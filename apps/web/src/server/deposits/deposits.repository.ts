import { and, asc, eq } from "drizzle-orm";

import { engineV2ReadModelsEnabled, readEngineV2SurfaceRows } from "@/server/analysis/engine-v2/materializers";
import { getDb } from "@/server/db/client";
import {
  depositLifecycleEvents,
  depositPerformanceDecompositions,
  depositWalletSummaries,
  pools,
  strategyExposures,
} from "@/server/db/schema";
import type {
  DepositDetailView,
  DepositLifecycleEventView,
  DepositLifecycleTokenDelta,
  DepositPerformanceDecompositionView,
  DepositSummaryView,
} from "@/server/deposits/deposits.types";

function hasRichEngineV2DepositRow(row: Partial<DepositDetailView>) {
  return Boolean(
    (row.poolLabel && row.poolId && row.poolLabel !== row.poolId)
      || row.token0Symbol
      || row.token1Symbol
      || row.coveredStartDayUtc
      || row.coveredEndDayUtc
      || row.tickLower !== null
      || row.tickUpper !== null
      || row.rangeLowerPrice !== null
      || row.rangeUpperPrice !== null
      || (Array.isArray(row.lifecycle) && row.lifecycle.length > 0),
  );
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asNullableNumber(value: unknown) {
  return asNumber(value);
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeStatus(value: string): DepositSummaryView["status"] {
  switch (value) {
    case "open_active":
    case "open_out_of_range":
    case "closed":
      return value;
    default:
      return "open_active";
  }
}

function normalizeCoverage(value: string): DepositSummaryView["coverageStatus"] {
  switch (value) {
    case "full":
    case "share_level":
    case "partial":
    case "unknown":
      return value;
    default:
      return "unknown";
  }
}

function normalizeConfidence(value: string): DepositSummaryView["confidence"] {
  switch (value) {
    case "high":
    case "medium":
    case "degraded":
    case "unknown":
      return value;
    default:
      return "unknown";
  }
}

function normalizePoolKind(value: string): DepositSummaryView["poolKind"] {
  switch (value) {
    case "cl":
    case "basic_stable":
    case "basic_volatile":
      return value;
    default:
      return "unknown";
  }
}

function toIso(value: Date | string | null): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

function normalizePriceSource(value: string | null): DepositLifecycleEventView["priceSource"] {
  switch (value) {
    case "event":
    case "pricePointFallback":
    case "unavailable":
      return value;
    default:
      return null;
  }
}

function deriveEngineV2DepositStatus(row: Partial<DepositDetailView>) {
  if (row.closedAt) {
    return "closed" as const;
  }
  return row.isInRange === false ? "open_out_of_range" as const : "open_active" as const;
}

function sumEngineV2DepositLifecycleRewards(row: Partial<DepositDetailView>) {
  if (!Array.isArray((row as { lifecycle?: unknown[] }).lifecycle)) {
    return null;
  }

  return ((row as { lifecycle?: unknown[] }).lifecycle ?? []).reduce((sum, event) => {
    const record = asRecord(event);
    if (asString(record.eventType) !== "claim_reward") {
      return sum;
    }
    return sum + (asNumber(record.usdValue) ?? 0);
  }, 0);
}

export function normalizeEngineV2DepositRow<T extends DepositSummaryView>(row: T): T;
export function normalizeEngineV2DepositRow<T extends DepositDetailView>(row: T): T;
export function normalizeEngineV2DepositRow<T extends DepositSummaryView | DepositDetailView>(row: T): T {
  const derivedRewardsUsd = sumEngineV2DepositLifecycleRewards(row);
  const totalRewardsUsd = derivedRewardsUsd ?? row.totalRewardsUsd;
  const totalReturnUsd = totalRewardsUsd + row.realizedPnlUsd + row.unrealizedPnlUsd;

  const normalized = {
    ...row,
    status: deriveEngineV2DepositStatus(row),
    totalRewardsUsd,
    totalReturnUsd,
  } as T;

  if ("decomposition" in normalized && normalized.decomposition) {
    normalized.decomposition = {
      ...normalized.decomposition,
      totalReturnUsd,
      rewardsUsd: totalRewardsUsd,
      feesUsd: 0,
    };
  }

  return normalized;
}

function normalizeLifecycleEventType(value: string): DepositLifecycleEventView["eventType"] {
  switch (value) {
    case "mint_position":
    case "increase_liquidity":
    case "stake":
    case "claim_reward":
    case "unstake":
    case "decrease_liquidity":
    case "collect_fees":
    case "withdraw":
    case "burn":
    case "close":
    case "transfer_in":
      return value;
    default:
      return "claim_reward";
  }
}

export type DepositSummaryRowRecord = {
  depositId: string;
  poolId: string;
  poolLabel: string;
  positionLabel: string;
  poolKind: string;
  feeTierBps: number | null;
  tokenId: string | null;
  token0Symbol: string | null;
  token1Symbol: string | null;
  status: string;
  openedAt: Date | string | null;
  closedAt: Date | string | null;
  openedByTransferIn: boolean;
  openedValueUsd: unknown;
  currentValueUsd: unknown;
  capitalEnteredUsd: unknown;
  capitalWithdrawnUsd: unknown;
  totalRewardsUsd: unknown;
  realizedPnlUsd: unknown;
  unrealizedPnlUsd: unknown;
  totalReturnUsd: unknown;
  totalReturnPct: unknown;
  estimatedAnnualizedReturnPct: unknown;
  isInRange: boolean | null;
  rangeLowerPrice: unknown;
  rangeUpperPrice: unknown;
  coverageStatus: string;
  confidence: string;
  coverageReasonCodes: string[] | null;
  coveredStartDayUtc: string | null;
  coveredEndDayUtc: string | null;
  metadataJson?: Record<string, unknown> | null;
};

export type DepositLifecycleEventRowRecord = {
  id: string;
  sequenceIndex: number;
  eventType: string;
  occurredAt: Date | string | null;
  txHash: string;
  logIndex: number;
  blockNumber: number;
  usdValue: unknown;
  signedTokenDeltas: unknown;
  priceSource: string | null;
  confidence: unknown;
  inferredActionId: string | null;
  coverageReasonCodes: string[] | null;
  metadataJson: Record<string, unknown> | null;
};

export type DepositDecompositionRowRecord = {
  totalReturnUsd: unknown;
  rewardsUsd: unknown;
  feesUsd: unknown;
  assetPriceEffectUsd: unknown;
  rebalanceEffectUsd: unknown;
  realizedPnlUsd: unknown;
  unrealizedPnlUsd: unknown;
  unattributedUsd: unknown;
  unattributedReasonCodes: string[] | null;
  componentPercentages: Record<string, number> | null;
};

export type DepositDetailRowRecord = DepositSummaryRowRecord & {
  token0Address: string | null;
  token1Address: string | null;
  tickLower: number | null;
  tickUpper: number | null;
  mellowStrategyCrossLinkId: string | null;
};

function readLinkedStrategyDebug(value: unknown) {
  const metadata = asRecord(value);
  const linkedStrategyDebug = asRecord(metadata.linkedStrategyDebug);
  const externalStrategyPositionReference = asString(linkedStrategyDebug.externalStrategyPositionReference);
  const externalStrategyPositionReferenceStatus = asString(linkedStrategyDebug.externalStrategyPositionReferenceStatus);
  const normalizedStatus: "resolved" | "unresolved" | null =
    externalStrategyPositionReferenceStatus === "resolved" || externalStrategyPositionReferenceStatus === "unresolved"
      ? externalStrategyPositionReferenceStatus
      : null;

  return {
    strategyId: asString(linkedStrategyDebug.strategyId),
    externalStrategyPositionReference,
    externalStrategyPositionReferenceStatus: normalizedStatus,
  };
}

function parseSignedTokenDeltas(value: unknown): DepositLifecycleTokenDelta[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    const record = asRecord(entry);
    return {
      tokenAddress: asString(record.tokenAddress),
      symbol: asString(record.symbol),
      direction: record.direction === "out" ? "out" : "in",
      amountRaw: asString(record.amountRaw) ?? "0",
      amountFormatted: asString(record.amountFormatted),
      usdValue: asNullableNumber(record.usdValue),
      priceSource: normalizePriceSource(asString(record.priceSource)),
    };
  });
}

export function mapDepositLifecycleEventRow(eventRow: DepositLifecycleEventRowRecord): DepositLifecycleEventView {
  return {
    id: eventRow.id,
    sequenceIndex: eventRow.sequenceIndex,
    eventType: normalizeLifecycleEventType(eventRow.eventType),
    occurredAt: toIso(eventRow.occurredAt) ?? new Date(0).toISOString(),
    txHash: eventRow.txHash,
    logIndex: eventRow.logIndex,
    blockNumber: eventRow.blockNumber,
    usdValue: asNullableNumber(eventRow.usdValue),
    signedTokenDeltas: parseSignedTokenDeltas(eventRow.signedTokenDeltas),
    priceSource: normalizePriceSource(eventRow.priceSource),
    confidence: normalizeConfidence(String(eventRow.confidence ?? "unknown")),
    inferredActionId: eventRow.inferredActionId,
    coverageReasonCodes: eventRow.coverageReasonCodes ?? [],
    metadata: (eventRow.metadataJson ?? {}) as Record<string, unknown>,
  };
}

export function mapDepositSummaryRow(row: DepositSummaryRowRecord): DepositSummaryView {
  const linkedStrategyDebug = readLinkedStrategyDebug(row.metadataJson);

  return {
    depositId: row.depositId,
    poolId: row.poolId,
    poolLabel: row.poolLabel,
    positionLabel: row.positionLabel,
    poolKind: normalizePoolKind(row.poolKind),
    feeTierBps: row.feeTierBps,
    tokenId: row.tokenId,
    token0Symbol: row.token0Symbol,
    token1Symbol: row.token1Symbol,
    status: normalizeStatus(row.status),
    openedAt: toIso(row.openedAt),
    closedAt: toIso(row.closedAt),
    openedByTransferIn: row.openedByTransferIn,
    openedValueUsd: asNumber(row.openedValueUsd) ?? 0,
    currentValueUsd: asNumber(row.currentValueUsd) ?? 0,
    capitalEnteredUsd: asNumber(row.capitalEnteredUsd) ?? 0,
    capitalWithdrawnUsd: asNumber(row.capitalWithdrawnUsd) ?? 0,
    totalRewardsUsd: asNumber(row.totalRewardsUsd) ?? 0,
    realizedPnlUsd: asNumber(row.realizedPnlUsd) ?? 0,
    unrealizedPnlUsd: asNumber(row.unrealizedPnlUsd) ?? 0,
    totalReturnUsd: asNumber(row.totalReturnUsd) ?? 0,
    totalReturnPct: asNullableNumber(row.totalReturnPct),
    estimatedAnnualizedReturnPct: asNullableNumber(row.estimatedAnnualizedReturnPct),
    isInRange: row.isInRange,
    rangeLowerPrice: asNullableNumber(row.rangeLowerPrice),
    rangeUpperPrice: asNullableNumber(row.rangeUpperPrice),
    coverageStatus: normalizeCoverage(row.coverageStatus),
    confidence: normalizeConfidence(row.confidence),
    coverageReasonCodes: row.coverageReasonCodes ?? [],
    coveredStartDayUtc: row.coveredStartDayUtc,
    coveredEndDayUtc: row.coveredEndDayUtc,
    mellowStrategyExternalPositionReference: linkedStrategyDebug.externalStrategyPositionReference,
    mellowStrategyExternalPositionReferenceStatus: linkedStrategyDebug.externalStrategyPositionReferenceStatus,
  };
}

export function mapDepositDetailRows(input: {
  row: DepositDetailRowRecord;
  decompositionRow?: DepositDecompositionRowRecord | null;
  lifecycleRows: DepositLifecycleEventRowRecord[];
}): DepositDetailView {
  const decompositionRow = input.decompositionRow ?? null;
  const decomposition: DepositPerformanceDecompositionView = {
    totalReturnUsd: asNumber(decompositionRow?.totalReturnUsd) ?? asNumber(input.row.totalReturnUsd) ?? 0,
    rewardsUsd: asNumber(decompositionRow?.rewardsUsd) ?? asNumber(input.row.totalRewardsUsd) ?? 0,
    feesUsd: asNumber(decompositionRow?.feesUsd) ?? 0,
    assetPriceEffectUsd: asNumber(decompositionRow?.assetPriceEffectUsd) ?? 0,
    rebalanceEffectUsd: asNumber(decompositionRow?.rebalanceEffectUsd) ?? 0,
    realizedPnlUsd: asNumber(decompositionRow?.realizedPnlUsd) ?? asNumber(input.row.realizedPnlUsd) ?? 0,
    unrealizedPnlUsd: asNumber(decompositionRow?.unrealizedPnlUsd) ?? asNumber(input.row.unrealizedPnlUsd) ?? 0,
    unattributedUsd: asNumber(decompositionRow?.unattributedUsd) ?? 0,
    unattributedReasonCodes: decompositionRow?.unattributedReasonCodes ?? [],
    componentPercentages: (decompositionRow?.componentPercentages ?? {}) as Record<string, number>,
  };

  return {
    ...mapDepositSummaryRow(input.row),
    token0Address: input.row.token0Address,
    token1Address: input.row.token1Address,
    tickLower: input.row.tickLower,
    tickUpper: input.row.tickUpper,
    decomposition,
    lifecycle: input.lifecycleRows.map((eventRow) => mapDepositLifecycleEventRow(eventRow)),
    mellowStrategyCrossLinkId: input.row.mellowStrategyCrossLinkId,
  };
}

export async function findDepositSummaries(input: {
  walletAddress: string;
  chainId: number;
}): Promise<DepositSummaryView[]> {
  const engineV2Rows = await readEngineV2SurfaceRows<DepositSummaryView>({
    chainId: input.chainId,
    walletAddress: input.walletAddress,
    surface: "deposits",
  });
  if (engineV2Rows?.some((row) => hasRichEngineV2DepositRow(row))) {
    return engineV2Rows.map((row) => normalizeEngineV2DepositRow(row));
  }

  const db = await getDb();
  const rows = await db
    .select({
      depositId: depositWalletSummaries.depositId,
      poolId: depositWalletSummaries.poolId,
      poolLabel: pools.label,
      positionLabel: depositWalletSummaries.positionLabel,
      poolKind: depositWalletSummaries.poolKind,
      feeTierBps: depositWalletSummaries.feeTierBps,
      tokenId: depositWalletSummaries.tokenId,
      token0Symbol: depositWalletSummaries.token0Symbol,
      token1Symbol: depositWalletSummaries.token1Symbol,
      status: depositWalletSummaries.status,
      openedAt: depositWalletSummaries.openedAt,
      closedAt: depositWalletSummaries.closedAt,
      openedByTransferIn: depositWalletSummaries.openedByTransferIn,
      openedValueUsd: depositWalletSummaries.openedValueUsd,
      currentValueUsd: depositWalletSummaries.currentValueUsd,
      capitalEnteredUsd: depositWalletSummaries.capitalEnteredUsd,
      capitalWithdrawnUsd: depositWalletSummaries.capitalWithdrawnUsd,
      totalRewardsUsd: depositWalletSummaries.totalRewardsUsd,
      realizedPnlUsd: depositWalletSummaries.realizedPnlUsd,
      unrealizedPnlUsd: depositWalletSummaries.unrealizedPnlUsd,
      totalReturnUsd: depositWalletSummaries.totalReturnUsd,
      totalReturnPct: depositWalletSummaries.totalReturnPct,
      estimatedAnnualizedReturnPct: depositWalletSummaries.estimatedAnnualizedReturnPct,
      isInRange: depositWalletSummaries.isInRange,
      rangeLowerPrice: depositWalletSummaries.rangeLowerPrice,
      rangeUpperPrice: depositWalletSummaries.rangeUpperPrice,
      coverageStatus: depositWalletSummaries.coverageStatus,
      confidence: depositWalletSummaries.confidence,
      coverageReasonCodes: depositWalletSummaries.coverageReasonCodes,
      coveredStartDayUtc: depositWalletSummaries.coveredStartDayUtc,
      coveredEndDayUtc: depositWalletSummaries.coveredEndDayUtc,
      metadataJson: depositWalletSummaries.metadataJson,
    })
    .from(depositWalletSummaries)
    .innerJoin(pools, eq(pools.id, depositWalletSummaries.poolId))
    .where(
      and(
        eq(depositWalletSummaries.chainId, input.chainId),
        eq(depositWalletSummaries.walletAddress, input.walletAddress),
      ),
    );

  return rows.map((row) => mapDepositSummaryRow(row));
}

export async function findDepositDetail(input: {
  walletAddress: string;
  chainId: number;
  depositId: string;
}): Promise<DepositDetailView | null> {
  const engineV2Rows = await readEngineV2SurfaceRows<DepositDetailView>({
    chainId: input.chainId,
    walletAddress: input.walletAddress,
    surface: "deposits",
  });
  const engineV2Detail = engineV2Rows?.find((row) => row.depositId === input.depositId);
  if (engineV2Detail && hasRichEngineV2DepositRow(engineV2Detail)) return normalizeEngineV2DepositRow(engineV2Detail);

  const db = await getDb();
  const rows = await db
    .select({
      depositId: depositWalletSummaries.depositId,
      poolId: depositWalletSummaries.poolId,
      poolLabel: pools.label,
      positionLabel: depositWalletSummaries.positionLabel,
      poolKind: depositWalletSummaries.poolKind,
      feeTierBps: depositWalletSummaries.feeTierBps,
      tokenId: depositWalletSummaries.tokenId,
      token0Address: depositWalletSummaries.token0Address,
      token0Symbol: depositWalletSummaries.token0Symbol,
      token1Address: depositWalletSummaries.token1Address,
      token1Symbol: depositWalletSummaries.token1Symbol,
      status: depositWalletSummaries.status,
      openedAt: depositWalletSummaries.openedAt,
      closedAt: depositWalletSummaries.closedAt,
      openedByTransferIn: depositWalletSummaries.openedByTransferIn,
      openedValueUsd: depositWalletSummaries.openedValueUsd,
      currentValueUsd: depositWalletSummaries.currentValueUsd,
      capitalEnteredUsd: depositWalletSummaries.capitalEnteredUsd,
      capitalWithdrawnUsd: depositWalletSummaries.capitalWithdrawnUsd,
      totalRewardsUsd: depositWalletSummaries.totalRewardsUsd,
      realizedPnlUsd: depositWalletSummaries.realizedPnlUsd,
      unrealizedPnlUsd: depositWalletSummaries.unrealizedPnlUsd,
      totalReturnUsd: depositWalletSummaries.totalReturnUsd,
      totalReturnPct: depositWalletSummaries.totalReturnPct,
      estimatedAnnualizedReturnPct: depositWalletSummaries.estimatedAnnualizedReturnPct,
      tickLower: depositWalletSummaries.tickLower,
      tickUpper: depositWalletSummaries.tickUpper,
      isInRange: depositWalletSummaries.isInRange,
      rangeLowerPrice: depositWalletSummaries.rangeLowerPrice,
      rangeUpperPrice: depositWalletSummaries.rangeUpperPrice,
      coverageStatus: depositWalletSummaries.coverageStatus,
      confidence: depositWalletSummaries.confidence,
      coverageReasonCodes: depositWalletSummaries.coverageReasonCodes,
      coveredStartDayUtc: depositWalletSummaries.coveredStartDayUtc,
      coveredEndDayUtc: depositWalletSummaries.coveredEndDayUtc,
      mellowStrategyCrossLinkId: depositWalletSummaries.mellowStrategyCrossLinkId,
      metadataJson: depositWalletSummaries.metadataJson,
    })
    .from(depositWalletSummaries)
    .innerJoin(pools, eq(pools.id, depositWalletSummaries.poolId))
    .where(
      and(
        eq(depositWalletSummaries.chainId, input.chainId),
        eq(depositWalletSummaries.walletAddress, input.walletAddress),
        eq(depositWalletSummaries.depositId, input.depositId),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const [decompositionRows, lifecycleRows] = await Promise.all([
    db
      .select()
      .from(depositPerformanceDecompositions)
      .where(
        and(
          eq(depositPerformanceDecompositions.chainId, input.chainId),
          eq(depositPerformanceDecompositions.walletAddress, input.walletAddress),
          eq(depositPerformanceDecompositions.depositId, input.depositId),
        ),
      )
      .limit(1),
    db
      .select()
      .from(depositLifecycleEvents)
      .where(
        and(
          eq(depositLifecycleEvents.chainId, input.chainId),
          eq(depositLifecycleEvents.walletAddress, input.walletAddress),
          eq(depositLifecycleEvents.depositId, input.depositId),
        ),
      )
      .orderBy(asc(depositLifecycleEvents.sequenceIndex)),
  ]);

  return mapDepositDetailRows({
    row,
    decompositionRow: decompositionRows[0],
    lifecycleRows,
  });
}

export async function hasAutomatedStrategyExposure(input: {
  walletAddress: string;
  chainId: number;
}): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .select({ id: strategyExposures.id })
    .from(strategyExposures)
    .where(
      and(
        eq(strategyExposures.chainId, input.chainId),
        eq(strategyExposures.walletAddress, input.walletAddress),
      ),
    )
    .limit(1);

  return rows.length > 0;
}
