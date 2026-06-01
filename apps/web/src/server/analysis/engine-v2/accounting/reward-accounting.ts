import type { EngineV2DomainEventLike, EngineV2EntityLinkLike } from "./chronological-accounting";

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

export function accountRewards(input: { events: EngineV2DomainEventLike[]; links?: EngineV2EntityLinkLike[] }) {
  const links = input.links ?? [];
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

    const rewardType = asString(metadata.rewardType) ?? (
      event.eventType.includes("bribe") ? "governance_bribe" :
      event.eventType.includes("fee") ? "governance_fee" :
      event.eventType.includes("rebase") ? "rebase" :
      event.eventFamily === "strategy" ? "strategy_reward" :
      "unknown"
    );
    const isExcluded = event.coverageStatus === "excluded";
    const metadataStrategyExposureId = asString(metadata.strategyExposureId);
    const metadataDepositId = asString(metadata.depositId);
    const ownerStatus = isExcluded ? "excluded" :
      strategyLink ? "strategy" :
      metadataStrategyExposureId ? "strategy" :
      depositLink ? "manual_deposit" :
      metadataDepositId ? "manual_deposit" :
      governanceLink || event.eventFamily === "governance" ? "governance" :
      "unresolved";
    const affectsTotals = asBoolean(metadata.affectsTotals) ?? (!isExcluded && rewardType !== "rebase" && ownerStatus !== "unresolved");
    const poolContribution = isExcluded ? "excluded" :
      poolLink ? "contributes" :
      asString(metadata.poolId) ? "contributes" :
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
      linkedEntityId: strategyLink?.entityId ?? metadataStrategyExposureId ?? depositLink?.entityId ?? metadataDepositId ?? governanceLink?.entityId ?? null,
      poolId: poolLink?.entityId ?? asString(metadata.poolId),
      affectsTotals,
      poolContribution,
      coverageStatus: isExcluded ? "excluded" : event.coverageStatus,
      confidence: event.confidence,
      reasonCodes: [...new Set([
        ...event.reasonCodes,
        ...(ownerStatus === "unresolved" ? ["missing_explicit_owner"] : []),
        ...(poolContribution === "unresolved" ? ["missing_distributor_pool_link"] : []),
      ])],
      txHash: event.txHash,
      occurredAt: event.occurredAt,
    });
  }

  return rewards;
}
