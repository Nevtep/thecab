import { and, asc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import { deposits, poolHistorySnapshots, poolTimelineEvents, poolWalletSummaries, strategies, strategyExposures } from "@/server/db/schema";
import type { PoolDetailRange, PoolPositionToken, PoolPositions, PoolsListItem } from "@/server/pools/pools.types";

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

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asTick(value: unknown) {
  const parsed = asNumber(value);
  return parsed === null ? null : Math.trunc(parsed);
}

function asNullableInteger(value: unknown) {
  const parsed = asNumber(value);
  return parsed === null ? null : Math.trunc(parsed);
}

function looksLikeAddressLabel(value: string) {
  return /^0x[0-9a-f]{40}(\b|$)/i.test(value.trim());
}

function isPairOnlyLabelWithoutDensity(value: string) {
  return /^[A-Za-z0-9]+\s*\/\s*[A-Za-z0-9]+$/.test(value.trim());
}

// Mirrors Aerodrome's pool taxonomy (CL tick spacing | v1 Volatile | v1 Stable).
// Labels MUST carry a density/type suffix — pair-only labels are forbidden
// because two pools with the same pair at different densities collide.
function resolveAerodromeSuffix(input: { feeTierLabel: string | null; poolType: string | null }) {
  if (input.feeTierLabel && input.feeTierLabel.trim().length > 0) {
    return input.feeTierLabel.trim();
  }
  const type = input.poolType?.trim().toLowerCase() ?? "";
  if (type === "stable") return "Stable";
  if (type === "volatile") return "Volatile";
  return null;
}

function resolveDisplayPoolLabel(input: {
  rawLabel: unknown;
  tokenSymbols: string[];
  feeTierLabel: string | null;
  poolType?: string | null;
}) {
  const pair = input.tokenSymbols.length >= 2
    ? `${input.tokenSymbols[0]} / ${input.tokenSymbols[1]}`
    : null;
  const suffix = resolveAerodromeSuffix({
    feeTierLabel: input.feeTierLabel,
    poolType: input.poolType ?? null,
  });
  const synthetic = pair && suffix ? `${pair} ${suffix}` : null;

  if (typeof input.rawLabel === "string" && input.rawLabel.trim().length > 0) {
    const trimmed = input.rawLabel.trim();
    if (!looksLikeAddressLabel(trimmed)) {
      // Reject pair-only stored labels: upgrade to a suffixed label if we
      // can, otherwise fall through so we never display "TOKEN0 / TOKEN1"
      // without a density/type suffix.
      if (isPairOnlyLabelWithoutDensity(trimmed)) {
        if (suffix) {
          return `${trimmed} ${suffix}`;
        }
      } else {
        return trimmed;
      }
    }
  }

  return synthetic ?? "Unknown pool";
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

function normalizeDepositStatus(value: string): "staked" | "open" | "closed" | "unknown" {
  switch (value) {
    case "staked":
    case "open":
    case "closed":
      return value;
    default:
      return "unknown";
  }
}

function buildPositionTokens(input: {
  primaryTokenSymbol: unknown;
  secondaryTokenSymbol: unknown;
  primaryTokenAmount: unknown;
  secondaryTokenAmount: unknown;
  fallbackSymbols?: string[];
}) {
  const tokens: PoolPositionToken[] = [];
  const seen = new Set<string>();

  const appendToken = (symbol: unknown, amount: unknown) => {
    if (typeof symbol !== "string") {
      return;
    }

    const trimmed = symbol.trim();
    if (trimmed.length === 0) {
      return;
    }

    const dedupeKey = trimmed.toLowerCase();
    if (seen.has(dedupeKey)) {
      return;
    }

    seen.add(dedupeKey);
    tokens.push({
      symbol: trimmed,
      amount: asNumber(amount),
    });
  };

  appendToken(input.primaryTokenSymbol, input.primaryTokenAmount);
  appendToken(input.secondaryTokenSymbol, input.secondaryTokenAmount);

  if (tokens.length > 0) {
    return tokens;
  }

  for (const symbol of input.fallbackSymbols ?? []) {
    appendToken(symbol, null);

    if (tokens.length === 2) {
      break;
    }
  }

  return tokens;
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
      label: resolveDisplayPoolLabel({
        rawLabel: metadata.label,
        tokenSymbols: asStringArray(metadata.tokenSymbols),
        feeTierLabel: typeof metadata.feeTierLabel === "string" ? metadata.feeTierLabel : null,
        poolType: typeof metadata.poolType === "string" ? metadata.poolType : null,
      }),
      poolAddress: typeof metadata.poolAddress === "string" ? metadata.poolAddress : "",
      tokenSymbols: asStringArray(metadata.tokenSymbols),
      feeTierLabel: typeof metadata.feeTierLabel === "string" ? metadata.feeTierLabel : null,
      poolType: typeof metadata.poolType === "string" ? metadata.poolType : null,
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

export async function readPoolPositions(input: {
  walletAddress: string;
  chainId: number;
  poolId: string;
  fallbackTokenSymbols: string[];
}): Promise<PoolPositions> {
  const db = getDb();
  const walletAddress = input.walletAddress.toLowerCase();
  const [depositRows, strategyRows] = await Promise.all([
    db
      .select()
      .from(deposits)
      .where(
        and(
          eq(deposits.walletAddress, walletAddress),
          eq(deposits.chainId, input.chainId),
          eq(deposits.poolId, input.poolId),
        ),
      ),
    db
      .select({
        exposureId: strategyExposures.id,
        strategyId: strategyExposures.strategyId,
        coverageStatus: strategyExposures.coverageStatus,
        metadataJson: strategyExposures.metadataJson,
        strategyLabel: strategies.label,
      })
      .from(strategyExposures)
      .innerJoin(strategies, eq(strategyExposures.strategyId, strategies.id))
      .where(
        and(
          eq(strategyExposures.walletAddress, walletAddress),
          eq(strategyExposures.chainId, input.chainId),
          eq(strategies.primaryPoolId, input.poolId),
        ),
      ),
  ]);

  return {
    manualDeposits: depositRows
      .filter((row) => normalizeDepositStatus(row.status) !== "closed")
      .map((row) => {
      const metadata = asRecord(row.metadataJson);
      const nestedMetadata = asRecord(metadata.metadata);

      return {
        depositId: row.id,
        tokenId: row.tokenId,
        status: normalizeDepositStatus(row.status),
        coverageStatus: normalizeCoverageStatus(row.coverageStatus),
        tickLower: asTick(nestedMetadata.rangeLowerTick),
        tickUpper: asTick(nestedMetadata.rangeUpperTick),
        rangeLowerPrice: asNumber(nestedMetadata.rangeLowerPrice),
        rangeUpperPrice: asNumber(nestedMetadata.rangeUpperPrice),
        rangeQuoteTokenSymbol:
          typeof nestedMetadata.rangeQuoteTokenSymbol === "string" && nestedMetadata.rangeQuoteTokenSymbol.trim().length > 0
            ? nestedMetadata.rangeQuoteTokenSymbol.trim()
            : null,
        rangeDisplayFractionDigits: asNullableInteger(nestedMetadata.rangeDisplayFractionDigits),
        isInRange: typeof nestedMetadata.isInRange === "boolean" ? nestedMetadata.isInRange : null,
        valueUsd: asNumber(metadata.valueUsd),
        tokens: buildPositionTokens({
          primaryTokenSymbol: metadata.primaryTokenSymbol,
          secondaryTokenSymbol: metadata.secondaryTokenSymbol,
          primaryTokenAmount: metadata.primaryTokenAmount,
          secondaryTokenAmount: metadata.secondaryTokenAmount,
          fallbackSymbols: input.fallbackTokenSymbols,
        }),
        annualizedReturnPct: null,
      };
    }),
    automatedStrategies: strategyRows.map((row) => {
      const metadata = asRecord(row.metadataJson);
      const nestedMetadata = asRecord(metadata.metadata);

      return {
        exposureId: row.exposureId,
        strategyId: row.strategyId,
        strategyLabel: row.strategyLabel,
        coverageStatus: normalizeCoverageStatus(row.coverageStatus),
        valueUsd: asNumber(metadata.valueUsd),
        externalStrategyPositionReference:
          typeof metadata.externalDepositReference === "string" ? metadata.externalDepositReference : null,
        externalStrategyPositionReferenceStatus:
          metadata.externalDepositReferenceStatus === "resolved" || metadata.externalDepositReferenceStatus === "unresolved"
            ? metadata.externalDepositReferenceStatus
            : null,
        tokens: buildPositionTokens({
          primaryTokenSymbol: metadata.primaryTokenSymbol ?? nestedMetadata.primaryTokenSymbol,
          secondaryTokenSymbol: metadata.secondaryTokenSymbol ?? nestedMetadata.secondaryTokenSymbol,
          primaryTokenAmount: metadata.primaryTokenAmount ?? nestedMetadata.primaryTokenAmount,
          secondaryTokenAmount: metadata.secondaryTokenAmount ?? nestedMetadata.secondaryTokenAmount,
          fallbackSymbols: input.fallbackTokenSymbols,
        }),
        annualizedReturnPct: null,
      };
    }),
  };
}