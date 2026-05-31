import type { SurfaceKind } from "@/server/analysis/txClassification";
import type {
  GovernanceConfidence,
  GovernanceCoverageState,
  GovernanceEventType,
  GovernanceProtocolSurface,
} from "@/server/governance/governance.types";

export type GovernanceClassificationInput = {
  txHash: string;
  category?: string | null;
  summary?: string | null;
  protocol?: string | null;
  methodLabel?: string | null;
  surfaceKind?: SurfaceKind | null;
  rewardType?: string | null;
  metadataJson?: Record<string, unknown> | null;
};

export type GovernanceClassification = {
  isGovernance: boolean;
  eventType: GovernanceEventType | null;
  protocolSurface: GovernanceProtocolSurface | "unknown";
  coverageState: GovernanceCoverageState;
  confidence: GovernanceConfidence;
  reasonCodes: string[];
  evidenceBasis: string[];
};

const GOVERNANCE_SURFACE_MAP: Partial<Record<SurfaceKind, {
  eventType: GovernanceEventType;
  protocolSurface: GovernanceProtocolSurface;
  reasonCode: string;
}>> = {
  governance_voter_claim: {
    eventType: "governance_reward",
    protocolSurface: "reward_distributor",
    reasonCode: "explicitGovernanceVoterClaim",
  },
  governance_voting_escrow: {
    eventType: "lock_increased",
    protocolSurface: "voting_escrow",
    reasonCode: "explicitVotingEscrowSurface",
  },
  governance_vote: {
    eventType: "vote_cast",
    protocolSurface: "voter",
    reasonCode: "explicitVoterSurface",
  },
  governance_relay: {
    eventType: "relay_joined",
    protocolSurface: "relay",
    reasonCode: "explicitRelaySurface",
  },
  governance_bribe_claim: {
    eventType: "bribe_claim",
    protocolSurface: "briber",
    reasonCode: "explicitBriberSurface",
  },
  governance_fee_claim: {
    eventType: "fee_claim",
    protocolSurface: "fee_distributor",
    reasonCode: "explicitFeeDistributorSurface",
  },
  governance_rebase_claim: {
    eventType: "rebase_claim",
    protocolSurface: "reward_distributor",
    reasonCode: "explicitRebaseSurface",
  },
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.toLowerCase() : "";
}

function metadataText(metadata: Record<string, unknown> | null | undefined) {
  if (!metadata) return "";
  return Object.values(metadata)
    .filter((value) => typeof value === "string" || typeof value === "number")
    .join(" ")
    .toLowerCase();
}

function baseNoMatchClassification(reasonCode = "noExplicitGovernanceEvidence"): GovernanceClassification {
  return {
    isGovernance: false,
    eventType: null,
    protocolSurface: "unknown",
    coverageState: "unavailable",
    confidence: "none",
    reasonCodes: [reasonCode],
    evidenceBasis: [],
  };
}

function matchedClassification(input: {
  eventType: GovernanceEventType;
  protocolSurface: GovernanceProtocolSurface;
  reasonCodes: string[];
  evidenceBasis: string[];
  coverageState?: GovernanceCoverageState;
  confidence?: GovernanceConfidence;
}): GovernanceClassification {
  return {
    isGovernance: true,
    eventType: input.eventType,
    protocolSurface: input.protocolSurface,
    coverageState: input.coverageState ?? "full",
    confidence: input.confidence ?? "high",
    reasonCodes: input.reasonCodes,
    evidenceBasis: input.evidenceBasis,
  };
}

export function classifyGovernanceSurface(input: GovernanceClassificationInput): GovernanceClassification {
  if (input.surfaceKind === "airdrop_spam") {
    return baseNoMatchClassification("excludedAirdrop");
  }

  const surfaceMatch = input.surfaceKind ? GOVERNANCE_SURFACE_MAP[input.surfaceKind] : null;
  if (surfaceMatch) {
    return matchedClassification({
      eventType: surfaceMatch.eventType,
      protocolSurface: surfaceMatch.protocolSurface,
      reasonCodes: [surfaceMatch.reasonCode],
      evidenceBasis: [`surfaceKind:${input.surfaceKind}`],
    });
  }

  const text = [
    normalizeText(input.category),
    normalizeText(input.summary),
    normalizeText(input.protocol),
    normalizeText(input.methodLabel),
    normalizeText(input.rewardType),
    metadataText(input.metadataJson),
  ].join(" ");

  if (/\b(airdrop|spam|phishing)\b/.test(text)) {
    return baseNoMatchClassification("excludedAirdrop");
  }

  if (/\b(voting escrow|veaero|ve aero|lock)\b/.test(text)) {
    const eventType: GovernanceEventType = /\b(withdraw|expired|unlock)\b/.test(text)
      ? "lock_withdrawn"
      : /\b(extend|increase_unlock_time)\b/.test(text)
        ? "lock_extended"
        : /\b(create|new lock)\b/.test(text)
          ? "lock_created"
          : /\b(relock)\b/.test(text)
            ? "lock_relocked"
            : "lock_increased";
    return matchedClassification({
      eventType,
      protocolSurface: "voting_escrow",
      reasonCodes: ["votingEscrowTextEvidence"],
      evidenceBasis: ["text:voting_escrow"],
      coverageState: "partial",
      confidence: "medium",
    });
  }

  if (/\b(vote|voter|gauge vote)\b/.test(text)) {
    return matchedClassification({
      eventType: /\b(reset|poke)\b/.test(text) ? "vote_reset" : "vote_cast",
      protocolSurface: "voter",
      reasonCodes: ["voterTextEvidence"],
      evidenceBasis: ["text:voter"],
      coverageState: "partial",
      confidence: "medium",
    });
  }

  if (/\b(relay)\b/.test(text)) {
    return matchedClassification({
      eventType: /\b(exit|disable|leave)\b/.test(text) ? "relay_exited" : "relay_joined",
      protocolSurface: "relay",
      reasonCodes: ["relayTextEvidence"],
      evidenceBasis: ["text:relay"],
      coverageState: "partial",
      confidence: "medium",
    });
  }

  if (/\b(bribe|briber)\b/.test(text)) {
    return matchedClassification({
      eventType: "bribe_claim",
      protocolSurface: "briber",
      reasonCodes: ["briberTextEvidence"],
      evidenceBasis: ["text:briber"],
      coverageState: "partial",
      confidence: "medium",
    });
  }

  if (/\b(fee distributor|voting fee|fees)\b/.test(text)) {
    return matchedClassification({
      eventType: "fee_claim",
      protocolSurface: "fee_distributor",
      reasonCodes: ["feeDistributorTextEvidence"],
      evidenceBasis: ["text:fee_distributor"],
      coverageState: "partial",
      confidence: "medium",
    });
  }

  if (/\b(rebase)\b/.test(text)) {
    return matchedClassification({
      eventType: "rebase_claim",
      protocolSurface: "reward_distributor",
      reasonCodes: ["rebaseTextEvidence"],
      evidenceBasis: ["text:rebase"],
      coverageState: "partial",
      confidence: "medium",
    });
  }

  if (/\b(reward distributor|governance reward)\b/.test(text)) {
    return matchedClassification({
      eventType: "governance_reward",
      protocolSurface: "reward_distributor",
      reasonCodes: ["rewardDistributorTextEvidence"],
      evidenceBasis: ["text:reward_distributor"],
      coverageState: "partial",
      confidence: "medium",
    });
  }

  return baseNoMatchClassification();
}

export function isExplicitGovernanceEvidence(classification: GovernanceClassification) {
  return classification.isGovernance && classification.evidenceBasis.length > 0;
}
