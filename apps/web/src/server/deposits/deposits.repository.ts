import { and, asc, eq } from "drizzle-orm";

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
}): Promise<DepositDetailView | null> {
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

  const decompositionRow = decompositionRows[0];
  const decomposition: DepositPerformanceDecompositionView = {
    totalReturnUsd: asNumber(decompositionRow?.totalReturnUsd) ?? asNumber(row.totalReturnUsd) ?? 0,
    rewardsUsd: asNumber(decompositionRow?.rewardsUsd) ?? asNumber(row.totalRewardsUsd) ?? 0,
    feesUsd: asNumber(decompositionRow?.feesUsd) ?? 0,
    assetPriceEffectUsd: asNumber(decompositionRow?.assetPriceEffectUsd) ?? 0,
    rebalanceEffectUsd: asNumber(decompositionRow?.rebalanceEffectUsd) ?? 0,
    realizedPnlUsd: asNumber(decompositionRow?.realizedPnlUsd) ?? asNumber(row.realizedPnlUsd) ?? 0,
    unrealizedPnlUsd: asNumber(decompositionRow?.unrealizedPnlUsd) ?? asNumber(row.unrealizedPnlUsd) ?? 0,
    unattributedUsd: asNumber(decompositionRow?.unattributedUsd) ?? 0,
    unattributedReasonCodes: decompositionRow?.unattributedReasonCodes ?? [],
    componentPercentages: (decompositionRow?.componentPercentages ?? {}) as Record<string, number>,
  };

  const lifecycle: DepositLifecycleEventView[] = lifecycleRows.map((eventRow) => ({
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
    confidence: normalizeConfidence(eventRow.confidence),
    inferredActionId: eventRow.inferredActionId,
    coverageReasonCodes: eventRow.coverageReasonCodes ?? [],
    metadata: (eventRow.metadataJson ?? {}) as Record<string, unknown>,
  }));

  return {
    depositId: row.depositId,
    poolId: row.poolId,
    poolLabel: row.poolLabel,
    positionLabel: row.positionLabel,
    poolKind: normalizePoolKind(row.poolKind),
    feeTierBps: row.feeTierBps,
    tokenId: row.tokenId,
    token0Address: row.token0Address,
    token0Symbol: row.token0Symbol,
    token1Address: row.token1Address,
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
    tickLower: row.tickLower,
    tickUpper: row.tickUpper,
    isInRange: row.isInRange,
    rangeLowerPrice: asNullableNumber(row.rangeLowerPrice),
    rangeUpperPrice: asNullableNumber(row.rangeUpperPrice),
    coverageStatus: normalizeCoverage(row.coverageStatus),
    confidence: normalizeConfidence(row.confidence),
    coverageReasonCodes: row.coverageReasonCodes ?? [],
    coveredStartDayUtc: row.coveredStartDayUtc,
    coveredEndDayUtc: row.coveredEndDayUtc,
    decomposition,
    lifecycle,
    mellowStrategyCrossLinkId: row.mellowStrategyCrossLinkId,
  };
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
