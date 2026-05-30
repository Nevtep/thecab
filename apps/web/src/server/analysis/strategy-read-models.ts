import { and, eq } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import {
  pools,
  rewardEvents,
  strategies,
  strategyExposures,
  strategyHistorySnapshots,
  strategyLifecycleEvents,
  strategyWalletSummaries,
} from "@/server/db/schema";
import {
  STRATEGY_CONFIDENCE_VALUES,
  STRATEGY_COVERAGE_STATUS_VALUES,
  STRATEGY_LIFECYCLE_EVENT_TYPE_VALUES,
  STRATEGY_PRICE_SOURCE_VALUES,
  type StrategyConfidence,
  type StrategyCoverageStatus,
  type StrategyLifecycleEventType,
  type StrategyPriceSource,
} from "@/server/strategies/strategies.contract";

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
  tokenAddress?: string | null;
  amountRaw?: string | null;
  amountUsd: unknown;
  occurredAt?: Date | string | null;
  txHash?: string | null;
  logIndex?: number | null;
  isAccrualSnapshot?: boolean | null;
  resolutionStatus: string;
  resolutionReasonCodes?: string[] | null;
  metadataJson?: Record<string, unknown> | null;
};

type StrategyReadModelRowsInput = MaterializeStrategyReadModelsInput & {
  exposures: StrategyExposureMaterializerRow[];
  rewards: StrategyRewardMaterializerRow[];
};

type StrategyLifecycleInsertRow = typeof strategyLifecycleEvents.$inferInsert;

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

function asDate(value: unknown) {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  return null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function numberFromUnknown(value: unknown) {
  const numeric = asNumericString(value);
  return numeric === null ? null : Number(numeric);
}

function addNumericStrings(values: unknown[]) {
  const sum = values.reduce<number>((total, value) => total + (numberFromUnknown(value) ?? 0), 0);
  return String(sum);
}

function normalizeOneOf<const TValues extends readonly string[]>(
  value: unknown,
  allowed: TValues,
  fallback: TValues[number],
): TValues[number] {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? value as TValues[number] : fallback;
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

function normalizeConfidence(value: unknown): StrategyConfidence {
  return normalizeOneOf(value, STRATEGY_CONFIDENCE_VALUES, "unknown");
}

function normalizePriceSource(value: unknown): StrategyPriceSource | null {
  return typeof value === "string" && (STRATEGY_PRICE_SOURCE_VALUES as readonly string[]).includes(value)
    ? value as StrategyPriceSource
    : null;
}

function normalizeLifecycleEventType(value: unknown): StrategyLifecycleEventType | null {
  return typeof value === "string" && (STRATEGY_LIFECYCLE_EVENT_TYPE_VALUES as readonly string[]).includes(value)
    ? value as StrategyLifecycleEventType
    : null;
}

function normalizeLifecycleCoverageStatus(value: unknown, fallback: StrategyCoverageStatus): StrategyCoverageStatus {
  return typeof value === "string" && (STRATEGY_COVERAGE_STATUS_VALUES as readonly string[]).includes(value)
    ? value as StrategyCoverageStatus
    : fallback;
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
  baseCoverageStatus?: StrategyCoverageStatus;
  poolMappingStatus: "confirmed" | "inferred" | "unknown";
  externalReferenceStatus: "resolved" | "unresolved";
  currentEstimatedValueUsd: string | null;
  unresolvedRewardCount?: number;
}) {
  const reasons = new Set<string>();
  if (input.coverageStatus === "share_level" || input.baseCoverageStatus === "share_level") {
    reasons.add("shareLevelAccounting");
  }
  if (input.coverageStatus === "partial") {
    reasons.add("incompleteInternalActivity");
  }
  if (input.coverageStatus === "unknown") {
    reasons.add("incompleteInternalActivity");
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
  if ((input.unresolvedRewardCount ?? 0) > 0) {
    reasons.add("unresolvedStrategyReward");
  }
  return Array.from(reasons);
}

export function deriveStrategyCoverageStatus(input: {
  baseCoverageStatus: StrategyCoverageStatus;
  poolMappingStatus: "confirmed" | "inferred" | "unknown";
  externalReferenceStatus: "resolved" | "unresolved";
  currentEstimatedValueUsd: string | null;
  unresolvedRewardCount: number;
}): StrategyCoverageStatus {
  if (input.baseCoverageStatus === "unknown") {
    return "unknown";
  }

  const hasDegradedEvidence =
    input.baseCoverageStatus === "partial" ||
    input.currentEstimatedValueUsd === null ||
    input.poolMappingStatus !== "confirmed" ||
    input.externalReferenceStatus === "unresolved" ||
    input.unresolvedRewardCount > 0;

  if (hasDegradedEvidence) {
    return "partial";
  }

  return input.baseCoverageStatus;
}

export function deriveStrategyConfidence(coverageStatus: StrategyCoverageStatus): StrategyConfidence {
  if (coverageStatus === "full") return "high";
  if (coverageStatus === "share_level") return "medium";
  if (coverageStatus === "partial") return "degraded";
  return "unknown";
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

function normalizeTokenDeltas(value: unknown) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : [];
}

function buildExplicitLifecycleRows(input: {
  chainId: number;
  walletAddress: string;
  strategyId: string;
  strategyExposureId: string;
  primaryPoolId: string | null;
  runId: string;
  capturedAt: Date;
  fallbackCoverageStatus: StrategyCoverageStatus;
  exposureMetadata: Record<string, unknown>;
}) {
  const explicitRows = Array.isArray(input.exposureMetadata.lifecycleEvents)
    ? input.exposureMetadata.lifecycleEvents
    : [];

  return explicitRows.flatMap((candidate) => {
    const record = asRecord(candidate);
    const eventType = normalizeLifecycleEventType(record.eventType);
    const occurredAt = asDate(record.occurredAt);
    if (!eventType || !occurredAt) {
      return [];
    }

    return [{
      chainId: input.chainId,
      walletAddress: input.walletAddress,
      strategyId: input.strategyId,
      strategyExposureId: input.strategyExposureId,
      primaryPoolId: input.primaryPoolId,
      sequenceIndex: 0,
      latestRunId: input.runId,
      eventType,
      occurredAt,
      txHash: asString(record.txHash),
      logIndex: typeof record.logIndex === "number" && Number.isInteger(record.logIndex) ? record.logIndex : null,
      blockNumber: asNumericString(record.blockNumber),
      sourceLedgerEventId: asString(record.sourceLedgerEventId),
      sourceRewardEventId: null,
      usdValue: asNumericString(record.usdValue),
      shareDeltaRaw: asNumericString(record.shareDeltaRaw),
      tokenDeltasJson: normalizeTokenDeltas(record.tokenDeltas),
      priceSource: normalizePriceSource(record.priceSource),
      confidence: normalizeConfidence(record.confidence),
      coverageStatus: normalizeLifecycleCoverageStatus(record.coverageStatus, input.fallbackCoverageStatus),
      coverageReasonCodes: asStringArray(record.coverageReasonCodes),
      metadataJson: asRecord(record.metadataJson),
      createdAt: input.capturedAt,
    }];
  });
}

function buildRewardLifecycleRows(input: {
  chainId: number;
  walletAddress: string;
  strategyId: string;
  strategyExposureId: string;
  primaryPoolId: string | null;
  runId: string;
  capturedAt: Date;
  fallbackCoverageStatus: StrategyCoverageStatus;
  rewards: StrategyRewardMaterializerRow[];
}) {
  return input.rewards.flatMap((reward) => {
    if (reward.strategyExposureId !== input.strategyExposureId) {
      return [];
    }
    const metadata = asRecord(reward.metadataJson);
    const resolved = reward.resolutionStatus === "resolved";
    const occurredAt = asDate(reward.occurredAt) ?? input.capturedAt;
    const reasonCodes = resolved
      ? asStringArray(reward.resolutionReasonCodes)
      : [...new Set(["unresolvedStrategyReward", ...asStringArray(reward.resolutionReasonCodes)])];

    return [{
      chainId: input.chainId,
      walletAddress: input.walletAddress,
      strategyId: input.strategyId,
      strategyExposureId: input.strategyExposureId,
      primaryPoolId: input.primaryPoolId,
      sequenceIndex: 0,
      latestRunId: input.runId,
      eventType: resolved ? "strategy_claim" as const : "unresolved_strategy_reward" as const,
      occurredAt,
      txHash: asString(reward.txHash),
      logIndex: typeof reward.logIndex === "number" && Number.isInteger(reward.logIndex) ? reward.logIndex : null,
      blockNumber: asNumericString(metadata.blockNumber),
      sourceLedgerEventId: null,
      sourceRewardEventId: reward.id,
      usdValue: asNumericString(reward.amountUsd),
      shareDeltaRaw: null,
      tokenDeltasJson: [{
        tokenAddress: reward.tokenAddress ?? null,
        symbol: asString(metadata.tokenSymbol),
        direction: "in",
        amountRaw: asNumericString(reward.amountRaw) ?? "0",
        amountFormatted: asString(metadata.amountFormatted),
        usdValue: asNumericString(reward.amountUsd),
        priceSource: normalizePriceSource(metadata.priceSource),
      }],
      priceSource: normalizePriceSource(metadata.priceSource),
      confidence: resolved ? "high" as const : "degraded" as const,
      coverageStatus: resolved ? input.fallbackCoverageStatus : "partial" as const,
      coverageReasonCodes: reasonCodes,
      metadataJson: {
        rewardType: asString(metadata.rewardType),
        resolutionStatus: reward.resolutionStatus,
      },
      createdAt: input.capturedAt,
    }];
  });
}

export function buildStrategyReadModelRows(input: StrategyReadModelRowsInput) {
  const walletAddress = input.walletAddress.toLowerCase();
  const capturedAt = input.capturedAt;
  const rewardsByExposureId = new Map<string, StrategyRewardMaterializerRow[]>();

  for (const reward of input.rewards) {
    if (!reward.strategyExposureId || reward.isAccrualSnapshot) {
      continue;
    }
    const existing = rewardsByExposureId.get(reward.strategyExposureId) ?? [];
    existing.push(reward);
    rewardsByExposureId.set(reward.strategyExposureId, existing);
  }

  const lifecycle: StrategyLifecycleInsertRow[] = [];
  const summaries = input.exposures.map((exposure) => {
    const exposureMetadata = asRecord(exposure.exposureMetadataJson);
    const strategyMetadata = asRecord(exposure.strategyMetadataJson);
    const rewards = rewardsByExposureId.get(exposure.strategyExposureId) ?? [];
    const resolvedRewards = rewards.filter((reward) => reward.resolutionStatus === "resolved");
    const rewardReasonCodes = rewards.flatMap((reward) => asStringArray(reward.resolutionReasonCodes));
    const currentEstimatedValueUsd = asNumericString(
      exposureMetadata.valueUsd ?? strategyMetadata.valueUsd ?? exposureMetadata.currentEstimatedValueUsd,
    );
    const externalReferenceStatus = resolveExternalReferenceStatus(exposureMetadata);
    const poolMappingStatus = resolvePoolMappingStatus(exposure.primaryPoolId, exposureMetadata);
    const baseCoverageStatus = normalizeCoverageStatus(exposure.coverageStatus);
    const currentSharesRaw = asNumericString(exposure.sharesRaw) ?? "0";
    const coverageStatus = deriveStrategyCoverageStatus({
      baseCoverageStatus,
      poolMappingStatus,
      externalReferenceStatus,
      currentEstimatedValueUsd,
      unresolvedRewardCount: rewards.length - resolvedRewards.length,
    });

    const summary = {
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
      confidence: deriveStrategyConfidence(coverageStatus),
      coverageReasonCodes: Array.from(new Set([
        ...deriveStrategyCoverageReasonCodes({
          coverageStatus,
          baseCoverageStatus,
          poolMappingStatus,
          externalReferenceStatus,
          currentEstimatedValueUsd,
          unresolvedRewardCount: rewards.length - resolvedRewards.length,
        }),
        ...rewardReasonCodes,
      ])),
      metadataJson: {
        poolLabel: exposure.poolLabel,
        token0Address: exposureMetadata.token0Address ?? null,
        token1Address: exposureMetadata.token1Address ?? null,
      },
      createdAt: capturedAt,
      updatedAt: capturedAt,
    };

    lifecycle.push(...buildExplicitLifecycleRows({
      chainId: input.chainId,
      walletAddress,
      strategyId: exposure.strategyId,
      strategyExposureId: exposure.strategyExposureId,
      primaryPoolId: exposure.primaryPoolId,
      runId: input.runId,
      capturedAt,
      fallbackCoverageStatus: coverageStatus,
      exposureMetadata,
    }));
    lifecycle.push(...buildRewardLifecycleRows({
      chainId: input.chainId,
      walletAddress,
      strategyId: exposure.strategyId,
      strategyExposureId: exposure.strategyExposureId,
      primaryPoolId: exposure.primaryPoolId,
      runId: input.runId,
      capturedAt,
      fallbackCoverageStatus: coverageStatus,
      rewards,
    }));

    return summary;
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
    lifecycle: lifecycle
      .sort((left, right) => {
        const time = left.occurredAt.getTime() - right.occurredAt.getTime();
        if (time !== 0) return time;
        const log = (left.logIndex ?? Number.MAX_SAFE_INTEGER) - (right.logIndex ?? Number.MAX_SAFE_INTEGER);
        if (log !== 0) return log;
        return left.eventType.localeCompare(right.eventType);
      })
      .map((row, index) => ({ ...row, sequenceIndex: index + 1 })),
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
        tokenAddress: rewardEvents.tokenAddress,
        amountRaw: rewardEvents.amountRaw,
        amountUsd: rewardEvents.amountUsd,
        occurredAt: rewardEvents.occurredAt,
        txHash: rewardEvents.txHash,
        logIndex: rewardEvents.logIndex,
        isAccrualSnapshot: rewardEvents.isAccrualSnapshot,
        resolutionStatus: rewardEvents.resolutionStatus,
        resolutionReasonCodes: rewardEvents.resolutionReasonCodes,
        metadataJson: rewardEvents.metadataJson,
      })
      .from(rewardEvents)
      .where(and(
        eq(rewardEvents.walletAddress, walletAddress),
        eq(rewardEvents.chainId, input.chainId),
        eq(rewardEvents.isAccrualSnapshot, false),
      )),
  ]);

  const rows = buildStrategyReadModelRows({
    ...input,
    walletAddress,
    exposures: exposureRows,
    rewards: rewardRows,
  });

  const deletedLifecycle = await db
    .delete(strategyLifecycleEvents)
    .where(and(eq(strategyLifecycleEvents.walletAddress, walletAddress), eq(strategyLifecycleEvents.chainId, input.chainId)));
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

  if (rows.lifecycle.length > 0) {
    await db.insert(strategyLifecycleEvents).values(rows.lifecycle);
  }

  return {
    summariesDeleted: deletedSummaries.rowCount ?? 0,
    summariesInserted: rows.summaries.length,
    historyDeleted: deletedHistory.rowCount ?? 0,
    historyInserted: rows.history.length,
    lifecycleDeleted: deletedLifecycle.rowCount ?? 0,
    lifecycleInserted: rows.lifecycle.length,
  };
}
