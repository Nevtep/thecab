import {
  classifyGovernanceSurface,
  type GovernanceClassification,
  type GovernanceClassificationInput,
} from "@/server/analysis/governance-classification";
import type {
  GovernanceConfidence,
  GovernanceCoverageState,
  GovernanceEventType,
  GovernanceRewardType,
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

export type GovernanceRewardInput = {
  id: string;
  chainId: number;
  walletAddress: string;
  txHash: string;
  logIndex: number;
  rewardType: string;
  resolutionBasis: string | null;
  resolutionReasonCodes: string[] | null;
  tokenAddress: string | null;
  amountRaw: string | null;
  amountUsd: string | null;
  occurredAt: Date;
  resolutionStatus: string;
  resolvedPoolId: string | null;
  metadataJson?: Record<string, unknown> | null;
};

export type GovernanceRewardMaterialization = {
  chainId: number;
  walletAddress: string;
  rewardEventId: string;
  governanceEventId: string | null;
  txHash: string;
  logIndex: number;
  claimedAt: Date;
  rewardType: GovernanceRewardType;
  tokenAddress: string | null;
  tokenSymbol: string | null;
  amountRaw: string | null;
  amountDecimal: string | null;
  valueUsdAtClaim: string | null;
  epochId: string | null;
  poolId: string | null;
  coverageStatus: GovernanceCoverageState;
  confidence: GovernanceConfidence;
  affectsTotals: boolean;
  contextJson: Record<string, unknown>;
  evidenceJson: Record<string, unknown>;
};

export type GovernanceSelectedDetailPayload = {
  selectionKind: "event" | "reward";
  selectionId: string;
  actionSummary: {
    labelKey: string;
    contextLabel: string | null;
  };
  transaction: {
    txHash: string;
    occurredAt: string;
  };
  protocolSurface: string;
  tokenMovements: Array<Record<string, unknown>>;
  valueEffect: {
    valueUsd: string | null;
    coverageState: GovernanceCoverageState;
  };
  epochContext: Record<string, unknown> | null;
  poolContext: Record<string, unknown> | null;
  classificationEvidence: {
    basis: string[];
    reasonCodes: string[];
    missingEvidenceReasonCodes: string[];
  };
  linkedContexts: Array<{
    kind: "activity" | "reward" | "pool";
    entityId: string;
    route: string | null;
  }>;
  coverageNotes: {
    coverageState: GovernanceCoverageState;
    confidence: GovernanceConfidence;
    affectsTotals: boolean;
    reasonCodes: string[];
  };
  sourceEvidenceRefs: Array<Record<string, unknown>>;
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

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asObjectArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry))
    : [];
}

function metadataText(metadata: Record<string, unknown> | null | undefined, keys: string[]) {
  return keys
    .map((key) => asString(metadata?.[key]))
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();
}

function isGovernanceReward(input: GovernanceRewardInput) {
  const metadata = input.metadataJson ?? {};
  const metadataSignal = metadataText(metadata, [
    "sourceSurface",
    "surfaceKind",
    "rewardSurface",
    "protocolSurface",
    "governanceSurface",
    "classification",
  ]);
  const rewardType = input.rewardType.toLowerCase();
  const basis = input.resolutionBasis?.toLowerCase() ?? "";

  return metadataSignal.includes("governance")
    || metadataSignal.includes("briber")
    || metadataSignal.includes("voting")
    || metadataSignal.includes("fee_distributor")
    || basis.includes("governance")
    || rewardType.includes("governance")
    || rewardType.includes("bribe")
    || rewardType.includes("rebase")
    || rewardType.includes("relay");
}

function normalizeRewardType(input: GovernanceRewardInput): GovernanceRewardType {
  const value = [
    input.rewardType,
    input.resolutionBasis ?? "",
    metadataText(input.metadataJson, ["sourceSurface", "surfaceKind", "rewardSurface", "protocolSurface"]),
  ].join(" ").toLowerCase();

  if (value.includes("bribe")) return "bribe";
  if (value.includes("fee")) return "fee";
  if (value.includes("rebase")) return "rebase";
  if (value.includes("relay")) return "relay";
  return "unknown";
}

function rewardCoverage(input: {
  resolutionStatus: string;
  amountUsd: string | null;
  poolId: string | null;
  rewardType: GovernanceRewardType;
}): GovernanceCoverageState {
  if (input.resolutionStatus === "excluded") return "excluded";
  if (input.resolutionStatus === "unresolved") return "unresolved";
  if (input.resolutionStatus === "unavailable") return "unavailable";
  if (input.amountUsd === null) return "partial";
  if ((input.rewardType === "bribe" || input.rewardType === "fee") && !input.poolId) return "partial";
  return "full";
}

function rewardConfidence(input: {
  coverageStatus: GovernanceCoverageState;
  resolutionStatus: string;
}): GovernanceConfidence {
  if (input.coverageStatus === "excluded" || input.resolutionStatus === "excluded") return "none";
  if (input.coverageStatus === "full") return "high";
  if (input.coverageStatus === "partial") return "medium";
  return "low";
}

export function resolveGovernanceRewardPoolAssociation(input: GovernanceRewardInput) {
  if (!input.resolvedPoolId) {
    return {
      poolId: null,
      rule: "explicit_pool_evidence_required",
      reasonCodes: ["explicitPoolAssociationUnavailable"],
    };
  }

  return {
    poolId: input.resolvedPoolId,
    rule: "persisted_explicit_pool_association",
    reasonCodes: ["explicitPoolAssociationPersisted"],
  };
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
      selectedDetail: buildGovernanceSelectedDetailPayload({
        selectionKind: "event",
        selectionId: input.id ?? `${input.txHash.toLowerCase()}:${input.logIndex}`,
        txHash: input.txHash,
        occurredAt: input.occurredAt,
        labelKey: `governance:events.${classification.eventType}`,
        contextLabel: classification.protocolSurface,
        protocolSurface: classification.protocolSurface,
        evidenceBasis: classification.evidenceBasis,
        reasonCodes: classification.reasonCodes,
        coverageState: classification.coverageState,
        confidence: normalizeConfidence(input.confidence ?? classification.confidence),
        affectsTotals: classification.coverageState !== "excluded" && classification.coverageState !== "unsupported",
        sourceEvidenceRefs: asObjectArray(input.metadataJson?.evidenceRefs).concat(asObjectArray(input.metadataJson?.sourceEvidenceRefs)),
        tokenMovements: asObjectArray(input.metadataJson?.tokenMovements).concat(asObjectArray(input.metadataJson?.assetMovements)),
        valueUsd: asString(input.metadataJson?.valueUsd) ?? asString(input.metadataJson?.amountUsd),
        epochContext: asString(input.metadataJson?.epochId) ? { epochId: asString(input.metadataJson?.epochId) } : null,
        poolContext: asString(input.metadataJson?.poolId) ? {
          poolId: asString(input.metadataJson?.poolId),
          label: asString(input.metadataJson?.poolLabel) ?? asString(input.metadataJson?.poolId),
        } : null,
      }),
      coverageStatus: classification.coverageState,
      confidence: normalizeConfidence(input.confidence ?? classification.confidence),
    },
  };
}

export function buildGovernanceSelectedDetailPayload(input: {
  selectionKind: "event" | "reward";
  selectionId: string;
  txHash: string;
  occurredAt: Date;
  labelKey: string;
  contextLabel: string | null;
  protocolSurface: string;
  evidenceBasis: string[];
  reasonCodes: string[];
  coverageState: GovernanceCoverageState;
  confidence: GovernanceConfidence;
  affectsTotals: boolean;
  sourceEvidenceRefs: Array<Record<string, unknown>>;
  tokenMovements?: Array<Record<string, unknown>>;
  valueUsd?: string | null;
  epochContext?: Record<string, unknown> | null;
  poolContext?: Record<string, unknown> | null;
  linkedContexts?: Array<{
    kind: "activity" | "reward" | "pool";
    entityId: string;
    route: string | null;
  }>;
}): GovernanceSelectedDetailPayload {
  const reasonCodes = Array.from(new Set(input.reasonCodes));
  return {
    selectionKind: input.selectionKind,
    selectionId: input.selectionId,
    actionSummary: {
      labelKey: input.labelKey,
      contextLabel: input.contextLabel,
    },
    transaction: {
      txHash: input.txHash.toLowerCase(),
      occurredAt: input.occurredAt.toISOString(),
    },
    protocolSurface: input.protocolSurface,
    tokenMovements: input.tokenMovements ?? [],
    valueEffect: {
      valueUsd: input.valueUsd ?? null,
      coverageState: input.coverageState,
    },
    epochContext: input.epochContext ?? null,
    poolContext: input.poolContext ?? null,
    classificationEvidence: {
      basis: Array.from(new Set(input.evidenceBasis)),
      reasonCodes,
      missingEvidenceReasonCodes: input.coverageState === "full" ? [] : reasonCodes,
    },
    linkedContexts: input.linkedContexts ?? [],
    coverageNotes: {
      coverageState: input.coverageState,
      confidence: input.confidence,
      affectsTotals: input.affectsTotals,
      reasonCodes,
    },
    sourceEvidenceRefs: input.sourceEvidenceRefs,
  };
}

export function buildGovernanceEventRows(inputs: GovernanceLedgerInput[]) {
  return inputs
    .map((input) => materializeGovernanceEvent(input))
    .filter((row): row is GovernanceEventMaterialization => row !== null);
}

export function materializeGovernanceReward(input: GovernanceRewardInput): GovernanceRewardMaterialization | null {
  if (!isGovernanceReward(input)) {
    return null;
  }

  const metadata = input.metadataJson ?? {};
  const rewardType = normalizeRewardType(input);
  const poolAssociation = resolveGovernanceRewardPoolAssociation(input);
  const coverageStatus = rewardCoverage({
    resolutionStatus: input.resolutionStatus,
    amountUsd: input.amountUsd,
    poolId: poolAssociation.poolId,
    rewardType,
  });
  const confidence = rewardConfidence({ coverageStatus, resolutionStatus: input.resolutionStatus });
  const affectsTotals = input.resolutionStatus === "resolved" && input.amountUsd !== null;
  const epochId = asString(metadata.epochId) ?? asString(metadata.governanceEpochId);
  const tokenSymbol = asString(metadata.tokenSymbol) ?? asString(metadata.rewardTokenSymbol) ?? asString(metadata.symbol);
  const amountDecimal = asString(metadata.amountDecimal) ?? asString(metadata.amountFormatted);
  const rewardReasonCodes = Array.from(new Set([
    ...(input.resolutionReasonCodes ?? []),
    ...poolAssociation.reasonCodes,
  ]));
  const selectedDetail = buildGovernanceSelectedDetailPayload({
    selectionKind: "reward",
    selectionId: input.id,
    txHash: input.txHash,
    occurredAt: input.occurredAt,
    labelKey: `governance:rewards.${rewardType}`,
    contextLabel: epochId ? `Epoch ${epochId}` : "Governance reward",
    protocolSurface: rewardType === "bribe" ? "briber" : rewardType === "fee" ? "fee_distributor" : "reward_distributor",
    evidenceBasis: ["rewardEventIdentity", input.resolutionBasis ?? "governance_reward", poolAssociation.rule],
    reasonCodes: rewardReasonCodes,
    coverageState: coverageStatus,
    confidence,
    affectsTotals,
    sourceEvidenceRefs: asObjectArray(metadata.evidenceRefs).concat(asObjectArray(metadata.sourceEvidenceRefs)),
    tokenMovements: [{
      tokenAddress: input.tokenAddress,
      tokenSymbol,
      amount: amountDecimal ?? input.amountRaw,
      amountUsd: input.amountUsd,
      direction: "in",
    }],
    valueUsd: input.amountUsd,
    epochContext: epochId ? { epochId, label: `Epoch ${epochId}` } : null,
    poolContext: poolAssociation.poolId ? { poolId: poolAssociation.poolId } : null,
    linkedContexts: [
      {
        kind: "reward",
        entityId: input.id,
        route: null,
      },
      ...(poolAssociation.poolId ? [{
        kind: "pool" as const,
        entityId: poolAssociation.poolId,
        route: null,
      }] : []),
    ],
  });

  return {
    chainId: input.chainId,
    walletAddress: input.walletAddress.toLowerCase(),
    rewardEventId: input.id,
    governanceEventId: null,
    txHash: input.txHash.toLowerCase(),
    logIndex: input.logIndex,
    claimedAt: input.occurredAt,
    rewardType,
    tokenAddress: input.tokenAddress?.toLowerCase() ?? null,
    tokenSymbol,
    amountRaw: input.amountRaw,
    amountDecimal,
    valueUsdAtClaim: input.amountUsd,
    epochId,
    poolId: poolAssociation.poolId,
    coverageStatus,
    confidence,
    affectsTotals,
    contextJson: {
      label: epochId ? `Epoch ${epochId}` : "Governance reward",
      tokenIconUrl: asString(metadata.tokenIconUrl),
      tokenSymbol,
      sourceSurface: asString(metadata.sourceSurface) ?? asString(metadata.surfaceKind) ?? "governance_reward",
      poolAssociation,
      selectedDetail,
      doubleCountingNoteKey: poolAssociation.poolId
        ? "governance:notes.explicitPoolContributionNoDoubleCount"
        : "governance:notes.unassociatedRewardNoPoolContribution",
    },
    evidenceJson: {
      sourceRewardEventId: input.id,
      resolutionBasis: input.resolutionBasis,
      resolutionReasonCodes: input.resolutionReasonCodes ?? [],
      sourceSurface: asString(metadata.sourceSurface) ?? asString(metadata.surfaceKind) ?? null,
      poolAssociation,
      selectedDetail,
      sourceEvidenceRefs: selectedDetail.sourceEvidenceRefs,
    },
  };
}

export function buildGovernanceRewardRows(inputs: GovernanceRewardInput[]) {
  return inputs
    .map((input) => materializeGovernanceReward(input))
    .filter((row): row is GovernanceRewardMaterialization => row !== null);
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
