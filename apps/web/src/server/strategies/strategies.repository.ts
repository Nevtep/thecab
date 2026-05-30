import { and, asc, eq } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import {
  pools,
  strategyHistorySnapshots,
  strategyWalletSummaries,
} from "@/server/db/schema";
import type {
  StrategiesListRequest,
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

function mapStrategyDetailRow(input: {
  row: StrategySummaryRowRecord;
  historyRows: StrategyHistoryRowRecord[];
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

  const start = (input.request.page - 1) * input.request.pageSize;
  const items = filtered.slice(start, start + input.request.pageSize);
  const selectedStrategyId =
    items.find((item) => item.strategyExposureId === input.request.selectedStrategyId)?.strategyExposureId ??
    items[0]?.strategyExposureId ??
    null;

  return {
    items,
    totalItems: filtered.length,
    totalPages: Math.max(1, Math.ceil(filtered.length / input.request.pageSize)),
    selectedStrategyId,
  };
}

async function readSummaryRows(input: { walletAddress: string; chainId: number }): Promise<StrategySummaryRowRecord[]> {
  const db = getDb();
  return db
    .select({
      id: strategyWalletSummaries.id,
      strategyId: strategyWalletSummaries.strategyId,
      strategyExposureId: strategyWalletSummaries.strategyExposureId,
      strategyLabel: strategyWalletSummaries.strategyLabel,
      protocol: strategyWalletSummaries.protocol,
      primaryPoolId: strategyWalletSummaries.primaryPoolId,
      poolLabel: pools.label,
      poolMappingStatus: strategyWalletSummaries.poolMappingStatus,
      status: strategyWalletSummaries.status,
      currentEstimatedValueUsd: strategyWalletSummaries.currentEstimatedValueUsd,
      depositedValueUsd: strategyWalletSummaries.depositedValueUsd,
      withdrawnValueUsd: strategyWalletSummaries.withdrawnValueUsd,
      currentSharesRaw: strategyWalletSummaries.currentSharesRaw,
      shareSymbol: strategyWalletSummaries.shareSymbol,
      totalRewardsUsd: strategyWalletSummaries.totalRewardsUsd,
      realizedPnlUsd: strategyWalletSummaries.realizedPnlUsd,
      unrealizedPnlUsd: strategyWalletSummaries.unrealizedPnlUsd,
      totalReturnUsd: strategyWalletSummaries.totalReturnUsd,
      totalReturnPct: strategyWalletSummaries.totalReturnPct,
      estimatedAnnualizedReturnPct: strategyWalletSummaries.estimatedAnnualizedReturnPct,
      coverageStatus: strategyWalletSummaries.coverageStatus,
      confidence: strategyWalletSummaries.confidence,
      coverageReasonCodes: strategyWalletSummaries.coverageReasonCodes,
      wrapperAddress: strategyWalletSummaries.wrapperAddress,
      stakingRewardsAddress: strategyWalletSummaries.stakingRewardsAddress,
      externalStrategyPositionReference: strategyWalletSummaries.externalStrategyPositionReference,
      externalStrategyPositionReferenceStatus: strategyWalletSummaries.externalStrategyPositionReferenceStatus,
      sharesReceivedRaw: strategyWalletSummaries.sharesReceivedRaw,
      sharesRedeemedRaw: strategyWalletSummaries.sharesRedeemedRaw,
      resolvedRewardCount: strategyWalletSummaries.resolvedRewardCount,
      unresolvedRewardCount: strategyWalletSummaries.unresolvedRewardCount,
      openedAt: strategyWalletSummaries.openedAt,
      closedAt: strategyWalletSummaries.closedAt,
      coveredStartDayUtc: strategyWalletSummaries.coveredStartDayUtc,
      coveredEndDayUtc: strategyWalletSummaries.coveredEndDayUtc,
      metadataJson: strategyWalletSummaries.metadataJson,
    })
    .from(strategyWalletSummaries)
    .leftJoin(pools, eq(strategyWalletSummaries.primaryPoolId, pools.id))
    .where(and(eq(strategyWalletSummaries.walletAddress, input.walletAddress.toLowerCase()), eq(strategyWalletSummaries.chainId, input.chainId)));
}

async function readHistoryRows(input: {
  walletAddress: string;
  chainId: number;
  strategyExposureId: string;
}): Promise<StrategyHistoryRowRecord[]> {
  const db = getDb();
  return db
    .select({
      dayUtc: strategyHistorySnapshots.dayUtc,
      estimatedValueUsd: strategyHistorySnapshots.estimatedValueUsd,
      cumulativeRewardsUsd: strategyHistorySnapshots.cumulativeRewardsUsd,
    })
    .from(strategyHistorySnapshots)
    .where(
      and(
        eq(strategyHistorySnapshots.walletAddress, input.walletAddress.toLowerCase()),
        eq(strategyHistorySnapshots.chainId, input.chainId),
        eq(strategyHistorySnapshots.strategyExposureId, input.strategyExposureId),
      ),
    )
    .orderBy(asc(strategyHistorySnapshots.dayUtc));
}

export async function findStrategySummaries(input: StrategiesListRequest) {
  const rows = (await readSummaryRows(input)).map(mapStrategySummaryRow);
  return applyStrategiesListRequest({ request: input, rows });
}

export async function findStrategyDetail(input: {
  walletAddress: string;
  chainId: number;
  strategyId: string;
}) {
  const rows = await readSummaryRows(input);
  const row = rows.find((item) => item.strategyExposureId === input.strategyId || item.strategyId === input.strategyId);
  if (!row) return null;
  const historyRows = await readHistoryRows({
    walletAddress: input.walletAddress,
    chainId: input.chainId,
    strategyExposureId: row.strategyExposureId,
  });
  return mapStrategyDetailRow({ row, historyRows });
}

export async function findAvailableStrategyPools(input: { walletAddress: string; chainId: number }) {
  const rows = await readSummaryRows(input);
  const byPoolId = new Map<string, { poolId: string; label: string }>();
  for (const row of rows) {
    if (row.primaryPoolId && row.poolLabel) {
      byPoolId.set(row.primaryPoolId, { poolId: row.primaryPoolId, label: row.poolLabel });
    }
  }
  return Array.from(byPoolId.values()).sort((left, right) => left.label.localeCompare(right.label));
}
