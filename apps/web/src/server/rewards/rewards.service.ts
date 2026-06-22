import { projectAnalysisStatus } from "@/server/analysis/status-projection";
import {
  findRewards,
  readRewardsAnalysisContext,
  type HistoricalCapitalPoint,
  type RewardsRepositoryResult,
} from "@/server/rewards/rewards.repository";
import type {
  RewardEventRow,
  RewardsDistribution,
  RewardsRequest,
  RewardsResponse,
  RewardsSummary,
  SelectedReward,
} from "@/server/rewards/rewards.types";

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toFixedString(value: number, digits = 2) {
  return value.toFixed(digits);
}

function getDateRange(input: RewardsRequest) {
  if (input.datePreset === "all") return { start: null, end: null };
  if (input.datePreset === "custom") {
    return { start: input.dateStart, end: input.dateEnd };
  }
  const days = input.datePreset === "7d" ? 7 : input.datePreset === "90d" ? 90 : input.datePreset === "1y" ? 365 : 30;
  const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  return { start, end: null };
}

function createActiveChips(input: RewardsRequest) {
  const chips = [];
  if (input.search) chips.push({ id: "search", labelKey: "rewards:filters.search", value: input.search, removeTarget: "search" });
  if (input.source !== "all") chips.push({ id: "source", labelKey: "rewards:filters.source", value: input.source, removeTarget: "source" });
  if (input.tokenAddress) chips.push({ id: "token", labelKey: "rewards:filters.token", value: input.tokenAddress, removeTarget: "tokenAddress" });
  if (input.poolId) chips.push({ id: "pool", labelKey: "rewards:filters.pool", value: input.poolId, removeTarget: "poolId" });
  if (input.depositId) chips.push({ id: "deposit", labelKey: "rewards:filters.deposit", value: input.depositId, removeTarget: "depositId" });
  if (input.strategyExposureId) chips.push({ id: "strategy", labelKey: "rewards:filters.strategy", value: input.strategyExposureId, removeTarget: "strategyExposureId" });
  if (input.coverage) chips.push({ id: "coverage", labelKey: "rewards:filters.coverage", value: input.coverage, removeTarget: "coverage" });
  if (input.resolutionStatus) chips.push({ id: "resolutionStatus", labelKey: "rewards:filters.resolutionStatus", value: input.resolutionStatus, removeTarget: "resolutionStatus" });
  return chips;
}

function calculateEstimatedRewardReturn(input: {
  rows: RewardEventRow[];
  historicalCapital: HistoricalCapitalPoint[];
  bucketStart: string | null;
  bucketEnd: string | null;
}) {
  const valuedResolvedRewards = input.rows.filter((row) =>
    row.coverageState === "full" &&
    row.owner.status !== "unresolved" &&
    row.owner.status !== "excluded" &&
    row.owner.status !== "unavailable"
  );
  const rewardValueUsd = valuedResolvedRewards.reduce((sum, row) => sum + (asNumber(row.usdValueAtClaim) ?? 0), 0);
  const capitalPoints = input.historicalCapital
    .filter((point) => {
      if (input.bucketStart && point.dayUtc < input.bucketStart.slice(0, 10)) return false;
      if (input.bucketEnd && point.dayUtc > input.bucketEnd.slice(0, 10)) return false;
      return true;
    })
    .map((point) => ({
      ...point,
      value: asNumber(point.valueUsd),
    }))
    .filter((point): point is HistoricalCapitalPoint & { value: number } => point.value !== null && point.value > 0);

  if (rewardValueUsd <= 0 || capitalPoints.length === 0) {
    return {
      estimatedRewardReturnPct: null,
      coverage: "unavailable" as const,
      reasonCodes: ["missingHistoricalCapital"],
    };
  }

  const averageCapitalUsd = capitalPoints.reduce((sum, point) => sum + point.value, 0) / capitalPoints.length;
  const firstDay = input.bucketStart ?? capitalPoints[0]?.dayUtc ?? null;
  const lastDay = input.bucketEnd ?? capitalPoints[capitalPoints.length - 1]?.dayUtc ?? firstDay;
  const daySpan = firstDay && lastDay
    ? Math.max(1, Math.ceil((Date.parse(lastDay) - Date.parse(firstDay)) / (24 * 60 * 60 * 1000)) + 1)
    : capitalPoints.length;
  const annualizedReturnPct = (rewardValueUsd / averageCapitalUsd) * (365 / daySpan) * 100;
  const hasMissingValuation = input.rows.some((row) => row.usdValueAtClaim === null);
  const hasUnresolved = input.rows.some((row) => row.owner.status === "unresolved" || row.owner.status === "unavailable");
  const rewardDays = new Set(input.rows.map((row) => row.occurredAt.slice(0, 10)));
  const capitalDays = new Set(capitalPoints.map((point) => point.dayUtc));
  const hasMissingRewardDayCapital = [...rewardDays].some((day) => !capitalDays.has(day));
  const hasExactCoverage = capitalPoints.every((point) => point.coverageStatus === "time_weighted_full");

  return {
    estimatedRewardReturnPct: toFixedString(annualizedReturnPct, 2),
    coverage: hasMissingValuation || hasUnresolved || hasMissingRewardDayCapital
      ? "partial" as const
      : hasExactCoverage
        ? "full" as const
        : "estimated" as const,
    reasonCodes: [
      ...(hasMissingValuation ? ["missingClaimTimePrice"] : []),
      ...(hasUnresolved ? ["missingOwnerEvidence"] : []),
      ...(hasMissingRewardDayCapital ? ["missingHistoricalCapital"] : []),
      ...(!hasExactCoverage ? ["estimatedHistoricalCapital"] : []),
    ],
  };
}

export function buildRewardsSummary(rows: RewardEventRow[], historicalCapital: HistoricalCapitalPoint[] = []): RewardsSummary {
  const total = rows.reduce((sum, row) => sum + (asNumber(row.usdValueAtClaim) ?? 0), 0);
  const resolvedRows = rows.filter((row) => row.owner.status !== "unresolved" && row.owner.status !== "excluded" && row.owner.status !== "unavailable");
  const resolved = resolvedRows.reduce((sum, row) => sum + (asNumber(row.usdValueAtClaim) ?? 0), 0);
  const unresolvedExcluded = Math.max(0, total - resolved);
  const fullRows = rows.filter((row) => row.coverageState === "full").length;
  const coveragePercent = rows.length > 0 ? (fullRows / rows.length) * 100 : 100;
  const hasMissingValuation = rows.some((row) => row.usdValueAtClaim === null);
  const hasUnresolved = rows.some((row) => row.owner.status === "unresolved" || row.owner.status === "unavailable");
  const hasExcluded = rows.some((row) => row.owner.status === "excluded");
  const returnMetric = calculateEstimatedRewardReturn({
    rows,
    historicalCapital,
    bucketStart: rows[rows.length - 1]?.occurredAt ?? null,
    bucketEnd: rows[0]?.occurredAt ?? null,
  });
  return {
    totalClaimedRewardsUsd: toFixedString(total),
    rewardEventCount: rows.length,
    estimatedRewardReturnPct: returnMetric.estimatedRewardReturnPct,
    estimatedRewardReturnCoverage: returnMetric.coverage,
    resolvedRewardsUsd: toFixedString(resolved),
    resolvedRewardsSharePct: total > 0 ? toFixedString((resolved / total) * 100, 1) : "0.0",
    unresolvedExcludedUsd: toFixedString(unresolvedExcluded),
    unresolvedExcludedSharePct: total > 0 ? toFixedString((unresolvedExcluded / total) * 100, 1) : "0.0",
    coverageState: hasUnresolved ? "unresolved" : hasExcluded ? "excluded" : hasMissingValuation ? "partial" : "full",
    coveragePercent: toFixedString(coveragePercent, 1),
    coverageReasonCodes: [
      ...(hasMissingValuation ? ["missingClaimTimePrice"] : []),
      ...(hasUnresolved ? ["missingOwnerEvidence"] : []),
      ...(hasExcluded ? ["excludedAirdrop"] : []),
      ...returnMetric.reasonCodes,
    ],
  };
}

function buildKpis(summary: RewardsSummary) {
  return [
    {
      id: "totalClaimedRewards",
      labelKey: "rewards:kpis.totalClaimedRewards",
      value: summary.totalClaimedRewardsUsd,
      valueKind: "currency" as const,
      context: { labelKey: "rewards:kpis.coverage", value: summary.coveragePercent },
      coverageState: summary.coverageState,
    },
    {
      id: "rewardEvents",
      labelKey: "rewards:kpis.rewardEvents",
      value: summary.rewardEventCount,
      valueKind: "count" as const,
      context: { labelKey: "rewards:kpis.allHistory" },
      coverageState: summary.coverageState,
    },
    {
      id: "estimatedRewardReturn",
      labelKey: "rewards:kpis.estimatedRewardReturn",
      value: summary.estimatedRewardReturnPct,
      valueKind: "percent" as const,
      context: {
        labelKey: summary.estimatedRewardReturnCoverage === "unavailable"
          ? "rewards:kpis.unavailable"
          : "rewards:kpis.estimated",
      },
      coverageState: summary.estimatedRewardReturnCoverage,
    },
    {
      id: "resolvedRewardsValue",
      labelKey: "rewards:kpis.resolvedRewardsValue",
      value: summary.resolvedRewardsUsd,
      valueKind: "currency" as const,
      context: { labelKey: "rewards:kpis.ofTotal", value: summary.resolvedRewardsSharePct },
      coverageState: summary.coverageState,
    },
    {
      id: "unresolvedExcludedValue",
      labelKey: "rewards:kpis.unresolvedExcludedValue",
      value: summary.unresolvedExcludedUsd,
      valueKind: "currency" as const,
      context: { labelKey: "rewards:kpis.ofTotal", value: summary.unresolvedExcludedSharePct },
      coverageState: summary.coverageState === "full" ? "partial" : summary.coverageState,
    },
  ];
}

function buildDistribution(
  rows: RewardEventRow[],
  group: (row: RewardEventRow) => { id: string; label: string; labelKey: string | null; filterTarget: Record<string, unknown> },
): RewardsDistribution {
  const total = rows.reduce((sum, row) => sum + (asNumber(row.usdValueAtClaim) ?? 0), 0);
  const map = new Map<string, { label: string; labelKey: string | null; value: number; count: number; filterTarget: Record<string, unknown> }>();
  for (const row of rows) {
    const key = group(row);
    const existing = map.get(key.id) ?? { label: key.label, labelKey: key.labelKey, value: 0, count: 0, filterTarget: key.filterTarget };
    existing.value += asNumber(row.usdValueAtClaim) ?? 0;
    existing.count += 1;
    map.set(key.id, existing);
  }
  return {
    totalUsd: toFixedString(total),
    coverageState: rows.some((row) => row.coverageState !== "full") ? "partial" : "full",
    items: [...map.entries()]
      .map(([id, item]) => ({
        id,
        label: item.label,
        labelKey: item.labelKey,
        valueUsd: toFixedString(item.value),
        sharePct: total > 0 ? toFixedString((item.value / total) * 100, 1) : "0.0",
        count: item.count,
        coverageState: "full" as const,
        filterTarget: item.filterTarget,
      }))
      .sort((left, right) => Number(right.valueUsd) - Number(left.valueUsd)),
  };
}

function buildOverTime(rows: RewardEventRow[], historicalCapital: HistoricalCapitalPoint[]) {
  const buckets = new Map<string, RewardEventRow[]>();
  for (const row of rows) {
    const day = row.occurredAt.slice(0, 10);
    buckets.set(day, [...(buckets.get(day) ?? []), row]);
  }
  let cumulativeClaimedValueUsd = 0;
  const result = [...buckets.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([day, bucketRows]) => {
    const returnMetric = calculateEstimatedRewardReturn({
      rows: bucketRows,
      historicalCapital,
      bucketStart: day,
      bucketEnd: day,
    });
    const totalValue = bucketRows.reduce((sum, row) => sum + (asNumber(row.usdValueAtClaim) ?? 0), 0);
    const resolvedValue = bucketRows
      .filter((row) => row.owner.status !== "unresolved" && row.owner.status !== "excluded" && row.owner.status !== "unavailable")
      .reduce((sum, row) => sum + (asNumber(row.usdValueAtClaim) ?? 0), 0);
    const unresolvedExcludedValue = Math.max(0, totalValue - resolvedValue);
    cumulativeClaimedValueUsd += totalValue;

    return {
      bucketStart: day,
      bucketEnd: null,
      claimedValueUsd: toFixedString(totalValue),
      resolvedValueUsd: toFixedString(resolvedValue),
      unresolvedExcludedValueUsd: toFixedString(unresolvedExcludedValue),
      cumulativeClaimedValueUsd: toFixedString(cumulativeClaimedValueUsd),
      estimatedRewardReturnPct: returnMetric.estimatedRewardReturnPct,
      rewardEventCount: bucketRows.length,
      claimMarkers: bucketRows.slice(0, 8).map((row) => ({ rewardEventId: row.rewardEventId, tokenSymbol: row.token.symbol })),
      coverageState: bucketRows.some((row) => row.coverageState !== "full") || returnMetric.coverage === "partial"
        ? "partial" as const
        : returnMetric.coverage === "unavailable"
          ? "unavailable" as const
          : "full" as const,
      coverageReasonCodes: [...new Set([...bucketRows.flatMap((row) => row.resolutionReasonCodes), ...returnMetric.reasonCodes])],
    };
  });
  return result;
}

function buildSelectedReward(row: RewardEventRow | null, contextRows: RewardEventRow[]): SelectedReward | null {
  if (!row) return null;
  return {
    rewardEventId: row.rewardEventId,
    summary: {
      tokenAddress: row.token.address,
      tokenIconUrl: row.token.iconUrl,
      tokenSymbol: row.token.symbol,
      rewardTypeLabelKey: `rewards:rewardTypes.${row.rewardType}`,
      tokenAmount: row.tokenAmount,
      usdValueAtClaim: row.usdValueAtClaim,
      ownerStatus: row.owner.status,
      coverageState: row.coverageState,
      confidence: row.confidence,
    },
    ownershipTrace: {
      ownerStatus: row.owner.status,
      linkedEntityLabel: row.owner.entityLabel,
      linkedEntityRoute: row.owner.route,
      sourceSurface: row.sourceSurface,
      evidenceKey: row.owner.status === "unresolved" ? "rewards:evidence.unresolved" : "rewards:evidence.resolvedOwner",
    },
    poolContribution: {
      status: row.poolContribution.status,
      linkedPoolLabel: row.poolContribution.poolLabel,
      linkedPoolRoute: row.poolContribution.route,
      countingRuleKey: `rewards:countingRules.${row.poolContribution.countingRule}`,
      noteKey: "rewards:notes.noDoubleCount",
    },
    claimDetails: {
      txHash: row.txHash,
      claimTime: row.occurredAt,
      rewardType: row.rewardType,
      sourceContract: null,
      externalTxUrl: row.externalTxUrl,
    },
    coverageNotes: {
      coverageState: row.coverageState,
      includedInAggregates: row.owner.status !== "unresolved" && row.owner.status !== "excluded" && row.owner.status !== "unavailable",
      reasonCodes: row.resolutionReasonCodes,
    },
    unresolvedExcludedActivity: contextRows
      .filter((candidate) => candidate.owner.status === "unresolved" || candidate.owner.status === "excluded" || candidate.owner.status === "unavailable")
      .slice(0, 5)
      .map((candidate) => ({
        rewardEventId: candidate.rewardEventId,
        tokenSymbol: candidate.token.symbol,
        occurredAt: candidate.occurredAt,
        tokenAmount: candidate.tokenAmount,
        usdValueAtClaim: candidate.usdValueAtClaim,
        reasonCode: candidate.resolutionReasonCodes[0] ?? (candidate.owner.status === "excluded" ? "excludedAirdrop" : "missingOwnerEvidence"),
      })),
  };
}

export function buildReadyResponse(input: {
  request: RewardsRequest;
  repository: RewardsRepositoryResult;
  analysisStatus: "ready" | "stale";
  runId: string | null;
  completedAt: string | null;
}): RewardsResponse {
  const summaryRows = input.repository.summaryRows ?? input.repository.allRows;
  const summary = buildRewardsSummary(summaryRows, input.repository.historicalCapital);
  const overTimeBuckets = buildOverTime(input.repository.allRows, input.repository.historicalCapital);
  const selectedRow =
    input.repository.allRows.find((row) => row.rewardEventId === input.request.selectedRewardEventId) ??
    input.repository.rows[0] ??
    input.repository.allRows[0] ??
    null;
  const dateRange = getDateRange(input.request);

  return {
    walletAddress: input.request.walletAddress,
    chainId: input.request.chainId,
    analysis: {
      status: input.analysisStatus,
      runId: input.runId,
      completedAt: input.completedAt,
      coveredRange: { start: null, end: input.completedAt },
      isStale: input.analysisStatus === "stale",
    },
    filters: {
      ...input.request,
      dateRange,
      activeChips: createActiveChips(input.request),
    },
    summary,
    kpis: buildKpis(summary),
    overTime: {
      grouping: "daily",
      coveragePercent: summary.coveragePercent,
      coverageState: summary.coverageState,
      coverageReasonCodes: summary.coverageReasonCodes,
      buckets: overTimeBuckets,
    },
    distributions: {
      source: buildDistribution(input.repository.allRows, (row) => ({
        id: row.owner.status,
        label: row.owner.status,
        labelKey: row.owner.labelKey,
        filterTarget: { source: row.owner.status === "manual_deposit" ? "deposits" : row.owner.status },
      })),
      pool: buildDistribution(input.repository.allRows.filter((row) => row.poolContribution.poolId), (row) => ({
        id: row.poolContribution.poolId ?? "none",
        label: row.poolContribution.poolLabel ?? "other",
        labelKey: row.poolContribution.poolLabel ? null : "common:other",
        filterTarget: { poolId: row.poolContribution.poolId },
      })),
      token: buildDistribution(input.repository.allRows, (row) => ({
        id: row.token.address ?? row.token.symbol ?? "unknown",
        label: row.token.symbol ?? "other",
        labelKey: row.token.symbol ? null : "common:other",
        filterTarget: { tokenAddress: row.token.address },
      })),
    },
    events: {
      rows: input.repository.rows,
      pagination: {
        page: input.request.page,
        pageSize: input.request.pageSize,
        totalRows: input.repository.totalRows,
        totalPages: Math.max(1, Math.ceil(input.repository.totalRows / input.request.pageSize)),
      },
    },
    selectedReward: buildSelectedReward(selectedRow, input.repository.allRows),
    availableFilters: {
      sources: ["all", "deposits", "strategies", "governance", "unresolved", "excluded", "unavailable"],
      tokens: input.repository.availableFilters.tokens,
      pools: input.repository.availableFilters.pools,
      rewardTypes: input.repository.availableFilters.rewardTypes,
      coverageStates: ["full", "partial", "unresolved", "excluded", "unavailable"],
    },
  };
}

export function buildLockedRewardsResponse(input: {
  request: RewardsRequest;
  runId: string | null;
  completedAt: string | null;
}): RewardsResponse {
  return {
    walletAddress: input.request.walletAddress,
    chainId: input.request.chainId,
    analysis: {
      status: "locked",
      runId: input.runId,
      completedAt: input.completedAt,
      coveredRange: { start: null, end: null },
      isStale: false,
      reasonCode: "analysisNotReady",
    },
    filters: {
      ...input.request,
      dateRange: getDateRange(input.request),
      activeChips: createActiveChips(input.request),
    },
    summary: null,
    kpis: [],
    overTime: {
      grouping: "daily",
      coveragePercent: "0.0",
      coverageState: "unavailable",
      coverageReasonCodes: ["analysisNotReady"],
      buckets: [],
    },
    distributions: {
      source: { totalUsd: "0.00", coverageState: "unavailable", items: [] },
      pool: { totalUsd: "0.00", coverageState: "unavailable", items: [] },
      token: { totalUsd: "0.00", coverageState: "unavailable", items: [] },
    },
    events: {
      rows: [],
      pagination: { page: input.request.page, pageSize: input.request.pageSize, totalRows: 0, totalPages: 0 },
    },
    selectedReward: null,
    availableFilters: {
      sources: ["all", "deposits", "strategies", "governance", "unresolved", "excluded", "unavailable"],
      tokens: [],
      pools: [],
      rewardTypes: [],
      coverageStates: ["full", "partial", "unresolved", "excluded", "unavailable"],
    },
  };
}

export async function getRewardsDataView(input: RewardsRequest): Promise<RewardsResponse> {
  const { run, freshness, slices } = await readRewardsAnalysisContext(input);
  const failedSlices = slices.filter((slice) => slice.status === "failed").length;
  const lastSuccessfulRunAt = freshness?.lastAnalyzedAt ?? run?.completedAt ?? null;
  const projected = projectAnalysisStatus({
    latestRunStatus: run?.status ?? null,
    lastSuccessfulRunAt,
    coverageReasons: run?.coverageReasonsJson ?? [],
    failedSliceCount: failedSlices,
  });

  if (projected.status !== "ready" && projected.status !== "stale") {
    return buildLockedRewardsResponse({
      request: input,
      runId: run?.id ?? null,
      completedAt: run?.completedAt?.toISOString() ?? null,
    });
  }

  const repository = await findRewards(input);
  return buildReadyResponse({
    request: input,
    repository,
    analysisStatus: projected.status,
    runId: run?.id ?? null,
    completedAt: lastSuccessfulRunAt?.toISOString() ?? null,
  });
}
