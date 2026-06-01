import type { AbiRegistryEntry, Address, MoralisDecodedTransaction } from "@/server/analysis/decoded-history";
import { classifyDecodedTransaction } from "@/server/analysis/decoded-history";

export type EngineV2Classification = {
  eventType: string;
  eventFamily: string;
  coverageStatus: "full" | "partial" | "unresolved" | "unsupported" | "excluded";
  confidence: "high" | "medium" | "low" | "none";
  reasonCodes: string[];
  evidence: Record<string, unknown>;
  metadataJson?: Record<string, unknown>;
};

const FAMILY_BY_PREFIX: Array<[string, string]> = [
  ["governance_", "governance"],
  ["strategy_", "strategy"],
  ["manual_", "deposit"],
  ["approval_", "approval"],
  ["cash_", "cashflow"],
  ["swap", "swap"],
  ["failed_", "activity"],
];

export function eventFamilyForClassification(classification: string) {
  return FAMILY_BY_PREFIX.find(([prefix]) => classification.startsWith(prefix))?.[1] ?? "activity";
}

export function coverageForClassification(input: { classification: string; needsResolution: boolean }) {
  if (input.classification.startsWith("unsupported")) return "unsupported";
  if (input.classification.includes("airdrop") || input.classification.includes("spam")) return "excluded";
  if (input.needsResolution) return "partial";
  if (input.classification === "unclassified_transaction") return "unresolved";
  return "full";
}

export function confidenceForClassification(confidence: string): EngineV2Classification["confidence"] {
  if (confidence.startsWith("high")) return "high";
  if (confidence.startsWith("medium")) return "medium";
  if (confidence.startsWith("low")) return "low";
  return "none";
}

export function classifyBaseTransaction(input: {
  tx: MoralisDecodedTransaction;
  walletAddress: Address;
  registry?: Map<Address, AbiRegistryEntry>;
}): EngineV2Classification {
  const providerFlags = input.tx as MoralisDecodedTransaction & {
    possible_spam?: boolean;
    possibleSpam?: boolean;
    airdrop?: boolean;
  };
  if (providerFlags.possible_spam === true || providerFlags.possibleSpam === true) {
    return {
      eventType: "excluded_spam",
      eventFamily: "activity",
      coverageStatus: "excluded",
      confidence: "high",
      reasonCodes: ["excluded_spam"],
      evidence: { source: "provider_flag" },
    };
  }
  if (providerFlags.airdrop === true) {
    return {
      eventType: "excluded_airdrop",
      eventFamily: "activity",
      coverageStatus: "excluded",
      confidence: "high",
      reasonCodes: ["excluded_airdrop"],
      evidence: { source: "explicit_airdrop_flag" },
    };
  }

  const result = classifyDecodedTransaction({
    tx: input.tx,
    walletAddress: input.walletAddress,
    registry: input.registry ?? new Map(),
  });

  return {
    eventType: result.classification,
    eventFamily: eventFamilyForClassification(result.classification),
    coverageStatus: coverageForClassification(result),
    confidence: confidenceForClassification(result.confidence),
    reasonCodes: result.needsResolution ? ["missing_explicit_evidence"] : [],
    evidence: {
      reason: result.reason,
      sourceClassifier: "decoded-history",
      rawConfidence: result.confidence,
      needsResolution: result.needsResolution,
    },
  };
}
