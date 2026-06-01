import type { EngineV2DomainEventLike, EngineV2EntityLinkLike } from "./chronological-accounting";

export type EngineV2RewardProjection = {
  rewardId: string;
  rewardType: string;
  tokenAddress: string | null;
  amountRaw: string | null;
  amountUsd: string | null;
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
      "unknown"
    );
    const isExcluded = event.coverageStatus === "excluded";
    const ownerStatus = isExcluded ? "excluded" :
      strategyLink ? "strategy" :
      depositLink ? "manual_deposit" :
      governanceLink || event.eventFamily === "governance" ? "governance" :
      "unresolved";
    const affectsTotals = asBoolean(metadata.affectsTotals) ?? (!isExcluded && rewardType !== "rebase" && ownerStatus !== "unresolved");
    const poolContribution = isExcluded ? "excluded" :
      poolLink ? "contributes" :
      rewardType === "rebase" ? "none" :
      "unresolved";

    rewards.push({
      rewardId,
      rewardType,
      tokenAddress: asString(metadata.tokenAddress),
      amountRaw: asString(metadata.amountRaw),
      amountUsd: asString(metadata.amountUsd) ?? asString(metadata.valueUsd) ?? asString(metadata.valueUsdAtEvent),
      ownerStatus,
      linkedEntityId: strategyLink?.entityId ?? depositLink?.entityId ?? governanceLink?.entityId ?? null,
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
