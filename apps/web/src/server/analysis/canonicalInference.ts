/**
 * Canonical inference pass.
 *
 * Replaces the legacy `classifyResidualAttribution` step. Walks the classified
 * ledger events chronologically and persists:
 *   - `attribution_source_lots`: every inflow is a source lot tagged with the
 *     ledger classification (cash_in / swap / claim / liquidation / etc).
 *   - `attribution_states`: every outflow leg becomes a residual state. For
 *     outflows whose counterparty resolves to a known pool (via
 *     `protocol_contracts.metadata.poolId` / `.poolAddress`) the residual is
 *     stamped with that `poolId` so downstream consumers can attribute
 *     liquidity at the pool grain instead of wallet-wide.
 *   - `inferred_actions`: for `manual_deposit` / `strategy_deposit` events,
 *     runs the source-of-funds waterfall over each outflow leg and persists
 *     a canonical action (`rebalance_same_pool`, `redeploy_same_pool`,
 *     `new_capital_deposit`, `unknown_source_deposit`).
 *
 * The function intentionally does not try to detect cross-tx paired-swap
 * rebalance chains in this pass. It records the per-deposit waterfall
 * allocation; richer chain detection is a follow-up pass once the per-deposit
 * attribution is reliable end-to-end.
 */

import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { decodeFunctionData } from "viem";

import { getDb } from "@/server/db/client";
import {
  approvalLinks,
  assetMovements,
  attributionSourceLots,
  attributionStates,
  deposits,
  inferredActions,
  ledgerEvents,
  pools,
  protocolContracts,
  strategies,
} from "@/server/db/schema";
import { alchemyRpc } from "@/server/providers/alchemy/rpc";
import {
  allocateSourceOfFunds,
  classifyInferredDepositAction,
  type WaterfallAllocation,
  type WaterfallLotSourceType,
  type WaterfallResidualLot,
  type WaterfallSourceLot,
} from "@/server/analysis/sourceOfFundsWaterfall";

type ResidualConsumptionActionSummary = {
  actionType: "rebalance_same_pool" | "liquidation_from_residual" | "cash_out_from_residual";
  primaryPoolId: string | null;
  classificationBasis: "residual_flow";
  allocationBreakdown: Array<{ source: string; amount: bigint }>;
  candidatePoolResidualConsumedRaw: bigint;
  candidatePoolResidualShare: number | null;
  mixedFunding: boolean;
  excessAllocationBuckets: Array<{ source: string; amount: bigint }>;
  counterpartyPoolId: string | null;
  sourcePoolBreakdown: Array<{ poolId: string; amount: bigint }>;
};

const erc721ApproveAbi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

function normalizeAddress(value: unknown): string | null {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value) ? value.toLowerCase() : null;
}

type RunInput = {
  walletAddress: string;
  chainId: number;
  txHashes: string[];
  runId: string;
};

type LoadedEvent = {
  ledgerEventId: string;
  txHash: string;
  classification: string | null;
  occurredAt: Date;
  fromAddress: string | null;
  toAddress: string | null;
  counterpartyAddress: string | null;
  candidatePoolId: string | null;
  candidateDepositId: string | null;
  candidateStrategyId: string | null;
  movements: Array<{
    id: string;
    tokenAddress: string;
    directionIn: boolean;
    amountRaw: string;
    amountUsd: string | null;
    metadataJson: Record<string, unknown>;
  }>;
};

function asString(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function safeBigInt(value: string | null | undefined): bigint {
  if (!value) return 0n;
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}

function mapClassificationToSourceType(classification: string | null): WaterfallLotSourceType {
  switch (classification) {
    case "cash_in":
      return "cash_in";
    case "swap":
      return "swap";
    case "claim":
      return "claim";
    case "manual_withdrawal":
      return "manual_withdrawal";
    case "strategy_withdraw":
      return "strategy_withdraw";
    case "unstake":
      return "unstake";
    default:
      return "other";
  }
}

function isInflowSourceLotClassification(classification: string | null): boolean {
  // Inflows from these classifications should be persisted as source lots
  // (capital arriving from outside the wallet's protocol residual state).
  return (
    classification === "cash_in" ||
    classification === "claim" ||
    classification === "airdrop"
  );
}

function isConsumingClassification(classification: string | null): boolean {
  return (
    classification === "manual_deposit" ||
    classification === "strategy_deposit" ||
    classification === "stake" ||
    classification === "swap" ||
    classification === "cash_out"
  );
}

function isResidualEmittingClassification(classification: string | null): boolean {
  return (
    classification === "manual_withdrawal" ||
    classification === "strategy_withdraw" ||
    classification === "unstake"
  );
}

export function summarizeResidualConsumptionAction(input: {
  classification: string | null;
  candidatePoolId: string | null;
  legAllocations: WaterfallAllocation[];
}): ResidualConsumptionActionSummary | null {
  if (input.classification !== "swap" && input.classification !== "cash_out") {
    return null;
  }

  const totals = new Map<string, bigint>();
  const residualByPool = new Map<string, bigint>();
  let grandTotal = 0n;

  for (const allocation of input.legAllocations) {
    for (const attribution of allocation.attributions) {
      totals.set(attribution.source, (totals.get(attribution.source) ?? 0n) + attribution.amount);
      grandTotal += attribution.amount;
      if (attribution.poolId) {
        residualByPool.set(
          attribution.poolId,
          (residualByPool.get(attribution.poolId) ?? 0n) + attribution.amount,
        );
      }
    }
  }

  if (grandTotal === 0n || residualByPool.size === 0) {
    return null;
  }

  const allocationBreakdown = [
    "candidate_pool_residual",
    "matching_cash_in",
    "liquidation_or_reward",
    "other_pool_residual",
    "unknown",
  ].flatMap((source) => {
    const amount = totals.get(source) ?? 0n;
    return amount > 0n ? [{ source, amount }] : [];
  });
  const candidatePoolResidualConsumedRaw = totals.get("candidate_pool_residual") ?? 0n;
  const candidatePoolResidualShare =
    grandTotal > 0n ? Number((candidatePoolResidualConsumedRaw * 10000n) / grandTotal) / 10000 : null;
  const excessAllocationBuckets = allocationBreakdown.filter(
    (entry) => entry.source !== "candidate_pool_residual",
  );
  const mixedFunding = candidatePoolResidualConsumedRaw > 0n && excessAllocationBuckets.length > 0;
  const sourcePoolBreakdown = Array.from(residualByPool.entries())
    .map(([poolId, amount]) => ({ poolId, amount }))
    .sort((left, right) => left.poolId.localeCompare(right.poolId));
  const primaryPoolId = sourcePoolBreakdown.length === 1 ? (sourcePoolBreakdown[0]?.poolId ?? null) : null;

  return {
    actionType:
      input.classification === "cash_out"
        ? "cash_out_from_residual"
        : candidatePoolResidualConsumedRaw > 0n
          ? "rebalance_same_pool"
          : "liquidation_from_residual",
    primaryPoolId,
    classificationBasis: "residual_flow",
    allocationBreakdown,
    candidatePoolResidualConsumedRaw,
    candidatePoolResidualShare,
    mixedFunding,
    excessAllocationBuckets,
    counterpartyPoolId: input.classification === "swap" ? input.candidatePoolId : null,
    sourcePoolBreakdown,
  };
}

export async function runCanonicalInference(input: RunInput): Promise<{
  sourceLotCount: number;
  residualStateCount: number;
  inferredActionCount: number;
}> {
  if (input.txHashes.length === 0) {
    return { sourceLotCount: 0, residualStateCount: 0, inferredActionCount: 0 };
  }

  const db = getDb();
  const walletAddress = input.walletAddress.toLowerCase();
  const txHashesLower = input.txHashes.map((txHash) => txHash.toLowerCase());

  // 1) Counterparty → pool / deposit / strategy resolution context.
  const [poolRows, protocolContractRows, depositRows, strategyRows] = await Promise.all([
    db
      .select({ id: pools.id, poolAddress: pools.poolAddress })
      .from(pools)
      .where(eq(pools.chainId, input.chainId)),
    db
      .select({
        address: protocolContracts.address,
        contractType: protocolContracts.contractType,
        metadataJson: protocolContracts.metadataJson,
      })
      .from(protocolContracts)
      .where(eq(protocolContracts.chainId, input.chainId)),
    db
      .select({
        id: deposits.id,
        positionManagerAddress: deposits.positionManagerAddress,
        poolId: deposits.poolId,
      })
      .from(deposits)
      .where(and(eq(deposits.walletAddress, walletAddress), eq(deposits.chainId, input.chainId))),
    db
      .select({
        id: strategies.id,
        wrapperAddress: strategies.wrapperAddress,
        primaryPoolId: strategies.primaryPoolId,
      })
      .from(strategies)
      .where(eq(strategies.chainId, input.chainId)),
  ]);

  const poolIdByAddress = new Map(poolRows.map((row) => [row.poolAddress.toLowerCase(), row.id] as const));
  const contractPoolIdByAddress = new Map<string, string>();
  const protocolContractTypeByAddress = new Map<string, string>();
  for (const row of protocolContractRows) {
    const metadata = (row.metadataJson ?? {}) as Record<string, unknown>;
    const directPoolId = asString(metadata.poolId);
    const address = row.address.toLowerCase();
    protocolContractTypeByAddress.set(address, row.contractType);
    if (directPoolId) {
      contractPoolIdByAddress.set(address, directPoolId);
      continue;
    }
    const poolAddress = asString(metadata.poolAddress)?.toLowerCase();
    if (poolAddress && poolIdByAddress.has(poolAddress)) {
      contractPoolIdByAddress.set(address, poolIdByAddress.get(poolAddress) ?? "");
    }
  }

  const strategyByWrapper = new Map<string, { id: string; primaryPoolId: string | null }>();
  for (const row of strategyRows) {
    if (row.wrapperAddress) {
      strategyByWrapper.set(row.wrapperAddress.toLowerCase(), {
        id: row.id,
        primaryPoolId: row.primaryPoolId,
      });
    }
  }

  // Aerodrome deposits share a position manager + (later) a pool. Within a
  // single tx the most precise deposit cannot be resolved without the NFT
  // tokenId; we therefore fall back to deposit.poolId == counterparty pool
  // when uniquely resolvable, otherwise leave the depositId unset.
  const depositsByPoolId = new Map<string, Array<{ id: string; positionManagerAddress: string | null }>>();
  for (const row of depositRows) {
    if (!row.poolId) continue;
    const bucket = depositsByPoolId.get(row.poolId) ?? [];
    bucket.push({ id: row.id, positionManagerAddress: row.positionManagerAddress?.toLowerCase() ?? null });
    depositsByPoolId.set(row.poolId, bucket);
  }

  // 2) Load ledger events + movements for the targeted txs, in time order.
  const eventRows = await db
    .select({
      ledgerEventId: ledgerEvents.id,
      txHash: ledgerEvents.txHash,
      classification: ledgerEvents.classification,
      occurredAt: ledgerEvents.occurredAt,
      metadataJson: ledgerEvents.metadataJson,
    })
    .from(ledgerEvents)
    .where(
      and(
        eq(ledgerEvents.walletAddress, walletAddress),
        eq(ledgerEvents.chainId, input.chainId),
        inArray(ledgerEvents.txHash, txHashesLower),
      ),
    )
    .orderBy(asc(ledgerEvents.occurredAt));

  if (eventRows.length === 0) {
    return { sourceLotCount: 0, residualStateCount: 0, inferredActionCount: 0 };
  }

  const movementRows = await db
    .select({
      id: assetMovements.id,
      ledgerEventId: assetMovements.ledgerEventId,
      tokenAddress: assetMovements.tokenAddress,
      directionIn: assetMovements.directionIn,
      amountRaw: assetMovements.amountRaw,
      amountUsd: assetMovements.amountUsd,
      metadataJson: assetMovements.metadataJson,
    })
    .from(assetMovements)
    .where(
      and(
        eq(assetMovements.walletAddress, walletAddress),
        eq(assetMovements.chainId, input.chainId),
        inArray(
          assetMovements.ledgerEventId,
          eventRows.map((row) => row.ledgerEventId),
        ),
      ),
    );

  const movementsByEvent = new Map<string, LoadedEvent["movements"]>();
  for (const movement of movementRows) {
    if (!movement.ledgerEventId) continue;
    const list = movementsByEvent.get(movement.ledgerEventId) ?? [];
    list.push({
      id: movement.id,
      tokenAddress: movement.tokenAddress.toLowerCase(),
      directionIn: movement.directionIn,
      amountRaw: movement.amountRaw,
      amountUsd: movement.amountUsd,
      metadataJson: (movement.metadataJson ?? {}) as Record<string, unknown>,
    });
    movementsByEvent.set(movement.ledgerEventId, list);
  }

  const events: LoadedEvent[] = eventRows.map((row) => {
    const metadata = (row.metadataJson ?? {}) as Record<string, unknown>;
    const fromAddress = asString(metadata.fromAddress)?.toLowerCase() ?? null;
    const toAddress = asString(metadata.toAddress)?.toLowerCase() ?? null;
    const counterpartyAddress =
      fromAddress && fromAddress !== walletAddress
        ? fromAddress
        : toAddress && toAddress !== walletAddress
          ? toAddress
          : null;

    let candidatePoolId: string | null = null;
    let candidateDepositId: string | null = null;
    let candidateStrategyId: string | null = null;

    if (counterpartyAddress) {
      candidatePoolId = contractPoolIdByAddress.get(counterpartyAddress) ?? null;
      const strategyHit = strategyByWrapper.get(counterpartyAddress);
      if (strategyHit) {
        candidateStrategyId = strategyHit.id;
        candidatePoolId = candidatePoolId ?? strategyHit.primaryPoolId;
      }
      if (candidatePoolId) {
        const bucket = depositsByPoolId.get(candidatePoolId) ?? [];
        const positionManagerMatches = bucket.filter(
          (dep) => !dep.positionManagerAddress || dep.positionManagerAddress === counterpartyAddress,
        );
        if (positionManagerMatches.length === 1) {
          candidateDepositId = positionManagerMatches[0]?.id ?? null;
        }
      }
    }

    return {
      ledgerEventId: row.ledgerEventId,
      txHash: row.txHash,
      classification: row.classification,
      occurredAt: row.occurredAt,
      fromAddress,
      toAddress,
      counterpartyAddress,
      candidatePoolId,
      candidateDepositId,
      candidateStrategyId,
      movements: movementsByEvent.get(row.ledgerEventId) ?? [],
    };
  });

  // 3) Walk events chronologically, maintaining waterfall state.
  const residualLots: WaterfallResidualLot[] = [];
  const sourceLots: WaterfallSourceLot[] = [];

  // Cross-event bookkeeping for paired-swap rebalance detection. When a swap
  // input is funded from a pool's residual lot, we remember that pool against
  // the swap's ledger event id. Later, when a deposit consumes the swap's
  // output (matched via the source lot's `sourceLedgerEventId`), we can
  // recognise the full "withdraw → paired swap → redeploy same pool" pattern
  // even when the legs cross transaction boundaries.
  const swapInputPoolOrigins = new Map<string, Set<string>>();

  const sourceLotRowsToInsert: Array<typeof attributionSourceLots.$inferInsert> = [];
  const residualStateRowsToInsert: Array<typeof attributionStates.$inferInsert> = [];
  const inferredActionRowsToInsert: Array<typeof inferredActions.$inferInsert> = [];
  const approvalRowsToInsert: Array<typeof approvalLinks.$inferInsert> = [];

  for (const event of events) {
    // (a) Residual emission: outflows of withdrawal / unstake become pool-scoped residual lots.
    if (isResidualEmittingClassification(event.classification)) {
      for (const movement of event.movements) {
        if (movement.directionIn) continue;
        const amount = safeBigInt(movement.amountRaw);
        if (amount <= 0n) continue;
        const lotIdSeed = `${event.ledgerEventId}:${movement.tokenAddress}:${movement.id}`;
        residualLots.push({
          id: lotIdSeed,
          poolId: event.candidatePoolId,
          tokenAddress: movement.tokenAddress,
          amount,
          occurredAt: event.occurredAt,
          sourceLedgerEventId: event.ledgerEventId,
          sourceType: mapClassificationToSourceType(event.classification),
        });
        residualStateRowsToInsert.push({
          chainId: input.chainId,
          walletAddress,
          poolId: event.candidatePoolId,
          tokenAddress: movement.tokenAddress,
          sourceLedgerEventId: event.ledgerEventId,
          residualAmountRaw: movement.amountRaw,
          resolutionStatus: "still_waiting",
          metadataJson: {
            classification: event.classification,
            txHash: event.txHash,
            occurredAt: event.occurredAt.toISOString(),
            counterpartyAddress: event.counterpartyAddress,
            ...(movement.metadataJson ?? {}),
          },
        });
      }
    }

    // (b) Inflow source-lot emission for cash-in / claim / airdrop.
    if (isInflowSourceLotClassification(event.classification)) {
      for (const movement of event.movements) {
        if (!movement.directionIn) continue;
        const amount = safeBigInt(movement.amountRaw);
        if (amount <= 0n) continue;
        const lotIdSeed = `${event.ledgerEventId}:${movement.tokenAddress}:${movement.id}`;
        sourceLots.push({
          id: lotIdSeed,
          tokenAddress: movement.tokenAddress,
          amount,
          occurredAt: event.occurredAt,
          sourceLedgerEventId: event.ledgerEventId,
          sourceType: mapClassificationToSourceType(event.classification),
        });
        sourceLotRowsToInsert.push({
          chainId: input.chainId,
          walletAddress,
          tokenAddress: movement.tokenAddress,
          sourceType: event.classification ?? "other",
          sourceLedgerEventId: event.ledgerEventId,
          amountRaw: movement.amountRaw,
          metadataJson: {
            txHash: event.txHash,
            occurredAt: event.occurredAt.toISOString(),
            ...(movement.metadataJson ?? {}),
          },
        });
      }
    }

    // (c) Consumption + inferred-action emission for deposits / strategy_deposits / stake / swap.
    if (isConsumingClassification(event.classification)) {
      const legAllocations: WaterfallAllocation[] = [];
      for (const movement of event.movements) {
        if (movement.directionIn) continue;
        const amount = safeBigInt(movement.amountRaw);
        if (amount <= 0n) continue;
        const allocation = allocateSourceOfFunds({
          consumption: {
            consumingLedgerEventId: event.ledgerEventId,
            tokenAddress: movement.tokenAddress,
            amount,
            candidatePoolId: event.candidatePoolId,
            occurredAt: event.occurredAt,
          },
          residualLots,
          sourceLots,
        });
        legAllocations.push(allocation);
      }

      // Swap bookkeeping: remember which pools sourced this swap's input so
      // downstream deposits can recognise a paired-swap rebalance even when
      // the swap and the deposit are in different transactions.
      if (event.classification === "swap") {
        const consumedPools = new Set<string>();
        for (const allocation of legAllocations) {
          for (const attribution of allocation.attributions) {
            if (attribution.poolId) consumedPools.add(attribution.poolId);
          }
        }
        if (consumedPools.size > 0) {
          swapInputPoolOrigins.set(event.ledgerEventId, consumedPools);
        }
      }

      const residualConsumptionAction = summarizeResidualConsumptionAction({
        classification: event.classification,
        candidatePoolId: event.candidatePoolId,
        legAllocations,
      });
      if (residualConsumptionAction) {
        const consumingLedgerEventIds = new Set<string>();
        for (const allocation of legAllocations) {
          for (const attribution of allocation.attributions) {
            if (attribution.sourceLedgerEventId) {
              consumingLedgerEventIds.add(attribution.sourceLedgerEventId);
            }
          }
        }
        inferredActionRowsToInsert.push({
          chainId: input.chainId,
          walletAddress,
          actionType: residualConsumptionAction.actionType,
          occurredAt: event.occurredAt,
          primaryPoolId: residualConsumptionAction.primaryPoolId,
          depositId: null,
          strategyId: null,
          sourceLedgerEventId: event.ledgerEventId,
          sourceResidualLotId: null,
          consumingLedgerEventIdsJson: Array.from(consumingLedgerEventIds),
          valueUsd: null,
          confidence:
            residualConsumptionAction.actionType === "cash_out_from_residual"
              ? "medium"
              : residualConsumptionAction.mixedFunding
                ? "medium"
                : "high",
          latestRunId: input.runId,
          metadataJson: {
            txHash: event.txHash,
            counterpartyAddress: event.counterpartyAddress,
            classificationBasis: residualConsumptionAction.classificationBasis,
            allocationBreakdown: residualConsumptionAction.allocationBreakdown.map((entry) => ({
              source: entry.source,
              amount: entry.amount.toString(),
            })),
            candidatePoolResidualConsumedRaw:
              residualConsumptionAction.candidatePoolResidualConsumedRaw.toString(),
            candidatePoolResidualShare: residualConsumptionAction.candidatePoolResidualShare,
            mixedFunding: residualConsumptionAction.mixedFunding,
            excessAllocationBuckets: residualConsumptionAction.excessAllocationBuckets.map((entry) => ({
              source: entry.source,
              amount: entry.amount.toString(),
            })),
            counterpartyPoolId: residualConsumptionAction.counterpartyPoolId,
            sourcePoolBreakdown: residualConsumptionAction.sourcePoolBreakdown.map((entry) => ({
              poolId: entry.poolId,
              amount: entry.amount.toString(),
            })),
          },
        });
      }

      if (
        legAllocations.length > 0 &&
        (event.classification === "manual_deposit" || event.classification === "strategy_deposit")
      ) {
        // Paired-swap rebalance detection: a deposit on pool X is a
        // `rebalance_same_pool` when one of its funding attributions traces
        // back to a swap whose input was itself drawn from pool X residual.
        let pairedSwapConsumedCandidateResidual = false;
        if (event.candidatePoolId) {
          for (const allocation of legAllocations) {
            for (const attribution of allocation.attributions) {
              const swapEventId = attribution.sourceLedgerEventId;
              if (!swapEventId) continue;
              const swapPools = swapInputPoolOrigins.get(swapEventId);
              if (swapPools?.has(event.candidatePoolId)) {
                pairedSwapConsumedCandidateResidual = true;
                break;
              }
            }
            if (pairedSwapConsumedCandidateResidual) break;
          }
        }

        const action = classifyInferredDepositAction({
          targetPoolId: event.candidatePoolId ?? "unknown",
          legAllocations,
          pairedSwapConsumedCandidateResidual,
        });

        const consumingLedgerEventIds = new Set<string>();
        for (const allocation of legAllocations) {
          for (const attribution of allocation.attributions) {
            if (attribution.sourceLedgerEventId) {
              consumingLedgerEventIds.add(attribution.sourceLedgerEventId);
            }
          }
        }
        inferredActionRowsToInsert.push({
          chainId: input.chainId,
          walletAddress,
          actionType: action.actionType,
          occurredAt: event.occurredAt,
          primaryPoolId: event.candidatePoolId,
          depositId: event.candidateDepositId,
          strategyId: event.candidateStrategyId,
          sourceLedgerEventId: event.ledgerEventId,
          sourceResidualLotId: null,
          consumingLedgerEventIdsJson: Array.from(consumingLedgerEventIds),
          valueUsd: null,
          confidence: action.confidence,
          latestRunId: input.runId,
          metadataJson: {
            txHash: event.txHash,
            counterpartyAddress: event.counterpartyAddress,
            classificationBasis: action.classificationBasis,
            allocationBreakdown: action.allocationBreakdown.map((entry) => ({
              source: entry.source,
              amount: entry.amount.toString(),
            })),
            pairedSwapConsumedCandidateResidual: action.pairedSwapConsumedCandidateResidual,
            candidatePoolResidualConsumedRaw: action.candidatePoolResidualConsumedRaw.toString(),
            candidatePoolResidualShare: action.candidatePoolResidualShare,
            mixedFunding: action.mixedFunding,
            excessAllocationBuckets: action.excessAllocationBuckets.map((entry) => ({
              source: entry.source,
              amount: entry.amount.toString(),
            })),
            counterpartyPoolId: event.candidatePoolId,
            allocations: legAllocations.map((alloc) => ({
              tokenAddress: alloc.tokenAddress,
              totalRequested: alloc.totalRequested.toString(),
              unallocatedAmount: alloc.unallocatedAmount.toString(),
              attributions: alloc.attributions.map((attribution) => ({
                source: attribution.source,
                amount: attribution.amount.toString(),
                confidence: attribution.confidence,
                residualLotId: attribution.residualLotId,
                sourceLotId: attribution.sourceLotId,
                sourceLedgerEventId: attribution.sourceLedgerEventId,
                poolId: attribution.poolId,
              })),
            })),
          },
        });
      }

      // Swap outputs feed the residual inventory with a generic "swap" source
      // type. We persist them as source lots (not pool-scoped residuals) so
      // they can fund downstream deposits but do not pretend to be pool
      // residual liquidity themselves.
      if (event.classification === "swap") {
        for (const movement of event.movements) {
          if (!movement.directionIn) continue;
          const amount = safeBigInt(movement.amountRaw);
          if (amount <= 0n) continue;
          const lotIdSeed = `${event.ledgerEventId}:${movement.tokenAddress}:${movement.id}`;
          sourceLots.push({
            id: lotIdSeed,
            tokenAddress: movement.tokenAddress,
            amount,
            occurredAt: event.occurredAt,
            sourceLedgerEventId: event.ledgerEventId,
            sourceType: "swap",
          });
          sourceLotRowsToInsert.push({
            chainId: input.chainId,
            walletAddress,
            tokenAddress: movement.tokenAddress,
            sourceType: "swap",
            sourceLedgerEventId: event.ledgerEventId,
            amountRaw: movement.amountRaw,
            metadataJson: {
              txHash: event.txHash,
              occurredAt: event.occurredAt.toISOString(),
              ...(movement.metadataJson ?? {}),
            },
          });
        }
      }
    }

    // (d) Approval persistence is handled in a dedicated pre-pass below; the
    // walker only emits source/residual/inferred-action rows here. Earlier
    // versions tried to read approval data from asset_movements metadata, but
    // ERC-721 approves do not emit token movements so the only reliable signal
    // is the tx input itself, which is decoded once upfront via Alchemy.
  }

  // 3b) Approval pre-pass: decode every Aerodrome position-manager `approve`
  // event via Alchemy and persist the spender/tokenId/pool mapping into
  // `approval_links`. Done once in the engine so Overview/Pools can read
  // approvals directly without per-render RPC calls.
  const approveEvents = events.filter((event) => {
    if (event.classification !== "approve") return false;
    if (!event.counterpartyAddress) return false;
    const contractTypeRaw = protocolContractTypeByAddress.get(event.counterpartyAddress);
    if (!contractTypeRaw) return false;
    const contractType = contractTypeRaw.toLowerCase();
    return contractType.includes("position");
  });

  const decodedApprovals = await Promise.all(
    approveEvents.map(async (event) => {
      try {
        const tx = await alchemyRpc<{ input?: `0x${string}` | string | null }>(
          "eth_getTransactionByHash",
          [event.txHash],
          { chainId: input.chainId },
        );
        if (!tx?.input || tx.input === "0x") return null;
        const decoded = decodeFunctionData({
          abi: erc721ApproveAbi,
          data: tx.input as `0x${string}`,
        });
        const spenderAddress = normalizeAddress(decoded.args?.[0]);
        const tokenIdRaw = decoded.args?.[1];
        const tokenId = typeof tokenIdRaw === "bigint" ? tokenIdRaw.toString() : null;
        if (!spenderAddress || !tokenId) return null;
        return { event, spenderAddress, tokenId };
      } catch {
        return null;
      }
    }),
  );

  for (const decoded of decodedApprovals) {
    if (!decoded) continue;
    const { event, spenderAddress, tokenId } = decoded;
    const spenderInfo = strategyByWrapper.get(spenderAddress) ?? null;
    const spenderContractType = protocolContractTypeByAddress.get(spenderAddress) ?? null;
    const spenderPoolId =
      contractPoolIdByAddress.get(spenderAddress) ?? spenderInfo?.primaryPoolId ?? null;
    approvalRowsToInsert.push({
      chainId: input.chainId,
      walletAddress,
      txHash: event.txHash,
      logIndex: 0,
      occurredAt: event.occurredAt,
      tokenAddress: event.counterpartyAddress, // ERC-721 contract = position manager
      tokenId,
      spenderAddress,
      spenderContractType,
      relatedPoolId: spenderPoolId,
      relatedDepositId: null,
      sourceLedgerEventId: event.ledgerEventId,
      confidence: spenderPoolId ? "high" : "medium",
      latestRunId: input.runId,
      metadataJson: {
        txHash: event.txHash,
        positionManagerAddress: event.counterpartyAddress,
      },
    });
  }

  // 4) Persist accumulated rows. Each insert uses the table's unique key to
  // upsert (or noop). We persist in order: source lots → residual states →
  // inferred actions → approvals. Approvals and inferred_actions are scoped by
  // run via `latest_run_id` so reruns refresh authorship.

  // Reset residual states for the affected ledger events first; otherwise the
  // unique key (chain, wallet, pool, token, sourceLedgerEvent) would block
  // legitimate updates when a residual moves to a different pool on rerun.
  const consumedLedgerEventIds = events
    .filter((event) => isResidualEmittingClassification(event.classification))
    .map((event) => event.ledgerEventId);
  if (consumedLedgerEventIds.length > 0) {
    await db
      .delete(attributionStates)
      .where(
        and(
          eq(attributionStates.chainId, input.chainId),
          eq(attributionStates.walletAddress, walletAddress),
          inArray(attributionStates.sourceLedgerEventId, consumedLedgerEventIds),
        ),
      );
  }

  if (sourceLotRowsToInsert.length > 0) {
    // Postgres rejects `ON CONFLICT DO UPDATE` when a single statement tries
    // to affect the same conflict key twice. A ledger event can carry
    // multiple asset movements for the same token (e.g. a swap whose output
    // is split across two transfers), so we aggregate by
    // `(chainId, sourceLedgerEventId, tokenAddress)` before persisting.
    const sourceLotByKey = new Map<string, typeof attributionSourceLots.$inferInsert>();
    for (const row of sourceLotRowsToInsert) {
      const key = `${row.chainId}:${row.sourceLedgerEventId}:${row.tokenAddress.toLowerCase()}`;
      const existing = sourceLotByKey.get(key);
      if (!existing) {
        sourceLotByKey.set(key, row);
        continue;
      }
      const summedAmount = safeBigInt(existing.amountRaw) + safeBigInt(row.amountRaw);
      sourceLotByKey.set(key, {
        ...existing,
        amountRaw: summedAmount.toString(),
      });
    }

    await db
      .insert(attributionSourceLots)
      .values(Array.from(sourceLotByKey.values()))
      .onConflictDoUpdate({
        target: [
          attributionSourceLots.chainId,
          attributionSourceLots.sourceLedgerEventId,
          attributionSourceLots.tokenAddress,
        ],
        set: {
          sourceType: sql`excluded.source_type`,
          amountRaw: sql`excluded.amount_raw`,
          metadataJson: sql`excluded.metadata_json`,
        },
      });
  }

  if (residualStateRowsToInsert.length > 0) {
    await db.insert(attributionStates).values(residualStateRowsToInsert);
  }

  if (inferredActionRowsToInsert.length > 0) {
    await db
      .insert(inferredActions)
      .values(inferredActionRowsToInsert)
      .onConflictDoUpdate({
        target: [
          inferredActions.chainId,
          inferredActions.walletAddress,
          inferredActions.actionType,
          inferredActions.sourceLedgerEventId,
        ],
        set: {
          primaryPoolId: sql`excluded.primary_pool_id`,
          depositId: sql`excluded.deposit_id`,
          strategyId: sql`excluded.strategy_id`,
          sourceResidualLotId: sql`excluded.source_residual_lot_id`,
          consumingLedgerEventIdsJson: sql`excluded.consuming_ledger_event_ids_json`,
          valueUsd: sql`excluded.value_usd`,
          confidence: sql`excluded.confidence`,
          latestRunId: sql`excluded.latest_run_id`,
          metadataJson: sql`excluded.metadata_json`,
          updatedAt: new Date(),
        },
      });
  }

  if (approvalRowsToInsert.length > 0) {
    await db
      .insert(approvalLinks)
      .values(approvalRowsToInsert)
      .onConflictDoUpdate({
        target: [approvalLinks.chainId, approvalLinks.txHash, approvalLinks.logIndex],
        set: {
          occurredAt: sql`excluded.occurred_at`,
          tokenAddress: sql`excluded.token_address`,
          tokenId: sql`excluded.token_id`,
          spenderAddress: sql`excluded.spender_address`,
          spenderContractType: sql`excluded.spender_contract_type`,
          relatedPoolId: sql`excluded.related_pool_id`,
          relatedDepositId: sql`excluded.related_deposit_id`,
          sourceLedgerEventId: sql`excluded.source_ledger_event_id`,
          confidence: sql`excluded.confidence`,
          latestRunId: sql`excluded.latest_run_id`,
          metadataJson: sql`excluded.metadata_json`,
          updatedAt: new Date(),
        },
      });
  }

  return {
    sourceLotCount: sourceLotRowsToInsert.length,
    residualStateCount: residualStateRowsToInsert.length,
    inferredActionCount: inferredActionRowsToInsert.length,
  };
}
