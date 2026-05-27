import { and, asc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import { poolHistorySnapshots, poolTimelineEvents, poolWalletSummaries } from "@/server/db/schema";
import type { PoolDetailRange, PoolsListItem } from "@/server/pools/pools.types";

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

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
}

function normalizeStatus(value: string): PoolsListItem["status"] {
  switch (value) {
    case "active":
    case "inactive":
    case "closed":
      return value;
    default:
      return "unknown";
  }
}

function normalizeExposureMix(value: string): PoolsListItem["exposureMix"] {
  switch (value) {
    case "manual":
    case "automated":
    case "mixed":
    case "residual_only":
      return value;
    default:
      return "unknown";
  }
}

function normalizeCoverageStatus(value: string): PoolsListItem["coverageStatus"] {
  switch (value) {
    case "full":
    case "share_level":
    case "partial":
      return value;
    default:
      return "unknown";
  }
}


  const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

  function endOfDayUtc(dayUtc: string) {
    return new Date(`${dayUtc}T23:59:59.999Z`);
  }

  function deriveRewardPerformanceMetrics(input: {
    firstParticipatedAt: Date | null;
    lastParticipatedAt: Date | null;
    coveredEndDayUtc: string;
    status: PoolsListItem["status"];
    capitalInvestedUsd: number;
    totalRewardsUsd: number;
    annualizedReturnPct?: number | null;
  }) {
    if (!input.firstParticipatedAt) {
      return {
        investedDays: null,
        totalReturnPct: null,
        annualizedReturnPct: null,
      };
    }

    const coveredEndAt = endOfDayUtc(input.coveredEndDayUtc);
    const effectiveEndAt = input.status === "active"
      ? coveredEndAt
      : input.lastParticipatedAt && input.lastParticipatedAt.getTime() < coveredEndAt.getTime()
        ? input.lastParticipatedAt
        : coveredEndAt;
    const investedDays = Math.max((effectiveEndAt.getTime() - input.firstParticipatedAt.getTime()) / MILLISECONDS_PER_DAY, 1);

    if (input.capitalInvestedUsd <= 0) {
      return {
        investedDays,
        totalReturnPct: null,
        annualizedReturnPct: null,
      };
    }

    const totalReturnPct = (input.totalRewardsUsd / input.capitalInvestedUsd) * 100;
    const derivedAnnualizedReturnPct = totalReturnPct * (365 / investedDays);

    return {
      investedDays,
      totalReturnPct,
      annualizedReturnPct: input.annualizedReturnPct ?? derivedAnnualizedReturnPct,
    };
  }
function daysForRange(range: PoolDetailRange) {
  switch (range) {
    case "30d":
      return 30;
    case "90d":
      return 90;
    case "180d":
      return 180;
    case "1y":
      return 365;
    case "covered":
      return null;
  }
}

export async function listPoolSummaries(input: {
  walletAddress: string;
  chainId: number;
}) {
  const db = getDb();
  const rows = await db
    .select()
    .from(poolWalletSummaries)
    .where(
      and(
        eq(poolWalletSummaries.walletAddress, input.walletAddress.toLowerCase()),
        eq(poolWalletSummaries.chainId, input.chainId),
      ),
    );

  return rows.map((row) => {
    const metadata = row.metadataJson ?? {};
    const status = normalizeStatus(row.status);
    const capitalEnteredUsd = Number(row.capitalEnteredUsd);
    const capitalWithdrawnUsd = Number(row.capitalWithdrawnUsd);
    const capitalInvestedUsd = Math.max(capitalEnteredUsd - capitalWithdrawnUsd, 0);
    const totalRewardsUsd = Number(row.totalRewardsUsd);
    const performance = deriveRewardPerformanceMetrics({
      firstParticipatedAt: row.firstParticipatedAt,
      lastParticipatedAt: row.lastParticipatedAt,
      coveredEndDayUtc: row.coveredEndDayUtc,
      status,
      capitalInvestedUsd,
      totalRewardsUsd,
    });

    return {
      poolId: row.poolId,
      label: typeof metadata.label === "string" ? metadata.label : "Unknown pool",
      poolAddress: typeof metadata.poolAddress === "string" ? metadata.poolAddress : "",
      tokenSymbols: asStringArray(metadata.tokenSymbols),
      feeTierLabel: typeof metadata.feeTierLabel === "string" ? metadata.feeTierLabel : null,
      protocolFamily: "aerodrome",
      status,
      exposureMix: normalizeExposureMix(row.exposureMix),
      currentAttributedValueUsd: Number(row.currentAttributedValueUsd),
      capitalEnteredUsd,
      capitalWithdrawnUsd,
      capitalInvestedUsd,
      realizedPnlUsd: asNumber(row.realizedPnlUsd),
      unrealizedPnlUsd: asNumber(row.unrealizedPnlUsd),
      totalRewardsUsd,
      investedDays: performance.investedDays,
      totalReturnPct: performance.totalReturnPct,
      annualizedReturnPct: performance.annualizedReturnPct,
      isInRange: typeof metadata.isInRange === "boolean" ? metadata.isInRange : null,
      coverageStatus: normalizeCoverageStatus(row.coverageStatus),
      coverageReasonCodes: asStringArray(metadata.coverageReasonCodes),
      latestActivityAt: row.lastParticipatedAt?.toISOString() ?? null,
      strategyLabels: asStringArray(metadata.strategyLabels),
      metricsEstimated: metadata.metricsEstimated === true,
      coveredStartDayUtc: row.coveredStartDayUtc,
      coveredEndDayUtc: row.coveredEndDayUtc,
      currentManualValueUsd: Number(row.currentManualValueUsd),
      currentStrategyValueUsd: Number(row.currentStrategyValueUsd),
      currentResidualValueUsd: Number(row.currentResidualValueUsd),
    };
  });
}

export async function readPoolSummarySeries(input: {
  walletAddress: string;
  chainId: number;
  poolIds: string[];
}) {
  if (input.poolIds.length === 0) {
    return {
      activePoolCount: [],
      currentAttributedValueUsd: [],
      totalRewardsUsd: [],
      estimatedAnnualizedReturnPct: [],
    };
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(poolHistorySnapshots)
    .where(
      and(
        eq(poolHistorySnapshots.walletAddress, input.walletAddress.toLowerCase()),
        eq(poolHistorySnapshots.chainId, input.chainId),
        inArray(poolHistorySnapshots.poolId, input.poolIds),
      ),
    )
    .orderBy(asc(poolHistorySnapshots.dayUtc));

  const buckets = new Map<string, {
    activePoolCount: number;
    currentAttributedValueUsd: number;
    totalRewardsUsd: number;
    rewardValueUsd: number;
  }>();

  for (const row of rows) {
    const bucket = buckets.get(row.dayUtc) ?? {
      activePoolCount: 0,
      currentAttributedValueUsd: 0,
      totalRewardsUsd: 0,
      rewardValueUsd: 0,
    };

    const totalValueUsd = Number(row.totalValueUsd);
    bucket.currentAttributedValueUsd += totalValueUsd;
    bucket.totalRewardsUsd += Number(row.cumulativeRewardsUsd);
    bucket.rewardValueUsd += Number(row.rewardValueUsd);
    if (totalValueUsd > 0) {
      bucket.activePoolCount += 1;
    }

    buckets.set(row.dayUtc, bucket);
  }

  const sortedDays = Array.from(buckets.keys()).sort((left, right) => left.localeCompare(right));

  return {
    activePoolCount: sortedDays.map((dayUtc) => buckets.get(dayUtc)?.activePoolCount ?? 0),
    currentAttributedValueUsd: sortedDays.map((dayUtc) => buckets.get(dayUtc)?.currentAttributedValueUsd ?? 0),
    totalRewardsUsd: sortedDays.map((dayUtc) => buckets.get(dayUtc)?.totalRewardsUsd ?? 0),
    estimatedAnnualizedReturnPct: sortedDays.map((dayUtc) => {
      const bucket = buckets.get(dayUtc);
      if (!bucket || bucket.currentAttributedValueUsd <= 0) {
        return 0;
      }

      return (bucket.rewardValueUsd / bucket.currentAttributedValueUsd) * 365 * 100;
    }),
  };
}

export async function readPoolHistory(input: {
  walletAddress: string;
  chainId: number;
  poolId: string;
  range: PoolDetailRange;
}) {
  const db = getDb();
  const rows = await db
    .select()
    .from(poolHistorySnapshots)
    .where(
      and(
        eq(poolHistorySnapshots.walletAddress, input.walletAddress.toLowerCase()),
        eq(poolHistorySnapshots.chainId, input.chainId),
        eq(poolHistorySnapshots.poolId, input.poolId),
      ),
    );

  const sorted = rows.sort((left, right) => left.dayUtc.localeCompare(right.dayUtc));
  const rangeDays = daysForRange(input.range);
  const filtered = rangeDays === null ? sorted : sorted.slice(-rangeDays);

  return filtered.map((row) => ({
    dayUtc: row.dayUtc,
    totalValueUsd: Number(row.totalValueUsd),
    deployedValueUsd: Number(row.deployedValueUsd),
    residualValueUsd: Number(row.residualValueUsd),
    manualValueUsd: Number(row.manualValueUsd),
    strategyValueUsd: Number(row.strategyValueUsd),
    rewardValueUsd: Number(row.rewardValueUsd),
    cumulativeRewardsUsd: Number(row.cumulativeRewardsUsd),
    capitalInUsd: Number(row.capitalInUsd),
    capitalOutUsd: Number(row.capitalOutUsd),
    coverageStatus: normalizeCoverageStatus(row.coverageStatus),
    metadata: row.metadataJson ?? {},
  }));
}

export async function readPoolTimeline(input: {
  walletAddress: string;
  chainId: number;
  poolId: string;
}) {
  const db = getDb();
  const rows = await db
    .select()
    .from(poolTimelineEvents)
    .where(
      and(
        eq(poolTimelineEvents.walletAddress, input.walletAddress.toLowerCase()),
        eq(poolTimelineEvents.chainId, input.chainId),
        eq(poolTimelineEvents.poolId, input.poolId),
      ),
    );

  return rows
    .map((row) => ({
      ...row,
      coverageStatus: normalizeCoverageStatus(row.coverageStatus),
    }))
    .sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime());
}