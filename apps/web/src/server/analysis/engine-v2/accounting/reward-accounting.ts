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
    const eventLinks = linksForEvent(links, event);
    const depositLink = eventLinks.find((link) => link.entityType === "deposit");
    const strategyLink = eventLinks.find((link) => link.entityType === "strategy" || link.entityType === "strategy_exposure");
    const governanceLink = eventLinks.find((link) => link.entityType === "governance_lock" || link.entityType === "governance_epoch");
    const poolLink = eventLinks.find((link) => link.entityType === "pool");
    const rewardId = asString(metadata.rewardId) ?? `${event.id ?? event.txHash}:${asString(metadata.itemIndex) ?? "0"}`;
    if (seen.has(rewardId)) continue;
    seen.add(rewardId);

    const isExcluded = event.coverageStatus === "excluded";
    const metadataStrategyExposureId = asString(metadata.strategyExposureId);
    const metadataDepositId = asString(metadata.depositId);
    const metadataTokenId = asString(metadata.tokenId) ?? asString(asRecord(event.evidenceJson).tokenId);
    const gaugeAddress = asString(metadata.claimContract)?.toLowerCase()
      ?? asString(metadata.sourceContract)?.toLowerCase()
      ?? asString(metadata.toAddress)?.toLowerCase()
      ?? null;
    const gaugePoolId = gaugeAddress ? input.gaugePoolIdByGaugeAddress?.get(gaugeAddress) ?? null : null;
    const activeBasicDeposits = gaugePoolId
      ? (depositsByPoolId.get(gaugePoolId) ?? []).filter((deposit) => activeDepositAtEventTime(deposit, event.occurredAt))
      : [];
    const gaugeResolvedDepositId = event.eventType === "manual_gauge_reward_claim" && activeBasicDeposits.length === 1
      ? activeBasicDeposits[0]?.depositId ?? null
      : null;
    const resolvedDepositId = depositLink?.entityId
      ?? metadataDepositId
      ?? (metadataTokenId ? depositIdByTokenId.get(metadataTokenId) ?? null : null)
      ?? gaugeResolvedDepositId;
    const resolvedDeposit = resolvedDepositId ? depositsById.get(resolvedDepositId) ?? null : null;
    const resolvedPoolId = poolLink?.entityId ?? asString(metadata.poolId) ?? gaugePoolId ?? resolvedDeposit?.poolId ?? null;
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

    rewards.push({
      rewardId,
      sourceDomainEventId: event.id ?? null,
      itemIndex: asInteger(metadata.itemIndex),
      rewardType,
      tokenAddress: asString(metadata.tokenAddress),
      amountRaw: asString(metadata.amountRaw),
      amountUsd: asString(metadata.amountUsd) ?? asString(metadata.valueUsd) ?? asString(metadata.valueUsdAtEvent),
      lockTokenId: asString(metadata.lockTokenId),
      sourceContract: asString(metadata.sourceContract) ?? asString(metadata.distributorAddress) ?? asString(metadata.claimContract),
      ownerStatus,
      linkedEntityId: strategyLink?.entityId ?? metadataStrategyExposureId ?? resolvedDepositId ?? governanceLink?.entityId ?? null,
      poolId: resolvedPoolId,
      affectsTotals,
      poolContribution,
      coverageStatus: isExcluded ? "excluded" : event.coverageStatus,
      confidence: event.confidence,
      reasonCodes: [...new Set([
        ...event.reasonCodes,
        ...(event.eventType === "manual_gauge_reward_claim" && gaugePoolId && activeBasicDeposits.length > 1 ? ["ambiguous_active_basic_deposit"] : []),
        ...(ownerStatus === "unresolved" ? ["missing_explicit_owner"] : []),
        ...(poolContribution === "unresolved" && event.eventFamily === "governance" ? ["missing_distributor_pool_link"] : []),
      ])],
      txHash: event.txHash,
      occurredAt: event.occurredAt,
    });
  }

  return rewards;
}
