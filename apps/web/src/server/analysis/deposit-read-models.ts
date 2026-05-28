/**
 * Materializes wallet-scoped deposit read models from analysis-engine output.
 *
 * 010-deposits-lifecycle T028 (MVP derivation):
 *   - Reads canonical `deposits` for (chainId, walletAddress).
 *   - Joins `pools` for label/token symbols/fee tier (via metadataJson).
 *   - Aggregates per-deposit capital flow from `pool_timeline_events`
 *     where `relatedDepositId = deposit.id` (`deposit` / `withdraw` / `close`).
 *   - Aggregates rewards from `reward_events` keyed by `depositOrStrategyId`.
 *   - Persists rows to `deposit_wallet_summaries`.
 *
 * Lifecycle events and performance decompositions are deferred to T048-T051
 * (US2) — this materializer only populates the list-level summary table that
 * the Phase-3 MVP UI needs.
 *
 * The reconciliation invariant `|totalReturn - (rewards + realized + unrealized)| <= 1e-9`
 * is enforced trivially here because we compute totalReturn as the sum.
 */

import { and, asc, eq, gte, inArray, lt, sql } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import {
  assetMovements,
  deposits,
  depositLifecycleEvents,
  depositPerformanceDecompositions,
  depositWalletSummaries,
  inferredActions,
  ledgerEvents,
  pools,
  pricePoints,
  protocolContracts,
  poolTimelineEvents,
  rewardEvents,
  strategies,
  strategyExposures,
} from "@/server/db/schema";

export type MaterializeDepositReadModelsInput = {
  runId: string;
  walletAddress: string;
  chainId: number;
  startDayUtc: string;
  endDayUtc: string;
  capturedAt: Date;
};

export type MaterializeDepositReadModelsResult = {
  summariesWritten: number;
  lifecycleEventsWritten: number;
  decompositionsWritten: number;
};

const READ_MODEL_INSERT_CHUNK_SIZE = 250;
const MS_PER_DAY = 86_400_000;
const BASE_WETH_ADDRESS = "0x4200000000000000000000000000000000000006";
const BASE_CBBTC_ADDRESS = "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf";
const BASE_AERO_ADDRESS = "0x940181a94a35a4569e4529a3cdfb74e38fd98631";
const BASE_USDC_ADDRESS = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const BASE_EURC_ADDRESS = "0x60a3e35cc302bfa44cb288bc5a4f316fdb1adb42";

const KNOWN_BASE_TOKEN_METADATA: Record<string, { address: string; decimals: number }> = {
  weth: { address: BASE_WETH_ADDRESS, decimals: 18 },
  eth: { address: BASE_WETH_ADDRESS, decimals: 18 },
  usdc: { address: BASE_USDC_ADDRESS, decimals: 6 },
  cbbtc: { address: BASE_CBBTC_ADDRESS, decimals: 8 },
  aero: { address: BASE_AERO_ADDRESS, decimals: 18 },
  eurc: { address: BASE_EURC_ADDRESS, decimals: 6 },
};

export async function chunkedInsert<TRow>(
  rows: TRow[],
  flush: (chunk: TRow[]) => Promise<void>,
  chunkSize: number = READ_MODEL_INSERT_CHUNK_SIZE,
) {
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    if (chunk.length > 0) {
      await flush(chunk);
    }
  }
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function asNullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asInteger(value: unknown): number | null {
  const parsed = asNullableNumber(value);
  return parsed === null ? null : Math.trunc(parsed);
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function normalizeTokenAddress(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value.toLowerCase() : null;
}

function normalizeTokenSymbol(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim().toLowerCase() : null;
}

function resolveKnownTokenDecimals(input: { tokenAddress: unknown; symbol: unknown }) {
  const normalizedAddress = normalizeTokenAddress(input.tokenAddress);
  if (normalizedAddress) {
    const byAddress = Object.values(KNOWN_BASE_TOKEN_METADATA).find((entry) => entry.address === normalizedAddress);
    if (byAddress) return byAddress.decimals;
  }

  const normalizedSymbol = normalizeTokenSymbol(input.symbol);
  return normalizedSymbol ? (KNOWN_BASE_TOKEN_METADATA[normalizedSymbol]?.decimals ?? null) : null;
}

function dayUtcFromDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function pricePointKey(tokenAddress: string, dayUtc: string) {
  return `${tokenAddress}:${dayUtc}`;
}

export function parseFeeTierBps(feeTierLabel: string | null): number | null {
  if (!feeTierLabel) return null;
  const match = /([0-9]+(?:\.[0-9]+)?)\s*%/.exec(feeTierLabel);
  if (!match) return null;
  const pct = Number(match[1]);
  if (!Number.isFinite(pct)) return null;
  return Math.round(pct * 10_000);
}

export function derivePositionLabel(input: {
  tokenSymbols: string[];
  feeTierLabel: string | null;
  poolKind: string;
  tokenId: string | null;
}): string {
  const pair = input.tokenSymbols.length > 0 ? input.tokenSymbols.join(" / ") : "Position";
  const segments: string[] = [pair];
  if (input.poolKind === "cl") segments.push("CL");
  if (input.feeTierLabel) segments.push(input.feeTierLabel);
  const idSuffix = input.tokenId ? ` #${input.tokenId}` : "";
  return `${segments.join(" · ")}${idSuffix}`;
}

export function derivePositionStatus(input: { rawStatus: string; isInRange: boolean | null }) {
  if (input.rawStatus === "closed") {
    return "closed" as const;
  }
  if (input.isInRange === false) {
    return "open_out_of_range" as const;
  }
  return "open_active" as const;
}

function normalizeCoverageStatus(value: string | null): "full" | "share_level" | "partial" | "unknown" {
  switch (value) {
    case "full":
    case "share_level":
    case "partial":
      return value;
    default:
      return "unknown";
  }
}

export function deriveConfidence(input: {
  coverageStatus: "full" | "share_level" | "partial" | "unknown";
  openedByTransferIn: boolean;
}): "high" | "medium" | "degraded" | "unknown" {
  if (input.openedByTransferIn) return "degraded";
  if (input.coverageStatus === "full") return "high";
  if (input.coverageStatus === "share_level") return "medium";
  if (input.coverageStatus === "partial") return "degraded";
  return "unknown";
}

export function deriveCoverageReasonCodes(input: {
  openedByTransferIn: boolean;
  coverageStatus: "full" | "share_level" | "partial" | "unknown";
}): string[] {
  const codes: string[] = [];
  if (input.openedByTransferIn) codes.push("transferInOrigin");
  if (input.coverageStatus === "partial") codes.push("unattributedResidual");
  return codes;
}

type DepositRow = typeof deposits.$inferSelect;
type PoolRow = typeof pools.$inferSelect;

type DepositTimelineAggregate = {
  capitalEnteredUsd: number;
  capitalWithdrawnUsd: number;
  openedAt: Date | null;
  closedAt: Date | null;
  openedValueUsd: number;
  openedByTransferIn: boolean;
};

type PricedMovement = {
  tokenAddress: string;
  directionIn: boolean;
  amountRaw: string;
  amountUsd: number | null;
  symbol: string | null;
};

type RewardLikeRow = {
  id: string;
  depositOrStrategyId: string | null;
  txHash: string;
  logIndex: number;
  rewardType: string;
  tokenAddress: string | null;
  amountRaw: string;
  occurredAt: Date;
  resolutionStatus: string | null;
  metadataJson: Record<string, unknown>;
  symbol: string | null;
  resolvedAmountUsd: number;
  priceSource: "event" | "pricePointFallback" | "unavailable" | null;
  reasonCodes: string[];
  resolvedTokenDeltas: Array<{
    tokenAddress: string | null;
    symbol: string | null;
    direction: string;
    amountRaw: string;
    amountFormatted: string | null;
    usdValue: number | null;
    priceSource: string | null;
  }>;
};

type DepositTimelineRow = {
  id: string;
  relatedDepositId: string | null;
  eventType: string;
  occurredAt: Date;
  sourceLedgerEventId: string | null;
  confidence: string | null;
  coverageStatus: string | null;
  attributedValueUsd: unknown;
  metadataJson: Record<string, unknown> | null;
};

type LifecycleLedgerRow = {
  txHash: string;
  logIndex: number;
  metadataJson: unknown;
};

function buildEmptyAggregate(): DepositTimelineAggregate {
  return {
    capitalEnteredUsd: 0,
    capitalWithdrawnUsd: 0,
    openedAt: null,
    closedAt: null,
    openedValueUsd: 0,
    openedByTransferIn: false,
  };
}

function summarizeSingleTokenMovements(movements: PricedMovement[]) {
  const tokenAddresses = Array.from(new Set(movements.map((movement) => movement.tokenAddress)));
  if (tokenAddresses.length !== 1) {
    return {
      tokenAddress: null,
      amountRaw: null,
      symbol: null,
    };
  }

  const [tokenAddress] = tokenAddresses;
  const amountRaw = movements
    .filter((movement) => movement.tokenAddress === tokenAddress)
    .reduce((total, movement) => total + BigInt(movement.amountRaw), 0n)
    .toString();

  return {
    tokenAddress,
    amountRaw,
    symbol: movements.find((movement) => movement.tokenAddress === tokenAddress)?.symbol ?? null,
  };
}

export function resolveMintValuationUsd(input: {
  deposit: DepositRow;
  mintLedgerEventByTxHash: Map<string, { id: string; occurredAt: Date }>;
  movementsByLedgerEventId: Map<string, Array<{ tokenAddress: string; amountRaw: string; symbol: string | null }>>;
  priceByTokenDay: Map<string, number>;
}) {
  const mintTxHash = typeof input.deposit.mintTxHash === "string" ? input.deposit.mintTxHash.toLowerCase() : null;
  if (!mintTxHash) return null;

  const ledgerEvent = input.mintLedgerEventByTxHash.get(mintTxHash);
  if (!ledgerEvent) return null;

  const movements = input.movementsByLedgerEventId.get(ledgerEvent.id) ?? [];
  if (movements.length === 0) return null;

  const dayUtc = dayUtcFromDate(ledgerEvent.occurredAt);
  let total = 0;

  for (const movement of movements) {
    const decimals = resolveKnownTokenDecimals({
      tokenAddress: movement.tokenAddress,
      symbol: movement.symbol,
    });
    if (decimals === null) return null;

    const priceUsd = input.priceByTokenDay.get(pricePointKey(movement.tokenAddress, dayUtc));
    if (priceUsd === undefined) return null;

    total += (Number(movement.amountRaw) / 10 ** decimals) * priceUsd;
  }

  return total > 0 ? total : null;
}

export function normalizeDepositConfidence(value: unknown): "high" | "medium" | "degraded" | "unknown" {
  switch (value) {
    case "high":
    case "medium":
    case "degraded":
      return value;
    default:
      return "unknown";
  }
}

function resolveBlockNumber(metadataJson: unknown) {
  const metadata = asRecord(metadataJson);
  return asInteger(metadata.blockNumber) ?? asInteger(metadata.block_number) ?? 0;
}

function mergeReasonCodes(...values: Array<string[]>) {
  return Array.from(new Set(values.flatMap((value) => value)));
}

export function deriveTimelineCoverageReasonCodes(input: {
  valuationReasonCodes: string[];
  coverageStatus: string | null | undefined;
  confidence: unknown;
  openedByTransferIn?: boolean;
}) {
  return mergeReasonCodes(
    input.valuationReasonCodes,
    input.openedByTransferIn ? ["transferInOrigin"] : [],
    input.coverageStatus === "partial" ? ["coverageGap"] : [],
    normalizeDepositConfidence(input.confidence) === "degraded" ? ["lowConfidenceClassification"] : [],
  );
}

function formatAmountRaw(input: { amountRaw: string; tokenAddress: string | null; symbol: string | null }) {
  const decimals = resolveKnownTokenDecimals({ tokenAddress: input.tokenAddress, symbol: input.symbol });
  if (decimals === null) return null;
  const scaled = Number(input.amountRaw) / 10 ** decimals;
  return Number.isFinite(scaled) ? String(scaled) : null;
}

export function resolveUsdValuation(input: {
  occurredAt: Date;
  tokenAddress: string | null;
  symbol: string | null;
  amountRaw: string;
  directAmountUsd: number | null;
  priceByTokenDay: Map<string, number>;
}) {
  if (input.directAmountUsd !== null) {
    return {
      usdValue: input.directAmountUsd,
      priceSource: "event" as const,
      reasonCodes: [] as string[],
    };
  }

  const decimals = resolveKnownTokenDecimals({
    tokenAddress: input.tokenAddress,
    symbol: input.symbol,
  });

  if (decimals === null || !input.tokenAddress) {
    return {
      usdValue: null,
      priceSource: "unavailable" as const,
      reasonCodes: ["priceUnavailable"],
    };
  }

  const priceUsd = input.priceByTokenDay.get(pricePointKey(input.tokenAddress, dayUtcFromDate(input.occurredAt)));
  if (priceUsd === undefined) {
    return {
      usdValue: null,
      priceSource: "unavailable" as const,
      reasonCodes: ["priceUnavailable"],
    };
  }

  return {
    usdValue: (Number(input.amountRaw) / 10 ** decimals) * priceUsd,
    priceSource: "pricePointFallback" as const,
    reasonCodes: ["priceFallbackDca"],
  };
}

export function buildSignedTokenDeltas(input: {
  occurredAt: Date;
  movements: Array<{
    tokenAddress: string;
    directionIn: boolean;
    amountRaw: string;
    amountUsd: number | null;
    symbol: string | null;
  }>;
  priceByTokenDay: Map<string, number>;
}) {
  let signedUsdTotal = 0;
  const reasonCodes: string[] = [];
  let eventPriceSource: "event" | "pricePointFallback" | "unavailable" | null = null;

  const deltas = input.movements.map((movement) => {
    const resolved = resolveUsdValuation({
      occurredAt: input.occurredAt,
      tokenAddress: movement.tokenAddress,
      symbol: movement.symbol,
      amountRaw: movement.amountRaw,
      directAmountUsd: movement.amountUsd,
      priceByTokenDay: input.priceByTokenDay,
    });

    reasonCodes.push(...resolved.reasonCodes);
    if (resolved.priceSource === "unavailable") {
      eventPriceSource = "unavailable";
    } else if (resolved.priceSource === "pricePointFallback" && eventPriceSource !== "unavailable") {
      eventPriceSource = "pricePointFallback";
    } else if (!eventPriceSource) {
      eventPriceSource = resolved.priceSource;
    }

    if (resolved.usdValue !== null) {
      signedUsdTotal += movement.directionIn ? resolved.usdValue : -resolved.usdValue;
    }

    return {
      tokenAddress: movement.tokenAddress,
      symbol: movement.symbol,
      direction: movement.directionIn ? "in" : "out",
      amountRaw: movement.amountRaw,
      amountFormatted: formatAmountRaw({
        amountRaw: movement.amountRaw,
        tokenAddress: movement.tokenAddress,
        symbol: movement.symbol,
      }),
      usdValue: resolved.usdValue,
      priceSource: resolved.priceSource,
    };
  });

  return {
    signedUsdTotal,
    deltas,
    reasonCodes: mergeReasonCodes(reasonCodes),
    eventPriceSource,
  };
}

export function buildDepositReadModelRows(input: {
  runId: string;
  walletAddress: string;
  chainId: number;
  startDayUtc: string;
  endDayUtc: string;
  capturedAt: Date;
  eligibleDeposits: Array<DepositRow & { poolId: string }>;
  poolById: Map<string, PoolRow>;
  aggregates: Map<string, DepositTimelineAggregate>;
  rewardsByDepositId: Map<string, number>;
  mintLedgerEventByTxHash: Map<string, { id: string; occurredAt: Date }>;
  mintOutflowsByLedgerEventId: Map<string, Array<{ tokenAddress: string; amountRaw: string; symbol: string | null }>>;
  priceByTokenDay: Map<string, number>;
  timelineRows: DepositTimelineRow[];
  lifecycleLedgerById: Map<string, LifecycleLedgerRow>;
  pricedLifecycleMovements: Map<string, PricedMovement[]>;
  inferredActionIdByLedgerEventId: Map<string, string>;
  strategyIdByPoolId: Map<string, string>;
  resolvedRewardRows: RewardLikeRow[];
}) {
  const lifecycleRowsToInsert: Array<typeof depositLifecycleEvents.$inferInsert> = [];
  const decompositionRowsToInsert: Array<typeof depositPerformanceDecompositions.$inferInsert> = [];

  const summaryRows = input.eligibleDeposits.map((deposit) => {
    const pool = input.poolById.get(deposit.poolId);
    const depositMetadata = asRecord(deposit.metadataJson);
    const depositRuntimeMetadata = asRecord(depositMetadata.metadata);
    const poolMetadata = (pool?.metadataJson as Record<string, unknown> | undefined) ?? {};
    const mintTxHash = typeof deposit.mintTxHash === "string" ? deposit.mintTxHash.toLowerCase() : null;
    const tokenSymbols = [
      asString(depositMetadata.primaryTokenSymbol),
      asString(depositMetadata.secondaryTokenSymbol),
    ].filter((value): value is string => Boolean(value));
    const resolvedTokenSymbols = tokenSymbols.length > 0 ? tokenSymbols : asStringArray(poolMetadata.tokenSymbols);
    const feeTierLabel = asString(depositRuntimeMetadata.feeTierLabel) ?? asString(poolMetadata.feeTierLabel);
    const poolKind = asString(poolMetadata.poolType) ?? "cl";
    const aggregate = input.aggregates.get(deposit.id) ?? buildEmptyAggregate();
    const rewards = input.rewardsByDepositId.get(deposit.id) ?? 0;
    const currentValueFromMetadataUsd = asNullableNumber(depositMetadata.valueUsd);
    const isInRange = asBoolean(depositRuntimeMetadata.isInRange);
    const openedValueUsd = resolveMintValuationUsd({
      deposit,
      mintLedgerEventByTxHash: input.mintLedgerEventByTxHash,
      movementsByLedgerEventId: input.mintOutflowsByLedgerEventId,
      priceByTokenDay: input.priceByTokenDay,
    }) ?? aggregate.openedValueUsd;
    const status = derivePositionStatus({ rawStatus: deposit.status, isInRange });
    const coverageStatus = normalizeCoverageStatus(deposit.coverageStatus);

    const capitalEntered = openedValueUsd > 0 ? openedValueUsd : aggregate.capitalEnteredUsd;
    const closedWithoutWithdrawalEvent =
      status === "closed" && aggregate.capitalWithdrawnUsd === 0 && capitalEntered > 0;
    const capitalWithdrawn = closedWithoutWithdrawalEvent
      ? capitalEntered
      : aggregate.capitalWithdrawnUsd;
    const netInvested = Math.max(capitalEntered - capitalWithdrawn, 0);
    const currentValueUsd = status === "closed" ? 0 : (currentValueFromMetadataUsd ?? netInvested);

    const realizedPnlUsd = status === "closed" ? capitalWithdrawn - capitalEntered : 0;
    const unrealizedPnlUsd = status === "closed" ? 0 : currentValueUsd - netInvested;
    const totalReturnUsd = rewards + realizedPnlUsd + unrealizedPnlUsd;
    const totalReturnPct = capitalEntered > 0 ? totalReturnUsd / capitalEntered : null;

    let estimatedAnnualizedReturnPct: number | null = null;
    if (aggregate.openedAt && totalReturnPct !== null) {
      const endRef = aggregate.closedAt ?? input.capturedAt;
      const days = Math.max(1, Math.round((endRef.getTime() - aggregate.openedAt.getTime()) / MS_PER_DAY));
      estimatedAnnualizedReturnPct = totalReturnPct * (365 / days);
    }

    const positionLabel = derivePositionLabel({
      tokenSymbols: resolvedTokenSymbols,
      feeTierLabel,
      poolKind,
      tokenId: deposit.tokenId,
    });

    const openingTimelineRow = input.timelineRows.find((row) => row.relatedDepositId === deposit.id && (
      row.eventType === "deposit" || row.eventType === "rebalance" || row.eventType === "redeploy"
    ));
    const openingLedgerEvent = mintTxHash ? input.mintLedgerEventByTxHash.get(mintTxHash) : null;
    const lifecycleCandidates: Array<{
      occurredAt: Date;
      logIndex: number;
      eventType: string;
      txHash: string;
      blockNumber: number;
      usdValue: number | null;
      signedTokenDeltas: unknown[];
      priceSource: "event" | "pricePointFallback" | "unavailable" | null;
      confidence: "high" | "medium" | "degraded" | "unknown";
      inferredActionId: string | null;
      coverageReasonCodes: string[];
      metadataJson: Record<string, unknown>;
    }> = [];

    if (openingLedgerEvent) {
      const openingMovements = input.pricedLifecycleMovements.get(openingLedgerEvent.id) ?? [];
      const openingDeltas = buildSignedTokenDeltas({
        occurredAt: openingLedgerEvent.occurredAt,
        movements: openingMovements,
        priceByTokenDay: input.priceByTokenDay,
      });
      lifecycleCandidates.push({
        occurredAt: openingLedgerEvent.occurredAt,
        logIndex: 0,
        eventType: aggregate.openedByTransferIn ? "transfer_in" : "mint_position",
        txHash: mintTxHash ?? "unknown",
        blockNumber: 0,
        usdValue: openingDeltas.signedUsdTotal,
        signedTokenDeltas: openingDeltas.deltas,
        priceSource: openingDeltas.eventPriceSource,
        confidence: normalizeDepositConfidence(aggregate.openedByTransferIn ? "degraded" : coverageStatus === "full" ? "high" : "medium"),
        inferredActionId: null,
        coverageReasonCodes: mergeReasonCodes(openingDeltas.reasonCodes, aggregate.openedByTransferIn ? ["transferInOrigin"] : []),
        metadataJson: {
          source: "mint_ledger_event",
        },
      });
    } else if (openingTimelineRow) {
      const ledgerEvent = openingTimelineRow.sourceLedgerEventId ? input.lifecycleLedgerById.get(openingTimelineRow.sourceLedgerEventId) : null;
      const openingMovements = openingTimelineRow.sourceLedgerEventId
        ? (input.pricedLifecycleMovements.get(openingTimelineRow.sourceLedgerEventId) ?? [])
        : [];
      const openingDeltas = buildSignedTokenDeltas({
        occurredAt: openingTimelineRow.occurredAt,
        movements: openingMovements,
        priceByTokenDay: input.priceByTokenDay,
      });
      lifecycleCandidates.push({
        occurredAt: openingTimelineRow.occurredAt,
        logIndex: ledgerEvent?.logIndex ?? 0,
        eventType: aggregate.openedByTransferIn ? "transfer_in" : "mint_position",
        txHash: ledgerEvent?.txHash ?? "unknown",
        blockNumber: resolveBlockNumber(ledgerEvent?.metadataJson),
        usdValue: openingDeltas.signedUsdTotal !== 0 ? openingDeltas.signedUsdTotal : asNullableNumber(openingTimelineRow.attributedValueUsd),
        signedTokenDeltas: openingDeltas.deltas,
        priceSource: openingDeltas.eventPriceSource,
        confidence: normalizeDepositConfidence(openingTimelineRow.confidence),
        inferredActionId: openingTimelineRow.sourceLedgerEventId ? (input.inferredActionIdByLedgerEventId.get(openingTimelineRow.sourceLedgerEventId) ?? null) : null,
        coverageReasonCodes: deriveTimelineCoverageReasonCodes({
          valuationReasonCodes: openingDeltas.reasonCodes,
          coverageStatus: openingTimelineRow.coverageStatus,
          confidence: openingTimelineRow.confidence,
          openedByTransferIn: aggregate.openedByTransferIn,
        }),
        metadataJson: {
          source: "timeline_opening_event",
          timelineEventType: openingTimelineRow.eventType,
        },
      });
    }

    const depositTimelineRows = input.timelineRows.filter((row) => row.relatedDepositId === deposit.id);
    for (const row of depositTimelineRows) {
      const isOpeningEvent = row === openingTimelineRow;
      if (isOpeningEvent && openingLedgerEvent) {
        continue;
      }

      const eventType = mapTimelineEventToLifecycleType({
        rawEventType: row.eventType,
        isOpeningEvent,
        openedByTransferIn: aggregate.openedByTransferIn,
      });
      if (!eventType) continue;

      const ledgerEvent = row.sourceLedgerEventId ? input.lifecycleLedgerById.get(row.sourceLedgerEventId) : null;
      const movements = row.sourceLedgerEventId ? (input.pricedLifecycleMovements.get(row.sourceLedgerEventId) ?? []) : [];
      const eventDeltas = buildSignedTokenDeltas({
        occurredAt: row.occurredAt,
        movements,
        priceByTokenDay: input.priceByTokenDay,
      });

      lifecycleCandidates.push({
        occurredAt: row.occurredAt,
        logIndex: ledgerEvent?.logIndex ?? 0,
        eventType,
        txHash: ledgerEvent?.txHash ?? "unknown",
        blockNumber: resolveBlockNumber(ledgerEvent?.metadataJson),
        usdValue: eventDeltas.signedUsdTotal !== 0 ? eventDeltas.signedUsdTotal : asNullableNumber(row.attributedValueUsd),
        signedTokenDeltas: eventDeltas.deltas,
        priceSource: eventDeltas.eventPriceSource,
        confidence: normalizeDepositConfidence(row.confidence),
        inferredActionId: row.sourceLedgerEventId ? (input.inferredActionIdByLedgerEventId.get(row.sourceLedgerEventId) ?? null) : null,
        coverageReasonCodes: deriveTimelineCoverageReasonCodes({
          valuationReasonCodes: eventDeltas.reasonCodes,
          coverageStatus: row.coverageStatus,
          confidence: row.confidence,
        }),
        metadataJson: {
          source: "pool_timeline_event",
          timelineEventType: row.eventType,
          timelineEventId: row.id,
        },
      });
    }

    const depositRewardRows = input.resolvedRewardRows.filter((row) => row.depositOrStrategyId === deposit.id);
    for (const row of depositRewardRows) {
      lifecycleCandidates.push({
        occurredAt: row.occurredAt,
        logIndex: row.logIndex,
        eventType: "claim_reward",
        txHash: row.txHash,
        blockNumber: asInteger(asRecord(row.metadataJson).blockNumber) ?? 0,
        usdValue: row.resolvedAmountUsd,
        signedTokenDeltas: row.resolvedTokenDeltas,
        priceSource: row.priceSource,
        confidence: normalizeDepositConfidence(row.reasonCodes.length > 0 ? "degraded" : "high"),
        inferredActionId: null,
        coverageReasonCodes: row.reasonCodes,
        metadataJson: {
          source: "reward_event",
          rewardEventId: row.id,
          rewardType: row.rewardType,
          resolutionStatus: row.resolutionStatus,
        },
      });
    }

    lifecycleCandidates.sort((left, right) => {
      const timeDelta = left.occurredAt.getTime() - right.occurredAt.getTime();
      if (timeDelta !== 0) return timeDelta;
      return left.logIndex - right.logIndex;
    });

    const lifecycleReasonCodes = mergeReasonCodes(...lifecycleCandidates.map((candidate) => candidate.coverageReasonCodes));

    lifecycleCandidates.forEach((candidate, index) => {
      lifecycleRowsToInsert.push({
        chainId: input.chainId,
        walletAddress: input.walletAddress,
        depositId: deposit.id,
        sequenceIndex: index + 1,
        latestRunId: input.runId,
        eventType: candidate.eventType,
        occurredAt: candidate.occurredAt,
        txHash: candidate.txHash,
        logIndex: candidate.logIndex,
        blockNumber: candidate.blockNumber,
        usdValue: candidate.usdValue !== null ? String(candidate.usdValue) : null,
        signedTokenDeltas: candidate.signedTokenDeltas,
        priceSource: candidate.priceSource,
        confidence: candidate.confidence,
        inferredActionId: candidate.inferredActionId,
        coverageReasonCodes: candidate.coverageReasonCodes,
        metadataJson: candidate.metadataJson,
      });
    });

    const baseReasonCodes = deriveCoverageReasonCodes({
      coverageStatus,
      openedByTransferIn: aggregate.openedByTransferIn,
    });
    if (poolKind === "cl" && status !== "closed" && isInRange === null) {
      baseReasonCodes.push("rangeUnavailable");
    }

    const reasonCodes = mergeReasonCodes(baseReasonCodes, lifecycleReasonCodes);
    const finalCoverageStatus = reasonCodes.length > 0 && coverageStatus === "full"
      ? "partial"
      : coverageStatus;
    const confidence = deriveConfidence({
      coverageStatus: finalCoverageStatus,
      openedByTransferIn: aggregate.openedByTransferIn,
    });

    const rewardsUsd = rewards;
    const feesUsd = 0;
    const assetPriceEffectUsd = 0;
    const rebalanceEffectUsd = 0;
    const unattributedUsd = totalReturnUsd - (
      rewardsUsd +
      feesUsd +
      assetPriceEffectUsd +
      rebalanceEffectUsd +
      realizedPnlUsd +
      unrealizedPnlUsd
    );
    const unattributedReasonCodes = Math.abs(unattributedUsd) > 1e-9
      ? mergeReasonCodes(reasonCodes, ["unattributedResidual"])
      : reasonCodes;
    const denominator = totalReturnUsd === 0 ? null : totalReturnUsd;

    decompositionRowsToInsert.push({
      chainId: input.chainId,
      walletAddress: input.walletAddress,
      depositId: deposit.id,
      latestRunId: input.runId,
      totalReturnUsd: String(totalReturnUsd),
      rewardsUsd: String(rewardsUsd),
      feesUsd: String(feesUsd),
      assetPriceEffectUsd: String(assetPriceEffectUsd),
      rebalanceEffectUsd: String(rebalanceEffectUsd),
      realizedPnlUsd: String(realizedPnlUsd),
      unrealizedPnlUsd: String(unrealizedPnlUsd),
      unattributedUsd: String(unattributedUsd),
      unattributedReasonCodes,
      componentPercentages: denominator === null
        ? {}
        : {
            rewardsUsd: rewardsUsd / denominator,
            feesUsd: feesUsd / denominator,
            assetPriceEffectUsd: assetPriceEffectUsd / denominator,
            rebalanceEffectUsd: rebalanceEffectUsd / denominator,
            realizedPnlUsd: realizedPnlUsd / denominator,
            unrealizedPnlUsd: unrealizedPnlUsd / denominator,
            unattributedUsd: unattributedUsd / denominator,
          },
    });

    return {
      chainId: input.chainId,
      walletAddress: input.walletAddress,
      depositId: deposit.id,
      poolId: deposit.poolId,
      latestRunId: input.runId,
      positionLabel,
      poolKind,
      feeTierBps: parseFeeTierBps(feeTierLabel),
      tokenId: deposit.tokenId,
      token0Address: pool?.token0Address ?? null,
      token0Symbol: resolvedTokenSymbols[0] ?? null,
      token1Address: pool?.token1Address ?? null,
      token1Symbol: resolvedTokenSymbols[1] ?? null,
      status,
      openedAt: aggregate.openedAt,
      closedAt:
        aggregate.closedAt ??
        (status === "closed" ? (deposit.updatedAt instanceof Date ? deposit.updatedAt : null) : null),
      openedByTransferIn: aggregate.openedByTransferIn,
      openedValueUsd: openedValueUsd.toString(),
      currentValueUsd: currentValueUsd.toString(),
      capitalEnteredUsd: capitalEntered.toString(),
      capitalWithdrawnUsd: capitalWithdrawn.toString(),
      totalRewardsUsd: rewards.toString(),
      realizedPnlUsd: realizedPnlUsd.toString(),
      unrealizedPnlUsd: unrealizedPnlUsd.toString(),
      totalReturnUsd: totalReturnUsd.toString(),
      totalReturnPct: totalReturnPct !== null ? totalReturnPct.toString() : null,
      estimatedAnnualizedReturnPct:
        estimatedAnnualizedReturnPct !== null ? estimatedAnnualizedReturnPct.toString() : null,
      tickLower: asInteger(depositRuntimeMetadata.rangeLowerTick),
      tickUpper: asInteger(depositRuntimeMetadata.rangeUpperTick),
      rangeLowerPrice:
        asNullableNumber(depositRuntimeMetadata.rangeLowerPrice) !== null
          ? String(asNullableNumber(depositRuntimeMetadata.rangeLowerPrice))
          : null,
      rangeUpperPrice:
        asNullableNumber(depositRuntimeMetadata.rangeUpperPrice) !== null
          ? String(asNullableNumber(depositRuntimeMetadata.rangeUpperPrice))
          : null,
      isInRange: status === "closed" ? null : isInRange,
      coverageStatus: finalCoverageStatus,
      confidence,
      coverageReasonCodes: reasonCodes,
      coveredStartDayUtc: input.startDayUtc,
      coveredEndDayUtc: input.endDayUtc,
      mellowStrategyCrossLinkId: input.strategyIdByPoolId.get(deposit.poolId) ?? null,
      metadataJson: {
        materializerVersion: "010-detail-1",
      } as Record<string, unknown>,
    };
  });

  return {
    summaryRows,
    lifecycleRowsToInsert,
    decompositionRowsToInsert,
  };
}

export function mapTimelineEventToLifecycleType(input: {
  rawEventType: string;
  isOpeningEvent: boolean;
  openedByTransferIn: boolean;
}) {
  if (input.isOpeningEvent) {
    return input.openedByTransferIn ? "transfer_in" as const : "mint_position" as const;
  }

  switch (input.rawEventType) {
    case "deposit":
    case "rebalance":
    case "redeploy":
      return "increase_liquidity" as const;
    case "withdraw":
    case "partial_swap_attribution":
      return "withdraw" as const;
    case "close":
      return "close" as const;
    default:
      return null;
  }
}

export function buildStrategyIdByPoolId(rows: Array<{ strategyId: string; primaryPoolId: string | null }>) {
  const strategyIdByPoolId = new Map<string, string>();
  for (const row of rows) {
    if (row.primaryPoolId && !strategyIdByPoolId.has(row.primaryPoolId)) {
      strategyIdByPoolId.set(row.primaryPoolId, row.strategyId);
    }
  }
  return strategyIdByPoolId;
}

export async function materializeDepositReadModels(
  input: MaterializeDepositReadModelsInput,
): Promise<MaterializeDepositReadModelsResult> {
  const db = await getDb();

  const walletScope = and(
    eq(depositWalletSummaries.chainId, input.chainId),
    eq(depositWalletSummaries.walletAddress, input.walletAddress),
  );

  // Purge previous run's read models for this wallet scope before re-materializing.
  // FK-safe order: lifecycle + decompositions THEN summaries.
  await db
    .delete(depositLifecycleEvents)
    .where(
      and(
        eq(depositLifecycleEvents.chainId, input.chainId),
        eq(depositLifecycleEvents.walletAddress, input.walletAddress),
      ),
    );
  await db
    .delete(depositPerformanceDecompositions)
    .where(
      and(
        eq(depositPerformanceDecompositions.chainId, input.chainId),
        eq(depositPerformanceDecompositions.walletAddress, input.walletAddress),
      ),
    );
  await db.delete(depositWalletSummaries).where(walletScope);

  const depositRows: DepositRow[] = await db
    .select()
    .from(deposits)
    .where(
      and(
        eq(deposits.chainId, input.chainId),
        eq(deposits.walletAddress, input.walletAddress),
      ),
    );

  const eligibleDeposits = depositRows.filter((row): row is DepositRow & { poolId: string } => Boolean(row.poolId));
  if (eligibleDeposits.length === 0) {
    return { summariesWritten: 0, lifecycleEventsWritten: 0, decompositionsWritten: 0 };
  }

  const depositIds = eligibleDeposits.map((row) => row.id);
  const poolIds = Array.from(new Set(eligibleDeposits.map((row) => row.poolId)));
  const mintTxHashes = Array.from(
    new Set(
      eligibleDeposits
        .map((row) => (typeof row.mintTxHash === "string" ? row.mintTxHash.toLowerCase() : null))
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const poolRows: PoolRow[] = poolIds.length > 0
    ? await db.select().from(pools).where(inArray(pools.id, poolIds))
    : [];
  const poolById = new Map(poolRows.map((row) => [row.id, row]));

  const mintLedgerRows = mintTxHashes.length > 0
    ? await db
      .select({
        id: ledgerEvents.id,
        txHash: ledgerEvents.txHash,
        occurredAt: ledgerEvents.occurredAt,
        classification: ledgerEvents.classification,
      })
      .from(ledgerEvents)
      .where(
        and(
          eq(ledgerEvents.chainId, input.chainId),
          eq(ledgerEvents.walletAddress, input.walletAddress),
          inArray(ledgerEvents.txHash, mintTxHashes),
        ),
      )
    : [];

  const mintLedgerEventByTxHash = new Map<string, { id: string; occurredAt: Date }>();
  for (const row of mintLedgerRows) {
    const existing = mintLedgerEventByTxHash.get(row.txHash);
    const candidate = { id: row.id, occurredAt: row.occurredAt };
    if (!existing || row.classification === "manual_deposit") {
      mintLedgerEventByTxHash.set(row.txHash, candidate);
    }
  }

  const mintLedgerEventIds = Array.from(new Set(Array.from(mintLedgerEventByTxHash.values()).map((row) => row.id)));
  const mintMovementRows = mintLedgerEventIds.length > 0
    ? await db
      .select({
        ledgerEventId: assetMovements.ledgerEventId,
        tokenAddress: assetMovements.tokenAddress,
        directionIn: assetMovements.directionIn,
        amountRaw: assetMovements.amountRaw,
        metadataJson: assetMovements.metadataJson,
      })
      .from(assetMovements)
      .where(
        and(
          eq(assetMovements.chainId, input.chainId),
          eq(assetMovements.walletAddress, input.walletAddress),
          inArray(assetMovements.ledgerEventId, mintLedgerEventIds),
        ),
      )
    : [];

  const mintOutflowsByLedgerEventId = new Map<string, Array<{ tokenAddress: string; amountRaw: string; symbol: string | null }>>();
  const priceTokenAddresses = new Set<string>();
  for (const row of mintMovementRows) {
    if (!row.ledgerEventId || row.directionIn) continue;
    const bucket = mintOutflowsByLedgerEventId.get(row.ledgerEventId) ?? [];
    const tokenAddress = row.tokenAddress.toLowerCase();
    bucket.push({
      tokenAddress,
      amountRaw: String(row.amountRaw),
      symbol: asString(asRecord(row.metadataJson).symbol),
    });
    mintOutflowsByLedgerEventId.set(row.ledgerEventId, bucket);
    priceTokenAddresses.add(tokenAddress);
  }

  const mintOccurredAtValues = Array.from(mintLedgerEventByTxHash.values()).map((row) => row.occurredAt);
  const earliestMintOccurredAt = mintOccurredAtValues.length > 0
    ? new Date(Math.min(...mintOccurredAtValues.map((value) => value.getTime())))
    : null;
  const latestMintOccurredAtExclusive = mintOccurredAtValues.length > 0
    ? new Date(Math.max(...mintOccurredAtValues.map((value) => value.getTime())) + MS_PER_DAY)
    : null;

  const pricePointRows =
    priceTokenAddresses.size > 0 && earliestMintOccurredAt && latestMintOccurredAtExclusive
      ? await db
        .select({
          tokenAddress: pricePoints.tokenAddress,
          pricedAt: pricePoints.pricedAt,
          priceUsd: pricePoints.priceUsd,
        })
        .from(pricePoints)
        .where(
          and(
            eq(pricePoints.chainId, input.chainId),
            inArray(pricePoints.tokenAddress, Array.from(priceTokenAddresses)),
            gte(pricePoints.pricedAt, earliestMintOccurredAt),
            lt(pricePoints.pricedAt, latestMintOccurredAtExclusive),
          ),
        )
      : [];

  const priceByTokenDay = new Map<string, number>();
  for (const row of pricePointRows) {
    const key = pricePointKey(row.tokenAddress.toLowerCase(), dayUtcFromDate(row.pricedAt));
    if (!priceByTokenDay.has(key)) {
      priceByTokenDay.set(key, asNumber(row.priceUsd));
    }
  }

  const timelineRows = await db
    .select({
      id: poolTimelineEvents.id,
      relatedDepositId: poolTimelineEvents.relatedDepositId,
      eventType: poolTimelineEvents.eventType,
      occurredAt: poolTimelineEvents.occurredAt,
      sourceLedgerEventId: poolTimelineEvents.sourceLedgerEventId,
      confidence: poolTimelineEvents.confidence,
      coverageStatus: poolTimelineEvents.coverageStatus,
      attributedValueUsd: poolTimelineEvents.attributedValueUsd,
      metadataJson: poolTimelineEvents.metadataJson,
    })
    .from(poolTimelineEvents)
    .where(
      and(
        eq(poolTimelineEvents.chainId, input.chainId),
        eq(poolTimelineEvents.walletAddress, input.walletAddress),
        inArray(poolTimelineEvents.relatedDepositId, depositIds),
      ),
    )
    .orderBy(asc(poolTimelineEvents.occurredAt));

  const aggregates = new Map<string, DepositTimelineAggregate>();
  for (const id of depositIds) {
    aggregates.set(id, buildEmptyAggregate());
  }

  for (const row of timelineRows) {
    if (!row.relatedDepositId) continue;
    const agg = aggregates.get(row.relatedDepositId);
    if (!agg) continue;
    const value = asNumber(row.attributedValueUsd);
    const occurredAt = row.occurredAt instanceof Date ? row.occurredAt : new Date(row.occurredAt as unknown as string);
    const transferIn = Boolean((row.metadataJson as Record<string, unknown> | null)?.openedByTransferIn);

    switch (row.eventType) {
      // Opening flows: a deposit is created either as fresh capital ("deposit"),
      // a same-pool rebalance from a prior deposit, or a cross-pool redeploy.
      // All three carry the opening attributed value on the new deposit row.
      case "deposit":
      case "rebalance":
      case "redeploy": {
        agg.capitalEnteredUsd += value;
        if (!agg.openedAt || occurredAt.getTime() < agg.openedAt.getTime()) {
          agg.openedAt = occurredAt;
          agg.openedValueUsd = value;
          agg.openedByTransferIn = transferIn;
        }
        break;
      }
      case "withdraw":
      case "partial_swap_attribution": {
        agg.capitalWithdrawnUsd += value;
        break;
      }
      case "close": {
        agg.capitalWithdrawnUsd += value;
        if (!agg.closedAt || occurredAt.getTime() > agg.closedAt.getTime()) {
          agg.closedAt = occurredAt;
        }
        break;
      }
      default:
        break;
    }
  }

  const rewardRows = await db
    .select({
      id: rewardEvents.id,
      depositOrStrategyId: rewardEvents.depositOrStrategyId,
      txHash: rewardEvents.txHash,
      logIndex: rewardEvents.logIndex,
      rewardType: rewardEvents.rewardType,
      tokenAddress: rewardEvents.tokenAddress,
      amountRaw: rewardEvents.amountRaw,
      amountUsd: rewardEvents.amountUsd,
      occurredAt: rewardEvents.occurredAt,
      resolutionStatus: rewardEvents.resolutionStatus,
      metadataJson: rewardEvents.metadataJson,
    })
    .from(rewardEvents)
    .where(
      and(
        eq(rewardEvents.chainId, input.chainId),
        eq(rewardEvents.walletAddress, input.walletAddress),
        eq(rewardEvents.isAccrualSnapshot, false),
        inArray(rewardEvents.depositOrStrategyId, depositIds),
      ),
    );

  const rewardTxHashes = Array.from(new Set(
    rewardRows
      .map((row) => (typeof row.txHash === "string" ? row.txHash.toLowerCase() : null))
      .filter((value): value is string => Boolean(value)),
  ));
  const rewardTxHashSet = new Set(rewardTxHashes);

  const uniqueActiveDepositIdByPoolId = new Map<string, string>();
  const ambiguousActivePoolIds = new Set<string>();
  for (const deposit of eligibleDeposits) {
    if (deposit.status === "closed") continue;
    if (ambiguousActivePoolIds.has(deposit.poolId)) continue;

    const existing = uniqueActiveDepositIdByPoolId.get(deposit.poolId);
    if (existing && existing !== deposit.id) {
      uniqueActiveDepositIdByPoolId.delete(deposit.poolId);
      ambiguousActivePoolIds.add(deposit.poolId);
      continue;
    }

    uniqueActiveDepositIdByPoolId.set(deposit.poolId, deposit.id);
  }

  const gaugeContractRows = uniqueActiveDepositIdByPoolId.size > 0
    ? await db
      .select({
        address: protocolContracts.address,
        metadataJson: protocolContracts.metadataJson,
      })
      .from(protocolContracts)
      .where(
        and(
          eq(protocolContracts.chainId, input.chainId),
          eq(protocolContracts.protocol, "aerodrome"),
          eq(protocolContracts.contractType, "gauge"),
        ),
      )
    : [];

  const poolIdByGaugeAddress = new Map<string, string>();
  for (const row of gaugeContractRows) {
    const poolId = asString(asRecord(row.metadataJson).poolId);
    if (!poolId || !uniqueActiveDepositIdByPoolId.has(poolId)) continue;
    poolIdByGaugeAddress.set(row.address.toLowerCase(), poolId);
  }

  const claimMethodLabels = new Set(["getreward", "getrewards", "claim", "collect"]);
  const depositById = new Map(eligibleDeposits.map((deposit) => [deposit.id, deposit]));
  const syntheticManualClaimCandidates = poolIdByGaugeAddress.size > 0
    ? (await db
      .select({
        id: ledgerEvents.id,
        txHash: ledgerEvents.txHash,
        logIndex: ledgerEvents.logIndex,
        occurredAt: ledgerEvents.occurredAt,
        metadataJson: ledgerEvents.metadataJson,
      })
      .from(ledgerEvents)
      .where(
        and(
          eq(ledgerEvents.chainId, input.chainId),
          eq(ledgerEvents.walletAddress, input.walletAddress),
          eq(ledgerEvents.classification, "claim"),
        ),
      ))
      .flatMap((row) => {
        const metadata = asRecord(row.metadataJson);
        const gaugeAddress = normalizeTokenAddress(asString(metadata.toAddress));
        const methodLabel = asString(metadata.methodLabel)?.toLowerCase() ?? null;
        if (!gaugeAddress || !methodLabel || !claimMethodLabels.has(methodLabel)) {
          return [];
        }

        const poolId = poolIdByGaugeAddress.get(gaugeAddress);
        if (!poolId) {
          return [];
        }

        const depositId = uniqueActiveDepositIdByPoolId.get(poolId);
        if (!depositId) {
          return [];
        }

        if (rewardTxHashSet.has(row.txHash.toLowerCase())) {
          return [];
        }

        const deposit = depositById.get(depositId);
        const mintOccurredAt = deposit?.mintTxHash ? mintLedgerEventByTxHash.get(deposit.mintTxHash.toLowerCase())?.occurredAt ?? null : null;
        const openedAt = aggregates.get(depositId)?.openedAt ?? mintOccurredAt;
        if (openedAt && row.occurredAt.getTime() < openedAt.getTime()) {
          return [];
        }

        return [{
          ...row,
          depositId,
          methodLabel,
          summary: asString(metadata.summary),
          gaugeAddress,
          poolId,
        }];
      })
    : [];

  const syntheticManualClaimLedgerEventIds = syntheticManualClaimCandidates.map((row) => row.id);
  const syntheticManualClaimMovementRows = syntheticManualClaimLedgerEventIds.length > 0
    ? await db
      .select({
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
          eq(assetMovements.chainId, input.chainId),
          eq(assetMovements.walletAddress, input.walletAddress),
          eq(assetMovements.directionIn, true),
          inArray(assetMovements.ledgerEventId, syntheticManualClaimLedgerEventIds),
        ),
      )
    : [];

  const syntheticManualClaimMovementsByLedgerEventId = new Map<string, PricedMovement[]>();
  for (const row of syntheticManualClaimMovementRows) {
    if (!row.ledgerEventId) continue;
    const bucket = syntheticManualClaimMovementsByLedgerEventId.get(row.ledgerEventId) ?? [];
    const tokenAddress = row.tokenAddress.toLowerCase();
    bucket.push({
      tokenAddress,
      directionIn: row.directionIn,
      amountRaw: String(row.amountRaw),
      amountUsd: asNullableNumber(row.amountUsd),
      symbol: asString(asRecord(row.metadataJson).symbol),
    });
    syntheticManualClaimMovementsByLedgerEventId.set(row.ledgerEventId, bucket);
    priceTokenAddresses.add(tokenAddress);
  }

  const rewardLedgerRows = rewardTxHashes.length > 0
    ? await db
      .select({
        id: ledgerEvents.id,
        txHash: ledgerEvents.txHash,
      })
      .from(ledgerEvents)
      .where(
        and(
          eq(ledgerEvents.chainId, input.chainId),
          inArray(ledgerEvents.txHash, rewardTxHashes),
        ),
      )
    : [];

  const rewardLedgerEventIds = rewardLedgerRows.map((row) => row.id);
  const rewardTxHashByLedgerEventId = new Map(rewardLedgerRows.map((row) => [row.id, row.txHash.toLowerCase()]));
  const rewardMovementRows = rewardLedgerEventIds.length > 0
    ? await db
      .select({
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
          eq(assetMovements.chainId, input.chainId),
          eq(assetMovements.walletAddress, input.walletAddress),
          eq(assetMovements.directionIn, true),
          inArray(assetMovements.ledgerEventId, rewardLedgerEventIds),
        ),
      )
    : [];

  const rewardInboundMovementsByTxHash = new Map<string, PricedMovement[]>();
  for (const row of rewardMovementRows) {
    if (!row.ledgerEventId) continue;
    const txHash = rewardTxHashByLedgerEventId.get(row.ledgerEventId);
    if (!txHash) continue;
    const bucket = rewardInboundMovementsByTxHash.get(txHash) ?? [];
    const tokenAddress = row.tokenAddress.toLowerCase();
    bucket.push({
      tokenAddress,
      directionIn: row.directionIn,
      amountRaw: String(row.amountRaw),
      amountUsd: asNullableNumber(row.amountUsd),
      symbol: asString(asRecord(row.metadataJson).symbol),
    });
    rewardInboundMovementsByTxHash.set(txHash, bucket);
    priceTokenAddresses.add(tokenAddress);
  }

  const sourceLedgerEventIds = Array.from(new Set(
    timelineRows
      .map((row) => row.sourceLedgerEventId)
      .filter((value): value is string => Boolean(value)),
  ));

  const lifecycleLedgerEventIds = Array.from(new Set([...mintLedgerEventIds, ...sourceLedgerEventIds]));
  const lifecycleLedgerRows = lifecycleLedgerEventIds.length > 0
    ? await db
      .select({
        id: ledgerEvents.id,
        txHash: ledgerEvents.txHash,
        logIndex: ledgerEvents.logIndex,
        eventType: ledgerEvents.eventType,
        classification: ledgerEvents.classification,
        occurredAt: ledgerEvents.occurredAt,
        confidence: ledgerEvents.confidence,
        metadataJson: ledgerEvents.metadataJson,
      })
      .from(ledgerEvents)
      .where(
        and(
          eq(ledgerEvents.chainId, input.chainId),
          eq(ledgerEvents.walletAddress, input.walletAddress),
          inArray(ledgerEvents.id, lifecycleLedgerEventIds),
        ),
      )
    : [];

  const lifecycleLedgerById = new Map(lifecycleLedgerRows.map((row) => [row.id, row]));
  const lifecycleMovementRows = lifecycleLedgerEventIds.length > 0
    ? await db
      .select({
        ledgerEventId: assetMovements.ledgerEventId,
        movementIndex: assetMovements.movementIndex,
        tokenAddress: assetMovements.tokenAddress,
        directionIn: assetMovements.directionIn,
        amountRaw: assetMovements.amountRaw,
        amountUsd: assetMovements.amountUsd,
        metadataJson: assetMovements.metadataJson,
      })
      .from(assetMovements)
      .where(
        and(
          eq(assetMovements.chainId, input.chainId),
          eq(assetMovements.walletAddress, input.walletAddress),
          inArray(assetMovements.ledgerEventId, lifecycleLedgerEventIds),
        ),
      )
    : [];

  for (const row of lifecycleMovementRows) {
    if (!row.ledgerEventId) continue;
    priceTokenAddresses.add(row.tokenAddress.toLowerCase());
  }

  const pricedLifecycleMovements = new Map<string, PricedMovement[]>();

  for (const row of lifecycleMovementRows) {
    if (!row.ledgerEventId) continue;
    const bucket = pricedLifecycleMovements.get(row.ledgerEventId) ?? [];
    bucket.push({
      tokenAddress: row.tokenAddress.toLowerCase(),
      directionIn: row.directionIn,
      amountRaw: String(row.amountRaw),
      amountUsd: asNullableNumber(row.amountUsd),
      symbol: asString(asRecord(row.metadataJson).symbol),
    });
    pricedLifecycleMovements.set(row.ledgerEventId, bucket);
  }

  for (const row of rewardRows) {
    const tokenAddress = normalizeTokenAddress(row.tokenAddress);
    if (tokenAddress) {
      priceTokenAddresses.add(tokenAddress);
    }
  }

  const rewardOccurredAtValues = rewardRows.map((row) => row.occurredAt).filter((value): value is Date => value instanceof Date);
  const lifecycleOccurredAtValues = lifecycleLedgerRows.map((row) => row.occurredAt).filter((value): value is Date => value instanceof Date);
  const syntheticClaimOccurredAtValues = syntheticManualClaimCandidates.map((row) => row.occurredAt);
  const priceWindowValues = [...mintOccurredAtValues, ...lifecycleOccurredAtValues, ...rewardOccurredAtValues, ...syntheticClaimOccurredAtValues];
  const earliestPriceOccurredAt = priceWindowValues.length > 0
    ? new Date(Math.min(...priceWindowValues.map((value) => value.getTime())))
    : earliestMintOccurredAt;
  const latestPriceOccurredAtExclusive = priceWindowValues.length > 0
    ? new Date(Math.max(...priceWindowValues.map((value) => value.getTime())) + MS_PER_DAY)
    : latestMintOccurredAtExclusive;

  const extendedPricePointRows =
    priceTokenAddresses.size > 0 && earliestPriceOccurredAt && latestPriceOccurredAtExclusive
      ? await db
        .select({
          tokenAddress: pricePoints.tokenAddress,
          pricedAt: pricePoints.pricedAt,
          priceUsd: pricePoints.priceUsd,
        })
        .from(pricePoints)
        .where(
          and(
            eq(pricePoints.chainId, input.chainId),
            inArray(pricePoints.tokenAddress, Array.from(priceTokenAddresses)),
            gte(pricePoints.pricedAt, earliestPriceOccurredAt),
            lt(pricePoints.pricedAt, latestPriceOccurredAtExclusive),
          ),
        )
      : [];

  for (const row of extendedPricePointRows) {
    const key = pricePointKey(row.tokenAddress.toLowerCase(), dayUtcFromDate(row.pricedAt));
    if (!priceByTokenDay.has(key)) {
      priceByTokenDay.set(key, asNumber(row.priceUsd));
    }
  }

  const inferredActionRows = sourceLedgerEventIds.length > 0
    ? await db
      .select({
        id: inferredActions.id,
        sourceLedgerEventId: inferredActions.sourceLedgerEventId,
      })
      .from(inferredActions)
      .where(
        and(
          eq(inferredActions.chainId, input.chainId),
          eq(inferredActions.walletAddress, input.walletAddress),
          inArray(inferredActions.sourceLedgerEventId, sourceLedgerEventIds),
        ),
      )
    : [];

  const inferredActionIdByLedgerEventId = new Map<string, string>();
  for (const row of inferredActionRows) {
    if (row.sourceLedgerEventId && !inferredActionIdByLedgerEventId.has(row.sourceLedgerEventId)) {
      inferredActionIdByLedgerEventId.set(row.sourceLedgerEventId, row.id);
    }
  }

  const strategyCrossLinkRows = await db
    .select({
      strategyId: strategies.id,
      primaryPoolId: strategies.primaryPoolId,
    })
    .from(strategyExposures)
    .innerJoin(strategies, eq(strategyExposures.strategyId, strategies.id))
    .where(
      and(
        eq(strategyExposures.chainId, input.chainId),
        eq(strategyExposures.walletAddress, input.walletAddress),
      ),
    );

  const strategyIdByPoolId = buildStrategyIdByPoolId(strategyCrossLinkRows);

  const enhancedRewardRows: RewardLikeRow[] = rewardRows.map((row) => {
    const tokenAddress = normalizeTokenAddress(row.tokenAddress);
    const metadata = asRecord(row.metadataJson);
    const symbol = asString(metadata.symbol);
    const occurredAt = row.occurredAt instanceof Date ? row.occurredAt : input.capturedAt;
    const amountRaw = typeof row.amountRaw === "string" ? row.amountRaw : String(row.amountRaw ?? "0");
    const directResolved = resolveUsdValuation({
      occurredAt,
      tokenAddress,
      symbol,
      amountRaw,
      directAmountUsd: asNullableNumber(row.amountUsd),
      priceByTokenDay,
    });

    const fallbackMovements = row.txHash
      ? (rewardInboundMovementsByTxHash.get(row.txHash.toLowerCase()) ?? [])
      : [];
    const movementFallback = directResolved.usdValue === null && fallbackMovements.length > 0
      ? buildSignedTokenDeltas({
        occurredAt,
        movements: fallbackMovements,
        priceByTokenDay,
      })
      : null;
    const fallbackMovementSummary = movementFallback ? summarizeSingleTokenMovements(fallbackMovements) : {
      tokenAddress: null,
      amountRaw: null,
      symbol: null,
    };

    const resolvedAmountUsd = directResolved.usdValue ?? movementFallback?.signedUsdTotal ?? 0;
    const priceSource = directResolved.usdValue !== null
      ? directResolved.priceSource
      : movementFallback?.eventPriceSource ?? directResolved.priceSource;
    const reasonCodes = directResolved.usdValue !== null
      ? directResolved.reasonCodes
      : movementFallback
        ? mergeReasonCodes(movementFallback.reasonCodes, ["rewardMovementFallback"])
        : directResolved.reasonCodes;
    const resolvedTokenDeltas = movementFallback
      ? movementFallback.deltas
      : [{
        tokenAddress,
        symbol,
        direction: "in" as const,
        amountRaw,
        amountFormatted: formatAmountRaw({
          amountRaw,
          tokenAddress,
          symbol,
        }),
        usdValue: resolvedAmountUsd || null,
        priceSource,
      }];

    return {
      ...row,
      tokenAddress: tokenAddress ?? fallbackMovementSummary.tokenAddress,
      symbol: symbol ?? fallbackMovementSummary.symbol,
      amountRaw: typeof row.amountRaw === "string" ? row.amountRaw : (fallbackMovementSummary.amountRaw ?? amountRaw),
      occurredAt,
      resolvedAmountUsd,
      priceSource,
      reasonCodes,
      resolvedTokenDeltas,
    };
  });

  const syntheticManualClaimRewardRows: RewardLikeRow[] = syntheticManualClaimCandidates.flatMap((row) => {
    const movements = syntheticManualClaimMovementsByLedgerEventId.get(row.id) ?? [];
    if (movements.length === 0) {
      return [];
    }

    const resolved = buildSignedTokenDeltas({
      occurredAt: row.occurredAt,
      movements,
      priceByTokenDay,
    });
    if (resolved.signedUsdTotal <= 0) {
      return [];
    }

    const summary = summarizeSingleTokenMovements(movements);
    return [{
      id: row.id,
      depositOrStrategyId: row.depositId,
      txHash: row.txHash,
      logIndex: row.logIndex,
      rewardType: "reward_claim",
      tokenAddress: summary.tokenAddress,
      amountRaw: summary.amountRaw ?? "0",
      occurredAt: row.occurredAt,
      resolutionStatus: "resolved",
      metadataJson: {
        source: "claim_ledger_fallback",
        summary: row.summary,
        methodLabel: row.methodLabel,
        gaugeAddress: row.gaugeAddress,
        poolId: row.poolId,
      },
      symbol: summary.symbol,
      resolvedAmountUsd: resolved.signedUsdTotal,
      priceSource: resolved.eventPriceSource,
      reasonCodes: mergeReasonCodes(resolved.reasonCodes, ["manualGaugeClaimFallback"]),
      resolvedTokenDeltas: resolved.deltas,
    }];
  });

  const resolvedRewardRows = [...enhancedRewardRows, ...syntheticManualClaimRewardRows];

  const rewardsByDepositId = new Map<string, number>();
  for (const row of resolvedRewardRows) {
    if (!row.depositOrStrategyId) continue;
    const prev = rewardsByDepositId.get(row.depositOrStrategyId) ?? 0;
    rewardsByDepositId.set(row.depositOrStrategyId, prev + row.resolvedAmountUsd);
  }

  const { summaryRows, lifecycleRowsToInsert, decompositionRowsToInsert } = buildDepositReadModelRows({
    runId: input.runId,
    walletAddress: input.walletAddress,
    chainId: input.chainId,
    startDayUtc: input.startDayUtc,
    endDayUtc: input.endDayUtc,
    capturedAt: input.capturedAt,
    eligibleDeposits,
    poolById,
    aggregates,
    rewardsByDepositId,
    mintLedgerEventByTxHash,
    mintOutflowsByLedgerEventId,
    priceByTokenDay,
    timelineRows,
    lifecycleLedgerById,
    pricedLifecycleMovements,
    inferredActionIdByLedgerEventId,
    strategyIdByPoolId,
    resolvedRewardRows,
  });

  let summariesWritten = 0;
  await chunkedInsert(summaryRows, async (chunk) => {
    await db.insert(depositWalletSummaries).values(chunk);
    summariesWritten += chunk.length;
  });

  let lifecycleEventsWritten = 0;
  await chunkedInsert(lifecycleRowsToInsert, async (chunk) => {
    await db.insert(depositLifecycleEvents).values(chunk);
    lifecycleEventsWritten += chunk.length;
  });

  let decompositionsWritten = 0;
  await chunkedInsert(decompositionRowsToInsert, async (chunk) => {
    await db.insert(depositPerformanceDecompositions).values(chunk);
    decompositionsWritten += chunk.length;
  });

  return {
    summariesWritten,
    lifecycleEventsWritten,
    decompositionsWritten,
  };
}

// Reference `sql` import to satisfy tree-shaking even if drizzle removes it.
void sql;
