/**
 * Materializes wallet-scoped deposit read models from analysis-engine output.
 *
 * 010-deposits-lifecycle T028 (MVP derivation):
 *   - Reads canonical `deposits` for (chainId, walletAddress).
 *   - Rehydrates per-deposit lifecycle from persisted deposit metadata + `ledger_events`
 *     so each deposit can materialize its own lifecycle independently of pool views.
 *   - Joins `pools` for label/token symbols/fee tier (via metadataJson).
 *   - Falls back to `pool_timeline_events` only when a deposit has no persisted
 *     lifecycle metadata yet.
 *   - Aggregates rewards from persisted lifecycle collects plus `reward_events`
 *     keyed by `depositOrStrategyId` when needed.
 *   - Persists rows to `deposit_wallet_summaries`.
 *
 * Lifecycle events and performance decompositions are deferred to T048-T051
 * (US2) — this materializer only populates the list-level summary table that
 * the Phase-3 MVP UI needs.
 *
 * The reconciliation invariant `|totalReturn - (rewards + realized + unrealized)| <= 1e-9`
 * is enforced trivially here because we compute totalReturn as the sum.
 */

import { and, asc, eq, gte, inArray, isNull, lt, or, sql } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import { hydrateHistoricalPriceLookup, resolveHistoricalUsdBackfill } from "@/server/analysis/computeSnapshots";
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

export function startOfUtcDay(value: Date) {
  return new Date(`${dayUtcFromDate(value)}T00:00:00.000Z`);
}

export function nextUtcDay(value: Date) {
  return new Date(startOfUtcDay(value).getTime() + MS_PER_DAY);
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

export function derivePositionStatus(input: {
  rawStatus: string;
  isInRange: boolean | null;
  /**
   * When true the analyzer could not read a live valuation for the position
   * (typically because the NFT is no longer held by the wallet). Combined with
   * a non-zero historical capital this is treated as an effective close so the
   * UI reflects that the deposit is no longer active even when the canonical
   * `deposits.status` row was not updated by the upstream pipeline.
   */
  hasLiveValuation?: boolean;
  capitalEnteredUsd?: number;
}) {
  if (input.rawStatus === "closed") {
    return "closed" as const;
  }
  if (
    input.hasLiveValuation === false &&
    (input.capitalEnteredUsd ?? 0) > 0
  ) {
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
  if (input.coverageStatus === "partial") codes.push("unattributedResidual", "residualAmbiguousSource");
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
  resolutionReasonCodes: string[];
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

function extractTimelineLedgerEventIds(input: Pick<DepositTimelineRow, "sourceLedgerEventId" | "metadataJson">) {
  const metadata = asRecord(input.metadataJson);
  const groupedLedgerEventIds = asStringArray(metadata.ledgerEventIds);
  return Array.from(new Set([
    ...(input.sourceLedgerEventId ? [input.sourceLedgerEventId] : []),
    ...groupedLedgerEventIds,
  ]));
}

const SYNTHETIC_REWARD_TOKEN_ID_KEY_PATTERN = /^(token_id|tokenId|token_ids|tokenIds|nft_token_id|position_id|positionId|position_ids|positionIds)$/i;

function normalizeSyntheticRewardTokenIdCandidates(value: unknown): string[] {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? [trimmed] : [];
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return [String(Math.trunc(value))];
  }

  if (typeof value === "bigint") {
    return [value.toString()];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => normalizeSyntheticRewardTokenIdCandidates(entry));
  }

  return [];
}

function collectSyntheticRewardTokenIdCandidates(value: unknown, depth = 0): string[] {
  if (depth > 5 || value === null || value === undefined) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectSyntheticRewardTokenIdCandidates(entry, depth + 1));
  }

  if (typeof value !== "object") {
    return [];
  }

  const record = value as Record<string, unknown>;
  const candidates: string[] = [];
  for (const [key, nestedValue] of Object.entries(record)) {
    if (SYNTHETIC_REWARD_TOKEN_ID_KEY_PATTERN.test(key)) {
      candidates.push(...normalizeSyntheticRewardTokenIdCandidates(nestedValue));
    }
    candidates.push(...collectSyntheticRewardTokenIdCandidates(nestedValue, depth + 1));
  }

  return candidates;
}

function extractSyntheticRewardTokenId(input: unknown) {
  const candidates = Array.from(new Set(
    collectSyntheticRewardTokenIdCandidates(input)
      .filter((candidate): candidate is string => Boolean(candidate)),
  ));

  return candidates.length === 1 ? (candidates[0] ?? null) : null;
}

function resolvePersistedLifecycleTokenIdForTx(input: {
  txHash: string;
  deposits: Array<DepositRow & { poolId: string }>;
}) {
  const normalizedTxHash = input.txHash.toLowerCase();
  const tokenIds = Array.from(new Set(
    input.deposits
      .flatMap((deposit) => extractPersistedDepositLifecycleRecords(deposit.metadataJson))
      .filter((record) => record.txHash.toLowerCase() === normalizedTxHash)
      .map((record) => record.tokenId)
      .filter((tokenId): tokenId is string => Boolean(tokenId)),
  ));

  return tokenIds.length === 1 ? (tokenIds[0] ?? null) : null;
}

export function resolveSyntheticGaugeClaimDepositId(input: {
  metadataJson: Record<string, unknown> | null;
  txHash: string;
  deposits: Array<DepositRow & { poolId: string }>;
}) {
  const targetTokenId = extractSyntheticRewardTokenId(input.metadataJson)
    ?? resolvePersistedLifecycleTokenIdForTx({ txHash: input.txHash, deposits: input.deposits });
  if (!targetTokenId) {
    return null;
  }

  const matchingDeposits = input.deposits.filter((deposit) => deposit.tokenId === targetTokenId);
  return matchingDeposits.length === 1 ? (matchingDeposits[0]?.id ?? null) : null;
}

type PersistedDepositLifecycleRecord = {
  txHash: string;
  action: "mint" | "increaseLiquidity" | "decreaseLiquidity" | "collect";
  occurredAt: Date | null;
  tokenId: string | null;
  positionManagerAddress: string | null;
  poolAddress: string | null;
  category: string | null;
  methodLabel: string | null;
  summary: string | null;
};

function extractPersistedDepositLifecycleRecords(input: unknown): PersistedDepositLifecycleRecord[] {
  const metadata = asRecord(input);
  const lifecycleEntries = Array.isArray(metadata.lifecycle) ? metadata.lifecycle : [];

  return lifecycleEntries.flatMap((entry) => {
    const record = asRecord(entry);
    const txHash = asString(record.txHash)?.toLowerCase() ?? null;
    const action = asString(record.action);
    if (
      !txHash
      || (action !== "mint" && action !== "increaseLiquidity" && action !== "decreaseLiquidity" && action !== "collect")
    ) {
      return [];
    }

    const occurredAtRaw = asString(record.occurredAt);
    const occurredAt = occurredAtRaw ? new Date(occurredAtRaw) : null;

    return [{
      txHash,
      action,
      occurredAt: occurredAt && !Number.isNaN(occurredAt.getTime()) ? occurredAt : null,
      tokenId: asString(record.tokenId),
      positionManagerAddress: asString(record.positionManagerAddress)?.toLowerCase() ?? null,
      poolAddress: asString(record.poolAddress)?.toLowerCase() ?? null,
      category: asString(record.category),
      methodLabel: asString(record.methodLabel),
      summary: asString(record.summary),
    } satisfies PersistedDepositLifecycleRecord];
  }).sort((left, right) => {
    const leftTime = left.occurredAt?.getTime() ?? 0;
    const rightTime = right.occurredAt?.getTime() ?? 0;
    if (leftTime !== rightTime) return leftTime - rightTime;
    return left.txHash.localeCompare(right.txHash);
  });
}

function selectLifecycleLedgerEventForRecord(input: {
  record: PersistedDepositLifecycleRecord;
  ledgerRowsByTxHash: Map<string, LifecycleLedgerRow[]>;
}) {
  const rows = input.ledgerRowsByTxHash.get(input.record.txHash) ?? [];
  const preferredClassifications = input.record.action === "collect"
    ? ["claim"]
    : input.record.action === "decreaseLiquidity"
      ? ["manual_withdrawal", "withdraw"]
      : ["manual_deposit", "deposit"];

  for (const classification of preferredClassifications) {
    const matching = rows.find((row) => row.classification === classification);
    if (matching) {
      return matching;
    }
  }

  return rows.at(-1) ?? null;
}

function mapPersistedLifecycleActionToEventType(input: {
  action: PersistedDepositLifecycleRecord["action"];
  isFinalDecrease: boolean;
}) {
  switch (input.action) {
    case "mint":
      return "mint_position" as const;
    case "increaseLiquidity":
      return "increase_liquidity" as const;
    case "decreaseLiquidity":
      return input.isFinalDecrease ? "close" as const : "decrease_liquidity" as const;
    case "collect":
      return "claim_reward" as const;
    default:
      return null;
  }
}

function rewardMatchesDeposit(input: {
  reward: Pick<RewardLikeRow, "depositOrStrategyId" | "metadataJson">;
  depositTokenId: string | null;
  depositId: string;
}) {
  if (input.reward.depositOrStrategyId) {
    return input.reward.depositOrStrategyId === input.depositId;
  }

  if (!input.depositTokenId) {
    return false;
  }

  const rewardTargetTokenId = asString(asRecord(input.reward.metadataJson).targetTokenId);
  return rewardTargetTokenId === input.depositTokenId;
}

type LifecycleLedgerRow = {
  id?: string;
  txHash: string;
  logIndex: number;
  classification?: string | null;
  occurredAt?: Date;
  confidence?: string | null;
  metadataJson: unknown;
};

type MaterializedLifecycleCandidate = {
  occurredAt: Date;
  logIndex: number;
  eventType: string;
  txHash: string;
  blockNumber: number;
  usdValue: number | null;
  signedTokenDeltas: Array<{
    tokenAddress: string | null;
    symbol: string | null;
    direction: string;
    amountRaw: string;
    amountFormatted: string | null;
    usdValue: number | null;
    priceSource: string | null;
  }>;
  priceSource: "event" | "pricePointFallback" | "unavailable" | null;
  confidence: "high" | "medium" | "degraded" | "unknown";
  inferredActionId: string | null;
  coverageReasonCodes: string[];
  metadataJson: Record<string, unknown>;
  principalFlowUsd: number | null;
};

type BenchmarkLot = {
  tokenAddress: string | null;
  symbol: string | null;
  amount: number;
  principalUsd: number;
};

type InventoryLot = {
  tokenAddress: string | null;
  symbol: string | null;
  amount: number;
  costBasisUsd: number;
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

function resolveAmountFormattedToNumber(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sumCandidateMovementUsd(
  candidate: Pick<MaterializedLifecycleCandidate, "signedTokenDeltas" | "usdValue">,
  direction: "in" | "out",
) {
  let total = 0;
  let hasResolvedMovement = false;

  for (const delta of candidate.signedTokenDeltas) {
    if (delta.direction !== direction || delta.usdValue === null) continue;
    total += Math.abs(delta.usdValue);
    hasResolvedMovement = true;
  }

  if (hasResolvedMovement) {
    return total;
  }

  return candidate.usdValue === null ? null : Math.abs(candidate.usdValue);
}

function candidateMovementBreakdown(
  candidate: Pick<MaterializedLifecycleCandidate, "signedTokenDeltas">,
  direction: "in" | "out",
) {
  return candidate.signedTokenDeltas
    .filter((delta) => delta.direction === direction)
    .map((delta) => ({
      tokenAddress: delta.tokenAddress,
      symbol: delta.symbol,
      amount: resolveAmountFormattedToNumber(delta.amountFormatted),
      usdValue: delta.usdValue === null ? null : Math.abs(delta.usdValue),
    }))
    .filter((delta) => delta.amount !== null && delta.amount > 0);
}

function buildBenchmarkLotsFromCapitalInCandidate(input: {
  candidate: MaterializedLifecycleCandidate;
  principalFlowUsd: number;
}) {
  const outflows = candidateMovementBreakdown(input.candidate, "out");
  if (outflows.length === 0 || input.principalFlowUsd <= 0) {
    return [] as BenchmarkLot[];
  }

  const totalOutflowUsd = outflows.reduce((sum, delta) => sum + (delta.usdValue ?? 0), 0);
  const weightedByUsd = totalOutflowUsd > 0;

  return outflows.map((delta, index) => {
    const weight = weightedByUsd
      ? ((delta.usdValue ?? 0) / totalOutflowUsd)
      : (1 / outflows.length);
    const principalUsd = index === outflows.length - 1
      ? Math.max(
          0,
          input.principalFlowUsd - outflows
            .slice(0, index)
            .reduce((sum, previous) => sum + input.principalFlowUsd * (weightedByUsd
              ? ((previous.usdValue ?? 0) / totalOutflowUsd)
              : (1 / outflows.length)), 0),
        )
      : input.principalFlowUsd * weight;

    return {
      tokenAddress: delta.tokenAddress,
      symbol: delta.symbol,
      amount: delta.amount ?? 0,
      principalUsd,
    } satisfies BenchmarkLot;
  });
}

function totalLotPrincipalUsd(lots: BenchmarkLot[]) {
  return lots.reduce((sum, lot) => sum + lot.principalUsd, 0);
}

function valueBenchmarkLotsAtDate(input: {
  lots: Array<Pick<BenchmarkLot, "tokenAddress" | "symbol" | "amount">>;
  occurredAt: Date;
  priceByTokenDay: Map<string, number>;
}) {
  let usdValue = 0;
  const reasonCodes: string[] = [];

  for (const lot of input.lots) {
    if (lot.amount <= 0) continue;
    const tokenAddress = normalizeTokenAddress(lot.tokenAddress);
    if (!tokenAddress) {
      reasonCodes.push("priceUnavailable");
      return { usdValue: null, reasonCodes: mergeReasonCodes(reasonCodes) };
    }

    const priceUsd = input.priceByTokenDay.get(pricePointKey(tokenAddress, dayUtcFromDate(input.occurredAt)));
    if (priceUsd === undefined) {
      reasonCodes.push("priceUnavailable");
      return { usdValue: null, reasonCodes: mergeReasonCodes(reasonCodes) };
    }

    usdValue += lot.amount * priceUsd;
  }

  return { usdValue, reasonCodes: mergeReasonCodes(reasonCodes) };
}

function consumeBenchmarkLotsByPrincipal(input: {
  lots: BenchmarkLot[];
  principalUsd: number;
}) {
  const remainingPrincipalUsd = totalLotPrincipalUsd(input.lots);
  if (input.principalUsd <= 0 || remainingPrincipalUsd <= 0) {
    return { consumedLots: [] as BenchmarkLot[], consumedPrincipalUsd: 0 };
  }

  const ratio = Math.min(1, input.principalUsd / remainingPrincipalUsd);
  const consumedLots: BenchmarkLot[] = [];

  input.lots.forEach((lot, index) => {
    const lotRatio = index === input.lots.length - 1 ? 1 : ratio;
    const consumedAmount = index === input.lots.length - 1
      ? lot.amount * ratio
      : lot.amount * lotRatio;
    const consumedPrincipalUsd = index === input.lots.length - 1
      ? Math.max(0, lot.principalUsd - lot.principalUsd * (1 - ratio))
      : lot.principalUsd * lotRatio;

    if (consumedAmount <= 0 || consumedPrincipalUsd <= 0) {
      return;
    }

    consumedLots.push({
      tokenAddress: lot.tokenAddress,
      symbol: lot.symbol,
      amount: consumedAmount,
      principalUsd: consumedPrincipalUsd,
    });

    lot.amount = Math.max(0, lot.amount - consumedAmount);
    lot.principalUsd = Math.max(0, lot.principalUsd - consumedPrincipalUsd);
  });

  for (let index = input.lots.length - 1; index >= 0; index -= 1) {
    const lot = input.lots[index];
    if (!lot || (lot.amount <= 1e-12 && lot.principalUsd <= 1e-9)) {
      input.lots.splice(index, 1);
    }
  }

  return {
    consumedLots,
    consumedPrincipalUsd: consumedLots.reduce((sum, lot) => sum + lot.principalUsd, 0),
  };
}

function appendInventoryLotsFromCandidate(input: {
  candidate: MaterializedLifecycleCandidate;
  target: InventoryLot[];
}) {
  for (const delta of candidateMovementBreakdown(input.candidate, "in")) {
    if ((delta.usdValue ?? 0) <= 0) continue;
    input.target.push({
      tokenAddress: delta.tokenAddress,
      symbol: delta.symbol,
      amount: delta.amount ?? 0,
      costBasisUsd: delta.usdValue ?? 0,
    });
  }
}

function consumeInventoryLotsByOutflows(input: {
  candidate: MaterializedLifecycleCandidate;
  inventoryLots: InventoryLot[];
}) {
  let consumedCostBasisUsd = 0;

  for (const delta of candidateMovementBreakdown(input.candidate, "out")) {
    let remainingAmount = delta.amount ?? 0;
    if (remainingAmount <= 0) continue;

    for (const lot of input.inventoryLots) {
      if (remainingAmount <= 1e-12) break;
      if (normalizeTokenAddress(lot.tokenAddress) !== normalizeTokenAddress(delta.tokenAddress)) continue;
      if (lot.amount <= 1e-12) continue;

      const consumedAmount = Math.min(lot.amount, remainingAmount);
      const ratio = consumedAmount / lot.amount;
      const consumedCostBasis = lot.costBasisUsd * ratio;

      lot.amount = Math.max(0, lot.amount - consumedAmount);
      lot.costBasisUsd = Math.max(0, lot.costBasisUsd - consumedCostBasis);
      remainingAmount -= consumedAmount;
      consumedCostBasisUsd += consumedCostBasis;
    }
  }

  for (let index = input.inventoryLots.length - 1; index >= 0; index -= 1) {
    const lot = input.inventoryLots[index];
    if (!lot || (lot.amount <= 1e-12 && lot.costBasisUsd <= 1e-9)) {
      input.inventoryLots.splice(index, 1);
    }
  }

  return consumedCostBasisUsd;
}

function deriveDepositPerformanceDecomposition(input: {
  lifecycleCandidates: MaterializedLifecycleCandidate[];
  currentValueUsd: number;
  rewardsUsd: number;
  totalReturnUsd: number;
  capturedAt: Date;
  priceByTokenDay: Map<string, number>;
}) {
  const benchmarkLots: BenchmarkLot[] = [];
  const withdrawnInventoryLots: InventoryLot[] = [];
  const reasonCodes: string[] = [];
  let unmodeledPrincipalUsd = 0;

  let feesUsd = 0;
  let assetPriceEffectUsd = 0;
  let rebalanceEffectUsd = 0;
  let realizedPnlUsd = 0;
  let unrealizedPnlUsd = 0;

  for (const candidate of input.lifecycleCandidates) {
    const rawTimelineEventType = asString(candidate.metadataJson.timelineEventType);

    if (candidate.eventType === "collect_fees") {
      feesUsd += sumCandidateMovementUsd(candidate, "in") ?? Math.abs(candidate.usdValue ?? 0);
      continue;
    }

    if (candidate.eventType === "claim_reward") {
      continue;
    }

    if (["mint_position", "increase_liquidity", "transfer_in", "stake"].includes(candidate.eventType)) {
      const principalFlowUsd = Math.abs(candidate.principalFlowUsd ?? candidate.usdValue ?? 0);
      const newLots = buildBenchmarkLotsFromCapitalInCandidate({
        candidate,
        principalFlowUsd,
      });
      if (newLots.length === 0 && principalFlowUsd > 0) {
        unmodeledPrincipalUsd += principalFlowUsd;
      }
      benchmarkLots.push(...newLots);
      continue;
    }

    if (rawTimelineEventType === "partial_swap_attribution") {
      const proceedsUsd = sumCandidateMovementUsd(candidate, "in") ?? Math.abs(candidate.usdValue ?? 0);
      const consumedCostBasisUsd = consumeInventoryLotsByOutflows({
        candidate,
        inventoryLots: withdrawnInventoryLots,
      });
      const realizedContributionUsd = proceedsUsd - consumedCostBasisUsd;
      realizedPnlUsd += realizedContributionUsd;
      candidate.metadataJson.realizedPnlUsd = realizedContributionUsd;
      candidate.metadataJson.realizedCostBasisUsd = consumedCostBasisUsd;
      candidate.metadataJson.swapProceedsUsd = proceedsUsd;
      continue;
    }

    if (["withdraw", "decrease_liquidity", "close", "burn", "unstake"].includes(candidate.eventType)) {
      const principalFlowUsd = Math.abs(candidate.principalFlowUsd ?? 0);
      const actualWithdrawalUsd = sumCandidateMovementUsd(candidate, "in") ?? Math.abs(candidate.usdValue ?? 0);
      const { consumedLots, consumedPrincipalUsd } = consumeBenchmarkLotsByPrincipal({
        lots: benchmarkLots,
        principalUsd: principalFlowUsd,
      });
      const benchmarkValuation = valueBenchmarkLotsAtDate({
        lots: consumedLots,
        occurredAt: candidate.occurredAt,
        priceByTokenDay: input.priceByTokenDay,
      });

      if (benchmarkValuation.usdValue === null) {
        reasonCodes.push(...benchmarkValuation.reasonCodes);
      } else {
        const priceEffectContributionUsd = benchmarkValuation.usdValue - consumedPrincipalUsd;
        const rebalanceContributionUsd = actualWithdrawalUsd - benchmarkValuation.usdValue;
        assetPriceEffectUsd += priceEffectContributionUsd;
        rebalanceEffectUsd += rebalanceContributionUsd;
        candidate.metadataJson.priceEffectUsd = priceEffectContributionUsd;
        candidate.metadataJson.rebalanceEffectUsd = rebalanceContributionUsd;
        candidate.metadataJson.hodlBenchmarkUsd = benchmarkValuation.usdValue;
        candidate.metadataJson.withdrawalValueUsd = actualWithdrawalUsd;
      }

      appendInventoryLotsFromCandidate({
        candidate,
        target: withdrawnInventoryLots,
      });
    }
  }

  const remainingBenchmarkPrincipalUsd = totalLotPrincipalUsd(benchmarkLots);
  if (remainingBenchmarkPrincipalUsd > 0) {
    const remainingBenchmarkValuation = valueBenchmarkLotsAtDate({
      lots: benchmarkLots,
      occurredAt: input.capturedAt,
      priceByTokenDay: input.priceByTokenDay,
    });
    if (remainingBenchmarkValuation.usdValue === null) {
      reasonCodes.push(...remainingBenchmarkValuation.reasonCodes);
    } else {
      assetPriceEffectUsd += remainingBenchmarkValuation.usdValue - remainingBenchmarkPrincipalUsd;
      rebalanceEffectUsd += input.currentValueUsd - remainingBenchmarkValuation.usdValue;
    }
  }

  if (remainingBenchmarkPrincipalUsd <= 0 && unmodeledPrincipalUsd > 0) {
    unrealizedPnlUsd += input.currentValueUsd - unmodeledPrincipalUsd;
  }

  const unattributedUsd = input.totalReturnUsd - (
    input.rewardsUsd +
    feesUsd +
    assetPriceEffectUsd +
    rebalanceEffectUsd +
    realizedPnlUsd +
    unrealizedPnlUsd
  );
  const unattributedReasonCodes = Math.abs(unattributedUsd) > 1e-9
    ? mergeReasonCodes(reasonCodes, ["unattributedResidual"])
    : mergeReasonCodes(reasonCodes);

  return {
    rewardsUsd: input.rewardsUsd,
    feesUsd,
    assetPriceEffectUsd,
    rebalanceEffectUsd,
    realizedPnlUsd,
    unrealizedPnlUsd,
    unattributedUsd,
    unattributedReasonCodes,
  };
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
    input.coverageStatus === "partial" ? ["coverageGap", "residualAmbiguousSource"] : [],
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
  chainId?: number;
  occurredAt: Date;
  tokenAddress: string | null;
  symbol: string | null;
  amountRaw: string;
  directAmountUsd: number | null;
  priceByTokenDay: Map<string, number>;
}) {
  return resolveHistoricalUsdBackfill({
    chainId: input.chainId ?? 8453,
    occurredAt: input.occurredAt,
    tokenAddress: input.tokenAddress,
    symbol: input.symbol,
    amountRaw: input.amountRaw,
    directAmountUsd: input.directAmountUsd,
    priceByTokenDay: input.priceByTokenDay,
  });
}

export function buildSignedTokenDeltas(input: {
  chainId?: number;
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
      chainId: input.chainId,
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
  lifecycleLedgerRowsByTxHash?: Map<string, LifecycleLedgerRow[]>;
  pricedLifecycleMovements: Map<string, PricedMovement[]>;
  inferredActionIdByLedgerEventId: Map<string, string>;
  strategyIdByPoolId: Map<string, string>;
  strategyDebugByPoolId?: Map<string, {
    strategyId: string;
    externalStrategyPositionReference: string | null;
    externalStrategyPositionReferenceStatus: "resolved" | "unresolved" | null;
  }>;
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
    const currentValueFromMetadataUsd = asNullableNumber(depositMetadata.valueUsd);
    const isInRange = asBoolean(depositRuntimeMetadata.isInRange);
    const openedValueUsd = resolveMintValuationUsd({
      deposit,
      mintLedgerEventByTxHash: input.mintLedgerEventByTxHash,
      movementsByLedgerEventId: input.mintOutflowsByLedgerEventId,
      priceByTokenDay: input.priceByTokenDay,
    }) ?? aggregate.openedValueUsd;
    const status = derivePositionStatus({
      rawStatus: deposit.status,
      isInRange,
      hasLiveValuation: currentValueFromMetadataUsd !== null,
      capitalEnteredUsd: openedValueUsd > 0 ? openedValueUsd : aggregate.capitalEnteredUsd,
    });
    const coverageStatus = normalizeCoverageStatus(deposit.coverageStatus);

    const positionLabel = derivePositionLabel({
      tokenSymbols: resolvedTokenSymbols,
      feeTierLabel,
      poolKind,
      tokenId: deposit.tokenId,
    });
    const linkedStrategyDebug = input.strategyDebugByPoolId?.get(deposit.poolId) ?? null;
    const persistedLifecycleRecords = extractPersistedDepositLifecycleRecords(deposit.metadataJson);

    const openingTimelineRow = input.timelineRows.find((row) => row.relatedDepositId === deposit.id && (
      row.eventType === "deposit" || row.eventType === "rebalance" || row.eventType === "redeploy"
    ));
    const openingLedgerEvent = mintTxHash ? input.mintLedgerEventByTxHash.get(mintTxHash) : null;
    const lifecycleCandidates: MaterializedLifecycleCandidate[] = [];

    if (persistedLifecycleRecords.length > 0) {
      const finalDecreaseIndex = (() => {
        for (let index = persistedLifecycleRecords.length - 1; index >= 0; index -= 1) {
          if (persistedLifecycleRecords[index]?.action === "decreaseLiquidity") {
            return index;
          }
        }
        return -1;
      })();

      for (const [index, record] of persistedLifecycleRecords.entries()) {
        const eventType = mapPersistedLifecycleActionToEventType({
          action: record.action,
          isFinalDecrease: finalDecreaseIndex === index,
        });
        if (!eventType) continue;

        const ledgerEvent = selectLifecycleLedgerEventForRecord({
          record,
          ledgerRowsByTxHash: input.lifecycleLedgerRowsByTxHash ?? new Map(),
        });
        const movements = ledgerEvent?.id ? (input.pricedLifecycleMovements.get(ledgerEvent.id) ?? []) : [];
        const occurredAt = ledgerEvent?.occurredAt ?? record.occurredAt ?? input.capturedAt;
        const eventDeltas = buildSignedTokenDeltas({
          chainId: input.chainId,
          occurredAt,
          movements,
          priceByTokenDay: input.priceByTokenDay,
        });

        lifecycleCandidates.push({
          occurredAt,
          logIndex: ledgerEvent?.logIndex ?? index,
          eventType,
          txHash: record.txHash,
          blockNumber: resolveBlockNumber(ledgerEvent?.metadataJson),
          usdValue: eventDeltas.signedUsdTotal !== 0 ? eventDeltas.signedUsdTotal : null,
          signedTokenDeltas: eventDeltas.deltas,
          priceSource: eventDeltas.eventPriceSource,
          confidence: normalizeDepositConfidence(ledgerEvent?.confidence),
          inferredActionId: ledgerEvent?.id ? (input.inferredActionIdByLedgerEventId.get(ledgerEvent.id) ?? null) : null,
          coverageReasonCodes: deriveTimelineCoverageReasonCodes({
            valuationReasonCodes: eventDeltas.reasonCodes,
            coverageStatus,
            confidence: ledgerEvent?.confidence ?? null,
            openedByTransferIn: eventType === "mint_position" ? aggregate.openedByTransferIn : false,
          }),
          metadataJson: {
            source: "persisted_deposit_lifecycle",
            lifecycleAction: record.action,
            category: record.category,
            methodLabel: record.methodLabel,
            summary: record.summary,
            ledgerEventId: ledgerEvent?.id ?? null,
          },
          principalFlowUsd:
            eventType === "mint_position" || eventType === "increase_liquidity"
              ? Math.abs(eventDeltas.signedUsdTotal)
              : null,
        });
      }
    } else if (openingLedgerEvent) {
      const openingMovements = input.pricedLifecycleMovements.get(openingLedgerEvent.id) ?? [];
      const openingDeltas = buildSignedTokenDeltas({
        chainId: input.chainId,
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
        principalFlowUsd: Math.abs(openedValueUsd),
      });
    } else if (openingTimelineRow) {
      const ledgerEvent = openingTimelineRow.sourceLedgerEventId ? input.lifecycleLedgerById.get(openingTimelineRow.sourceLedgerEventId) : null;
      const openingMovements = openingTimelineRow.sourceLedgerEventId
        ? (input.pricedLifecycleMovements.get(openingTimelineRow.sourceLedgerEventId) ?? [])
        : [];
      const inferredActionId = openingTimelineRow.sourceLedgerEventId
        ? (input.inferredActionIdByLedgerEventId.get(openingTimelineRow.sourceLedgerEventId) ?? null)
        : null;
      const timelineEventType = shouldAttachCanonicalTimelineNarrative({
        rawEventType: openingTimelineRow.eventType,
        inferredActionId,
      })
        ? openingTimelineRow.eventType
        : null;
      const openingDeltas = buildSignedTokenDeltas({
        chainId: input.chainId,
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
        inferredActionId,
        coverageReasonCodes: deriveTimelineCoverageReasonCodes({
          valuationReasonCodes: openingDeltas.reasonCodes,
          coverageStatus: openingTimelineRow.coverageStatus,
          confidence: openingTimelineRow.confidence,
          openedByTransferIn: aggregate.openedByTransferIn,
        }),
        metadataJson: {
          source: "timeline_opening_event",
          ...(timelineEventType ? { timelineEventType } : {}),
        },
        principalFlowUsd: asNullableNumber(openingTimelineRow.attributedValueUsd),
      });
    }

    if (persistedLifecycleRecords.length === 0) {
      const depositTimelineRows = input.timelineRows.filter((row) => row.relatedDepositId === deposit.id);
      for (const row of depositTimelineRows) {
        const isOpeningEvent = row === openingTimelineRow;
        if (isOpeningEvent) {
          continue;
        }

        const eventType = mapTimelineEventToLifecycleType({
          rawEventType: row.eventType,
          isOpeningEvent,
          openedByTransferIn: aggregate.openedByTransferIn,
        });
        if (!eventType) continue;
        const inferredActionId = row.sourceLedgerEventId
          ? (input.inferredActionIdByLedgerEventId.get(row.sourceLedgerEventId) ?? null)
          : null;
        const timelineEventType = shouldAttachCanonicalTimelineNarrative({
          rawEventType: row.eventType,
          inferredActionId,
        })
          ? row.eventType
          : null;

        const rowLedgerEventIds = extractTimelineLedgerEventIds(row);
        const ledgerEvents = rowLedgerEventIds
          .map((ledgerEventId) => input.lifecycleLedgerById.get(ledgerEventId) ?? null)
          .filter((ledgerEvent): ledgerEvent is NonNullable<typeof ledgerEvent> => Boolean(ledgerEvent));
        const ledgerEvent = ledgerEvents.at(-1) ?? null;
        const movements = rowLedgerEventIds.flatMap((ledgerEventId) => input.pricedLifecycleMovements.get(ledgerEventId) ?? []);
        const eventDeltas = buildSignedTokenDeltas({
          chainId: input.chainId,
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
          inferredActionId,
          coverageReasonCodes: deriveTimelineCoverageReasonCodes({
            valuationReasonCodes: eventDeltas.reasonCodes,
            coverageStatus: row.coverageStatus,
            confidence: row.confidence,
          }),
          metadataJson: {
            source: "pool_timeline_event",
            ...(timelineEventType ? { timelineEventType } : {}),
            timelineEventId: row.id,
            ledgerEventIds: rowLedgerEventIds,
          },
          principalFlowUsd: asNullableNumber(row.attributedValueUsd),
        });
      }
    }

    const persistedCollectTxHashes = new Set(
      persistedLifecycleRecords
        .filter((record) => record.action === "collect")
        .map((record) => record.txHash),
    );

    // Sum rewards directly from reward_events linked to this deposit, both via
    // deposit_or_strategy_id and the metadata.targetTokenId fallback. The
    // persisted lifecycle "collect" entries are display-only — they may have
    // zero priced movement if the underlying ledger event wasn't linked.
    const depositRewardRows = input.resolvedRewardRows.filter((row) => (
      rewardMatchesDeposit({
        reward: row,
        depositTokenId: deposit.tokenId,
        depositId: deposit.id,
      })
    ));
    for (const row of depositRewardRows) {
      const rewardCoverageReasonCodes = row.resolutionStatus === "resolved"
        ? row.reasonCodes
        : mergeReasonCodes(row.reasonCodes, row.resolutionReasonCodes);

      // Skip pushing a duplicate lifecycle candidate when the persisted
      // lifecycle already carries the same tx as "collect"; the persisted
      // record will render in the lifecycle UI. We still count the reward_event
      // value below for the totalRewards sum.
      if (persistedCollectTxHashes.has(row.txHash.toLowerCase())) {
        continue;
      }
      lifecycleCandidates.push({
        occurredAt: row.occurredAt,
        logIndex: row.logIndex,
        eventType: "claim_reward",
        txHash: row.txHash,
        blockNumber: asInteger(asRecord(row.metadataJson).blockNumber) ?? 0,
        usdValue: row.resolvedAmountUsd,
        signedTokenDeltas: row.resolvedTokenDeltas,
        priceSource: row.priceSource,
        confidence: normalizeDepositConfidence(rewardCoverageReasonCodes.length > 0 ? "degraded" : "high"),
        inferredActionId: null,
        coverageReasonCodes: rewardCoverageReasonCodes,
        metadataJson: {
          source: "reward_event",
          rewardEventId: row.id,
          rewardType: row.rewardType,
          resolutionStatus: row.resolutionStatus,
          resolutionReasonCodes: row.resolutionReasonCodes,
        },
        principalFlowUsd: null,
      });
    }

    lifecycleCandidates.sort((left, right) => {
      const timeDelta = left.occurredAt.getTime() - right.occurredAt.getTime();
      if (timeDelta !== 0) return timeDelta;
      return left.logIndex - right.logIndex;
    });

    // Total rewards = sum of every reward_event linked to this deposit.
    // This is independent of how the deposit lifecycle records the tx, so a
    // deposit's totalRewards is purely a join + sum over reward_events.
    const countableRewardRows = depositRewardRows.filter((row) => (
      row.resolutionStatus === "resolved"
    ));
    const rewards = countableRewardRows.reduce(
      (sum, row) => sum + Math.abs(row.resolvedAmountUsd ?? 0),
      0,
    );
    const capitalEnteredFromLifecycle = lifecycleCandidates
      .filter((candidate) => candidate.eventType === "mint_position" || candidate.eventType === "increase_liquidity" || candidate.eventType === "transfer_in")
      .reduce((sum, candidate) => sum + (candidate.principalFlowUsd ?? Math.abs(sumCandidateMovementUsd(candidate, "out") ?? candidate.usdValue ?? 0)), 0);
    const capitalEntered = capitalEnteredFromLifecycle > 0
      ? capitalEnteredFromLifecycle
      : openedValueUsd > 0
        ? openedValueUsd
        : aggregate.capitalEnteredUsd;
    const withdrawalCandidates = lifecycleCandidates.filter((candidate) => (
      candidate.eventType === "decrease_liquidity"
      || candidate.eventType === "withdraw"
      || candidate.eventType === "close"
      || candidate.eventType === "burn"
      || candidate.eventType === "unstake"
    ));
    const exitCandidates = withdrawalCandidates.filter((candidate) =>
      asString(candidate.metadataJson.timelineEventType) !== "partial_swap_attribution",
    );
    const capitalWithdrawnFromLifecycle = (exitCandidates.length > 0 ? exitCandidates : withdrawalCandidates).reduce(
      (sum, candidate) => sum + (sumCandidateMovementUsd(candidate, "in") ?? Math.abs(candidate.usdValue ?? 0)),
      0,
    );
    const capitalWithdrawn = capitalWithdrawnFromLifecycle > 0
      ? capitalWithdrawnFromLifecycle
      : aggregate.capitalWithdrawnUsd;
    const realizedExitValueUsd = status === "closed"
      ? Math.max(aggregate.capitalWithdrawnUsd, capitalWithdrawn)
      : capitalWithdrawn;
    const latestWithdrawalCandidate = (exitCandidates.length > 0 ? exitCandidates : withdrawalCandidates).at(-1) ?? null;
    const closedLatestValuationCandidateUsd = latestWithdrawalCandidate
      ? (sumCandidateMovementUsd(latestWithdrawalCandidate, "in") ?? Math.abs(latestWithdrawalCandidate.usdValue ?? 0))
      : null;
    const closedLatestValuationUsd =
      closedLatestValuationCandidateUsd !== null && closedLatestValuationCandidateUsd > 0
        ? closedLatestValuationCandidateUsd
        : null;
    const netInvested = Math.max(capitalEntered - capitalWithdrawn, 0);
    const currentValueUsd = status === "closed"
      ? (closedLatestValuationUsd ?? currentValueFromMetadataUsd ?? capitalWithdrawn)
      : (currentValueFromMetadataUsd ?? netInvested);
    // Single total-return formula across open and closed deposits:
    //   total return = current valuation (or realized exit value) - initial capital + rewards
    // For closed deposits the "current valuation" is the value of the assets
    // received at the burn tx; for open ones it is the live position valuation.
    const realizedPnlUsd = status === "closed" ? realizedExitValueUsd - capitalEntered : 0;
    const unrealizedPnlUsd = status === "closed" ? 0 : currentValueUsd - netInvested;
    const totalReturnUsd = currentValueUsd - capitalEntered + rewards;
    const totalReturnPct = capitalEntered > 0 ? totalReturnUsd / capitalEntered : null;

    let estimatedAnnualizedReturnPct: number | null = null;
    if (aggregate.openedAt && totalReturnPct !== null) {
      const endRef = latestWithdrawalCandidate?.occurredAt ?? aggregate.closedAt ?? input.capturedAt;
      const days = Math.max(1, Math.round((endRef.getTime() - aggregate.openedAt.getTime()) / MS_PER_DAY));
      estimatedAnnualizedReturnPct = totalReturnPct * (365 / days);
    }

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

    const provisionalReasonCodes = mergeReasonCodes(baseReasonCodes, lifecycleReasonCodes);

    const decomposition = deriveDepositPerformanceDecomposition({
      lifecycleCandidates,
      currentValueUsd: status === "closed" ? 0 : currentValueUsd,
      rewardsUsd: rewards,
      totalReturnUsd,
      capturedAt: input.capturedAt,
      priceByTokenDay: input.priceByTokenDay,
    });
    const reasonCodes = decomposition.unattributedReasonCodes.length > 0
      ? mergeReasonCodes(provisionalReasonCodes, decomposition.unattributedReasonCodes)
      : provisionalReasonCodes;
    const finalCoverageStatus = reasonCodes.length > 0 && coverageStatus === "full"
      ? "partial"
      : coverageStatus;
    const confidence = deriveConfidence({
      coverageStatus: finalCoverageStatus,
      openedByTransferIn: aggregate.openedByTransferIn,
    });
    const denominator = totalReturnUsd === 0 ? null : totalReturnUsd;

    decompositionRowsToInsert.push({
      chainId: input.chainId,
      walletAddress: input.walletAddress,
      depositId: deposit.id,
      latestRunId: input.runId,
      totalReturnUsd: String(totalReturnUsd),
      rewardsUsd: String(decomposition.rewardsUsd),
      feesUsd: String(decomposition.feesUsd),
      assetPriceEffectUsd: String(decomposition.assetPriceEffectUsd),
      rebalanceEffectUsd: String(decomposition.rebalanceEffectUsd),
      realizedPnlUsd: String(decomposition.realizedPnlUsd),
      unrealizedPnlUsd: String(decomposition.unrealizedPnlUsd),
      unattributedUsd: String(decomposition.unattributedUsd),
      unattributedReasonCodes: reasonCodes,
      componentPercentages: denominator === null
        ? {}
        : {
        rewardsUsd: decomposition.rewardsUsd / denominator,
        feesUsd: decomposition.feesUsd / denominator,
        assetPriceEffectUsd: decomposition.assetPriceEffectUsd / denominator,
        rebalanceEffectUsd: decomposition.rebalanceEffectUsd / denominator,
        realizedPnlUsd: decomposition.realizedPnlUsd / denominator,
        unrealizedPnlUsd: decomposition.unrealizedPnlUsd / denominator,
        unattributedUsd: decomposition.unattributedUsd / denominator,
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
        latestWithdrawalCandidate?.occurredAt ??
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
      isInRange,
      coverageStatus: finalCoverageStatus,
      confidence,
      coverageReasonCodes: reasonCodes,
      coveredStartDayUtc: input.startDayUtc,
      coveredEndDayUtc: input.endDayUtc,
      mellowStrategyCrossLinkId: input.strategyIdByPoolId.get(deposit.poolId) ?? null,
      metadataJson: {
        materializerVersion: "010-detail-1",
        ...(linkedStrategyDebug
          ? {
              linkedStrategyDebug: {
                strategyId: linkedStrategyDebug.strategyId,
                externalStrategyPositionReference: linkedStrategyDebug.externalStrategyPositionReference,
                externalStrategyPositionReferenceStatus: linkedStrategyDebug.externalStrategyPositionReferenceStatus,
              },
            }
          : {}),
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

export function shouldAttachCanonicalTimelineNarrative(input: {
  rawEventType: string;
  inferredActionId: string | null;
}) {
  return !(
    (input.rawEventType === "rebalance" || input.rawEventType === "redeploy")
    && !input.inferredActionId
  );
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

export function buildStrategyDebugByPoolId(rows: Array<{
  strategyId: string;
  primaryPoolId: string | null;
  externalStrategyPositionReference: string | null;
  externalStrategyPositionReferenceStatus: "resolved" | "unresolved" | null;
}>) {
  const strategyDebugByPoolId = new Map<string, {
    strategyId: string;
    externalStrategyPositionReference: string | null;
    externalStrategyPositionReferenceStatus: "resolved" | "unresolved" | null;
  }>();

  for (const row of rows) {
    if (row.primaryPoolId && !strategyDebugByPoolId.has(row.primaryPoolId)) {
      strategyDebugByPoolId.set(row.primaryPoolId, {
        strategyId: row.strategyId,
        externalStrategyPositionReference: row.externalStrategyPositionReference,
        externalStrategyPositionReferenceStatus: row.externalStrategyPositionReferenceStatus,
      });
    }
  }

  return strategyDebugByPoolId;
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
    ? startOfUtcDay(new Date(Math.min(...mintOccurredAtValues.map((value) => value.getTime()))))
    : null;
  const latestMintOccurredAtExclusive = mintOccurredAtValues.length > 0
    ? nextUtcDay(new Date(Math.max(...mintOccurredAtValues.map((value) => value.getTime()))))
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

  const priceByTokenDay = hydrateHistoricalPriceLookup({
    priceRows: pricePointRows,
  });

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

  const strategyCrossLinkRows = await db
    .select({
      strategyId: strategies.id,
      primaryPoolId: strategies.primaryPoolId,
      externalStrategyPositionReference:
        sql<string | null>`${strategyExposures.metadataJson} ->> 'externalDepositReference'`,
      externalStrategyPositionReferenceStatus:
        sql<"resolved" | "unresolved" | null>`${strategyExposures.metadataJson} ->> 'externalDepositReferenceStatus'`,
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
  const strategyDebugByPoolId = buildStrategyDebugByPoolId(strategyCrossLinkRows);
  // Wallet deposits' token IDs are used as a secondary attribution path so
  // orphan reward events (claims with `deposit_or_strategy_id = NULL`) still
  // reach the matching deposit when their `metadata.targetTokenId` lines up.
  // Without this, claims persisted before the resolver fix would never show
  // up against any deposit, leaving "Total rewards" stuck at 0.
  const knownDepositTokenIds = Array.from(new Set(
    eligibleDeposits
      .map((row) => row.tokenId)
      .filter((tokenId): tokenId is string => Boolean(tokenId)),
  ));

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
      resolutionReasonCodes: rewardEvents.resolutionReasonCodes,
      metadataJson: rewardEvents.metadataJson,
    })
    .from(rewardEvents)
    .where(
      and(
        eq(rewardEvents.chainId, input.chainId),
        eq(rewardEvents.walletAddress, input.walletAddress),
        eq(rewardEvents.isAccrualSnapshot, false),
        or(
          inArray(rewardEvents.depositOrStrategyId, depositIds),
          knownDepositTokenIds.length > 0
            ? and(
                isNull(rewardEvents.depositOrStrategyId),
                inArray(sql`${rewardEvents.metadataJson} ->> 'targetTokenId'`, knownDepositTokenIds),
              )
            : sql`false`,
        ),
      ),
    );

  const rewardTxHashes = Array.from(new Set(
    rewardRows
      .map((row) => (typeof row.txHash === "string" ? row.txHash.toLowerCase() : null))
      .filter((value): value is string => Boolean(value)),
  ));
  const rewardTxHashSet = new Set(rewardTxHashes);

  const depositPoolIds = Array.from(new Set(eligibleDeposits.map((deposit) => deposit.poolId)));

  const gaugeContractRows = depositPoolIds.length > 0
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
    if (!poolId || !depositPoolIds.includes(poolId)) continue;
    poolIdByGaugeAddress.set(row.address.toLowerCase(), poolId);
  }

  const syntheticRewardClassifications = ["claim", "unstake"] as const;
  const syntheticRewardMethodLabels = new Set(["getreward", "getrewards", "claim", "collect", "withdraw"]);
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
          inArray(ledgerEvents.classification, syntheticRewardClassifications),
        ),
      ))
      .flatMap((row) => {
        const metadata = asRecord(row.metadataJson);
        const gaugeAddress = normalizeTokenAddress(asString(metadata.toAddress));
        const methodLabel = asString(metadata.methodLabel)?.toLowerCase() ?? null;
        if (!gaugeAddress || !methodLabel || !syntheticRewardMethodLabels.has(methodLabel)) {
          return [];
        }

        const poolId = poolIdByGaugeAddress.get(gaugeAddress);
        if (!poolId) {
          return [];
        }

        const depositId = resolveSyntheticGaugeClaimDepositId({
          metadataJson: row.metadataJson,
          txHash: row.txHash,
          deposits: eligibleDeposits,
        });
        if (!depositId) {
          return [];
        }

        if (rewardTxHashSet.has(row.txHash.toLowerCase())) {
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
    timelineRows.flatMap((row) => extractTimelineLedgerEventIds(row)),
  ));

  const persistedLifecycleTxHashes = Array.from(new Set(
    eligibleDeposits.flatMap((deposit) => (
      extractPersistedDepositLifecycleRecords(deposit.metadataJson).map((record) => record.txHash)
    )),
  ));

  const lifecycleLedgerEventIds = Array.from(new Set([...mintLedgerEventIds, ...sourceLedgerEventIds]));
  const lifecycleLedgerRowsById = lifecycleLedgerEventIds.length > 0
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

  const lifecycleLedgerRowsByTxHash = persistedLifecycleTxHashes.length > 0
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
          inArray(ledgerEvents.txHash, persistedLifecycleTxHashes),
        ),
      )
    : [];

  const lifecycleLedgerRows = Array.from(new Map(
    [...lifecycleLedgerRowsById, ...lifecycleLedgerRowsByTxHash].map((row) => [row.id, row]),
  ).values());

  const lifecycleLedgerById = new Map(lifecycleLedgerRows.map((row) => [row.id, row]));
  const lifecycleLedgerRowsByTxHashMap = new Map<string, LifecycleLedgerRow[]>();
  for (const row of lifecycleLedgerRows) {
    const bucket = lifecycleLedgerRowsByTxHashMap.get(row.txHash.toLowerCase()) ?? [];
    bucket.push(row);
    lifecycleLedgerRowsByTxHashMap.set(row.txHash.toLowerCase(), bucket);
  }
  for (const bucket of lifecycleLedgerRowsByTxHashMap.values()) {
    bucket.sort((left, right) => {
      const timeDelta = (left.occurredAt?.getTime() ?? 0) - (right.occurredAt?.getTime() ?? 0);
      if (timeDelta !== 0) return timeDelta;
      return left.logIndex - right.logIndex;
    });
  }
  const allLifecycleLedgerEventIds = lifecycleLedgerRows.map((row) => row.id);
  const lifecycleMovementRows = allLifecycleLedgerEventIds.length > 0
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
          inArray(assetMovements.ledgerEventId, allLifecycleLedgerEventIds),
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

  hydrateHistoricalPriceLookup({
    priceRows: extendedPricePointRows,
    target: priceByTokenDay,
  });

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

  const enhancedRewardRows: RewardLikeRow[] = rewardRows.map((row) => {
    const tokenAddress = normalizeTokenAddress(row.tokenAddress);
    const metadata = asRecord(row.metadataJson);
    const symbol = asString(metadata.symbol);
    const occurredAt = row.occurredAt instanceof Date ? row.occurredAt : input.capturedAt;
    const amountRaw = typeof row.amountRaw === "string" ? row.amountRaw : String(row.amountRaw ?? "0");
    const directResolved = resolveUsdValuation({
      chainId: input.chainId,
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
        chainId: input.chainId,
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
      reasonCodes: row.resolutionStatus === "resolved"
        ? reasonCodes
        : mergeReasonCodes(reasonCodes, row.resolutionReasonCodes),
      resolutionReasonCodes: row.resolutionReasonCodes,
      resolvedTokenDeltas,
    };
  });

  const syntheticManualClaimRewardRows: RewardLikeRow[] = syntheticManualClaimCandidates.flatMap((row) => {
    const movements = syntheticManualClaimMovementsByLedgerEventId.get(row.id) ?? [];
    if (movements.length === 0) {
      return [];
    }

    const resolved = buildSignedTokenDeltas({
      chainId: input.chainId,
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
      resolutionReasonCodes: [],
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
    lifecycleLedgerRowsByTxHash: lifecycleLedgerRowsByTxHashMap,
    pricedLifecycleMovements,
    inferredActionIdByLedgerEventId,
    strategyIdByPoolId,
    strategyDebugByPoolId,
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
