import type { EngineV2DomainEventLike, EngineV2EntityLinkLike } from "./chronological-accounting";

export type EngineV2StrategyProjection = {
  strategyExposureId: string;
  strategyId: string | null;
  wrapperAddress: string | null;
  poolId: string | null;
  currentSharesRaw: string;
  sharesReceivedRaw: string;
  sharesRedeemedRaw: string;
  depositedValueUsd: string;
  withdrawnValueUsd: string;
  rewardsUsd: string;
  lifecycle: Array<{ eventId: string | null; eventType: string; txHash: string; occurredAt: Date; valueUsd: string | null }>;
  coverageStatus: string;
  confidence: string;
  reasonCodes: string[];
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function addBigInt(left: string, right: string | null, sign: 1 | -1 = 1) {
  if (!right) return left;
  try {
    return (BigInt(left) + BigInt(right) * BigInt(sign)).toString();
  } catch {
    return left;
  }
}

function addNumberString(left: string, right: string | null) {
  if (!right) return left;
  const total = Number(left) + Number(right);
  return Number.isFinite(total) ? String(total) : left;
}

function linkForEvent(links: EngineV2EntityLinkLike[], event: EngineV2DomainEventLike, entityType: string) {
  if (!event.id) return null;
  return links.find((link) => link.domainEventId === event.id && link.entityType === entityType) ?? null;
}

export function accountStrategies(input: { events: EngineV2DomainEventLike[]; links?: EngineV2EntityLinkLike[] }) {
  const links = input.links ?? [];
  const strategies = new Map<string, EngineV2StrategyProjection>();

  for (const event of input.events) {
    if (event.eventFamily !== "strategy" && !event.eventType.startsWith("strategy_")) continue;
    const metadata = asRecord(event.metadataJson);
    const strategyLink = linkForEvent(links, event, "strategy");
    const exposureLink = linkForEvent(links, event, "strategy_exposure");
    const poolLink = linkForEvent(links, event, "pool");
    const strategyExposureId = exposureLink?.entityId ?? asString(metadata.strategyExposureId) ?? strategyLink?.entityId;
    if (!strategyExposureId) continue;

    const valueUsd = asString(metadata.valueUsd) ?? asString(metadata.valueUsdAtEvent);
    const sharesRaw = asString(metadata.sharesRaw) ?? asString(metadata.shareDeltaRaw);
    const existing = strategies.get(strategyExposureId) ?? {
      strategyExposureId,
      strategyId: strategyLink?.entityId ?? asString(metadata.strategyId),
      wrapperAddress: asString(metadata.wrapperAddress),
      poolId: poolLink?.entityId ?? asString(metadata.poolId),
      currentSharesRaw: "0",
      sharesReceivedRaw: "0",
      sharesRedeemedRaw: "0",
      depositedValueUsd: "0",
      withdrawnValueUsd: "0",
      rewardsUsd: "0",
      lifecycle: [],
      coverageStatus: event.coverageStatus === "full" ? "share_level" : event.coverageStatus,
      confidence: event.confidence,
      reasonCodes: [],
    } satisfies EngineV2StrategyProjection;

    if (!existing.poolId && poolLink?.entityId) existing.poolId = poolLink.entityId;
    existing.reasonCodes = [...new Set([...existing.reasonCodes, ...event.reasonCodes])];
    if (event.coverageStatus !== "full") existing.coverageStatus = event.coverageStatus;
    if (event.confidence !== "high") existing.confidence = event.confidence;

    if (event.eventType.includes("deposit") || event.eventType.includes("stake")) {
      existing.depositedValueUsd = addNumberString(existing.depositedValueUsd, valueUsd);
      existing.sharesReceivedRaw = addBigInt(existing.sharesReceivedRaw, sharesRaw);
      existing.currentSharesRaw = addBigInt(existing.currentSharesRaw, sharesRaw);
    } else if (event.eventType.includes("withdraw") || event.eventType.includes("unstake") || event.eventType.includes("redeem")) {
      existing.withdrawnValueUsd = addNumberString(existing.withdrawnValueUsd, valueUsd);
      existing.sharesRedeemedRaw = addBigInt(existing.sharesRedeemedRaw, sharesRaw);
      existing.currentSharesRaw = addBigInt(existing.currentSharesRaw, sharesRaw, -1);
    } else if (event.eventType.includes("reward") || event.eventType.includes("claim")) {
      existing.rewardsUsd = addNumberString(existing.rewardsUsd, valueUsd);
    }
    existing.lifecycle.push({
      eventId: event.id ?? null,
      eventType: event.eventType,
      txHash: event.txHash,
      occurredAt: event.occurredAt,
      valueUsd,
    });
    strategies.set(strategyExposureId, existing);
  }

  return [...strategies.values()];
}
