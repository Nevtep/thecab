import {
  buildClassifiedDecodedTransaction,
  type AbiRegistryEntry,
  type Address,
  type ClassifiedDecodedTransaction,
  type MoralisDecodedTransaction,
} from "@/server/analysis/decoded-history";

import { decodeCanonicalTransactionCalls } from "./canonical-call-decoder";

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

function toJsonSafeValue(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map((item) => toJsonSafeValue(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toJsonSafeValue(item)]));
  }
  return value ?? null;
}

function firstTokenId(value: unknown): string | null {
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number" && Number.isInteger(value)) return String(value);
  if (typeof value === "string" && /^\d+$/.test(value)) return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const tokenId = firstTokenId(item);
      if (tokenId) return tokenId;
    }
  }
  return null;
}

function firstStructuredTokenId(value: unknown): string | null {
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number" && Number.isInteger(value)) return String(value);
  if (typeof value === "string" && /^\d+$/.test(value)) return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const tokenId = firstStructuredTokenId(item);
      if (tokenId) return tokenId;
    }
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      const tokenId = firstStructuredTokenId(item);
      if (tokenId) return tokenId;
    }
  }
  return null;
}

function explicitCollectTokenId(input: {
  tx: MoralisDecodedTransaction;
  registry: Map<Address, AbiRegistryEntry>;
}) {
  const collectTokenIds = Array.from(new Set(
    decodeCanonicalTransactionCalls(input)
      .filter((call) => call.functionName === "collect")
      .map((call) => firstStructuredTokenId(call.args))
      .filter((tokenId): tokenId is string => Boolean(tokenId)),
  ));

  return collectTokenIds.length === 1 ? collectTokenIds[0] : null;
}

function extractDeterministicTokenId(snapshot: ClassifiedDecodedTransaction) {
  switch (snapshot.classification) {
    case "manual_pool_deposit_router":
    case "manual_pool_withdraw_router":
    case "manual_gauge_stake":
    case "manual_gauge_unstake":
      return null;
    default:
      return firstTokenId(toJsonSafeValue(Array.from(snapshot.decodedArgs)));
  }
}

export function classificationFromSnapshot(snapshot: ClassifiedDecodedTransaction): EngineV2Classification {
  const decodedArgs = toJsonSafeValue(Array.from(snapshot.decodedArgs));
  const tokenId = extractDeterministicTokenId(snapshot);

  return {
    eventType: snapshot.classification,
    eventFamily: eventFamilyForClassification(snapshot.classification),
    coverageStatus: coverageForClassification(snapshot),
    confidence: confidenceForClassification(snapshot.confidence),
    reasonCodes: snapshot.needsResolution ? ["missing_explicit_evidence"] : [],
    evidence: {
      reason: snapshot.reason,
      sourceClassifier: "decoded-history-snapshot",
      rawConfidence: snapshot.confidence,
      needsResolution: snapshot.needsResolution,
      selector: snapshot.selector,
      contractLabel: snapshot.contractLabel,
      contractName: snapshot.contractName,
      decodedFunction: snapshot.decodedFunction,
      decodedArgs,
      tokenId,
      transferCount: snapshot.transferCount,
      inboundTransferCount: snapshot.inboundTransferCount,
      outboundTransferCount: snapshot.outboundTransferCount,
      approvalCount: snapshot.approvalCount,
    },
    metadataJson: {
      selector: snapshot.selector,
      contractLabel: snapshot.contractLabel,
      contractName: snapshot.contractName,
      decodedFunction: snapshot.decodedFunction,
      decodedArgs,
      tokenId,
      transferCount: snapshot.transferCount,
      inboundTransferCount: snapshot.inboundTransferCount,
      outboundTransferCount: snapshot.outboundTransferCount,
      approvalCount: snapshot.approvalCount,
    },
  };
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

  const snapshot = buildClassifiedDecodedTransaction({
    tx: input.tx,
    walletAddress: input.walletAddress,
    registry: input.registry ?? new Map(),
  });
  const classification = classificationFromSnapshot(snapshot);

  if (classification.eventType === "manual_position_fee_claim") {
    const collectTokenId = explicitCollectTokenId({
      tx: input.tx,
      registry: input.registry ?? new Map(),
    });

    if (collectTokenId) {
      classification.evidence = {
        ...classification.evidence,
        tokenId: collectTokenId,
      };
      classification.metadataJson = {
        ...(classification.metadataJson ?? {}),
        tokenId: collectTokenId,
      };
    }
  }

  return classification;
}
