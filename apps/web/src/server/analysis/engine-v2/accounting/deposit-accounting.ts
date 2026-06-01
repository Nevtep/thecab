import type { EngineV2DomainEventLike, EngineV2EntityLinkLike } from "./chronological-accounting";

export type EngineV2DepositProjection = {
  depositId: string;
  tokenId: string;
  poolId: string | null;
  status: "open" | "closed" | "unknown";
  openedAt: Date | null;
  closedAt: Date | null;
  openedValueUsd: string | null;
  currentOrCloseValueUsd: string | null;
  capitalInUsd: string;
  capitalOutUsd: string;
  rewardsUsd: string;
  lifecycle: EngineV2DepositLifecycleProjection[];
  coverageStatus: string;
  confidence: string;
  reasonCodes: string[];
};

export type EngineV2DepositLifecycleProjection = {
  eventId: string | null;
  eventType: string;
  txHash: string;
  occurredAt: Date;
  valueUsd: string | null;
  coverageStatus: string;
  reasonCodes: string[];
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumberString(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return asString(value);
}

function addDecimal(left: string, right: string | null) {
  if (!right) return left;
  const total = Number(left) + Number(right);
  return Number.isFinite(total) ? String(total) : left;
}

function linkForEvent(links: EngineV2EntityLinkLike[], event: EngineV2DomainEventLike, entityType: string) {
  if (!event.id) return null;
  return links.find((link) => link.domainEventId === event.id && link.entityType === entityType) ?? null;
}

function depositIdentity(event: EngineV2DomainEventLike, links: EngineV2EntityLinkLike[]) {
  const metadata = asRecord(event.metadataJson);
  const evidence = asRecord(event.evidenceJson);
  const depositLink = linkForEvent(links, event, "deposit");
  const positionManager = asString(metadata.positionManagerAddress) ?? asString(evidence.positionManagerAddress);
  const tokenId = asString(metadata.tokenId) ?? asString(evidence.tokenId);
  const depositId = depositLink?.entityId ?? asString(metadata.depositId) ?? (positionManager && tokenId ? `${event.chainId}:${positionManager.toLowerCase()}:${tokenId}` : null);
  const poolLink = linkForEvent(links, event, "pool");
  return {
    depositId,
    tokenId,
    poolId: poolLink?.entityId ?? asString(metadata.poolId) ?? null,
  };
}

export function accountManualDeposits(input: {
  events: EngineV2DomainEventLike[];
  links?: EngineV2EntityLinkLike[];
}) {
  const links = input.links ?? [];
  const deposits = new Map<string, EngineV2DepositProjection>();
  const knownDepositByTokenId = new Map<string, string>();

  for (const event of input.events) {
    if (event.eventFamily !== "deposit" && !event.eventType.startsWith("manual_")) continue;
    const identity = depositIdentity(event, links);
    const knownDepositId = identity.tokenId ? knownDepositByTokenId.get(identity.tokenId) : null;
    const depositId = identity.depositId ?? knownDepositId;
    if (!depositId || !identity.tokenId) continue;
    knownDepositByTokenId.set(identity.tokenId, depositId);

    const metadata = asRecord(event.metadataJson);
    const valueUsd = asNumberString(metadata.valueUsd) ?? asNumberString(metadata.valueUsdAtEvent);
    const existing = deposits.get(depositId) ?? {
      depositId,
      tokenId: identity.tokenId,
      poolId: identity.poolId,
      status: "unknown",
      openedAt: null,
      closedAt: null,
      openedValueUsd: null,
      currentOrCloseValueUsd: null,
      capitalInUsd: "0",
      capitalOutUsd: "0",
      rewardsUsd: "0",
      lifecycle: [],
      coverageStatus: "full",
      confidence: "high",
      reasonCodes: [],
    } satisfies EngineV2DepositProjection;

    if (event.coverageStatus !== "full") existing.coverageStatus = event.coverageStatus;
    if (event.confidence !== "high") existing.confidence = event.confidence;
    existing.reasonCodes = [...new Set([...existing.reasonCodes, ...event.reasonCodes])];
    if (!existing.poolId && identity.poolId) existing.poolId = identity.poolId;

    if (event.eventType.includes("open") || event.eventType.includes("deposit") || event.eventType.includes("increase")) {
      existing.status = existing.status === "closed" ? "closed" : "open";
      existing.openedAt ??= event.occurredAt;
      existing.openedValueUsd ??= valueUsd;
      existing.capitalInUsd = addDecimal(existing.capitalInUsd, valueUsd);
    }
    if (event.eventType.includes("decrease") || event.eventType.includes("withdraw") || event.eventType.includes("close")) {
      existing.capitalOutUsd = addDecimal(existing.capitalOutUsd, valueUsd);
      existing.currentOrCloseValueUsd = valueUsd ?? existing.currentOrCloseValueUsd;
      if (event.eventType.includes("close") || event.eventType.includes("withdraw")) {
        existing.status = "closed";
        existing.closedAt = event.occurredAt;
      }
    }
    if (event.eventType.includes("collect") || event.eventType.includes("reward") || event.eventType.includes("claim")) {
      existing.rewardsUsd = addDecimal(existing.rewardsUsd, valueUsd);
    }
    existing.lifecycle.push({
      eventId: event.id ?? null,
      eventType: event.eventType,
      txHash: event.txHash,
      occurredAt: event.occurredAt,
      valueUsd,
      coverageStatus: event.coverageStatus,
      reasonCodes: event.reasonCodes,
    });
    deposits.set(depositId, existing);
  }

  return [...deposits.values()];
}
