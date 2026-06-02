import type { EngineV2AccountingOutput } from "@/server/analysis/engine-v2/accounting";
import { deriveGovernanceLockKind, resolvePrimaryGovernanceLockPanel, selectPrimaryGovernanceLockId } from "@/server/governance/governance-locks";
import type { GovernanceLockPanel } from "@/server/governance/governance.types";

import { materializeActivityRows, type EngineV2ReadModelRowInput } from "./activity-materializer";
import type { EngineV2MaterializationContext, EngineV2MaterializationPoolState } from "./load-materialization-context";

function row(input: Omit<EngineV2ReadModelRowInput, "walletAddress" | "chainId"> & {
  chainId: number;
  walletAddress: string;
}): EngineV2ReadModelRowInput {
  return {
    ...input,
    walletAddress: input.walletAddress.toLowerCase(),
  };
}

function toNumber(value: string | null | undefined) {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toNullableNumber(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function coverageStatus(value: string) {
  return value === "full" || value === "share_level" || value === "partial" ? value : "unknown";
}

function confidence(value: string) {
  return value === "high" || value === "medium" || value === "low" ? value : "unknown";
}

function confidenceDots(value: string) {
  return value === "high" ? 5 : value === "medium" ? 3 : value === "low" ? 2 : 0;
}

function externalTxUrl(chainId: number, txHash: string | null) {
  return txHash ? `https://basescan.org/tx/${txHash}` : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asObjectArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry))
    : [];
}

function asGovernanceLockPanel(value: unknown): GovernanceLockPanel | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as GovernanceLockPanel : null;
}

function asInteger(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : null;
  }
  return null;
}

function movementRecords(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry))
    : [];
}

function normalizeAddress(value: string | null | undefined) {
  return value ? value.toLowerCase() : null;
}

function poolAddressFromPoolId(poolId: string | null | undefined) {
  if (!poolId) return null;
  const poolAddress = poolId.split(":").at(-1) ?? null;
  return normalizeAddress(poolAddress);
}

function defaultMaterializationContext(): EngineV2MaterializationContext {
  return {
    poolStateByPoolId: new Map(),
    tokenMetadataByAddress: new Map(),
    governanceLockByLockKey: new Map(),
    governanceLockByTokenId: new Map(),
  };
}

function getPoolState(context: EngineV2MaterializationContext, poolId: string | null | undefined) {
  if (!poolId) return null;
  return context.poolStateByPoolId.get(poolId) ?? null;
}

function getTokenMetadata(context: EngineV2MaterializationContext, tokenAddress: string | null | undefined) {
  const normalized = normalizeAddress(tokenAddress);
  return normalized ? context.tokenMetadataByAddress.get(normalized) ?? null : null;
}

function poolKindFromState(input: {
  depositTokenId: string | null | undefined;
  poolState: EngineV2MaterializationPoolState | null;
}) {
  if (input.depositTokenId) return "cl";
  if (input.poolState?.tickSpacing !== null && input.poolState?.tickSpacing !== undefined) return "cl";
  return "unknown";
}

function poolLabelFromState(input: {
  poolId: string | null | undefined;
  poolState: EngineV2MaterializationPoolState | null;
  context: EngineV2MaterializationContext;
}) {
  if (!input.poolId) return "Unresolved pool";
  const token0Symbol = getTokenMetadata(input.context, input.poolState?.token0Address)?.symbol ?? null;
  const token1Symbol = getTokenMetadata(input.context, input.poolState?.token1Address)?.symbol ?? null;
  if (!token0Symbol || !token1Symbol) return input.poolId;
  const suffix = input.poolState?.feeTierBps ?? input.poolState?.tickSpacing;
  return suffix ? `${token0Symbol} / ${token1Symbol} ${suffix}` : `${token0Symbol} / ${token1Symbol}`;
}

function positionLabelFromDeposit(input: {
  depositId: string;
  tokenId: string | null | undefined;
  poolLabel: string;
  poolKind: string;
}) {
  if (!input.tokenId) return input.depositId;
  const suffix = input.poolKind === "cl" ? " · CL" : "";
  return `${input.poolLabel}${suffix} #${input.tokenId}`;
}

function formatFeeTierLabel(tickSpacing: number | null | undefined) {
  return typeof tickSpacing === "number" && Number.isFinite(tickSpacing)
    ? String(tickSpacing)
    : null;
}

function normalizeDepositLifecycleEventType(value: string) {
  if (value.includes("transfer_in")) return "transfer_in";
  if (value.includes("unstake")) return "unstake";
  if (value.includes("stake")) return "stake";
  if (value.includes("fee")) return "collect_fees";
  if (value.includes("reward") || value.includes("claim")) return "claim_reward";
  if (value.includes("decrease")) return "decrease_liquidity";
  if (value.includes("withdraw")) return "withdraw";
  if (value.includes("burn")) return "burn";
  if (value.includes("close")) return "close";
  if (value.includes("increase")) return "increase_liquidity";
  if (value.includes("mint") || value.includes("open") || value.includes("deposit") || value.includes("create")) return "mint_position";
  return "mint_position";
}

function normalizeStrategyLifecycleEventType(value: string) {
  if (value.includes("baseline_transfer_in") || value.includes("transfer_in")) return "strategy_baseline_transfer_in";
  if (value.includes("fee_dilution")) return "strategy_fee_dilution";
  if (value.includes("rebalance")) return "strategy_internal_rebalance";
  if (value.includes("share_redeem") || value.includes("redeem")) return "strategy_share_redeem";
  if (value.includes("withdraw")) return "strategy_withdraw";
  if (value.includes("unstake")) return "strategy_unstake";
  if (value.includes("reward") || value.includes("claim")) return "strategy_claim";
  if (value.includes("stake")) return "strategy_stake";
  if (value.includes("share_receive")) return "strategy_share_receive";
  if (value.includes("close")) return "strategy_close";
  if (value.includes("deposit")) return "strategy_deposit";
  return "strategy_internal_rebalance";
}

function formatTokenAmount(amountRaw: string | null, decimals: number | null) {
  if (!amountRaw || decimals === null || decimals < 0) return null;
  if (!/^\d+$/.test(amountRaw)) return null;
  const raw = BigInt(amountRaw);
  const base = 10n ** BigInt(decimals);
  const whole = raw / base;
  const fraction = raw % base;
  if (fraction === 0n) return whole.toString();
  const padded = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  return padded.length > 0 ? `${whole.toString()}.${padded}` : whole.toString();
}

function buildDepositLifecycleTokenDeltas(input: {
  eventId: string | null;
  sourceEventsById: Map<string, EngineV2AccountingOutput["events"][number]>;
  context: EngineV2MaterializationContext;
}) {
  if (!input.eventId) return [];
  const sourceEvent = input.sourceEventsById.get(input.eventId);
  if (!sourceEvent) return [];
  return movementRecords(asRecord(sourceEvent.evidenceJson).movements)
    .filter((movement) => movement.assetType === "erc20")
    .flatMap((movement) => {
      const direction = asString(movement.direction);
      if (direction !== "in" && direction !== "out") return [];
      const tokenAddress = normalizeAddress(asString(movement.tokenAddress));
      const metadata = getTokenMetadata(input.context, tokenAddress);
      const amountRaw = asString(movement.amountRaw) ?? "0";
      return [{
        tokenAddress,
        symbol: metadata?.symbol ?? null,
        direction,
        amountRaw,
        amountFormatted: formatTokenAmount(amountRaw, metadata?.decimals ?? null),
        usdValue: toNullableNumber(asString(movement.valueUsdAtEvent)),
        priceSource: asString(movement.valueUsdAtEvent) ? "event" : null,
      }];
    });
}

function buildStrategyLifecycleTokenDeltas(input: {
  eventId: string | null;
  sourceEventsById: Map<string, EngineV2AccountingOutput["events"][number]>;
  context: EngineV2MaterializationContext;
}) {
  if (!input.eventId) return [];
  const sourceEvent = input.sourceEventsById.get(input.eventId);
  if (!sourceEvent) return [];
  return movementRecords(asRecord(sourceEvent.evidenceJson).movements)
    .filter((movement) => movement.assetType === "erc20")
    .flatMap((movement) => {
      const direction = asString(movement.direction);
      if (direction !== "in" && direction !== "out") return [];
      const tokenAddress = normalizeAddress(asString(movement.tokenAddress));
      const metadata = getTokenMetadata(input.context, tokenAddress);
      const amountRaw = asString(movement.amountRaw) ?? "0";
      return [{
        tokenAddress,
        symbol: metadata?.symbol ?? null,
        direction,
        amountRaw,
        amountFormatted: formatTokenAmount(amountRaw, metadata?.decimals ?? null),
        usdValue: toNullableNumber(asString(movement.valueUsdAtEvent)),
        priceSource: asString(movement.valueUsdAtEvent) ? "alchemyHistorical" : null,
      }];
    });
}

function buildStrategyHistory(input: {
  lifecycle: Array<{ eventType: string; occurredAt: Date; valueUsd: string | null }>;
  rewards: Array<{ occurredAt: Date; amountUsd: string | null }>;
  fallbackEstimatedValueUsd: number | null;
}) {
  const ordered = [...input.lifecycle].sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime());
  const history = new Map<string, { dayUtc: string; estimatedValueUsd: number | null; cumulativeRewardsUsd: number }>();
  let cumulativeRewardsUsd = 0;
  const rewardsByDay = input.rewards.reduce<Map<string, number>>((acc, reward) => {
    const dayUtc = reward.occurredAt.toISOString().slice(0, 10);
    acc.set(dayUtc, (acc.get(dayUtc) ?? 0) + toNumber(reward.amountUsd));
    return acc;
  }, new Map());

  for (const event of ordered) {
    const dayUtc = event.occurredAt.toISOString().slice(0, 10);
    const entry = history.get(dayUtc) ?? {
      dayUtc,
      estimatedValueUsd: null,
      cumulativeRewardsUsd,
    };
    if (!(event.eventType.includes("reward") || event.eventType.includes("claim")) && event.valueUsd) {
      entry.estimatedValueUsd = toNullableNumber(event.valueUsd);
    }
    if (rewardsByDay.has(dayUtc)) {
      cumulativeRewardsUsd += rewardsByDay.get(dayUtc) ?? 0;
      rewardsByDay.delete(dayUtc);
    }
    entry.cumulativeRewardsUsd = cumulativeRewardsUsd;
    history.set(dayUtc, entry);
  }

  for (const [dayUtc, rewardUsd] of Array.from(rewardsByDay.entries()).sort(([left], [right]) => left.localeCompare(right))) {
    cumulativeRewardsUsd += rewardUsd;
    history.set(dayUtc, history.get(dayUtc) ?? {
      dayUtc,
      estimatedValueUsd: null,
      cumulativeRewardsUsd,
    });
    history.get(dayUtc)!.cumulativeRewardsUsd = cumulativeRewardsUsd;
  }

  const values = Array.from(history.values()).sort((left, right) => left.dayUtc.localeCompare(right.dayUtc));
  if (values.length > 0 && values.at(-1)?.estimatedValueUsd === null && input.fallbackEstimatedValueUsd !== null) {
    values[values.length - 1] = {
      ...values[values.length - 1]!,
      estimatedValueUsd: input.fallbackEstimatedValueUsd,
    };
  }
  return values;
}

function resolvedPoolLabel(poolId: string | null | undefined, context: EngineV2MaterializationContext) {
  if (!poolId) return null;
  const label = poolLabelFromState({
    poolId,
    poolState: getPoolState(context, poolId),
    context,
  });
  return label !== poolId ? label : null;
}

function getGovernanceLockContext(input: {
  context: EngineV2MaterializationContext;
  lockKey?: string | null;
  tokenId?: string | null;
}) {
  if (input.lockKey) {
    const match = input.context.governanceLockByLockKey.get(input.lockKey);
    if (match) return match;
  }
  if (input.tokenId) {
    const match = input.context.governanceLockByTokenId.get(input.tokenId);
    if (match) return match;
  }
  return null;
}

function governanceExplicitValue(records: Array<Record<string, unknown>>, keys: string[]) {
  for (const record of records) {
    for (const key of keys) {
      const value = asString(record[key]);
      if (value) return value;
    }
  }
  return null;
}

function governanceDurationDeltaDays(input: {
  currentLockEnd: Date | null;
  previousLockEnd: Date | null;
  occurredAt: Date;
}) {
  if (!input.currentLockEnd) return null;
  const baseline = input.previousLockEnd ?? input.occurredAt;
  const deltaMs = input.currentLockEnd.getTime() - baseline.getTime();
  return deltaMs === 0 ? 0 : Math.round(deltaMs / (24 * 60 * 60 * 1000));
}

function buildGovernanceEventTokenMovements(input: {
  eventId: string | null;
  sourceEventsById: Map<string, EngineV2AccountingOutput["events"][number]>;
  context: EngineV2MaterializationContext;
}) {
  if (!input.eventId) return [];
  const sourceEvent = input.sourceEventsById.get(input.eventId);
  if (!sourceEvent) return [];
  return movementRecords(asRecord(sourceEvent.evidenceJson).movements)
    .filter((movement) => asString(movement.assetType) === "erc20")
    .map((movement) => {
      const tokenAddress = normalizeAddress(asString(movement.tokenAddress));
      const metadata = getTokenMetadata(input.context, tokenAddress);
      return {
        tokenAddress,
        tokenSymbol: metadata?.symbol ?? null,
        direction: asString(movement.direction) ?? "unknown",
        amountRaw: asString(movement.amountRaw),
        amountFormatted: formatTokenAmount(asString(movement.amountRaw), metadata?.decimals ?? null),
        valueUsd: toNullableNumber(asString(movement.valueUsdAtEvent)),
      };
    });
}

function strategyCurrentEstimatedValueUsd(strategy: EngineV2AccountingOutput["strategies"][number]) {
  const latestNonRewardValue = [...strategy.lifecycle]
    .reverse()
    .find((event) => !event.eventType.includes("reward") && !event.eventType.includes("claim") && event.valueUsd)?.valueUsd;
  return toNullableNumber(latestNonRewardValue ?? strategy.depositedValueUsd);
}

function strategyDisplayLabel(input: {
  strategy: EngineV2AccountingOutput["strategies"][number];
  context: EngineV2MaterializationContext;
  poolLabel: string | null;
}) {
  const shareMetadata = getTokenMetadata(input.context, input.strategy.wrapperAddress);
  return shareMetadata?.symbol
    ?? (input.poolLabel ? `Mellow ${input.poolLabel}` : null)
    ?? (input.strategy.wrapperAddress ? `Mellow ${input.strategy.wrapperAddress.slice(0, 6)}` : input.strategy.strategyExposureId);
}

function deriveDepositPoolPositionStatus(deposit: EngineV2AccountingOutput["deposits"][number]) {
  if (deposit.status === "closed") return "closed";
  const latestStatusEvent = [...deposit.lifecycle]
    .reverse()
    .find((event) => event.eventType.includes("stake") || event.eventType.includes("unstake") || event.eventType.includes("withdraw") || event.eventType.includes("close"));
  if (latestStatusEvent?.eventType.includes("stake") && !latestStatusEvent.eventType.includes("unstake")) return "staked";
  return "open";
}

function resolveRewardPoolContext(input: {
  reward: EngineV2AccountingOutput["rewards"][number];
  accounting: EngineV2AccountingOutput;
  context: EngineV2MaterializationContext;
}) {
  const directPoolId = input.reward.poolId;
  if (directPoolId) {
    return {
      poolId: directPoolId,
      poolLabel: resolvedPoolLabel(directPoolId, input.context) ?? directPoolId,
      poolContributionStatus: input.reward.poolContribution,
      countingRule: input.reward.ownerStatus === "governance" ? "explicit_pool_evidence" : "owner_resolved_pool",
    };
  }

  if (input.reward.ownerStatus === "manual_deposit" && input.reward.linkedEntityId) {
    const deposit = input.accounting.deposits.find((item) => item.depositId === input.reward.linkedEntityId);
    if (deposit?.poolId) {
      return {
        poolId: deposit.poolId,
        poolLabel: resolvedPoolLabel(deposit.poolId, input.context) ?? deposit.poolId,
        poolContributionStatus: "contributes",
        countingRule: "owner_resolved_pool",
      };
    }
  }

  if (input.reward.ownerStatus === "strategy" && input.reward.linkedEntityId) {
    const strategy = input.accounting.strategies.find((item) => item.strategyExposureId === input.reward.linkedEntityId);
    if (strategy?.poolId) {
      return {
        poolId: strategy.poolId,
        poolLabel: resolvedPoolLabel(strategy.poolId, input.context) ?? strategy.poolId,
        poolContributionStatus: "contributes",
        countingRule: "owner_resolved_pool",
      };
    }
  }

  return {
    poolId: null,
    poolLabel: null,
    poolContributionStatus: input.reward.poolContribution,
    countingRule: input.reward.poolContribution === "contributes" ? "explicit_pool_evidence" : input.reward.poolContribution,
  };
}

function classifyManualCapitalFlow(eventType: string) {
  if (eventType.includes("collect") || eventType.includes("reward") || eventType.includes("claim")) return null;
  if (eventType.includes("decrease") || eventType.includes("withdraw") || eventType.includes("close") || eventType.includes("burn")) return -1;
  if (eventType.includes("open") || eventType.includes("created") || eventType.includes("mint") || eventType.includes("deposit") || eventType.includes("increase") || eventType.includes("stake") || eventType.includes("transfer_in")) return 1;
  return null;
}

function classifyStrategyCapitalFlow(eventType: string) {
  if (eventType.includes("reward") || eventType.includes("claim") || eventType.includes("fee_dilution") || eventType.includes("rebalance")) return null;
  if (eventType.includes("withdraw") || eventType.includes("unstake") || eventType.includes("redeem") || eventType.includes("close")) return -1;
  if (eventType.includes("deposit") || eventType.includes("stake") || eventType.includes("share_receive") || eventType.includes("transfer_in")) return 1;
  return null;
}

function buildPoolHistoryPoints(input: {
  poolId: string;
  accounting: EngineV2AccountingOutput;
  context: EngineV2MaterializationContext;
}) {
  const buckets = new Map<string, {
    dayUtc: string;
    capitalInUsd: number;
    capitalOutUsd: number;
    manualDeltaUsd: number;
    strategyDeltaUsd: number;
    rewardValueUsd: number;
    activityCount: number;
  }>();

  const upsertBucket = (occurredAt: Date) => {
    const dayUtc = occurredAt.toISOString().slice(0, 10);
    const current = buckets.get(dayUtc) ?? {
      dayUtc,
      capitalInUsd: 0,
      capitalOutUsd: 0,
      manualDeltaUsd: 0,
      strategyDeltaUsd: 0,
      rewardValueUsd: 0,
      activityCount: 0,
    };
    buckets.set(dayUtc, current);
    return current;
  };

  for (const deposit of input.accounting.deposits) {
    if (deposit.poolId !== input.poolId) continue;
    for (const event of deposit.lifecycle) {
      const flow = classifyManualCapitalFlow(event.eventType);
      const valueUsd = toNumber(event.valueUsd);
      const bucket = upsertBucket(event.occurredAt);
      bucket.activityCount += 1;
      if (flow === 1) {
        bucket.capitalInUsd += valueUsd;
        bucket.manualDeltaUsd += valueUsd;
      } else if (flow === -1) {
        bucket.capitalOutUsd += valueUsd;
        bucket.manualDeltaUsd -= valueUsd;
      }
    }
  }

  for (const strategy of input.accounting.strategies) {
    if (strategy.poolId !== input.poolId) continue;
    for (const event of strategy.lifecycle) {
      const flow = classifyStrategyCapitalFlow(event.eventType);
      const valueUsd = toNumber(event.valueUsd);
      const bucket = upsertBucket(event.occurredAt);
      bucket.activityCount += 1;
      if (flow === 1) {
        bucket.capitalInUsd += valueUsd;
        bucket.strategyDeltaUsd += valueUsd;
      } else if (flow === -1) {
        bucket.capitalOutUsd += valueUsd;
        bucket.strategyDeltaUsd -= valueUsd;
      }
    }
  }

  for (const reward of input.accounting.rewards) {
    const rewardPool = resolveRewardPoolContext({ reward, accounting: input.accounting, context: input.context });
    if (rewardPool.poolId !== input.poolId) continue;
    const bucket = upsertBucket(reward.occurredAt);
    bucket.activityCount += 1;
    bucket.rewardValueUsd += toNumber(reward.amountUsd);
  }

  const days = [...buckets.keys()].sort((left, right) => left.localeCompare(right));
  let runningManualValueUsd = 0;
  let runningStrategyValueUsd = 0;
  let cumulativeRewardsUsd = 0;

  return days.map((dayUtc) => {
    const bucket = buckets.get(dayUtc)!;
    runningManualValueUsd = Math.max(0, runningManualValueUsd + bucket.manualDeltaUsd);
    runningStrategyValueUsd = Math.max(0, runningStrategyValueUsd + bucket.strategyDeltaUsd);
    cumulativeRewardsUsd += bucket.rewardValueUsd;
    const deployedValueUsd = runningManualValueUsd + runningStrategyValueUsd;

    return {
      dayUtc,
      totalValueUsd: deployedValueUsd,
      deployedValueUsd,
      residualValueUsd: 0,
      manualValueUsd: runningManualValueUsd,
      strategyValueUsd: runningStrategyValueUsd,
      rewardValueUsd: bucket.rewardValueUsd,
      cumulativeRewardsUsd,
      capitalInUsd: bucket.capitalInUsd,
      capitalOutUsd: bucket.capitalOutUsd,
      metadata: {
        valueBasis: "event_flows",
        activityCount: bucket.activityCount,
      },
    };
  });
}

function buildPoolTimelineItems(input: {
  poolId: string;
  accounting: EngineV2AccountingOutput;
  context: EngineV2MaterializationContext;
}) {
  const items: Array<{
    eventKey: string;
    eventType: string;
    occurredAt: string;
    confidence: string;
    coverageStatus: string;
    attributedValueUsd: number | null;
    relatedDepositId: string | null;
    relatedStrategyId: string | null;
    metadataJson: Record<string, unknown>;
  }> = [];
  const rewardSourceEventIds = new Set(
    input.accounting.rewards
      .map((reward) => reward.sourceDomainEventId)
      .filter((eventId): eventId is string => typeof eventId === "string" && eventId.length > 0),
  );

  for (const deposit of input.accounting.deposits) {
    if (deposit.poolId !== input.poolId) continue;
    deposit.lifecycle.forEach((event, index) => {
      if (event.eventId && rewardSourceEventIds.has(event.eventId) && (event.eventType.includes("reward") || event.eventType.includes("claim"))) {
        return;
      }
      items.push({
        eventKey: event.eventId ?? `${deposit.depositId}:${index}`,
        eventType: normalizeDepositLifecycleEventType(event.eventType),
        occurredAt: event.occurredAt.toISOString(),
        confidence: confidence(deposit.confidence),
        coverageStatus: coverageStatus(event.coverageStatus),
        attributedValueUsd: toNullableNumber(event.valueUsd),
        relatedDepositId: deposit.depositId,
        relatedStrategyId: null,
        metadataJson: {
          source: "deposit",
          tokenId: deposit.tokenId,
          txHash: event.txHash,
        },
      });
    });
  }

  for (const strategy of input.accounting.strategies) {
    if (strategy.poolId !== input.poolId) continue;
    strategy.lifecycle.forEach((event, index) => {
      if (event.eventId && rewardSourceEventIds.has(event.eventId) && (event.eventType.includes("reward") || event.eventType.includes("claim"))) {
        return;
      }
      items.push({
        eventKey: event.eventId ?? `${strategy.strategyExposureId}:${index}`,
        eventType: normalizeStrategyLifecycleEventType(event.eventType),
        occurredAt: event.occurredAt.toISOString(),
        confidence: confidence(strategy.confidence),
        coverageStatus: coverageStatus(strategy.coverageStatus),
        attributedValueUsd: toNullableNumber(event.valueUsd),
        relatedDepositId: null,
        relatedStrategyId: strategy.strategyExposureId,
        metadataJson: {
          source: "strategy",
          strategyId: strategy.strategyId,
          wrapperAddress: strategy.wrapperAddress,
          txHash: event.txHash,
        },
      });
    });
  }

  for (const reward of input.accounting.rewards) {
    const rewardPool = resolveRewardPoolContext({ reward, accounting: input.accounting, context: input.context });
    if (rewardPool.poolId !== input.poolId) continue;
    items.push({
      eventKey: reward.rewardId,
      eventType: reward.rewardType,
      occurredAt: reward.occurredAt.toISOString(),
      confidence: confidence(reward.confidence),
      coverageStatus: reward.coverageStatus === "unsupported" ? "unknown" : coverageStatus(reward.coverageStatus),
      attributedValueUsd: toNullableNumber(reward.amountUsd),
      relatedDepositId: reward.ownerStatus === "manual_deposit" ? reward.linkedEntityId : null,
      relatedStrategyId: reward.ownerStatus === "strategy" ? reward.linkedEntityId : null,
      metadataJson: {
        source: "reward",
        rewardEventId: reward.rewardId,
        rewardType: reward.rewardType,
        governanceReward: reward.ownerStatus === "governance",
        txHash: reward.txHash,
      },
    });
  }

  return items.sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
}

function shortId(value: string | null | undefined, prefix: string) {
  if (!value) return null;
  return `${prefix}-${value.slice(0, 4)}...${value.slice(-4)}`;
}

function governanceCoverageStatus(value: string) {
  return value === "full"
    || value === "partial"
    || value === "unresolved"
    || value === "unsupported"
    || value === "excluded"
    ? value
    : "unavailable";
}

function governanceConfidence(value: string) {
  return value === "high" || value === "medium" || value === "low" ? value : "none";
}

function worstGovernanceCoverage(values: string[]) {
  if (values.includes("unresolved")) return "unresolved";
  if (values.includes("partial")) return "partial";
  if (values.includes("unsupported")) return "unsupported";
  if (values.includes("excluded")) return "excluded";
  if (values.includes("full")) return "full";
  return "unavailable";
}

function worstGovernanceConfidence(values: string[]) {
  if (values.includes("none")) return "none";
  if (values.includes("low")) return "low";
  if (values.includes("medium")) return "medium";
  if (values.includes("high")) return "high";
  return "none";
}

function normalizeGovernanceEventType(value: string) {
  if (value.includes("reset")) return "vote_reset";
  if (value.includes("vote") || value.includes("poke")) return "vote_cast";
  if (value.includes("deposit_managed")) return "relay_joined";
  if (value.includes("relay_exit")) return "relay_exited";
  if (value.includes("withdraw") && value.includes("lock")) return "lock_withdrawn";
  if (value.includes("extend")) return "lock_extended";
  if (value.includes("increase")) return "lock_increased";
  if (value.includes("relock") || value.includes("rebase")) return "rebase_claim";
  if (value.includes("bribe")) return "bribe_claim";
  if (value.includes("fee")) return "fee_claim";
  if (value.includes("create") || value.includes("grant") || value.includes("transfer_in")) return "lock_created";
  return "unsupported_governance";
}

function normalizeGovernanceProtocolSurface(value: string) {
  if (value.includes("vote") || value.includes("poke") || value.includes("deposit_managed") || value.includes("reset")) return "voter";
  if (value.includes("lock") || value.includes("grant") || value.includes("transfer_in") || value.includes("extend")) return "voting_escrow";
  if (value.includes("bribe")) return "briber";
  if (value.includes("fee")) return "fee_distributor";
  if (value.includes("rebase") || value.includes("relock")) return "reward_distributor";
  if (value.includes("relay")) return "relay";
  return "unknown";
}

function normalizeGovernanceRewardType(value: string) {
  if (value.includes("bribe")) return "bribe";
  if (value.includes("fee")) return "fee";
  if (value.includes("rebase")) return "rebase";
  if (value.includes("relay")) return "relay";
  return "unknown";
}

function sumStringNumbers(values: Array<string | null | undefined>) {
  const total = values.reduce((sum, value) => sum + toNumber(value), 0);
  return total > 0 ? String(total) : null;
}

export function materializeDepositRows(
  accounting: EngineV2AccountingOutput,
  context: EngineV2MaterializationContext = defaultMaterializationContext(),
): EngineV2ReadModelRowInput[] {
  const sourceEventsById = new Map(
    accounting.events
      .filter((event): event is typeof event & { id: string } => typeof event.id === "string" && event.id.length > 0)
      .map((event) => [event.id, event]),
  );

  return accounting.deposits.map((deposit) => row({
    chainId: accounting.events[0]?.chainId ?? 0,
    walletAddress: accounting.events[0]?.walletAddress ?? "",
    surface: "deposits",
    rowKey: deposit.depositId,
    sourceDomainEventId: deposit.lifecycle[0]?.eventId ?? null,
    coverageStatus: deposit.coverageStatus,
    confidence: deposit.confidence,
    rowJson: {
      ...(function buildDepositRow() {
        const poolState = getPoolState(context, deposit.poolId);
        const poolKind = poolKindFromState({ depositTokenId: deposit.tokenId, poolState });
        const poolLabel = poolLabelFromState({ poolId: deposit.poolId, poolState, context });
        const token0Metadata = getTokenMetadata(context, poolState?.token0Address);
        const token1Metadata = getTokenMetadata(context, poolState?.token1Address);
        const openedByTransferIn = deposit.lifecycle.some((event) => normalizeDepositLifecycleEventType(event.eventType) === "transfer_in");

        return {
      depositId: deposit.depositId,
      poolId: deposit.poolId ?? "",
      poolLabel,
      positionLabel: positionLabelFromDeposit({
        depositId: deposit.depositId,
        tokenId: deposit.tokenId,
        poolLabel,
        poolKind,
      }),
      poolKind,
      feeTierBps: poolState?.feeTierBps ?? poolState?.tickSpacing ?? null,
      tokenId: deposit.tokenId,
      token0Symbol: token0Metadata?.symbol ?? null,
      token1Symbol: token1Metadata?.symbol ?? null,
      status: deposit.status === "closed" ? "closed" : "open_active",
      openedAt: toIso(deposit.openedAt),
      closedAt: toIso(deposit.closedAt),
      openedByTransferIn,
      openedValueUsd: toNumber(deposit.openedValueUsd),
      currentValueUsd: toNumber(deposit.currentOrCloseValueUsd ?? deposit.openedValueUsd),
      capitalEnteredUsd: toNumber(deposit.capitalInUsd),
      capitalWithdrawnUsd: toNumber(deposit.capitalOutUsd),
      totalRewardsUsd: toNumber(deposit.rewardsUsd),
      realizedPnlUsd: 0,
      unrealizedPnlUsd: 0,
      totalReturnUsd: toNumber(deposit.rewardsUsd),
      totalReturnPct: null,
      estimatedAnnualizedReturnPct: null,
      isInRange: null,
      rangeLowerPrice: null,
      rangeUpperPrice: null,
      coverageStatus: coverageStatus(deposit.coverageStatus),
      confidence: confidence(deposit.confidence),
      coverageReasonCodes: deposit.reasonCodes,
      coveredStartDayUtc: deposit.openedAt?.toISOString().slice(0, 10) ?? null,
      coveredEndDayUtc: (deposit.closedAt ?? deposit.lifecycle.at(-1)?.occurredAt)?.toISOString().slice(0, 10) ?? null,
      tickLower: null,
      tickUpper: null,
      token0Address: poolState?.token0Address ?? null,
      token1Address: poolState?.token1Address ?? null,
      decomposition: {
        totalReturnUsd: toNumber(deposit.rewardsUsd),
        rewardsUsd: toNumber(deposit.rewardsUsd),
        feesUsd: toNumber(deposit.rewardsUsd),
        assetPriceEffectUsd: 0,
        rebalanceEffectUsd: 0,
        realizedPnlUsd: 0,
        unrealizedPnlUsd: 0,
        unattributedUsd: 0,
        unattributedReasonCodes: deposit.reasonCodes,
        componentPercentages: {},
      },
      lifecycle: deposit.lifecycle.map((event, index) => ({
        id: event.eventId ?? `${deposit.depositId}:${index}`,
        sequenceIndex: index,
        eventType: normalizeDepositLifecycleEventType(event.eventType),
        occurredAt: event.occurredAt.toISOString(),
        txHash: event.txHash,
        logIndex: index,
        blockNumber: 0,
        usdValue: toNullableNumber(event.valueUsd),
        signedTokenDeltas: buildDepositLifecycleTokenDeltas({
          eventId: event.eventId,
          sourceEventsById,
          context,
        }),
        priceSource: event.valueUsd ? "event" : "unavailable",
        confidence: confidence(deposit.confidence),
        inferredActionId: event.eventId,
        coverageReasonCodes: event.reasonCodes,
        metadata: { sourceEventType: event.eventType },
      })),
      mellowStrategyCrossLinkId: null,
        };
      })(),
    },
    evidenceJson: {
      tokenId: deposit.tokenId,
      lifecycleEventIds: deposit.lifecycle.map((item) => item.eventId).filter(Boolean),
      reasonCodes: deposit.reasonCodes,
      poolAddress: poolAddressFromPoolId(deposit.poolId),
    },
  }));
}

export function materializeStrategyRows(
  accounting: EngineV2AccountingOutput,
  context: EngineV2MaterializationContext = defaultMaterializationContext(),
): EngineV2ReadModelRowInput[] {
  const sourceEventsById = new Map(
    accounting.events
      .filter((event): event is typeof event & { id: string } => typeof event.id === "string" && event.id.length > 0)
      .map((event) => [event.id, event]),
  );

  return accounting.strategies.map((strategy) => row({
    chainId: accounting.events[0]?.chainId ?? 0,
    walletAddress: accounting.events[0]?.walletAddress ?? "",
    surface: "strategies",
    rowKey: strategy.strategyExposureId,
    sourceDomainEventId: strategy.lifecycle[0]?.eventId ?? null,
    coverageStatus: strategy.coverageStatus,
    confidence: strategy.confidence,
    rowJson: {
      ...(function buildStrategyRow() {
        const poolLabel = resolvedPoolLabel(strategy.poolId, context);
        const shareMetadata = getTokenMetadata(context, strategy.wrapperAddress);
        const strategyRewards = accounting.rewards
          .filter((reward) => reward.ownerStatus === "strategy" && reward.linkedEntityId === strategy.strategyExposureId)
          .sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime());
        const currentEstimatedValueUsd = strategyCurrentEstimatedValueUsd(strategy);
        const rewards = strategyRewards.map((reward) => {
          const sourceMetadata = reward.sourceDomainEventId
            ? asRecord(sourceEventsById.get(reward.sourceDomainEventId)?.metadataJson)
            : {};
          const tokenMetadata = getTokenMetadata(context, reward.tokenAddress);
          const resolutionStatus = reward.linkedEntityId && reward.tokenAddress && reward.amountRaw
            ? "resolved"
            : "unresolved";
          return {
            id: reward.rewardId,
            tokenSymbol: tokenMetadata?.symbol
              ?? asString(sourceMetadata.tokenSymbol)
              ?? asString(sourceMetadata.rewardTokenSymbol)
              ?? null,
            tokenAddress: reward.tokenAddress,
            amountRaw: reward.amountRaw,
            amountFormatted: formatTokenAmount(reward.amountRaw, tokenMetadata?.decimals ?? null),
            amountUsd: toNullableNumber(reward.amountUsd),
            claimedAt: toIso(reward.occurredAt),
            txHash: reward.txHash,
            resolutionStatus,
            coverageReasonCodes: reward.reasonCodes,
          };
        });
        const strategyLabel = strategyDisplayLabel({ strategy, context, poolLabel });

        return {
      id: strategy.strategyExposureId,
      strategyId: strategy.strategyId ?? strategy.strategyExposureId,
      strategyExposureId: strategy.strategyExposureId,
      strategyLabel,
      protocol: "mellow",
      primaryPoolId: strategy.poolId,
      poolLabel,
      poolMappingStatus: strategy.poolId ? "confirmed" : "unknown",
      status: strategy.currentSharesRaw !== "0" ? "active" : "closed",
      currentEstimatedValueUsd,
      depositedValueUsd: toNumber(strategy.depositedValueUsd),
      withdrawnValueUsd: toNumber(strategy.withdrawnValueUsd),
      currentSharesRaw: strategy.currentSharesRaw,
      shareSymbol: shareMetadata?.symbol ?? null,
      totalRewardsUsd: toNumber(strategy.rewardsUsd),
      realizedPnlUsd: null,
      unrealizedPnlUsd: null,
      totalReturnUsd: toNumber(strategy.rewardsUsd),
      totalReturnPct: null,
      estimatedAnnualizedReturnPct: null,
      coverageStatus: coverageStatus(strategy.coverageStatus),
      confidence: confidence(strategy.confidence),
      coverageReasonCodes: strategy.reasonCodes,
      wrapperAddress: strategy.wrapperAddress,
      stakingRewardsAddress: null,
      externalStrategyPositionReference: null,
      externalStrategyPositionReferenceStatus: "unresolved",
      sharesReceivedRaw: strategy.sharesReceivedRaw,
      sharesRedeemedRaw: strategy.sharesRedeemedRaw,
      resolvedRewardCount: rewards.filter((reward) => reward.resolutionStatus === "resolved").length,
      unresolvedRewardCount: rewards.filter((reward) => reward.resolutionStatus === "unresolved").length,
      history: buildStrategyHistory({
        lifecycle: strategy.lifecycle,
        rewards: strategyRewards,
        fallbackEstimatedValueUsd: currentEstimatedValueUsd,
      }),
      rewards,
      lifecycle: strategy.lifecycle.map((event, index) => ({
        id: event.eventId ?? `${strategy.strategyExposureId}:${index}`,
        sequenceIndex: index,
        eventType: normalizeStrategyLifecycleEventType(event.eventType),
        occurredAt: event.occurredAt.toISOString(),
        txHash: event.txHash,
        logIndex: null,
        blockNumber: null,
        usdValue: toNullableNumber(event.valueUsd),
        shareDeltaRaw: event.eventId
          ? asString(asRecord(sourceEventsById.get(event.eventId)?.metadataJson).shareDeltaRaw)
            ?? asString(asRecord(sourceEventsById.get(event.eventId)?.metadataJson).sharesRaw)
          : null,
        tokenDeltas: buildStrategyLifecycleTokenDeltas({
          eventId: event.eventId,
          sourceEventsById,
          context,
        }),
        priceSource: event.valueUsd ? "alchemyHistorical" : "unavailable",
        confidence: confidence(strategy.confidence),
        coverageStatus: coverageStatus(strategy.coverageStatus),
        coverageReasonCodes: strategy.reasonCodes,
        metadata: {
          sourceEventType: event.eventType,
          wrapperAddress: strategy.wrapperAddress,
          poolId: strategy.poolId,
        },
      })),
      coverageNote: {
        status: coverageStatus(strategy.coverageStatus),
        titleKey: `strategies:coverageNote.${coverageStatus(strategy.coverageStatus)}.title`,
        bodyKey: `strategies:coverageNote.${coverageStatus(strategy.coverageStatus)}.body`,
        reasonCodes: strategy.reasonCodes,
      },
        };
      })(),
    },
    evidenceJson: {
      strategyExposureId: strategy.strategyExposureId,
      lifecycleEventIds: strategy.lifecycle.map((item) => item.eventId).filter(Boolean),
      reasonCodes: strategy.reasonCodes,
    },
  }));
}

export function materializePoolRows(
  accounting: EngineV2AccountingOutput,
  context: EngineV2MaterializationContext = defaultMaterializationContext(),
): EngineV2ReadModelRowInput[] {
  return accounting.pools.map((pool) => row({
    chainId: accounting.events[0]?.chainId ?? 0,
    walletAddress: accounting.events[0]?.walletAddress ?? "",
    surface: "pools",
    rowKey: pool.poolId,
    sourceDomainEventId: null,
    coverageStatus: pool.coverageStatus,
    confidence: pool.coverageStatus === "full" ? "high" : "medium",
    rowJson: {
      ...(function buildPoolRow() {
        const poolState = getPoolState(context, pool.poolId);
        const token0Metadata = getTokenMetadata(context, poolState?.token0Address);
        const token1Metadata = getTokenMetadata(context, poolState?.token1Address);
        const tokenSymbols = [token0Metadata?.symbol, token1Metadata?.symbol].filter((symbol): symbol is string => Boolean(symbol));
        const label = poolLabelFromState({ poolId: pool.poolId, poolState, context });
        const historyPoints = buildPoolHistoryPoints({ poolId: pool.poolId, accounting, context });
        const timelineItems = buildPoolTimelineItems({ poolId: pool.poolId, accounting, context });
        const linkedDepositEvents = accounting.deposits
          .filter((deposit) => deposit.poolId === pool.poolId)
          .flatMap((deposit) => deposit.lifecycle.map((event) => event.occurredAt));
        const linkedStrategyEvents = accounting.strategies
          .filter((strategy) => strategy.poolId === pool.poolId)
          .flatMap((strategy) => strategy.lifecycle.map((event) => event.occurredAt));
        const linkedRewardEvents = accounting.rewards
          .filter((reward) => resolveRewardPoolContext({ reward, accounting, context }).poolId === pool.poolId)
          .map((reward) => reward.occurredAt);
        const activityDates = [...linkedDepositEvents, ...linkedStrategyEvents, ...linkedRewardEvents]
          .filter((value): value is Date => value instanceof Date && Number.isFinite(value.getTime()))
          .sort((left, right) => left.getTime() - right.getTime());
        const manualDeposits = accounting.deposits
          .filter((deposit) => deposit.poolId === pool.poolId && deposit.status !== "closed")
          .map((deposit) => ({
            depositId: deposit.depositId,
            tokenId: deposit.tokenId,
            status: deriveDepositPoolPositionStatus(deposit),
            coverageStatus: coverageStatus(deposit.coverageStatus),
            tickLower: null,
            tickUpper: null,
            rangeLowerPrice: null,
            rangeUpperPrice: null,
            rangeQuoteTokenSymbol: token1Metadata?.symbol ?? null,
            rangeDisplayFractionDigits: null,
            isInRange: null,
            valueUsd: toNullableNumber(deposit.currentOrCloseValueUsd ?? deposit.openedValueUsd),
            tokens: tokenSymbols.map((symbol) => ({ symbol, amount: null })),
            annualizedReturnPct: null,
          }));
        const automatedStrategies = accounting.strategies
          .filter((strategy) => strategy.poolId === pool.poolId)
          .map((strategy) => {
            const poolLabel = resolvedPoolLabel(strategy.poolId, context);
            return {
              exposureId: strategy.strategyExposureId,
              strategyId: strategy.strategyId ?? strategy.strategyExposureId,
              strategyLabel: strategyDisplayLabel({ strategy, context, poolLabel }),
              coverageStatus: coverageStatus(strategy.coverageStatus),
              valueUsd: strategyCurrentEstimatedValueUsd(strategy),
              externalStrategyPositionReference: null,
              externalStrategyPositionReferenceStatus: null,
              tokens: tokenSymbols.map((symbol) => ({ symbol, amount: null })),
              annualizedReturnPct: null,
            };
          });
        const linkedStrategyLabels = automatedStrategies.map((strategy) => strategy.strategyLabel);

        return {
      poolId: pool.poolId,
      label,
      poolAddress: poolState?.poolAddress ?? pool.poolId.split(":").at(-1) ?? pool.poolId,
      tokenSymbols,
      feeTierLabel: formatFeeTierLabel(poolState?.tickSpacing),
      poolType: poolState?.tickSpacing !== null && poolState?.tickSpacing !== undefined ? "cl" : null,
      protocolFamily: "aerodrome",
      status: "active",
      exposureMix: Number(pool.strategyValueUsd) > 0 && Number(pool.manualDepositValueUsd) > 0 ? "mixed" : Number(pool.strategyValueUsd) > 0 ? "automated" : "manual",
      currentAttributedValueUsd: toNumber(pool.manualDepositValueUsd) + toNumber(pool.strategyValueUsd),
      capitalInvestedUsd: toNumber(pool.manualDepositValueUsd) + toNumber(pool.strategyValueUsd),
      capitalEnteredUsd: toNumber(pool.manualDepositValueUsd) + toNumber(pool.strategyValueUsd),
      capitalWithdrawnUsd: 0,
      realizedPnlUsd: null,
      unrealizedPnlUsd: null,
      totalRewardsUsd: toNumber(pool.rewardValueUsd),
      investedDays: null,
      totalReturnPct: null,
      annualizedReturnPct: null,
      isInRange: null,
      coverageStatus: coverageStatus(pool.coverageStatus),
      coverageReasonCodes: pool.reasonCodes,
      latestActivityAt: toIso(activityDates.at(-1) ?? null),
      strategyLabels: linkedStrategyLabels,
      metricsEstimated: true,
      coveredStartDayUtc: activityDates[0]?.toISOString().slice(0, 10) ?? null,
      coveredEndDayUtc: activityDates.at(-1)?.toISOString().slice(0, 10) ?? null,
      currentManualValueUsd: toNumber(pool.manualDepositValueUsd),
      currentStrategyValueUsd: toNumber(pool.strategyValueUsd),
      currentResidualValueUsd: 0,
      history: { points: historyPoints },
      timeline: { items: timelineItems },
      positions: {
        manualDeposits,
        automatedStrategies,
      },
        };
      })(),
    },
    evidenceJson: {
      poolId: pool.poolId,
      reasonCodes: pool.reasonCodes,
      explicitLinksOnly: true,
    },
  }));
}

export function materializeRewardRows(
  accounting: EngineV2AccountingOutput,
  context: EngineV2MaterializationContext = defaultMaterializationContext(),
): EngineV2ReadModelRowInput[] {
  const sourceEventsById = new Map(
    accounting.events
      .filter((event): event is typeof event & { id: string } => typeof event.id === "string" && event.id.length > 0)
      .map((event) => [event.id, event]),
  );

  return accounting.rewards.map((reward) => row({
    chainId: accounting.events[0]?.chainId ?? 0,
    walletAddress: accounting.events[0]?.walletAddress ?? "",
    surface: "rewards",
    rowKey: reward.rewardId,
    sourceDomainEventId: null,
    coverageStatus: reward.coverageStatus,
    confidence: reward.confidence,
    rowJson: {
      ...(function buildRewardRow() {
        const sourceMetadata = reward.sourceDomainEventId
          ? asRecord(sourceEventsById.get(reward.sourceDomainEventId)?.metadataJson)
          : {};
        const tokenMetadata = getTokenMetadata(context, reward.tokenAddress);
        const rewardPool = resolveRewardPoolContext({ reward, accounting, context });
        const tokenSymbol = tokenMetadata?.symbol
          ?? asString(sourceMetadata.tokenSymbol)
          ?? asString(sourceMetadata.rewardTokenSymbol)
          ?? asString(sourceMetadata.symbol)
          ?? (reward.tokenAddress ? `${reward.tokenAddress.slice(0, 6)}...${reward.tokenAddress.slice(-4)}` : null);
        const poolLabel = asString(sourceMetadata.poolLabel)
          ?? rewardPool.poolLabel;
        const entityLabel = reward.ownerStatus === "manual_deposit"
          ? shortId(reward.linkedEntityId, "Dep")
          : reward.ownerStatus === "strategy"
            ? shortId(reward.linkedEntityId, "Strat")
            : reward.ownerStatus === "governance"
              ? shortId(reward.rewardId, "Gov")
              : null;

        return {
      rewardEventId: reward.rewardId,
      occurredAt: reward.occurredAt.toISOString(),
      token: {
        address: reward.tokenAddress,
        symbol: tokenSymbol,
        iconUrl: asString(sourceMetadata.tokenIconUrl),
      },
      tokenAmount: reward.amountRaw,
      usdValueAtClaim: reward.amountUsd,
      owner: {
        status: reward.ownerStatus,
        labelKey: `rewards:sources.${reward.ownerStatus === "manual_deposit" ? "manualDeposit" : reward.ownerStatus}`,
        entityId: reward.linkedEntityId,
        entityLabel,
        route: reward.ownerStatus === "governance" ? `/governance?chainId=${accounting.events[0]?.chainId ?? 0}&kind=reward&selected=${reward.rewardId}` : null,
      },
      sourceSurface: reward.ownerStatus,
      poolContribution: {
        status: rewardPool.poolContributionStatus,
        poolId: rewardPool.poolId,
        poolLabel,
        route: rewardPool.poolId ? `/pools/${rewardPool.poolId}` : null,
        countingRule: rewardPool.countingRule,
      },
      rewardType: reward.rewardType,
      coverageState: reward.coverageStatus === "unsupported" ? "unavailable" : reward.coverageStatus,
      confidence: reward.confidence === "unknown" ? "none" : reward.confidence,
      confidenceDots: confidenceDots(reward.confidence),
      resolutionReasonCodes: reward.reasonCodes,
      txHash: reward.txHash,
      externalTxUrl: externalTxUrl(accounting.events[0]?.chainId ?? 0, reward.txHash),
        };
      })(),
    },
    evidenceJson: {
      rewardId: reward.rewardId,
      affectsTotals: reward.affectsTotals,
      poolContribution: resolveRewardPoolContext({ reward, accounting, context }).poolContributionStatus,
      reasonCodes: reward.reasonCodes,
    },
  }));
}

export function materializeGovernanceRows(
  accounting: EngineV2AccountingOutput,
  context: EngineV2MaterializationContext = defaultMaterializationContext(),
): EngineV2ReadModelRowInput[] {
  const wallet = accounting.events[0]?.walletAddress ?? "";
  const chainId = accounting.events[0]?.chainId ?? 0;
  const sourceEventsById = new Map(
    accounting.events
      .filter((event): event is typeof event & { id: string } => typeof event.id === "string" && event.id.length > 0)
      .map((event) => [event.id, event]),
  );
  const governanceRewards = accounting.rewards.filter((reward) => reward.ownerStatus === "governance");
  const governanceEventsByTokenId = accounting.governance.events.reduce<Map<string, typeof accounting.governance.events>>((acc, event) => {
    if (!event.tokenId) return acc;
    acc.set(event.tokenId, [...(acc.get(event.tokenId) ?? []), event].sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime()));
    return acc;
  }, new Map());

  const lockRows = accounting.governance.locks.map((lock) => {
    const persistedLock = getGovernanceLockContext({ context, lockKey: lock.lockKey, tokenId: lock.tokenId });
    return row({
    chainId,
    walletAddress: wallet,
    surface: "governance",
    rowKey: `lock:${lock.lockKey}`,
    sourceDomainEventId: null,
    coverageStatus: lock.coverageStatus,
    confidence: lock.confidence,
    rowJson: {
      ...(function buildLockRow() {
        const lifecycleEvents = governanceEventsByTokenId.get(lock.tokenId) ?? [];
        const lifecycleSources = lifecycleEvents.map((event) => ({
          event,
          sourceMetadata: event.eventId ? asRecord(sourceEventsById.get(event.eventId)?.metadataJson) : {},
        }));
        const createdAt = lifecycleEvents[0]?.occurredAt ?? null;
        const expiresAt = [...lifecycleEvents]
          .reverse()
          .find((event) => event.lockEnd instanceof Date)?.lockEnd ?? null;
        const latestAmount = governanceExplicitValue(
          [persistedLock?.metadataJson ?? {}],
          ["lockedAeroAmount", "currentLockedAeroAmount"],
        ) ?? [...lifecycleEvents]
          .reverse()
          .find((event) => event.amountRaw
            && !event.eventType.includes("claim")
            && !event.eventType.includes("fee")
            && !event.eventType.includes("bribe")
            && !event.eventType.includes("rebase")
            && !event.eventType.includes("vote")
            && !event.eventType.includes("poke"))
          ?.amountRaw ?? null;
        const lockedAeroValueUsd = governanceExplicitValue(
          [
            persistedLock?.metadataJson ?? {},
            ...lifecycleSources.map((item) => item.sourceMetadata).reverse(),
          ],
          ["lockedAeroValueUsd", "currentLockedAeroValueUsd"],
        );
        const veAeroExposure = governanceExplicitValue(
          [
            persistedLock?.metadataJson ?? {},
            ...lifecycleSources.map((item) => item.sourceMetadata).reverse(),
          ],
          ["veAeroExposure", "currentVeAeroExposure"],
        );
        const status = persistedLock?.status === "withdrawn" || lock.status === "withdrawn"
          ? "withdrawn"
          : persistedLock?.status === "deposited_managed" || lock.status === "deposited_managed"
            ? "partial"
            : expiresAt && expiresAt.getTime() < Date.now()
              ? "expired"
              : "active";
        const lockKind = deriveGovernanceLockKind({
          status: persistedLock?.status ?? lock.status,
          originKind: persistedLock?.originKind ?? lock.originKind,
          managedTokenId: lock.managedTokenId,
          provenance: asString(persistedLock?.metadataJson?.provenance),
          explicitKind: asString(persistedLock?.metadataJson?.lockKind),
        });
        const lockReasonCodes = Array.from(new Set([
          ...lock.reasonCodes,
          ...(persistedLock?.reasonCodes ?? []),
          ...(lockedAeroValueUsd === null && veAeroExposure === null && status !== "withdrawn" ? ["missingGovernanceCurrentState"] : []),
        ]));

        return {
      kind: "lock",
      lockPanel: {
        lockExposureId: persistedLock?.lockKey ?? lock.lockKey,
        lockId: lock.tokenId,
        lockKind,
        status,
        createdAt: toIso(createdAt),
        expiresAt: toIso(expiresAt),
        managedTokenId: lock.managedTokenId,
        lockedAeroAmount: latestAmount,
        lockedAeroValueUsd,
        veAeroExposure,
        coverageState: governanceCoverageStatus(lock.coverageStatus),
        confidence: governanceConfidence(lock.confidence),
        reasonCodes: lockReasonCodes,
        lifecycle: lifecycleEvents.map((event, index) => ({
          eventId: event.eventId ?? `${lock.lockKey}:${event.txHash}`,
          eventType: normalizeGovernanceEventType(event.eventType),
          occurredAt: event.occurredAt.toISOString(),
          amountDelta: event.amountRaw,
          durationDeltaDays: governanceDurationDeltaDays({
            currentLockEnd: event.lockEnd,
            previousLockEnd: index > 0 ? lifecycleEvents[index - 1]?.lockEnd ?? null : null,
            occurredAt: event.occurredAt,
          }),
          coverageState: governanceCoverageStatus(event.coverageStatus),
          confidence: governanceConfidence(event.confidence),
        })),
      },
        };
      })(),
    },
    evidenceJson: {
      tokenId: lock.tokenId,
      managedTokenId: lock.managedTokenId,
      reasonCodes: Array.from(new Set([...lock.reasonCodes, ...(persistedLock?.reasonCodes ?? [])])),
    },
  });
  });
  const eventRows = accounting.governance.events.map((event) => row({
    chainId,
    walletAddress: wallet,
    surface: "governance",
    rowKey: `event:${event.eventId ?? event.txHash}`,
    sourceDomainEventId: event.eventId ?? null,
    coverageStatus: event.coverageStatus,
    confidence: event.confidence,
    rowJson: {
      ...(function buildEventRow() {
        const sourceMetadata = event.eventId ? asRecord(sourceEventsById.get(event.eventId)?.metadataJson) : {};
        const classification = asRecord(sourceMetadata.governanceClassification);
        const poolId = asString(sourceMetadata.poolId);
        const poolLabel = asString(sourceMetadata.poolLabel) ?? resolvedPoolLabel(poolId, context);
        return {
      kind: "event",
      event: {
        governanceEventId: event.eventId ?? event.txHash,
        txHash: event.txHash,
        logIndex: 0,
        eventType: normalizeGovernanceEventType(event.eventType),
        occurredAt: event.occurredAt.toISOString(),
        protocolSurface: asString(classification.protocolSurface) ?? normalizeGovernanceProtocolSurface(event.eventType),
        coverageState: governanceCoverageStatus(event.coverageStatus),
        confidence: governanceConfidence(event.confidence),
        reasonCodes: event.reasonCodes,
        evidenceRefs: asObjectArray(sourceMetadata.evidenceRefs).concat(asObjectArray(sourceMetadata.sourceEvidenceRefs)),
        metadata: {
          tokenId: event.tokenId,
          epochId: asString(sourceMetadata.epochId),
          poolId,
          poolLabel,
          tokenMovements: buildGovernanceEventTokenMovements({
            eventId: event.eventId,
            sourceEventsById,
            context,
          }),
          valueUsd: asString(sourceMetadata.valueUsd) ?? asString(sourceMetadata.valueUsdAtEvent),
          governanceClassification: {
            protocolSurface: asString(classification.protocolSurface) ?? normalizeGovernanceProtocolSurface(event.eventType),
            evidenceBasis: asObjectArray(classification.evidenceBasis).length > 0
              ? asObjectArray(classification.evidenceBasis)
              : [],
            reasonCodes: asObjectArray(classification.reasonCodes).length > 0
              ? asObjectArray(classification.reasonCodes)
              : event.reasonCodes,
          },
          sourceEvidenceRefs: asObjectArray(sourceMetadata.sourceEvidenceRefs),
        },
      },
        };
      })(),
    },
    evidenceJson: {
      tokenId: event.tokenId,
      reasonCodes: event.reasonCodes,
    },
  }));

  const rewardRows = governanceRewards.map((reward) => row({
    chainId,
    walletAddress: wallet,
    surface: "governance",
    rowKey: `reward:${reward.rewardId}`,
    sourceDomainEventId: reward.sourceDomainEventId ?? null,
    coverageStatus: reward.coverageStatus,
    confidence: reward.confidence,
    rowJson: {
      ...(function buildGovernanceRewardRow() {
        const sourceMetadata = reward.sourceDomainEventId
          ? asRecord(sourceEventsById.get(reward.sourceDomainEventId)?.metadataJson)
          : {};
        const tokenMetadata = getTokenMetadata(context, reward.tokenAddress);
        const rewardType = normalizeGovernanceRewardType(reward.rewardType);
        const epochId = asString(sourceMetadata.epochId);
        const poolLabel = asString(sourceMetadata.poolLabel)
          ?? resolvedPoolLabel(reward.poolId, context)
          ?? shortId(reward.poolId, "Pool")
          ?? "Governance reward";
        const poolAssociationReasonCodes = reward.poolId ? [] : reward.reasonCodes;

        return {
          kind: "reward",
          reward: {
            governanceRewardId: reward.rewardId,
            rewardEventId: reward.rewardId,
            governanceEventId: reward.sourceDomainEventId ?? null,
            txHash: reward.txHash,
            claimedAt: reward.occurredAt.toISOString(),
            rewardType,
            token: {
              address: reward.tokenAddress,
              symbol: tokenMetadata?.symbol
                ?? asString(sourceMetadata.tokenSymbol)
                ?? asString(sourceMetadata.rewardTokenSymbol)
                ?? asString(sourceMetadata.symbol)
                ?? shortId(reward.tokenAddress, "Token")
                ?? "n/a",
              iconUrl: asString(sourceMetadata.tokenIconUrl),
            },
            amount: reward.amountRaw,
            valueUsdAtClaim: reward.amountUsd,
            epochId,
            pool: reward.poolId
              ? {
                  poolId: reward.poolId,
                  label: poolLabel,
                }
              : null,
            coverageState: governanceCoverageStatus(reward.coverageStatus),
            confidence: governanceConfidence(reward.confidence),
            affectsTotals: reward.affectsTotals,
            poolAssociation: {
              status: reward.poolId ? "explicit" : "unassociated",
              rule: reward.poolId ? "persisted_explicit_pool_association" : "explicit_pool_evidence_required",
              reasonCodes: poolAssociationReasonCodes,
            },
            doubleCountingNoteKey: reward.poolId
              ? "governance:notes.explicitPoolContributionNoDoubleCount"
              : "governance:notes.unassociatedRewardNoPoolContribution",
            context: {
              kind: epochId ? "epoch" : reward.poolId ? "pool" : "reward",
              label: epochId ? `Epoch ${epochId}` : poolLabel,
            },
            sourceEvidenceRefs: asObjectArray(sourceMetadata.evidenceRefs).concat(asObjectArray(sourceMetadata.sourceEvidenceRefs)),
          },
        };
      })(),
    },
    evidenceJson: {
      rewardId: reward.rewardId,
      poolId: reward.poolId,
      reasonCodes: reward.reasonCodes,
    },
  }));

  const epochRows = accounting.governance.epochs.map((epoch) => {
    const epochSourceEvents = accounting.events.filter((item) => asString(item.metadataJson?.epochId) === epoch.epochId);
    const epochRewards = governanceRewards.filter((reward) => {
      const metadata = reward.sourceDomainEventId ? asRecord(sourceEventsById.get(reward.sourceDomainEventId)?.metadataJson) : {};
      return asString(metadata.epochId) === epoch.epochId;
    });
    const votedPools = Array.from(new Map(
      epochSourceEvents
        .map((event) => {
          const metadata = asRecord(event.metadataJson);
          const poolId = asString(metadata.poolId);
          return poolId
            ? [poolId, {
                poolId,
                label: asString(metadata.poolLabel) ?? resolvedPoolLabel(poolId, context) ?? shortId(poolId, "Pool") ?? poolId,
                weightPercent: asString(metadata.weightPercent) ?? asString(metadata.weight),
              }]
            : null;
        })
        .filter((entry): entry is [string, { poolId: string; label: string; weightPercent: string | null }] => Boolean(entry)),
    ).values());
    const explicitEpochStartAt = epochSourceEvents
      .map((event) => asString(asRecord(event.metadataJson).epochStartAt) ?? asString(asRecord(event.metadataJson).epochStart))
      .find((value): value is string => Boolean(value)) ?? null;
    const explicitEpochEndAt = epochSourceEvents
      .map((event) => asString(asRecord(event.metadataJson).epochEndAt) ?? asString(asRecord(event.metadataJson).epochEnd))
      .find((value): value is string => Boolean(value)) ?? null;
    const hasManualVote = epochSourceEvents.some((event) => event.eventType.includes("vote") || event.eventType.includes("poke"));
    const hasRelayVote = epochSourceEvents.some((event) => event.eventType.includes("relay") || event.eventType.includes("deposit_managed"));
    const rewardState = epochRewards.length === 0
      ? "none"
      : epochRewards.some((reward) => governanceCoverageStatus(reward.coverageStatus) !== "full")
        ? "partial"
        : "claimed";

    return row({
      chainId,
      walletAddress: wallet,
      surface: "governance",
      rowKey: `epoch:${epoch.epochId}`,
      sourceDomainEventId: epoch.events[0] ?? null,
      coverageStatus: worstGovernanceCoverage([
        ...epochSourceEvents.map((event) => governanceCoverageStatus(event.coverageStatus)),
        ...epochRewards.map((reward) => governanceCoverageStatus(reward.coverageStatus)),
      ]),
      confidence: worstGovernanceConfidence([
        ...epochSourceEvents.map((event) => governanceConfidence(event.confidence)),
        ...epochRewards.map((reward) => governanceConfidence(reward.confidence)),
      ]),
      rowJson: {
        kind: "epoch",
        epoch: {
          epochId: epoch.epochId,
          epochLabel: `Epoch ${epoch.epochId}`,
          epochStartAt: explicitEpochStartAt ?? toIso(epochSourceEvents[0]?.occurredAt ?? null),
          epochEndAt: explicitEpochEndAt ?? toIso(epochSourceEvents.at(-1)?.occurredAt ?? null),
          votedPools,
          voteMode: hasManualVote && hasRelayVote ? "mixed" : hasRelayVote ? "relay" : hasManualVote ? "manual" : "unknown",
          resetState: epochSourceEvents.some((event) => event.eventType.includes("reset")) ? "reset" : "not_reset",
          rewardState,
          feesUsd: sumStringNumbers(epochRewards.filter((reward) => normalizeGovernanceRewardType(reward.rewardType) === "fee").map((reward) => reward.amountUsd)),
          bribesUsd: sumStringNumbers(epochRewards.filter((reward) => normalizeGovernanceRewardType(reward.rewardType) === "bribe").map((reward) => reward.amountUsd)),
          rebasesUsd: sumStringNumbers(epochRewards.filter((reward) => normalizeGovernanceRewardType(reward.rewardType) === "rebase").map((reward) => reward.amountUsd)),
          coverageState: worstGovernanceCoverage([
            ...epochSourceEvents.map((event) => governanceCoverageStatus(event.coverageStatus)),
            ...epochRewards.map((reward) => governanceCoverageStatus(reward.coverageStatus)),
          ]),
          confidence: worstGovernanceConfidence([
            ...epochSourceEvents.map((event) => governanceConfidence(event.confidence)),
            ...epochRewards.map((reward) => governanceConfidence(reward.confidence)),
          ]),
        },
      },
      evidenceJson: {
        epochId: epoch.epochId,
        eventIds: epoch.events,
      },
    });
  });

  const metricRows = accounting.governance.events.length === 0 && governanceRewards.length === 0 && accounting.governance.locks.length === 0
    ? []
    : [row({
        chainId,
        walletAddress: wallet,
        surface: "governance",
        rowKey: "metric:summary",
        sourceDomainEventId: accounting.governance.events[0]?.eventId ?? governanceRewards[0]?.sourceDomainEventId ?? null,
        coverageStatus: worstGovernanceCoverage([
          ...accounting.governance.locks.map((lock) => governanceCoverageStatus(lock.coverageStatus)),
          ...accounting.governance.events.map((event) => governanceCoverageStatus(event.coverageStatus)),
          ...governanceRewards.map((reward) => governanceCoverageStatus(reward.coverageStatus)),
        ]),
        confidence: worstGovernanceConfidence([
          ...accounting.governance.locks.map((lock) => governanceConfidence(lock.confidence)),
          ...accounting.governance.events.map((event) => governanceConfidence(event.confidence)),
          ...governanceRewards.map((reward) => governanceConfidence(reward.confidence)),
        ]),
        rowJson: {
          kind: "metric",
          metricSnapshot: {
            summary: {
              ...(function primaryGovernanceLockSummary() {
                const lockPanels = lockRows
                  .map((lockRow) => asGovernanceLockPanel(asRecord(lockRow.rowJson).lockPanel))
                  .filter((lockPanel): lockPanel is GovernanceLockPanel => Boolean(lockPanel));
                const primaryLock = resolvePrimaryGovernanceLockPanel({
                  rows: lockPanels,
                  primaryLockId: selectPrimaryGovernanceLockId(lockPanels),
                });
                return {
              totalEvents: accounting.governance.events.length,
              lockedAero: primaryLock?.lockedAeroAmount ?? null,
              veAeroExposure: primaryLock?.veAeroExposure ?? null,
              governanceRewardsClaimedUsd: sumStringNumbers(governanceRewards.filter((reward) => reward.affectsTotals).map((reward) => reward.amountUsd)),
              estimatedGovernanceReturn: null,
                };
              })(),
            },
            selectedDetail: null,
            coverageState: worstGovernanceCoverage([
              ...accounting.governance.locks.map((lock) => governanceCoverageStatus(lock.coverageStatus)),
              ...accounting.governance.events.map((event) => governanceCoverageStatus(event.coverageStatus)),
              ...governanceRewards.map((reward) => governanceCoverageStatus(reward.coverageStatus)),
            ]),
            confidence: worstGovernanceConfidence([
              ...accounting.governance.locks.map((lock) => governanceConfidence(lock.confidence)),
              ...accounting.governance.events.map((event) => governanceConfidence(event.confidence)),
              ...governanceRewards.map((reward) => governanceConfidence(reward.confidence)),
            ]),
          },
        },
        evidenceJson: {
          rewardCount: governanceRewards.length,
          governanceEventCount: accounting.governance.events.length,
        },
      })];

  return [...lockRows, ...eventRows, ...rewardRows, ...epochRows, ...metricRows];
}

export function materializeAllDataViewRows(
  accounting: EngineV2AccountingOutput,
  context: EngineV2MaterializationContext = defaultMaterializationContext(),
): EngineV2ReadModelRowInput[] {
  return [
    ...materializeActivityRows({ accounting }),
    ...materializeDepositRows(accounting, context),
    ...materializeStrategyRows(accounting, context),
    ...materializePoolRows(accounting, context),
    ...materializeRewardRows(accounting, context),
    ...materializeGovernanceRows(accounting, context),
  ];
}
