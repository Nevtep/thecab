import { engineV2DomainEventLinks, engineV2DomainEvents } from "@/server/db/schema";

import type { EngineV2Classification } from "./base-classifiers";

export type EngineV2DomainEventInput = {
  chainId: number;
  walletAddress: string;
  canonicalTransactionId: string | null;
  canonicalCallId?: string | null;
  parentEventId?: string | null;
  txHash: string;
  occurredAt: Date;
  sequenceIndex: number;
  classification: EngineV2Classification;
};

export type EngineV2DomainEventLinkInput = {
  domainEventId: string;
  chainId: number;
  entityType: string;
  entityId: string;
  linkKind?: string;
  confidence?: string;
  evidenceJson?: Record<string, unknown>;
};

export function toDomainEventValues(input: EngineV2DomainEventInput): typeof engineV2DomainEvents.$inferInsert {
  return {
    chainId: input.chainId,
    walletAddress: input.walletAddress.toLowerCase(),
    canonicalTransactionId: input.canonicalTransactionId,
    canonicalCallId: input.canonicalCallId ?? null,
    parentEventId: input.parentEventId ?? null,
    eventType: input.classification.eventType,
    eventFamily: input.classification.eventFamily,
    occurredAt: input.occurredAt,
    txHash: input.txHash.toLowerCase(),
    sequenceIndex: input.sequenceIndex,
    coverageStatus: input.classification.coverageStatus,
    confidence: input.classification.confidence,
    reasonCodes: input.classification.reasonCodes,
    evidenceJson: input.classification.evidence,
    metadataJson: {},
  };
}

export function toDomainEventLinkValues(input: EngineV2DomainEventLinkInput): typeof engineV2DomainEventLinks.$inferInsert {
  return {
    domainEventId: input.domainEventId,
    chainId: input.chainId,
    entityType: input.entityType,
    entityId: input.entityId,
    linkKind: input.linkKind ?? "explicit",
    confidence: input.confidence ?? "high",
    evidenceJson: input.evidenceJson ?? {},
  };
}

export async function persistDomainEvent(input: {
  db: { insert(table: unknown): { values(value: unknown): { onConflictDoNothing(): { returning(): Promise<Array<{ id: string }>> } } } };
  event: EngineV2DomainEventInput;
}) {
  const [row] = await input.db.insert(engineV2DomainEvents)
    .values(toDomainEventValues(input.event))
    .onConflictDoNothing()
    .returning() ?? [];

  return row ?? null;
}
