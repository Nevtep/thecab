import { and, eq } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import { depositWalletSummaries, pools } from "@/server/db/schema";
import type { DepositSummaryView } from "@/server/deposits/deposits.types";

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

export async function findDepositSummaries(input: {
  walletAddress: string;
  chainId: number;
}): Promise<DepositSummaryView[]> {
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
    })
    .from(depositWalletSummaries)
    .innerJoin(pools, eq(pools.id, depositWalletSummaries.poolId))
    .where(
      and(
        eq(depositWalletSummaries.chainId, input.chainId),
        eq(depositWalletSummaries.walletAddress, input.walletAddress),
      ),
    );

  return rows.map((row) => ({
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
  }));
}

export async function findDepositDetail(input: {
  walletAddress: string;
  chainId: number;
  depositId: string;
}): Promise<DepositSummaryView | null> {
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
  };
}
