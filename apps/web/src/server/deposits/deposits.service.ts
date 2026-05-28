import { readAnalysisStatusContext } from "@/server/analysis/analysis-run.repository";
import { projectAnalysisStatus } from "@/server/analysis/status-projection";
import {
  findDepositDetail,
  findDepositSummaries,
  hasAutomatedStrategyExposure,
} from "@/server/deposits/deposits.repository";
import type {
  DepositDetailRequest,
  DepositDetailResponse,
  DepositLifecycleEventView,
  DepositSummaryView,
  DepositValueChartSeries,
  DepositsListRequest,
  DepositsListResponse,
  DepositsListSummary,
} from "@/server/deposits/deposits.types";

function compareNullableNumber(left: number | null, right: number | null) {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left - right;
}

async function assertDepositsAccessible(input: { walletAddress: string; chainId: number }) {
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
    throw new Error("DEPOSITS_REQUEST_FAILED:ANALYSIS_REQUIRED");
  }

  return { analysisStatus: projected.status as "ready" | "stale" };
}

function aggregateSummary(items: DepositSummaryView[]): DepositsListSummary {
  let currentValueUsd = 0;
  let totalRewardsUsd = 0;
  let openActiveCount = 0;
  let openOutOfRangeCount = 0;
  let closedCount = 0;
  let weightedReturnSum = 0;
  let weightedDenominator = 0;
  let capitalEnteredTotal = 0;
  let currentDeployed = 0;
  const reasonCodeSet = new Set<string>();
  let coverageStatus: DepositsListSummary["coverageStatus"] = "full";

  for (const item of items) {
    currentValueUsd += item.currentValueUsd;
    totalRewardsUsd += item.totalRewardsUsd;
    capitalEnteredTotal += item.capitalEnteredUsd;
    if (item.status === "closed") closedCount += 1;
    else if (item.status === "open_out_of_range") openOutOfRangeCount += 1;
    else openActiveCount += 1;

    if (item.status !== "closed") {
      currentDeployed += item.currentValueUsd;
    }

    if (item.estimatedAnnualizedReturnPct !== null && item.currentValueUsd > 0) {
      weightedReturnSum += item.estimatedAnnualizedReturnPct * item.currentValueUsd;
      weightedDenominator += item.currentValueUsd;
    }

    for (const code of item.coverageReasonCodes) reasonCodeSet.add(code);

    if (item.coverageStatus === "partial" || coverageStatus === "partial") {
      coverageStatus = "partial";
    } else if (item.coverageStatus === "share_level" || coverageStatus === "share_level") {
      coverageStatus = "share_level";
    } else if (item.coverageStatus === "unknown" || coverageStatus === "unknown") {
      coverageStatus = "unknown";
    }
  }

  const capitalDeployedPctOfManual = capitalEnteredTotal > 0
    ? currentDeployed / capitalEnteredTotal
    : null;
  const weightedAnnualizedReturnPct = weightedDenominator > 0
    ? weightedReturnSum / weightedDenominator
    : null;

  return {
    totalCount: items.length,
    openActiveCount,
    openOutOfRangeCount,
    closedCount,
    currentValueUsd,
    totalRewardsUsd,
    weightedAnnualizedReturnPct,
    capitalDeployedPctOfManual,
    hasAutomatedExposure: false,
    coverageStatus,
    coverageReasonCodes: Array.from(reasonCodeSet),
  };
}

function matchesDateRange(item: DepositSummaryView, start: string | null, end: string | null) {
  if (!start && !end) return true;
  const openedDay = item.openedAt ? item.openedAt.slice(0, 10) : null;
  const closedDay = item.closedAt ? item.closedAt.slice(0, 10) : null;
  // Position overlaps requested range if it was active at any time in [start, end].
  if (start && closedDay && closedDay < start) return false;
  if (end && openedDay && openedDay > end) return false;
  return true;
}

function deriveValueChartSeries(input: {
  deposit: Awaited<ReturnType<typeof findDepositDetail>> extends infer T ? Exclude<T, null> : never;
}) {
  const series = {
    openedValue: [] as Array<{ occurredAt: string; usd: number; lifecycleEventId: string | null }>,
    additionalCapital: [] as Array<{ occurredAt: string; usd: number; lifecycleEventId: string | null }>,
    rewards: [] as Array<{ occurredAt: string; usd: number; lifecycleEventId: string | null }>,
    currentValue: [] as Array<{ occurredAt: string; usd: number; lifecycleEventId: string | null }>,
    withdrawal: [] as Array<{ occurredAt: string; usd: number; lifecycleEventId: string | null }>,
    closedValue: [] as Array<{ occurredAt: string; usd: number; lifecycleEventId: string | null }>,
  };

  let cumulativeRewards = 0;
  for (const event of input.deposit.lifecycle) {
    switch (event.eventType) {
      case "mint_position":
      case "transfer_in":
        series.openedValue.push({
          occurredAt: event.occurredAt,
          usd: input.deposit.openedValueUsd,
          lifecycleEventId: event.id,
        });
        break;
      case "increase_liquidity":
      case "stake":
        series.additionalCapital.push({
          occurredAt: event.occurredAt,
          usd: Math.abs(event.usdValue ?? 0),
          lifecycleEventId: event.id,
        });
        break;
      case "claim_reward":
      case "collect_fees":
        cumulativeRewards += Math.abs(event.usdValue ?? 0);
        series.rewards.push({
          occurredAt: event.occurredAt,
          usd: cumulativeRewards,
          lifecycleEventId: event.id,
        });
        break;
      case "decrease_liquidity":
      case "withdraw":
      case "unstake":
        series.withdrawal.push({
          occurredAt: event.occurredAt,
          usd: Math.abs(event.usdValue ?? 0),
          lifecycleEventId: event.id,
        });
        break;
      case "close":
      case "burn":
        series.closedValue.push({
          occurredAt: event.occurredAt,
          usd: Math.abs(event.usdValue ?? input.deposit.currentValueUsd),
          lifecycleEventId: event.id,
        });
        break;
    }
  }

  if (input.deposit.status !== "closed" && input.deposit.coveredEndDayUtc) {
    series.currentValue.push({
      occurredAt: `${input.deposit.coveredEndDayUtc}T00:00:00.000Z`,
      usd: input.deposit.currentValueUsd,
      lifecycleEventId: null,
    });
  }

  const orderedKeys: DepositValueChartSeries["key"][] = [
    "openedValue",
    "additionalCapital",
    "rewards",
    "currentValue",
    "withdrawal",
    "closedValue",
  ];

  return orderedKeys.map((key) => ({
    key,
    points: series[key],
  }));
}

function deriveValueChartGaps(lifecycle: DepositLifecycleEventView[]) {
  const gaps: DepositDetailResponse["valueChart"]["gaps"] = [];
  for (let index = 1; index < lifecycle.length; index += 1) {
    const previous = lifecycle[index - 1];
    const current = lifecycle[index];
    if (!previous || !current) continue;
    const reasonCode = [...previous.coverageReasonCodes, ...current.coverageReasonCodes].find((code) => (
      code === "coverageGap" ||
      code === "priceUnavailable" ||
      code === "missingHistoricalPrice" ||
      code === "priceFallbackDca" ||
      code === "lowConfidenceClassification"
    ));
    if (!reasonCode) continue;
    gaps.push({
      fromOccurredAt: previous.occurredAt,
      toOccurredAt: current.occurredAt,
      reasonCode,
    });
  }
  return gaps;
}

function assertDepositReconciliation(input: { totalReturnUsd: number; components: number[] }) {
  const reconstructed = input.components.reduce((sum, value) => sum + value, 0);
  if (Math.abs(input.totalReturnUsd - reconstructed) > 1e-9) {
    throw new Error("DEPOSITS_REQUEST_FAILED:RECONCILIATION_DRIFT");
  }
}

export async function getDepositsList(input: DepositsListRequest): Promise<DepositsListResponse> {
  const access = await assertDepositsAccessible({
    walletAddress: input.walletAddress,
    chainId: input.chainId,
  });

  const [rows, hasAutomatedExposure] = await Promise.all([
    findDepositSummaries({
      walletAddress: input.walletAddress,
      chainId: input.chainId,
    }),
    hasAutomatedStrategyExposure({
      walletAddress: input.walletAddress,
      chainId: input.chainId,
    }),
  ]);

  const allFiltered = rows.filter((row) => {
    if (input.status !== "all" && row.status !== input.status) return false;
    if (input.poolId && row.poolId !== input.poolId) return false;
    if (input.returnSign === "positive" && row.totalReturnUsd < 0) return false;
    if (input.returnSign === "negative" && row.totalReturnUsd >= 0) return false;
    if (!matchesDateRange(row, input.startDayUtc, input.endDayUtc)) return false;
    return true;
  });

  allFiltered.sort((left, right) => {
    let cmp = 0;
    switch (input.sort) {
      case "openedAt":
        cmp = (left.openedAt ?? "").localeCompare(right.openedAt ?? "");
        break;
      case "currentValue":
        cmp = left.currentValueUsd - right.currentValueUsd;
        break;
      case "totalReturn":
        cmp = left.totalReturnUsd - right.totalReturnUsd;
        break;
      case "totalRewards":
        cmp = left.totalRewardsUsd - right.totalRewardsUsd;
        break;
      case "estApr":
        cmp = compareNullableNumber(left.estimatedAnnualizedReturnPct, right.estimatedAnnualizedReturnPct);
        break;
    }
    if (cmp === 0) {
      cmp = left.depositId.localeCompare(right.depositId);
    }
    return input.direction === "asc" ? cmp : -cmp;
  });

  const totalCount = allFiltered.length;
  const startIndex = (input.page - 1) * input.pageSize;
  const items = allFiltered.slice(startIndex, startIndex + input.pageSize);
  const summary = {
    ...aggregateSummary(rows),
    hasAutomatedExposure,
  };

  // Reconciliation defensive assertion (per data-model §3.10): total_return roughly == components sum.
  // Read-side guard against drift (engine enforces canonical invariant).
  for (const item of items) {
    const componentsSum = item.totalRewardsUsd + item.realizedPnlUsd + item.unrealizedPnlUsd;
    if (Math.abs(item.totalReturnUsd - componentsSum) > 1) {
      // Drift > $1 indicates upstream materializer corruption — surface as internal_error.
      throw new Error("DEPOSITS_REQUEST_FAILED:RECONCILIATION_DRIFT");
    }
  }

  const coveredStartDays = rows.map((r) => r.coveredStartDayUtc).filter((v): v is string => Boolean(v));
  const coveredEndDays = rows.map((r) => r.coveredEndDayUtc).filter((v): v is string => Boolean(v));

  return {
    walletAddress: input.walletAddress,
    chainId: input.chainId,
    analysisStatus: access.analysisStatus,
    coveredRange: {
      startDayUtc: coveredStartDays.length > 0 ? coveredStartDays.sort()[0] : null,
      endDayUtc: coveredEndDays.length > 0 ? coveredEndDays.sort().at(-1) ?? null : null,
    },
    summary,
    items,
    page: {
      page: input.page,
      pageSize: input.pageSize,
      totalCount,
      hasMore: startIndex + items.length < totalCount,
    },
  };
}

export async function getDepositDetail(input: DepositDetailRequest): Promise<DepositDetailResponse> {
  const access = await assertDepositsAccessible({
    walletAddress: input.walletAddress,
    chainId: input.chainId,
  });

  const deposit = await findDepositDetail(input);
  if (!deposit) {
    throw new Error("DEPOSITS_REQUEST_FAILED:DEPOSIT_NOT_FOUND");
  }

  assertDepositReconciliation({
    totalReturnUsd: deposit.decomposition.totalReturnUsd,
    components: [
      deposit.decomposition.rewardsUsd,
      deposit.decomposition.feesUsd,
      deposit.decomposition.assetPriceEffectUsd,
      deposit.decomposition.rebalanceEffectUsd,
      deposit.decomposition.realizedPnlUsd,
      deposit.decomposition.unrealizedPnlUsd,
      deposit.decomposition.unattributedUsd,
    ],
  });

  return {
    walletAddress: input.walletAddress,
    chainId: input.chainId,
    analysisStatus: access.analysisStatus,
    coveredRange: {
      startDayUtc: deposit.coveredStartDayUtc,
      endDayUtc: deposit.coveredEndDayUtc,
    },
    deposit,
    valueChart: {
      series: deriveValueChartSeries({ deposit }),
      gaps: deriveValueChartGaps(deposit.lifecycle),
    },
  };
}
