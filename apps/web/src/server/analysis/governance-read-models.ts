import {
  classifyGovernanceSurface,
  type GovernanceClassification,
  type GovernanceClassificationInput,
} from "@/server/analysis/governance-classification";
import type {
  GovernanceConfidence,
  GovernanceCoverageState,
  GovernanceEventType,
} from "@/server/governance/governance.types";

export type GovernanceLedgerInput = GovernanceClassificationInput & {
  id?: string;
  chainId: number;
  walletAddress: string;
  txHash: string;
  logIndex: number;
  eventType: string;
  occurredAt: Date;
  confidence?: string | null;
  classification?: string | null;
  metadataJson?: Record<string, unknown> | null;
};

export type GovernanceEventMaterialization = {
  chainId: number;
  walletAddress: string;
  txHash: string;
  logIndex: number;
  eventType: GovernanceEventType;
  occurredAt: Date;
  metadataJson: Record<string, unknown>;
};

export type GovernanceMetricSnapshotMaterialization = {
  chainId: number;
  walletAddress: string;
  summaryJson: Record<string, unknown>;
  selectedDetailJson: Record<string, unknown> | null;
  coverageStatus: GovernanceCoverageState;
  confidence: GovernanceConfidence;
};

function normalizeConfidence(value: string | null | undefined): GovernanceConfidence {
  if (value === "high" || value === "medium" || value === "low" || value === "none") {
    return value;
  }
  return "none";
}

function classificationFromMetadata(metadata: Record<string, unknown> | null | undefined) {
  const value = metadata?.governanceClassification;
  return typeof value === "object" && value !== null
    ? value as Partial<GovernanceClassification>
    : null;
}

export function materializeGovernanceEvent(input: GovernanceLedgerInput): GovernanceEventMaterialization | null {
  const metadataClassification = classificationFromMetadata(input.metadataJson);
  const classification = metadataClassification?.isGovernance
    ? {
      ...classifyGovernanceSurface(input),
      ...metadataClassification,
    } as GovernanceClassification
    : classifyGovernanceSurface(input);

  if (!classification.isGovernance || !classification.eventType) {
    return null;
  }

  return {
    chainId: input.chainId,
    walletAddress: input.walletAddress.toLowerCase(),
    txHash: input.txHash.toLowerCase(),
    logIndex: input.logIndex,
    eventType: classification.eventType,
    occurredAt: input.occurredAt,
    metadataJson: {
      ...(input.metadataJson ?? {}),
      sourceLedgerEventId: input.id ?? null,
      sourceLedgerEventType: input.eventType,
      sourceLedgerClassification: input.classification ?? null,
      governanceClassification: {
        isGovernance: true,
        eventType: classification.eventType,
        protocolSurface: classification.protocolSurface,
        coverageState: classification.coverageState,
        confidence: classification.confidence,
        reasonCodes: classification.reasonCodes,
        evidenceBasis: classification.evidenceBasis,
      },
      coverageStatus: classification.coverageState,
      confidence: normalizeConfidence(input.confidence ?? classification.confidence),
    },
  };
}

export function buildGovernanceEventRows(inputs: GovernanceLedgerInput[]) {
  return inputs
    .map((input) => materializeGovernanceEvent(input))
    .filter((row): row is GovernanceEventMaterialization => row !== null);
}

export function buildGovernanceMetricSnapshot(input: {
  chainId: number;
  walletAddress: string;
  rows: GovernanceEventMaterialization[];
}): GovernanceMetricSnapshotMaterialization {
  const totalEvents = input.rows.length;
  const byType = input.rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.eventType] = (acc[row.eventType] ?? 0) + 1;
    return acc;
  }, {});
  const coverageStates = input.rows.map((row) => {
    const value = row.metadataJson.governanceClassification;
    return typeof value === "object" && value !== null && "coverageState" in value
      ? String((value as { coverageState?: unknown }).coverageState)
      : "unavailable";
  });
  const confidenceStates = input.rows.map((row) => {
    const value = row.metadataJson.governanceClassification;
    return typeof value === "object" && value !== null && "confidence" in value
      ? String((value as { confidence?: unknown }).confidence)
      : "none";
  });
  const hasPartial = coverageStates.some((state) => state !== "full");
  const hasLowConfidence = confidenceStates.some((state) => state === "low" || state === "none");

  return {
    chainId: input.chainId,
    walletAddress: input.walletAddress.toLowerCase(),
    summaryJson: {
      totalEvents,
      eventTypes: byType,
      lockedAero: null,
      veAeroExposure: null,
      governanceRewardsClaimedUsd: null,
      estimatedGovernanceReturn: null,
    },
    selectedDetailJson: input.rows[0]
      ? {
        selectionKind: "event",
        txHash: input.rows[0].txHash,
        eventType: input.rows[0].eventType,
        occurredAt: input.rows[0].occurredAt.toISOString(),
      }
      : null,
    coverageStatus: totalEvents === 0 ? "unavailable" : hasPartial ? "partial" : "full",
    confidence: totalEvents === 0 ? "none" : hasLowConfidence ? "low" : "high",
  };
}
