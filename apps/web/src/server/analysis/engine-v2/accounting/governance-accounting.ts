import type { EngineV2DomainEventLike, EngineV2EntityLinkLike } from "./chronological-accounting";

export type EngineV2GovernanceProjection = {
  locks: EngineV2GovernanceLockProjection[];
  managedLinks: EngineV2ManagedLockProjection[];
  epochs: EngineV2GovernanceEpochProjection[];
  events: EngineV2GovernanceEventProjection[];
};

export type EngineV2GovernanceLockProjection = {
  lockKey: string;
  tokenId: string;
  votingEscrowAddress: string | null;
  originKind: string;
  status: string;
  managedTokenId: string | null;
  coverageStatus: string;
  confidence: string;
  reasonCodes: string[];
};

export type EngineV2ManagedLockProjection = {
  userTokenId: string;
  managedTokenId: string;
  managerAddress: string | null;
  depositedAt: Date;
  txHash: string;
  sourceEventId: string | null;
  votingEscrowAddress: string | null;
};

export type EngineV2GovernanceEpochProjection = {
  epochId: string;
  lockTokenId: string | null;
  events: string[];
};

export type EngineV2GovernanceEventProjection = {
  eventId: string | null;
  eventType: string;
  tokenId: string | null;
  votingEscrowAddress: string | null;
  txHash: string;
  occurredAt: Date;
  amountRaw: string | null;
  lockEnd: Date | null;
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

function asDate(value: unknown) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== "string" || value.length === 0) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function linkForEvent(links: EngineV2EntityLinkLike[], event: EngineV2DomainEventLike, entityType: string) {
  if (!event.id) return null;
  return links.find((link) => link.domainEventId === event.id && link.entityType === entityType) ?? null;
}

function isGovernanceEvent(event: EngineV2DomainEventLike) {
  return event.eventFamily === "governance" || event.eventType.startsWith("governance_") || event.eventType.includes("lock") || event.eventType.includes("vote");
}

export function accountGovernance(input: { events: EngineV2DomainEventLike[]; links?: EngineV2EntityLinkLike[] }): EngineV2GovernanceProjection {
  const links = input.links ?? [];
  const locks = new Map<string, EngineV2GovernanceLockProjection>();
  const managedLinks: EngineV2ManagedLockProjection[] = [];
  const epochs = new Map<string, EngineV2GovernanceEpochProjection>();
  const events: EngineV2GovernanceEventProjection[] = [];

  for (const event of input.events) {
    if (!isGovernanceEvent(event)) continue;
    const metadata = asRecord(event.metadataJson);
    const evidence = asRecord(event.evidenceJson);
    const lockLink = linkForEvent(links, event, "governance_lock");
    const tokenId = asString(metadata.lockTokenId) ?? asString(metadata.tokenId) ?? asString(evidence.lockTokenId);
    const votingEscrowAddress = asString(metadata.votingEscrowAddress) ?? asString(evidence.votingEscrowAddress);
    const lockKey = lockLink?.entityId ?? (votingEscrowAddress && tokenId ? `${event.chainId}:${votingEscrowAddress.toLowerCase()}:${tokenId}` : null);
    const managedTokenId = asString(metadata.managedTokenId);

    if (lockKey && tokenId) {
      const current = locks.get(lockKey) ?? {
        lockKey,
        tokenId,
        votingEscrowAddress,
        originKind: "unknown",
        status: "unknown",
        managedTokenId: null,
        coverageStatus: event.coverageStatus,
        confidence: event.confidence,
        reasonCodes: [],
      } satisfies EngineV2GovernanceLockProjection;
      if (event.eventType.includes("create")) current.originKind = "create_lock";
      if (event.eventType.includes("grant") || event.eventType.includes("transfer_in")) current.originKind = "protocol_grant_or_external_transfer";
      if (event.eventType.includes("depositManaged") || event.eventType.includes("deposit_managed")) current.status = "deposited_managed";
      if (managedTokenId) current.managedTokenId = managedTokenId;
      current.reasonCodes = [...new Set([...current.reasonCodes, ...event.reasonCodes])];
      locks.set(lockKey, current);
    }

    if (tokenId && managedTokenId && (event.eventType.includes("depositManaged") || event.eventType.includes("deposit_managed"))) {
      managedLinks.push({
        userTokenId: tokenId,
        managedTokenId,
        managerAddress: asString(metadata.managerAddress),
        depositedAt: event.occurredAt,
        txHash: event.txHash,
        sourceEventId: event.id ?? null,
        votingEscrowAddress,
      });
    }

    const epochId = asString(metadata.epochId);
    if (epochId) {
      const current = epochs.get(epochId) ?? { epochId, lockTokenId: tokenId, events: [] };
      current.events.push(event.id ?? event.txHash);
      epochs.set(epochId, current);
    }

    events.push({
      eventId: event.id ?? null,
      eventType: event.eventType,
      tokenId,
      votingEscrowAddress,
      txHash: event.txHash,
      occurredAt: event.occurredAt,
      amountRaw: asString(metadata.amountRaw) ?? asString(evidence.amountRaw),
      lockEnd: asDate(metadata.lockEnd) ?? asDate(evidence.lockEnd),
      coverageStatus: event.coverageStatus,
      confidence: event.confidence,
      reasonCodes: event.reasonCodes,
    });
  }

  return {
    locks: [...locks.values()],
    managedLinks,
    epochs: [...epochs.values()],
    events,
  };
}
