import type { EngineV2AccountingOutput, EngineV2DomainEventLike } from "@/server/analysis/engine-v2/accounting";

export type EngineV2ReadModelRowInput = {
  chainId: number;
  walletAddress: string;
  surface: string;
  rowKey: string;
  sourceDomainEventId?: string | null;
  coverageStatus: string;
  confidence: string;
  rowJson: Record<string, unknown>;
  evidenceJson: Record<string, unknown>;
};

function eventEvidence(event: EngineV2DomainEventLike) {
  return {
    txHash: event.txHash,
    canonicalTransactionId: event.canonicalTransactionId ?? null,
    domainEventIds: event.id ? [event.id] : [],
    reasonCodes: event.reasonCodes,
    classificationEvidence: event.evidenceJson ?? {},
  };
}

export function materializeActivityRows(input: {
  accounting: EngineV2AccountingOutput;
}): EngineV2ReadModelRowInput[] {
  return input.accounting.events.map((event) => ({
    chainId: event.chainId,
    walletAddress: event.walletAddress.toLowerCase(),
    surface: "activity",
    rowKey: event.id ?? `${event.txHash}:${event.sequenceIndex}`,
    sourceDomainEventId: event.id ?? null,
    coverageStatus: event.coverageStatus,
    confidence: event.confidence,
    rowJson: {
      activityId: event.id ?? `${event.txHash}:${event.sequenceIndex}`,
      chainId: event.chainId,
      walletAddress: event.walletAddress.toLowerCase(),
      txHash: event.txHash,
      occurredAt: event.occurredAt.toISOString(),
      action: event.eventType,
      surface: event.eventFamily,
      summary: event.eventType,
      coverage: event.coverageStatus,
      confidence: event.confidence,
      reasonCodes: event.reasonCodes,
      selectedDetail: {
        actionSummary: event.eventType,
        transaction: {
          txHash: event.txHash,
          occurredAt: event.occurredAt.toISOString(),
        },
        tokenMovements: event.evidenceJson?.movements ?? [],
        valueEffect: event.valueEffectJson ?? {},
        linkedContexts: event.metadataJson?.linkedContexts ?? [],
        classificationEvidence: event.evidenceJson ?? {},
        sourceEvidence: event.metadataJson?.sourceEvidence ?? [],
        coverageNotes: event.reasonCodes,
      },
    },
    evidenceJson: eventEvidence(event),
  }));
}
