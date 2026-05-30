import { and, eq } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import {
  pools,
  rewardEvents,
  strategies,
  strategyExposures,
  strategyHistorySnapshots,
  strategyWalletSummaries,
} from "@/server/db/schema";
import type { StrategyCoverageStatus } from "@/server/strategies/strategies.contract";

export type MaterializeStrategyReadModelsInput = {
  runId: string;
  walletAddress: string;
  chainId: number;
  startDayUtc: string;
  endDayUtc: string;
  capturedAt: Date;
};

export type MaterializeStrategyReadModelsResult = {
  summariesDeleted: number;
  summariesInserted: number;
  historyDeleted: number;
  historyInserted: number;
  lifecycleDeleted: number;
  lifecycleInserted: number;
};

export type StrategyExposureMaterializerRow = {
  strategyId: string;
  strategyExposureId: string;
  primaryPoolId: string | null;
  poolLabel: string | null;
  strategyLabel: string;
  protocol: string;
  wrapperAddress: string | null;
  stakingRewardsAddress: string | null;
  sharesRaw: string | null;
  underlying0AmountRaw: string | null;
  underlying1AmountRaw: string | null;
  coverageStatus: string;
  strategyMetadataJson: Record<string, unknown> | null;
  exposureMetadataJson: Record<string, unknown> | null;
};

export type StrategyRewardMaterializerRow = {
  id: string;
  strategyExposureId: string | null;
  amountUsd: unknown;
  resolutionStatus: string;
};

type StrategyReadModelRowsInput = MaterializeStrategyReadModelsInput & {
  exposures: StrategyExposureMaterializerRow[];
  rewards: StrategyRewardMaterializerRow[];
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function asNumericString(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "string" && value.trim().length > 0 && Number.isFinite(Number(value))) {
    return value;
  }
  return null;
}

function numberFromUnknown(value: unknown) {
  const numeric = asNumericString(value);
  return numeric === null ? null : Number(numeric);
}

function addNumericStrings(values: unknown[]) {
  const sum = values.reduce<number>((total, value) => total + (numberFromUnknown(value) ?? 0), 0);
  return String(sum);
}

function normalizeCoverageStatus(value: string): StrategyCoverageStatus {
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

export function deriveStrategyStatus(currentSharesRaw: string | null): "active" | "closed" | "unknown" {
  if (currentSharesRaw === null) {
    return "unknown";
  }

  try {
    return BigInt(currentSharesRaw) > 0n ? "active" : "closed";
  } catch {
    return "unknown";
  }
}

export function deriveStrategyCoverageReasonCodes(input: {
  coverageStatus: StrategyCoverageStatus;
  poolMappingStatus: "confirmed" | "inferred" | "unknown";
  externalReferenceStatus: "resolved" | "unresolved";
  currentEstimatedValueUsd: string | null;
}) {
  const reasons = new Set<string>();
  if (input.coverageStatus === "share_level") {
    reasons.add("shareLevelAccounting");
  }
  if (input.currentEstimatedValueUsd === null) {
    reasons.add("missingShareValuation");
  }
  if (input.poolMappingStatus === "inferred") {
    reasons.add("poolMappingInferred");
  }
  if (input.poolMappingStatus === "unknown") {
    reasons.add("poolMappingUnknown");
  }
  if (input.externalReferenceStatus === "unresolved") {
    reasons.add("externalStrategyReferenceUnresolved");
  }
  return Array.from(reasons);
}

function resolvePoolMappingStatus(primaryPoolId: string | null, exposureMetadata: Record<string, unknown>) {
  const raw = asString(exposureMetadata.poolMappingStatus);
  if (raw === "confirmed" || raw === "inferred" || raw === "unknown") {
    return raw;
  }
  return primaryPoolId ? "confirmed" : "unknown";
}

function resolveExternalReferenceStatus(exposureMetadata: Record<string, unknown>) {
  const raw = asString(exposureMetadata.externalDepositReferenceStatus)
    ?? asString(exposureMetadata.externalStrategyPositionReferenceStatus);
  return raw === "resolved" ? "resolved" : "unresolved";
}

export function buildStrategyReadModelRows(input: StrategyReadModelRowsInput) {
  const walletAddress = input.walletAddress.toLowerCase();
  const capturedAt = input.capturedAt;
  const rewardsByExposureId = new Map<string, StrategyRewardMaterializerRow[]>();

  for (const reward of input.rewards) {
    if (!reward.strategyExposureId) {
      continue;
    }
    const existing = rewardsByExposureId.get(reward.strategyExposureId) ?? [];
    existing.push(reward);
    rewardsByExposureId.set(reward.strategyExposureId, existing);
  }

  const summaries = input.exposures.map((exposure) => {
    const exposureMetadata = asRecord(exposure.exposureMetadataJson);
    const strategyMetadata = asRecord(exposure.strategyMetadataJson);
    const rewards = rewardsByExposureId.get(exposure.strategyExposureId) ?? [];
    const resolvedRewards = rewards.filter((reward) => reward.resolutionStatus === "resolved");
    const currentEstimatedValueUsd = asNumericString(
      exposureMetadata.valueUsd ?? strategyMetadata.valueUsd ?? exposureMetadata.currentEstimatedValueUsd,
    );
    const externalReferenceStatus = resolveExternalReferenceStatus(exposureMetadata);
    const poolMappingStatus = resolvePoolMappingStatus(exposure.primaryPoolId, exposureMetadata);
    const coverageStatus = normalizeCoverageStatus(exposure.coverageStatus);
    const currentSharesRaw = asNumericString(exposure.sharesRaw) ?? "0";

    return {
      chainId: input.chainId,
      walletAddress,
      strategyId: exposure.strategyId,
      strategyExposureId: exposure.strategyExposureId,
      primaryPoolId: exposure.primaryPoolId,
      latestRunId: input.runId,
      strategyLabel: asString(exposureMetadata.strategyLabel) ?? asString(strategyMetadata.label) ?? exposure.strategyLabel,
      protocol: exposure.protocol || "mellow",
      wrapperAddress: exposure.wrapperAddress,
      stakingRewardsAddress:
        exposure.stakingRewardsAddress ??
        asString(exposureMetadata.stakingRewardsAddress) ??
        asString(strategyMetadata.stakingRewardsAddress),
      externalStrategyPositionReference:
        asString(exposureMetadata.externalDepositReference) ??
        asString(exposureMetadata.externalStrategyPositionReference),
      externalStrategyPositionReferenceStatus: externalReferenceStatus,
      poolMappingStatus,
      status: deriveStrategyStatus(currentSharesRaw),
      openedAt: null,
      closedAt: null,
      coveredStartDayUtc: input.startDayUtc,
      coveredEndDayUtc: input.endDayUtc,
      depositedValueUsd: "0",
      withdrawnValueUsd: "0",
      currentEstimatedValueUsd,
      sharesReceivedRaw: currentSharesRaw,
      sharesRedeemedRaw: "0",
      currentSharesRaw,
      shareSymbol: asString(exposureMetadata.shareSymbol),
      totalRewardsUsd: addNumericStrings(resolvedRewards.map((reward) => reward.amountUsd)),
      resolvedRewardCount: resolvedRewards.length,
      unresolvedRewardCount: rewards.length - resolvedRewards.length,
      realizedPnlUsd: null,
      unrealizedPnlUsd: null,
      totalReturnUsd: currentEstimatedValueUsd === null ? null : currentEstimatedValueUsd,
      totalReturnPct: null,
      estimatedAnnualizedReturnPct: null,
      coverageStatus,
      confidence: coverageStatus === "full" ? "high" : coverageStatus === "unknown" ? "unknown" : "degraded",
      coverageReasonCodes: deriveStrategyCoverageReasonCodes({
        coverageStatus,
        poolMappingStatus,
        externalReferenceStatus,
        currentEstimatedValueUsd,
      }),
      metadataJson: {
        poolLabel: exposure.poolLabel,
        token0Address: exposureMetadata.token0Address ?? null,
        token1Address: exposureMetadata.token1Address ?? null,
      },
      createdAt: capturedAt,
      updatedAt: capturedAt,
    };
  });

  const history = summaries.map((summary) => ({
    chainId: summary.chainId,
    walletAddress: summary.walletAddress,
    strategyId: summary.strategyId,
    strategyExposureId: summary.strategyExposureId,
    primaryPoolId: summary.primaryPoolId,
    dayUtc: input.endDayUtc,
    latestRunId: input.runId,
    coverageStatus: summary.coverageStatus,
    shareBalanceRaw: summary.currentSharesRaw,
    estimatedValueUsd: summary.currentEstimatedValueUsd,
    depositedValueUsd: "0",
    withdrawnValueUsd: "0",
    rewardValueUsd: summary.totalRewardsUsd,
    cumulativeRewardsUsd: summary.totalRewardsUsd,
    totalReturnUsd: summary.totalReturnUsd,
    metadataJson: summary.metadataJson,
    createdAt: capturedAt,
  }));

  return {
    summaries,
    history,
    lifecycle: [],
  };
}

export async function materializeStrategyReadModels(
  input: MaterializeStrategyReadModelsInput,
): Promise<MaterializeStrategyReadModelsResult> {
  const db = getDb();
  const walletAddress = input.walletAddress.toLowerCase();
  const [exposureRows, rewardRows] = await Promise.all([
    db
      .select({
        strategyId: strategies.id,
        strategyExposureId: strategyExposures.id,
        primaryPoolId: strategies.primaryPoolId,
        poolLabel: pools.label,
        strategyLabel: strategies.label,
        protocol: strategies.protocol,
        wrapperAddress: strategies.wrapperAddress,
        stakingRewardsAddress: strategies.stakingRewardsAddress,
        sharesRaw: strategyExposures.sharesRaw,
        underlying0AmountRaw: strategyExposures.underlying0AmountRaw,
        underlying1AmountRaw: strategyExposures.underlying1AmountRaw,
        coverageStatus: strategyExposures.coverageStatus,
        strategyMetadataJson: strategies.metadataJson,
        exposureMetadataJson: strategyExposures.metadataJson,
      })
      .from(strategyExposures)
      .innerJoin(strategies, eq(strategyExposures.strategyId, strategies.id))
      .leftJoin(pools, eq(strategies.primaryPoolId, pools.id))
      .where(and(eq(strategyExposures.walletAddress, walletAddress), eq(strategyExposures.chainId, input.chainId))),
    db
      .select({
        id: rewardEvents.id,
        strategyExposureId: rewardEvents.strategyExposureId,
        amountUsd: rewardEvents.amountUsd,
        resolutionStatus: rewardEvents.resolutionStatus,
      })
      .from(rewardEvents)
      .where(and(eq(rewardEvents.walletAddress, walletAddress), eq(rewardEvents.chainId, input.chainId))),
  ]);

  const rows = buildStrategyReadModelRows({
    ...input,
    walletAddress,
    exposures: exposureRows,
    rewards: rewardRows,
  });

  const deletedHistory = await db
    .delete(strategyHistorySnapshots)
    .where(and(eq(strategyHistorySnapshots.walletAddress, walletAddress), eq(strategyHistorySnapshots.chainId, input.chainId)));
  const deletedSummaries = await db
    .delete(strategyWalletSummaries)
    .where(and(eq(strategyWalletSummaries.walletAddress, walletAddress), eq(strategyWalletSummaries.chainId, input.chainId)));

  if (rows.summaries.length > 0) {
    await db.insert(strategyWalletSummaries).values(rows.summaries);
  }

  if (rows.history.length > 0) {
    await db.insert(strategyHistorySnapshots).values(rows.history);
  }

  return {
    summariesDeleted: deletedSummaries.rowCount ?? 0,
    summariesInserted: rows.summaries.length,
    historyDeleted: deletedHistory.rowCount ?? 0,
    historyInserted: rows.history.length,
    lifecycleDeleted: 0,
    lifecycleInserted: rows.lifecycle.length,
  };
}
