import type { EngineV2DomainEventLike, EngineV2EntityLinkLike } from "./chronological-accounting";
import type { EngineV2DepositProjection } from "./deposit-accounting";

export type EngineV2RewardProjection = {
  rewardId: string;
  sourceDomainEventId?: string | null;
  itemIndex?: number | null;
  rewardType: string;
  tokenAddress: string | null;
  amountRaw: string | null;
  amountUsd: string | null;
  lockTokenId?: string | null;
  sourceContract?: string | null;
  ownerStatus: "manual_deposit" | "strategy" | "governance" | "unresolved" | "excluded";
  linkedEntityId: string | null;
  poolId: string | null;
  affectsTotals: boolean;
  poolContribution: "contributes" | "none" | "unresolved" | "excluded";
  coverageStatus: string;
  confidence: string;
  reasonCodes: string[];
  txHash: string;
  occurredAt: Date;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function asInteger(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value !== "string" || value.length === 0) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function movementRecords(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
}

function linksForEvent(links: EngineV2EntityLinkLike[], event: EngineV2DomainEventLike) {
  if (!event.id) return [];
  return links.filter((link) => link.domainEventId === event.id);
}

function isRewardEvent(event: EngineV2DomainEventLike) {
  const source = `${event.eventType} ${event.eventFamily}`.toLowerCase();
  return source.includes("reward") || source.includes("claim") || source.includes("rebase") || source.includes("fee") || source.includes("bribe");
}

function normalizeRewardType(input: {
  value: string | null;
  ownerStatus: EngineV2RewardProjection["ownerStatus"];
  eventFamily: string;
}) {
  const { value, ownerStatus, eventFamily } = input;
  if (!value) return null;
  if (value === "unknown") return null;
  if ((value === "manual_reward" || value === "manual_reward_claim") && ownerStatus === "manual_deposit") {
    return "reward_claim";
  }
  if (value === "governance_fee" && eventFamily !== "governance" && ownerStatus !== "governance") {
    return "fee_claim";
  }
  return value;
}

function activeDepositAtEventTime(deposit: EngineV2DepositProjection, occurredAt: Date) {
  const openedAt = deposit.openedAt?.getTime() ?? Number.NEGATIVE_INFINITY;
  const closedAt = deposit.closedAt?.getTime() ?? Number.POSITIVE_INFINITY;
  const eventTime = occurredAt.getTime();
  return openedAt <= eventTime && eventTime <= closedAt;
}

function resolveBasicDepositAtEventTime(input: {
  depositsByPoolId: Map<string, EngineV2DepositProjection[]>;
  poolId: string | null;
  occurredAt: Date;
}) {
  if (!input.poolId) {
    return {
      depositId: null,
      deposit: null,
      ambiguityReasonCode: null,
      activeMatchCount: 0,
    };
  }

  const poolDeposits = input.depositsByPoolId.get(input.poolId) ?? [];
  const activeDeposits = poolDeposits.filter((deposit) => activeDepositAtEventTime(deposit, input.occurredAt));
  if (activeDeposits.length === 1) {
    return {
      depositId: activeDeposits[0]?.depositId ?? null,
      deposit: activeDeposits[0] ?? null,
      ambiguityReasonCode: null,
      activeMatchCount: activeDeposits.length,
    };
  }
  if (activeDeposits.length > 1) {
    return {
      depositId: null,
      deposit: null,
      ambiguityReasonCode: "ambiguous_active_basic_deposit",
      activeMatchCount: activeDeposits.length,
    };
  }

  const eventTime = input.occurredAt.getTime();
  const closedCandidates = poolDeposits.filter((deposit) => {
    const closedAt = deposit.closedAt?.getTime();
    return typeof closedAt === "number" && Number.isFinite(closedAt) && closedAt < eventTime;
  });
  if (closedCandidates.length === 0) {
    return {
      depositId: null,
      deposit: null,
      ambiguityReasonCode: null,
      activeMatchCount: 0,
    };
  }

  const latestClosedAt = Math.max(...closedCandidates.map((deposit) => deposit.closedAt?.getTime() ?? Number.NEGATIVE_INFINITY));
  const latestClosedCandidates = closedCandidates.filter((deposit) => (deposit.closedAt?.getTime() ?? Number.NEGATIVE_INFINITY) === latestClosedAt);
  if (latestClosedCandidates.length !== 1) {
    return {
      depositId: null,
      deposit: null,
      ambiguityReasonCode: "ambiguous_closed_basic_deposit",
      activeMatchCount: 0,
    };
  }

  const candidate = latestClosedCandidates[0] ?? null;
  const reopenedBeforeClaim = poolDeposits.some((deposit) => {
    if (!candidate || deposit.depositId === candidate.depositId) return false;
    const openedAt = deposit.openedAt?.getTime();
    return typeof openedAt === "number"
      && Number.isFinite(openedAt)
      && openedAt > latestClosedAt
      && openedAt < eventTime;
  });
  if (reopenedBeforeClaim) {
    return {
      depositId: null,
      deposit: null,
      ambiguityReasonCode: "reopened_basic_deposit_before_claim",
      activeMatchCount: 0,
    };
  }

  return {
    depositId: candidate?.depositId ?? null,
    deposit: candidate,
    ambiguityReasonCode: null,
    activeMatchCount: 0,
  };
}

function rewardItemsForEvent(input: {
  event: EngineV2DomainEventLike;
  metadata: Record<string, unknown>;
  evidence: Record<string, unknown>;
  baseRewardId: string;
}) {
  if (input.event.eventType !== "manual_pool_fee_claim") {
    return [{
      rewardId: input.baseRewardId,
      itemIndex: asInteger(input.metadata.itemIndex),
      tokenAddress: asString(input.metadata.tokenAddress),
      amountRaw: asString(input.metadata.amountRaw),
      amountUsd: asString(input.metadata.amountUsd) ?? asString(input.metadata.valueUsd) ?? asString(input.metadata.valueUsdAtEvent),
    }];
  }

  const inboundErc20Movements = movementRecords(input.evidence.movements).filter((movement) => (
    asString(movement.assetType) === "erc20"
    && asString(movement.direction) === "in"
    && Boolean(asString(movement.tokenAddress))
    && Boolean(asString(movement.amountRaw))
  ));
  if (inboundErc20Movements.length === 0) {
    return [{
      rewardId: input.baseRewardId,
      itemIndex: asInteger(input.metadata.itemIndex),
      tokenAddress: asString(input.metadata.tokenAddress),
      amountRaw: asString(input.metadata.amountRaw),
      amountUsd: asString(input.metadata.amountUsd) ?? asString(input.metadata.valueUsd) ?? asString(input.metadata.valueUsdAtEvent),
    }];
  }

  return inboundErc20Movements.map((movement, index) => ({
    rewardId: inboundErc20Movements.length === 1 ? input.baseRewardId : `${input.baseRewardId}:${index}`,
    itemIndex: inboundErc20Movements.length === 1 ? asInteger(input.metadata.itemIndex) : index,
    tokenAddress: asString(movement.tokenAddress) ?? asString(input.metadata.tokenAddress),
    amountRaw: asString(movement.amountRaw) ?? asString(input.metadata.amountRaw),
    amountUsd: asString(movement.valueUsdAtEvent)
      ?? (inboundErc20Movements.length === 1
        ? asString(input.metadata.amountUsd) ?? asString(input.metadata.valueUsd) ?? asString(input.metadata.valueUsdAtEvent)
        : null),
  }));
}

export function accountRewards(input: {
  events: EngineV2DomainEventLike[];
  links?: EngineV2EntityLinkLike[];
  deposits?: EngineV2DepositProjection[];
  gaugePoolIdByGaugeAddress?: Map<string, string>;
}) {
  const links = input.links ?? [];
  const depositsById = new Map((input.deposits ?? []).map((deposit) => [deposit.depositId, deposit] as const));
  const depositIdByTokenId = new Map(
    (input.deposits ?? [])
      .filter((deposit) => typeof deposit.tokenId === "string" && deposit.tokenId.length > 0)
      .map((deposit) => [deposit.tokenId, deposit.depositId] as const),
  );
  const depositsByPoolId = new Map<string, EngineV2DepositProjection[]>();
  for (const deposit of input.deposits ?? []) {
    if (!deposit.poolId) continue;
    const bucket = depositsByPoolId.get(deposit.poolId) ?? [];
    bucket.push(deposit);
    depositsByPoolId.set(deposit.poolId, bucket);
  }
  const seen = new Set<string>();
  const rewards: EngineV2RewardProjection[] = [];

  for (const event of input.events) {
    if (!isRewardEvent(event)) continue;
    const metadata = asRecord(event.metadataJson);
    const evidence = asRecord(event.evidenceJson);
    const eventLinks = linksForEvent(links, event);
    const depositLink = eventLinks.find((link) => link.entityType === "deposit");
    const strategyLink = eventLinks.find((link) => link.entityType === "strategy" || link.entityType === "strategy_exposure");
    const governanceLink = eventLinks.find((link) => link.entityType === "governance_lock" || link.entityType === "governance_epoch");
    const poolLink = eventLinks.find((link) => link.entityType === "pool");
    const baseRewardId = asString(metadata.rewardId) ?? `${event.id ?? event.txHash}:${asString(metadata.itemIndex) ?? "0"}`;

    const isExcluded = event.coverageStatus === "excluded";
    const metadataStrategyExposureId = asString(metadata.strategyExposureId);
    const metadataDepositId = asString(metadata.depositId);
    const metadataTokenId = asString(metadata.tokenId) ?? asString(asRecord(event.evidenceJson).tokenId);
    const gaugeAddress = asString(metadata.claimContract)?.toLowerCase()
      ?? asString(metadata.sourceContract)?.toLowerCase()
      ?? asString(metadata.toAddress)?.toLowerCase()
      ?? null;
    const gaugePoolId = gaugeAddress ? input.gaugePoolIdByGaugeAddress?.get(gaugeAddress) ?? null : null;
    const poolContractPoolId = event.eventType === "manual_pool_fee_claim" && gaugeAddress
      ? `${event.chainId}:${gaugeAddress}`
      : null;
    const explicitPoolId = poolLink?.entityId ?? asString(metadata.poolId) ?? poolContractPoolId ?? gaugePoolId ?? null;
    const basicDepositResolution = (
      event.eventType === "manual_gauge_reward_claim" || event.eventType === "manual_pool_fee_claim"
    )
      ? resolveBasicDepositAtEventTime({
        depositsByPoolId,
        poolId: explicitPoolId,
        occurredAt: event.occurredAt,
      })
      : { depositId: null, deposit: null, ambiguityReasonCode: null, activeMatchCount: 0 };
    const resolvedDepositId = depositLink?.entityId
      ?? metadataDepositId
      ?? (metadataTokenId ? depositIdByTokenId.get(metadataTokenId) ?? null : null)
      ?? basicDepositResolution.depositId;
    const resolvedDeposit = resolvedDepositId
      ? depositsById.get(resolvedDepositId) ?? basicDepositResolution.deposit ?? null
      : basicDepositResolution.deposit ?? null;
    const resolvedPoolId = explicitPoolId ?? resolvedDeposit?.poolId ?? null;
    const ownerStatus = isExcluded ? "excluded" :
      strategyLink ? "strategy" :
      metadataStrategyExposureId ? "strategy" :
      resolvedDepositId ? "manual_deposit" :
      governanceLink || event.eventFamily === "governance" ? "governance" :
      "unresolved";
    const rewardType = normalizeRewardType({
      value: asString(metadata.rewardType),
      ownerStatus,
      eventFamily: event.eventFamily,
    }) ?? (
      event.eventType.includes("bribe") ? "governance_bribe" :
      event.eventType.includes("fee")
        ? (event.eventFamily === "governance" || ownerStatus === "governance" ? "governance_fee" : "fee_claim")
        :
      event.eventType.includes("rebase") ? "rebase" :
      event.eventFamily === "strategy" ? "strategy_reward" :
      ownerStatus === "manual_deposit" ? "reward_claim" :
      "unknown"
    );
    const affectsTotals = asBoolean(metadata.affectsTotals) ?? (!isExcluded && rewardType !== "rebase" && ownerStatus !== "unresolved");
    const poolContribution = isExcluded ? "excluded" :
      resolvedPoolId ? "contributes" :
      rewardType === "rebase" ? "none" :
      "unresolved";
    const reasonCodes = [...new Set([
      ...event.reasonCodes,
      ...(basicDepositResolution.ambiguityReasonCode ? [basicDepositResolution.ambiguityReasonCode] : []),
      ...(ownerStatus === "unresolved" ? ["missing_explicit_owner"] : []),
      ...(poolContribution === "unresolved" && event.eventFamily === "governance" ? ["missing_distributor_pool_link"] : []),
    ])];

    for (const rewardItem of rewardItemsForEvent({
      event,
      metadata,
      evidence,
      baseRewardId,
    })) {
      if (seen.has(rewardItem.rewardId)) continue;
      seen.add(rewardItem.rewardId);

      rewards.push({
        rewardId: rewardItem.rewardId,
        sourceDomainEventId: event.id ?? null,
        itemIndex: rewardItem.itemIndex,
        rewardType,
        tokenAddress: rewardItem.tokenAddress,
        amountRaw: rewardItem.amountRaw,
        amountUsd: rewardItem.amountUsd,
        lockTokenId: asString(metadata.lockTokenId),
        sourceContract: asString(metadata.sourceContract) ?? asString(metadata.distributorAddress) ?? asString(metadata.claimContract),
        ownerStatus,
        linkedEntityId: strategyLink?.entityId ?? metadataStrategyExposureId ?? resolvedDepositId ?? governanceLink?.entityId ?? null,
        poolId: resolvedPoolId,
        affectsTotals,
        poolContribution,
        coverageStatus: isExcluded ? "excluded" : event.coverageStatus,
        confidence: event.confidence,
        reasonCodes,
        txHash: event.txHash,
        occurredAt: event.occurredAt,
      });
    }
  }

  return rewards;
}
