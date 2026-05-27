import { readAnalysisStatusContext } from "@/server/analysis/analysis-run.repository";
import { projectAnalysisStatus } from "@/server/analysis/status-projection";
import { listPoolSummaries, readPoolHistory, readPoolSummarySeries, readPoolTimeline } from "@/server/pools/pools.repository";
import type { PoolDetailRequest, PoolDetailResponse, PoolsListRequest, PoolsListResponse } from "@/server/pools/pools.types";

function dedupe(values: string[]) {
  return Array.from(new Set(values));
}

function compareNullableNumber(left: number | null, right: number | null) {
  if (left === right) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return left - right;
}

async function assertPoolsAccessible(input: {
  walletAddress: string;
  chainId: number;
}) {
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
    throw new Error("POOLS_REQUEST_FAILED:ANALYSIS_REQUIRED");
  }

  return {
    analysisStatus: projected.status,
  };
}

export async function getPoolsList(input: PoolsListRequest): Promise<PoolsListResponse> {
  const access = await assertPoolsAccessible({
    walletAddress: input.walletAddress,
    chainId: input.chainId,
  });
  const summaryRows = await listPoolSummaries({
    walletAddress: input.walletAddress,
    chainId: input.chainId,
  });
  const searchTerm = input.search.trim().toLowerCase();
  const filtered = summaryRows.filter((row) => {
    if (input.status !== "all" && row.status !== input.status) {
      return false;
    }

    if (input.exposure !== "all" && row.exposureMix !== input.exposure) {
      return false;
    }

    if (input.coverage !== "all" && row.coverageStatus !== input.coverage) {
      return false;
    }

    if (input.returnBand === "positive" && (row.annualizedReturnPct ?? 0) < 0) {
      return false;
    }

    if (input.returnBand === "negative" && (row.annualizedReturnPct ?? 0) >= 0) {
      return false;
    }

    if (searchTerm.length > 0) {
      const haystack = [row.label, ...row.tokenSymbols, row.poolAddress].join(" ").toLowerCase();
      if (!haystack.includes(searchTerm)) {
        return false;
      }
    }

    return true;
  });

  filtered.sort((left, right) => {
    let result = 0;
    switch (input.sort) {
      case "currentValue":
        result = left.currentAttributedValueUsd - right.currentAttributedValueUsd;
        break;
      case "rewards":
        result = left.totalRewardsUsd - right.totalRewardsUsd;
        break;
      case "return":
        result = compareNullableNumber(left.annualizedReturnPct, right.annualizedReturnPct);
        break;
      case "recentActivity":
        result = (left.latestActivityAt ?? "").localeCompare(right.latestActivityAt ?? "");
        break;
    }

    return input.direction === "asc" ? result : -result;
  });

  const offset = input.cursor ? Number.parseInt(input.cursor, 10) : 0;
  const items = filtered.slice(offset, offset + input.limit);
  const nextOffset = offset + input.limit;
  const summarySeries = await readPoolSummarySeries({
    walletAddress: input.walletAddress,
    chainId: input.chainId,
    poolIds: filtered.map((row) => row.poolId),
  });
  const weightedReturnValues = filtered
    .map((row) => row.annualizedReturnPct)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const weightedAnnualizedReturnPct = weightedReturnValues.length > 0
    ? weightedReturnValues.reduce((sum, value) => sum + value, 0) / weightedReturnValues.length
    : summarySeries.estimatedAnnualizedReturnPct.at(-1) ?? null;

  return {
    walletAddress: input.walletAddress,
    chainId: input.chainId,
    analysisStatus: access.analysisStatus,
    coveredRange: {
      startDayUtc: filtered.length > 0
        ? filtered.reduce((min, row) => min === null || row.coveredStartDayUtc < min ? row.coveredStartDayUtc : min, null as string | null)
        : null,
      endDayUtc: filtered.length > 0
        ? filtered.reduce((max, row) => max === null || row.coveredEndDayUtc > max ? row.coveredEndDayUtc : max, null as string | null)
        : null,
    },
    summary: {
      poolCount: filtered.length,
      activePoolCount: filtered.filter((row) => row.status === "active").length,
      activeInRangePoolCount: filtered.filter((row) => row.isInRange === true).length,
      currentAttributedValueUsd: filtered.reduce((sum, row) => sum + row.currentAttributedValueUsd, 0),
      totalRewardsUsd: filtered.reduce((sum, row) => sum + row.totalRewardsUsd, 0),
      weightedAnnualizedReturnPct,
      series: summarySeries,
      coverageStatus: filtered.some((row) => row.coverageStatus === "partial")
        ? "partial"
        : filtered.some((row) => row.coverageStatus === "share_level")
          ? "share_level"
          : filtered.some((row) => row.coverageStatus === "full")
            ? "full"
            : "unknown",
      coverageReasonCodes: dedupe(filtered.flatMap((row) => row.coverageReasonCodes)),
    },
    items,
    page: {
      nextCursor: nextOffset < filtered.length ? String(nextOffset) : null,
      hasMore: nextOffset < filtered.length,
    },
  };
}

export async function getPoolDetail(input: PoolDetailRequest): Promise<PoolDetailResponse> {
  const access = await assertPoolsAccessible({
    walletAddress: input.walletAddress,
    chainId: input.chainId,
  });
  const summaryRows = await listPoolSummaries({
    walletAddress: input.walletAddress,
    chainId: input.chainId,
  });
  const summary = summaryRows.find((row) => row.poolId === input.poolId) ?? null;

  if (!summary) {
    throw new Error("POOLS_REQUEST_FAILED:POOL_NOT_FOUND");
  }

  const [historyRows, timelineRows] = await Promise.all([
    readPoolHistory({
      walletAddress: input.walletAddress,
      chainId: input.chainId,
      poolId: input.poolId,
      range: input.range,
    }),
    readPoolTimeline({
      walletAddress: input.walletAddress,
      chainId: input.chainId,
      poolId: input.poolId,
    }),
  ]);
  const timelineOffset = input.timelineCursor ? Number.parseInt(input.timelineCursor, 10) : 0;
  const timelineItems = timelineRows.slice(timelineOffset, timelineOffset + input.timelineLimit);
  const nextOffset = timelineOffset + input.timelineLimit;

  return {
    walletAddress: input.walletAddress,
    chainId: input.chainId,
    analysisStatus: access.analysisStatus,
    coveredRange: {
      startDayUtc: summary.coveredStartDayUtc,
      endDayUtc: summary.coveredEndDayUtc,
    },
    selectedRange: input.range,
    header: {
      poolId: summary.poolId,
      label: summary.label,
      poolAddress: summary.poolAddress,
      tokenSymbols: summary.tokenSymbols,
      feeTierLabel: summary.feeTierLabel,
      poolType: summary.poolType,
      protocolFamily: summary.protocolFamily,
      status: summary.status,
      currentAttributedValueUsd: summary.currentAttributedValueUsd,
      capitalInvestedUsd: summary.capitalInvestedUsd,
      capitalEnteredUsd: summary.capitalEnteredUsd,
      capitalWithdrawnUsd: summary.capitalWithdrawnUsd,
      totalRewardsUsd: summary.totalRewardsUsd,
      investedDays: summary.investedDays,
      totalReturnPct: summary.totalReturnPct,
      realizedPnlUsd: summary.realizedPnlUsd,
      unrealizedPnlUsd: summary.unrealizedPnlUsd,
      annualizedReturnPct: summary.annualizedReturnPct,
      isInRange: summary.isInRange,
      coverageStatus: summary.coverageStatus,
      coverageReasonCodes: summary.coverageReasonCodes,
      strategyLabels: summary.strategyLabels,
      metricsEstimated: summary.metricsEstimated,
    },
    segments: {
      manual: { currentValueUsd: summary.currentManualValueUsd, coverageStatus: summary.coverageStatus },
      strategy: { currentValueUsd: summary.currentStrategyValueUsd, coverageStatus: summary.coverageStatus },
      residual: { currentValueUsd: summary.currentResidualValueUsd, coverageStatus: summary.coverageStatus },
    },
    currentComposition: [
      {
        tokenSymbol: summary.tokenSymbols[0] ?? summary.label,
        amount: null,
        valueUsd: summary.currentAttributedValueUsd,
        segment: "manual",
      },
    ],
    history: {
      points: historyRows.map((row) => ({
        dayUtc: row.dayUtc,
        totalValueUsd: row.totalValueUsd,
        deployedValueUsd: row.deployedValueUsd,
        residualValueUsd: row.residualValueUsd,
        manualValueUsd: row.manualValueUsd,
        strategyValueUsd: row.strategyValueUsd,
        rewardValueUsd: row.rewardValueUsd,
        cumulativeRewardsUsd: row.cumulativeRewardsUsd,
        capitalInUsd: row.capitalInUsd,
        capitalOutUsd: row.capitalOutUsd,
        metadata: row.metadata,
      })),
      coverageStatus: summary.coverageStatus,
      coverageReasonCodes: summary.coverageReasonCodes,
    },
    timeline: {
      items: timelineItems.map((row) => ({
        eventKey: row.eventKey,
        eventType: row.eventType,
        occurredAt: row.occurredAt.toISOString(),
        confidence: row.confidence,
        coverageStatus: row.coverageStatus,
        attributedValueUsd: row.attributedValueUsd === null ? null : Number(row.attributedValueUsd),
        relatedDepositId: row.relatedDepositId,
        relatedStrategyId: row.relatedStrategyId,
        metadata: row.metadataJson ?? {},
      })),
      nextCursor: nextOffset < timelineRows.length ? String(nextOffset) : null,
      hasMore: nextOffset < timelineRows.length,
    },
    related: {
      deposits: timelineItems
        .filter((row) => row.relatedDepositId)
        .map((row) => ({ id: row.relatedDepositId!, label: row.eventType })),
      strategies: timelineItems
        .filter((row) => row.relatedStrategyId)
        .map((row) => ({ id: row.relatedStrategyId!, label: row.eventType })),
    },
  };
}