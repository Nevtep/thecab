import { readAnalysisStatusContext } from "@/server/analysis/analysis-run.repository";
import { projectAnalysisStatus } from "@/server/analysis/status-projection";
import {
  findAvailableStrategyPools,
  findStrategyDetail,
  findStrategySummaries,
} from "@/server/strategies/strategies.repository";
import type {
  StrategiesListRequest,
  StrategiesListResponse,
  StrategyDetailRequest,
  StrategyDetailView,
  StrategySummaryView,
} from "@/server/strategies/strategies.types";

async function assertStrategiesAccessible(input: { walletAddress: string; chainId: number }) {
  const { run, freshness, slices } = await readAnalysisStatusContext(input);
  const failedSlices = slices.filter((slice) => slice.status === "failed").length;
  const lastSuccessfulRunAt = freshness?.lastAnalyzedAt ?? run?.completedAt ?? null;
  const projected = projectAnalysisStatus({
    latestRunStatus: run?.status ?? null,
    lastSuccessfulRunAt,
    coverageReasons: run?.coverageReasonsJson ?? [],
    failedSliceCount: failedSlices,
  });

  if (projected.status !== "ready" && projected.status !== "stale") {
    throw new Error("STRATEGIES_REQUEST_FAILED:ANALYSIS_NOT_READY");
  }

  return { analysisStatus: projected.status as "ready" | "stale" };
}

function combineCoverage(items: StrategySummaryView[]) {
  let coverageStatus: StrategySummaryView["coverageStatus"] = "full";
  const reasons = new Set<string>();

  for (const item of items) {
    for (const code of item.coverageReasonCodes) reasons.add(code);
    if (item.coverageStatus === "unknown") {
      coverageStatus = "unknown";
    } else if (item.coverageStatus === "partial" && coverageStatus !== "unknown") {
      coverageStatus = "partial";
    } else if (item.coverageStatus === "share_level" && coverageStatus === "full") {
      coverageStatus = "share_level";
    }
  }

  if (items.some((item) => item.coverageStatus !== coverageStatus)) {
    reasons.add("mixedCoverageAggregate");
  }

  return { coverageStatus, coverageReasonCodes: Array.from(reasons) };
}

function createDetailShell(summary: StrategySummaryView): StrategyDetailView {
  return {
    ...summary,
    wrapperAddress: null,
    stakingRewardsAddress: null,
    externalStrategyPositionReference: null,
    externalStrategyPositionReferenceStatus: "unresolved",
    sharesReceivedRaw: summary.currentSharesRaw,
    sharesRedeemedRaw: "0",
    resolvedRewardCount: 0,
    unresolvedRewardCount: 0,
    history: [],
    rewards: [],
    lifecycle: [],
    coverageNote: {
      status: summary.coverageStatus,
      titleKey: `strategies:coverageNote.${summary.coverageStatus}.title`,
      bodyKey: `strategies:coverageNote.${summary.coverageStatus}.body`,
      reasonCodes: summary.coverageReasonCodes,
    },
  };
}

export function buildStrategiesListResponse(input: {
  walletAddress: string;
  chainId: number;
  analysisStatus: "ready" | "stale";
  request: StrategiesListRequest;
  rows: StrategySummaryView[];
  selectedStrategy: StrategyDetailView | null;
  availablePools: Array<{ poolId: string; label: string }>;
}): StrategiesListResponse {
  const totalReturnValues = input.rows
    .map((row) => row.totalReturnUsd)
    .filter((value): value is number => value !== null);
  const coverage = combineCoverage(input.rows);
  const selected: StrategyDetailView | null =
    input.selectedStrategy ??
    (input.rows.find((row) => row.strategyExposureId === input.request.selectedStrategyId)
      ? createDetailShell(input.rows.find((row) => row.strategyExposureId === input.request.selectedStrategyId) as StrategySummaryView)
      : input.rows[0]
        ? createDetailShell(input.rows[0])
        : null);

  return {
    walletAddress: input.walletAddress,
    chainId: input.chainId,
    analysisStatus: input.analysisStatus,
    coveredRange: {
      startDayUtc: null,
      endDayUtc: null,
    },
    kpis: {
      currentStrategyValueUsd: input.rows.some((row) => row.currentEstimatedValueUsd !== null)
        ? input.rows.reduce((total, row) => total + (row.currentEstimatedValueUsd ?? 0), 0)
        : null,
      activeStrategyCount: input.rows.filter((row) => row.status === "active").length,
      totalClaimedRewardsUsd: input.rows.reduce((total, row) => total + row.totalRewardsUsd, 0),
      totalReturnUsd: totalReturnValues.length > 0
        ? totalReturnValues.reduce((total, value) => total + value, 0)
        : null,
      protocolCoveragePct: input.rows.length > 0
        ? input.rows.filter((row) => row.coverageStatus === "full" || row.coverageStatus === "share_level").length / input.rows.length
        : null,
      coverageStatus: coverage.coverageStatus,
      coverageReasonCodes: coverage.coverageReasonCodes,
      trends: {},
    },
    filters: {
      applied: {
        status: input.request.status,
        protocol: input.request.protocol,
        pool: input.request.poolId,
        coverage: input.request.coverage,
        returnSign: input.request.returnSign,
        search: input.request.search,
        sort: input.request.sort,
      },
      availablePools: input.availablePools,
    },
    page: {
      page: input.request.page,
      pageSize: input.request.pageSize,
      totalPages: Math.max(1, Math.ceil(input.rows.length / input.request.pageSize)),
      totalItems: input.rows.length,
    },
    strategies: input.rows,
    selectedStrategy: selected,
  };
}

export async function getStrategiesList(input: StrategiesListRequest) {
  const { analysisStatus } = await assertStrategiesAccessible(input);
  const [listResult, availablePools] = await Promise.all([
    findStrategySummaries(input),
    findAvailableStrategyPools(input),
  ]);
  const selectedStrategy = listResult.selectedStrategyId
    ? await findStrategyDetail({
        walletAddress: input.walletAddress,
        chainId: input.chainId,
        strategyId: listResult.selectedStrategyId,
      })
    : null;

  return buildStrategiesListResponse({
    walletAddress: input.walletAddress,
    chainId: input.chainId,
    analysisStatus,
    request: input,
    rows: listResult.items,
    selectedStrategy,
    availablePools,
  });
}

export async function getStrategyDetail(input: StrategyDetailRequest) {
  await assertStrategiesAccessible(input);
  const strategy = await findStrategyDetail(input);
  if (!strategy) {
    throw new Error("STRATEGIES_REQUEST_FAILED:STRATEGY_NOT_FOUND");
  }
  return {
    walletAddress: input.walletAddress,
    chainId: input.chainId,
    coveredRange: {
      startDayUtc: null,
      endDayUtc: null,
    },
    strategy,
  };
}
