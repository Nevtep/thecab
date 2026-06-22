import { engineV2ReadModelsEnabled, readEngineV2SurfaceRows } from "@/server/analysis/engine-v2/materializers";
import type {
  DepositDetailView,
  DepositLifecycleEventView,
  DepositLifecycleTokenDelta,
  DepositPerformanceDecompositionView,
  DepositSummaryView,
} from "@/server/deposits/deposits.types";

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

  return ((row as { lifecycle?: unknown[] }).lifecycle ?? []).reduce<number>((sum, event) => {
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
  if (!engineV2ReadModelsEnabled()) return [];

  const engineV2Rows = await readEngineV2SurfaceRows<DepositSummaryView>({
    chainId: input.chainId,
    walletAddress: input.walletAddress,
    surface: "deposits",
  });
  return (engineV2Rows ?? []).map((row) => normalizeEngineV2DepositRow(row));
}

export async function findDepositDetail(input: {
  walletAddress: string;
  chainId: number;
  depositId: string;
}): Promise<DepositDetailView | null> {
  if (!engineV2ReadModelsEnabled()) return null;

  const engineV2Rows = await readEngineV2SurfaceRows<DepositDetailView>({
    chainId: input.chainId,
    walletAddress: input.walletAddress,
    surface: "deposits",
  });
  const engineV2Detail = engineV2Rows?.find((row) => row.depositId === input.depositId);
  return engineV2Detail ? normalizeEngineV2DepositRow(engineV2Detail) : null;
}

export async function hasAutomatedStrategyExposure(input: {
  walletAddress: string;
  chainId: number;
}): Promise<boolean> {
  if (!engineV2ReadModelsEnabled()) return false;

  const rows = await readEngineV2SurfaceRows<{ status?: string }>({
    chainId: input.chainId,
    walletAddress: input.walletAddress,
    surface: "strategies",
  });
  return (rows ?? []).some((row) => row.status === "active");
}
