import { engineV2ReadModelsEnabled, readEngineV2SurfaceRows } from "@/server/analysis/engine-v2/materializers";
import type {
  StrategiesListRequest,
  StrategyLifecycleEventView,
  StrategyRewardView,
  StrategyDetailView,
  StrategySummaryView,
} from "@/server/strategies/strategies.types";

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function normalizeStatus(value: string): StrategySummaryView["status"] {
  return value === "active" || value === "closed" || value === "unknown" ? value : "unknown";
}

function normalizeCoverage(value: string): StrategySummaryView["coverageStatus"] {
  return value === "full" || value === "share_level" || value === "partial" || value === "unknown"
    ? value
    : "unknown";
}

function normalizeConfidence(value: string): StrategySummaryView["confidence"] {
  return value === "high" || value === "medium" || value === "low" || value === "degraded" || value === "unknown"
    ? value
    : "unknown";
}

function normalizePoolMapping(value: string): StrategySummaryView["poolMappingStatus"] {
  return value === "confirmed" || value === "inferred" || value === "unknown" ? value : "unknown";
}

function normalizeExternalReferenceStatus(value: string): StrategyDetailView["externalStrategyPositionReferenceStatus"] {
  return value === "resolved" ? "resolved" : "unresolved";
}

export type StrategySummaryRowRecord = {
  id: string;
  strategyId: string;
  strategyExposureId: string;
  strategyLabel: string;
  protocol: string;
  primaryPoolId: string | null;
  poolLabel: string | null;
  poolMappingStatus: string;
  status: string;
  currentEstimatedValueUsd: unknown;
  closeValueUsd?: unknown;
  displayValueUsd?: unknown;
  depositedValueUsd: unknown;
  withdrawnValueUsd: unknown;
  currentSharesRaw: string;
  shareSymbol: string | null;
  totalRewardsUsd: unknown;
  realizedPnlUsd: unknown;
  unrealizedPnlUsd: unknown;
  totalReturnUsd: unknown;
  totalReturnPct: unknown;
  estimatedAnnualizedReturnPct: unknown;
  coverageStatus: string;
  confidence: string;
  coverageReasonCodes: string[] | null;
  wrapperAddress: string | null;
  stakingRewardsAddress: string | null;
  externalStrategyPositionReference: string | null;
  externalStrategyPositionReferenceStatus: string;
  sharesReceivedRaw: string;
  sharesRedeemedRaw: string;
  resolvedRewardCount: number;
  unresolvedRewardCount: number;
  openedAt: Date | string | null;
  closedAt: Date | string | null;
  coveredStartDayUtc: string | null;
  coveredEndDayUtc: string | null;
  metadataJson: Record<string, unknown> | null;
};

type StrategyHistoryRowRecord = {
  dayUtc: string;
  estimatedValueUsd: unknown;
  cumulativeRewardsUsd: unknown;
};

export type StrategyRewardRowRecord = {
  id: string;
  tokenSymbol: string | null;
  tokenAddress: string | null;
  amountRaw: string | null;
  amountFormatted: string | null;
  amountUsd: unknown;
  claimedAt: Date | string | null;
  txHash: string | null;
  resolutionStatus: string;
  coverageReasonCodes: string[] | null;
};

export type StrategyLifecycleRowRecord = {
  id: string;
  sequenceIndex: number;
  eventType: string;
  occurredAt: Date | string;
  txHash: string | null;
  logIndex: number | null;
  blockNumber: string | null;
  usdValue: unknown;
  shareDeltaRaw: string | null;
  tokenDeltasJson: unknown;
  priceSource: string | null;
  confidence: string;
  coverageStatus: string;
  coverageReasonCodes: string[] | null;
  metadataJson: Record<string, unknown> | null;
};

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : value;
}

function normalizeEventType(value: string): StrategyLifecycleEventView["eventType"] {
  switch (value) {
    case "strategy_deposit":
    case "strategy_share_receive":
    case "strategy_stake":
    case "strategy_claim":
    case "strategy_unstake":
    case "strategy_withdraw":
    case "strategy_share_redeem":
    case "strategy_close":
    case "strategy_internal_rebalance":
    case "strategy_fee_dilution":
    case "strategy_baseline_transfer_in":
    case "unresolved_strategy_reward":
      return value;
    default:
      return "strategy_internal_rebalance";
  }
}

function normalizePriceSource(value: string | null): StrategyLifecycleEventView["priceSource"] {
  return value === "alchemyHistorical" || value === "pricePointFallback" || value === "unavailable" || value === "unknown"
    ? value
    : null;
}

function normalizeRewardResolutionStatus(value: string): StrategyRewardView["resolutionStatus"] {
  return value === "resolved" ? "resolved" : "unresolved";
}

function normalizeTokenDeltas(value: unknown): StrategyLifecycleEventView["tokenDeltas"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    const record = asRecord(candidate);
    const direction = record.direction === "out" ? "out" : record.direction === "in" ? "in" : null;
    const amountRaw = typeof record.amountRaw === "string" ? record.amountRaw : null;
    if (!direction || !amountRaw) return [];
    return [{
      tokenAddress: typeof record.tokenAddress === "string" ? record.tokenAddress : null,
      symbol: typeof record.symbol === "string" ? record.symbol : null,
      direction,
      amountRaw,
      amountFormatted: typeof record.amountFormatted === "string" ? record.amountFormatted : null,
      usdValue: asNumber(record.usdValue),
      priceSource: normalizePriceSource(typeof record.priceSource === "string" ? record.priceSource : null),
    }];
  });
}

export function mapStrategySummaryRow(row: StrategySummaryRowRecord): StrategySummaryView {
  return {
    id: row.id,
    strategyId: row.strategyId,
    strategyExposureId: row.strategyExposureId,
    strategyLabel: row.strategyLabel,
    protocol: "mellow",
    primaryPoolId: row.primaryPoolId,
    poolLabel: row.poolLabel ?? (typeof asRecord(row.metadataJson).poolLabel === "string" ? String(asRecord(row.metadataJson).poolLabel) : null),
    poolMappingStatus: normalizePoolMapping(row.poolMappingStatus),
    status: normalizeStatus(row.status),
    currentEstimatedValueUsd: asNumber(row.currentEstimatedValueUsd),
    closeValueUsd: asNumber(row.closeValueUsd),
    displayValueUsd: asNumber(row.displayValueUsd) ?? asNumber(row.currentEstimatedValueUsd),
    depositedValueUsd: asNumber(row.depositedValueUsd) ?? 0,
    withdrawnValueUsd: asNumber(row.withdrawnValueUsd) ?? 0,
    currentSharesRaw: row.currentSharesRaw,
    shareSymbol: row.shareSymbol,
    totalRewardsUsd: asNumber(row.totalRewardsUsd) ?? 0,
    realizedPnlUsd: asNumber(row.realizedPnlUsd),
    unrealizedPnlUsd: asNumber(row.unrealizedPnlUsd),
    totalReturnUsd: asNumber(row.totalReturnUsd),
    totalReturnPct: asNumber(row.totalReturnPct),
    estimatedAnnualizedReturnPct: asNumber(row.estimatedAnnualizedReturnPct),
    coverageStatus: normalizeCoverage(row.coverageStatus),
    confidence: normalizeConfidence(row.confidence),
    coverageReasonCodes: row.coverageReasonCodes ?? [],
  };
}

export function mapStrategyRewardRow(row: StrategyRewardRowRecord): StrategyRewardView {
  return {
    id: row.id,
    tokenSymbol: row.tokenSymbol,
    tokenAddress: row.tokenAddress,
    amountRaw: row.amountRaw,
    amountFormatted: row.amountFormatted,
    amountUsd: asNumber(row.amountUsd),
    claimedAt: row.claimedAt ? toIso(row.claimedAt) : null,
    txHash: row.txHash,
    resolutionStatus: normalizeRewardResolutionStatus(row.resolutionStatus),
    coverageReasonCodes: row.coverageReasonCodes ?? [],
  };
}

export function mapStrategyLifecycleRow(row: StrategyLifecycleRowRecord): StrategyLifecycleEventView {
  return {
    id: row.id,
    sequenceIndex: row.sequenceIndex,
    eventType: normalizeEventType(row.eventType),
    occurredAt: toIso(row.occurredAt),
    txHash: row.txHash,
    logIndex: row.logIndex,
    blockNumber: row.blockNumber,
    usdValue: asNumber(row.usdValue),
    shareDeltaRaw: row.shareDeltaRaw,
    tokenDeltas: normalizeTokenDeltas(row.tokenDeltasJson),
    priceSource: normalizePriceSource(row.priceSource),
    confidence: normalizeConfidence(row.confidence),
    coverageStatus: normalizeCoverage(row.coverageStatus),
    coverageReasonCodes: row.coverageReasonCodes ?? [],
    metadata: row.metadataJson ?? {},
  };
}

function mapStrategyDetailRow(input: {
  row: StrategySummaryRowRecord;
  historyRows: StrategyHistoryRowRecord[];
  rewardRows: StrategyRewardRowRecord[];
  lifecycleRows: StrategyLifecycleRowRecord[];
}): StrategyDetailView {
  const summary = mapStrategySummaryRow(input.row);
  return {
    ...summary,
    wrapperAddress: input.row.wrapperAddress,
    stakingRewardsAddress: input.row.stakingRewardsAddress,
    externalStrategyPositionReference: input.row.externalStrategyPositionReference,
    externalStrategyPositionReferenceStatus: normalizeExternalReferenceStatus(input.row.externalStrategyPositionReferenceStatus),
    sharesReceivedRaw: input.row.sharesReceivedRaw,
    sharesRedeemedRaw: input.row.sharesRedeemedRaw,
    resolvedRewardCount: input.row.resolvedRewardCount,
    unresolvedRewardCount: input.row.unresolvedRewardCount,
    history: input.historyRows.map((row) => ({
      dayUtc: row.dayUtc,
      estimatedValueUsd: asNumber(row.estimatedValueUsd),
      cumulativeRewardsUsd: asNumber(row.cumulativeRewardsUsd) ?? 0,
    })),
    rewards: input.rewardRows.map(mapStrategyRewardRow),
    lifecycle: input.lifecycleRows.map(mapStrategyLifecycleRow),
    coverageNote: {
      status: summary.coverageStatus,
      titleKey: `strategies:coverageNote.${summary.coverageStatus}.title`,
      bodyKey: `strategies:coverageNote.${summary.coverageStatus}.body`,
      reasonCodes: summary.coverageReasonCodes,
    },
  };
}

export function applyStrategiesListRequest(input: {
  request: StrategiesListRequest;
  rows: StrategySummaryView[];
}) {
  const filtered = input.rows.filter((row) => {
    if (input.request.status !== "all" && row.status !== input.request.status) return false;
    if (input.request.protocol !== "all" && row.protocol !== input.request.protocol) return false;
    if (input.request.poolId && row.primaryPoolId !== input.request.poolId) return false;
    if (input.request.coverage !== "all" && row.coverageStatus !== input.request.coverage) return false;
    if (input.request.returnSign === "positive" && (row.totalReturnUsd ?? 0) < 0) return false;
    if (input.request.returnSign === "negative" && (row.totalReturnUsd ?? 0) >= 0) return false;
    if (input.request.search) {
      const search = input.request.search.toLowerCase();
      const haystack = [row.strategyLabel, row.poolLabel, row.shareSymbol].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  filtered.sort((left, right) => {
    let cmp = 0;
    switch (input.request.sort) {
      case "current_value_desc":
      case "current_value_asc":
        cmp = (left.currentEstimatedValueUsd ?? -1) - (right.currentEstimatedValueUsd ?? -1);
        break;
      case "opened_desc":
      case "opened_asc":
        cmp = left.strategyExposureId.localeCompare(right.strategyExposureId);
        break;
      case "return_desc":
      case "return_asc":
        cmp = (left.totalReturnUsd ?? -Infinity) - (right.totalReturnUsd ?? -Infinity);
        break;
      case "coverage_asc":
      case "coverage_desc":
        cmp = left.coverageStatus.localeCompare(right.coverageStatus);
        break;
    }
    if (cmp === 0) cmp = left.strategyExposureId.localeCompare(right.strategyExposureId);
    return input.request.sort.endsWith("_asc") ? cmp : -cmp;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / input.request.pageSize));
  const page = Math.min(input.request.page, totalPages);
  const start = (page - 1) * input.request.pageSize;
  const items = filtered.slice(start, start + input.request.pageSize);
  const requestedSelectedId = input.request.selectedStrategyId;
  const selectedStrategyId = requestedSelectedId
    ? filtered.some((item) => item.strategyExposureId === requestedSelectedId)
      ? requestedSelectedId
      : null
    : items[0]?.strategyExposureId ?? null;

  return {
    items,
    allItems: input.rows,
    page,
    totalItems: filtered.length,
    totalPages,
    selectedStrategyId,
  };
}

export async function findStrategySummaries(input: StrategiesListRequest) {
  if (!engineV2ReadModelsEnabled()) {
    return applyStrategiesListRequest({ request: input, rows: [] });
  }

  const engineV2Rows = await readEngineV2SurfaceRows<StrategySummaryView>({
    chainId: input.chainId,
    walletAddress: input.walletAddress,
    surface: "strategies",
  });
  return applyStrategiesListRequest({ request: input, rows: engineV2Rows ?? [] });
}

export async function findStrategyDetail(input: {
  walletAddress: string;
  chainId: number;
  strategyId: string;
}) {
  if (!engineV2ReadModelsEnabled()) return null;

  const engineV2Rows = await readEngineV2SurfaceRows<StrategyDetailView>({
    chainId: input.chainId,
    walletAddress: input.walletAddress,
    surface: "strategies",
  });
  const engineV2Detail = engineV2Rows?.find((row) => row.strategyExposureId === input.strategyId || row.strategyId === input.strategyId);
  return engineV2Detail ?? null;
}

export async function findAvailableStrategyPools(input: { walletAddress: string; chainId: number }) {
  if (!engineV2ReadModelsEnabled()) return [];

  const rows = await readEngineV2SurfaceRows<StrategySummaryView>({
    chainId: input.chainId,
    walletAddress: input.walletAddress,
    surface: "strategies",
  });
  const byPoolId = new Map<string, { poolId: string; label: string }>();
  for (const row of rows ?? []) {
    if (row.primaryPoolId && row.poolLabel) {
      byPoolId.set(row.primaryPoolId, { poolId: row.primaryPoolId, label: row.poolLabel });
    }
  }
  return Array.from(byPoolId.values()).sort((left, right) => left.label.localeCompare(right.label));
}
