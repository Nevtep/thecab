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
  const primitiveRows = input.accounting.events.map((event) => ({
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

  const chainId = input.accounting.events[0]?.chainId ?? 0;
  const walletAddress = input.accounting.events[0]?.walletAddress.toLowerCase() ?? "";
  const derivedRebalanceRows = input.accounting.rebalances.map((rebalance) => ({
    chainId,
    walletAddress,
    surface: "activity",
    rowKey: rebalance.rebalanceId,
    sourceDomainEventId: rebalance.depositEventId,
    coverageStatus: rebalance.coverageStatus,
    confidence: rebalance.confidence,
    rowJson: {
      activityId: rebalance.rebalanceId,
      chainId,
      walletAddress,
      txHash: rebalance.txHash,
      occurredAt: rebalance.occurredAt.toISOString(),
      action: "rebalance_same_pool",
      surface: "pools",
      summary: "rebalance_same_pool",
      coverage: rebalance.coverageStatus,
      confidence: rebalance.confidence,
      reasonCodes: rebalance.reasonCodes,
      selectedDetail: {
        actionSummary: "rebalance_same_pool",
        transaction: {
          txHash: rebalance.txHash,
          occurredAt: rebalance.occurredAt.toISOString(),
        },
        tokenMovements: [],
        valueEffect: {
          withdrawnCapitalUsd: rebalance.withdrawnCapitalUsd,
          redeployedCapitalUsd: rebalance.redeployedCapitalUsd,
          capitalDeltaUsd: rebalance.capitalDeltaUsd,
        },
        linkedContexts: [{
          kind: "pool",
          entityId: rebalance.poolId,
        }],
        classificationEvidence: {
          sourceWithdrawalId: rebalance.sourceWithdrawalId,
          withdrawalEventId: rebalance.withdrawalEventId,
          swapEventIds: rebalance.swapEventIds,
          depositEventId: rebalance.depositEventId,
          classificationBasis: "residual_flow",
        },
        sourceEvidence: [
          rebalance.withdrawalEventId,
          ...rebalance.swapEventIds,
          rebalance.depositEventId,
        ].filter(Boolean),
        coverageNotes: rebalance.reasonCodes,
      },
      metadata: {
        actionType: "rebalance_same_pool",
        sourceSurface: "pools",
        poolId: rebalance.poolId,
        sourceWithdrawalId: rebalance.sourceWithdrawalId,
        withdrawalEventId: rebalance.withdrawalEventId,
        swapEventIds: rebalance.swapEventIds,
        depositEventId: rebalance.depositEventId,
      },
    },
    evidenceJson: {
      reasonCodes: rebalance.reasonCodes,
      sourceWithdrawalId: rebalance.sourceWithdrawalId,
      withdrawalEventId: rebalance.withdrawalEventId,
      swapEventIds: rebalance.swapEventIds,
      depositEventId: rebalance.depositEventId,
    },
  }));

  return [...primitiveRows, ...derivedRebalanceRows];
}
