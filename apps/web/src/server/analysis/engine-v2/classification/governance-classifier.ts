import type { AbiRegistryEntry, Address, MoralisDecodedTransaction } from "@/server/analysis/decoded-history";

import { normalizeAddress } from "@/server/analysis/decoded-history/address";

import { classifyBaseTransaction, type EngineV2Classification } from "./base-classifiers";
import { decodeCanonicalTransactionCalls, type EngineV2DecodedCall } from "./canonical-call-decoder";

function asString(value: unknown) {
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return typeof value === "string" && value.length > 0 ? value : null;
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

function flattenAddresses(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenAddresses(item));
  }

  const address = normalizeAddress(value);
  return address ? [address] : [];
}

function votingEscrowAddressFromRegistry(registry: Map<Address, AbiRegistryEntry>) {
  for (const [address, entry] of registry.entries()) {
    if (entry.expectedKind === "governance-lock" || entry.label === "VotingEscrow" || entry.source?.contractName === "VotingEscrow") {
      return address;
    }
  }
  return null;
}

function governanceClassificationFromCall(input: {
  call: EngineV2DecodedCall;
  registry: Map<Address, AbiRegistryEntry>;
}): EngineV2Classification | null {
  const functionName = input.call.functionName;
  if (!functionName) return null;

  const tokenId = firstTokenId(input.call.args);
  const votingEscrowAddress = votingEscrowAddressFromRegistry(input.registry);
  const evidence = {
    sourceClassifier: "engine-v2-governance",
    functionName,
    callPath: input.call.callPath,
    targetAddress: input.call.targetAddress || null,
    contractKind: input.call.entry?.expectedKind ?? null,
    noTimeWindowOwnershipInference: true,
    identityRule: "explicit_lock_token_id_or_governance_abi",
  } satisfies Record<string, unknown>;

  if (functionName === "vote") {
    return {
      eventType: "governance_vote",
      eventFamily: "governance",
      coverageStatus: tokenId ? "full" : "partial",
      confidence: "high",
      reasonCodes: tokenId ? [] : ["missing_lock_origin"],
      evidence,
      metadataJson: {
        tokenId,
        lockTokenId: tokenId,
        votingEscrowAddress,
      },
    };
  }

  if (functionName === "poke") {
    return {
      eventType: "governance_poke",
      eventFamily: "governance",
      coverageStatus: tokenId ? "full" : "partial",
      confidence: "high",
      reasonCodes: tokenId ? [] : ["missing_lock_origin"],
      evidence,
      metadataJson: {
        tokenId,
        lockTokenId: tokenId,
        votingEscrowAddress,
      },
    };
  }

  if (functionName === "depositManaged") {
    const managedTokenId = asString(input.call.args[1]);
    return {
      eventType: "governance_deposit_managed",
      eventFamily: "governance",
      coverageStatus: tokenId && managedTokenId ? "full" : "partial",
      confidence: "high",
      reasonCodes: tokenId && managedTokenId ? [] : ["missing_explicit_evidence"],
      evidence,
      metadataJson: {
        tokenId,
        lockTokenId: tokenId,
        managedTokenId,
        votingEscrowAddress,
      },
    };
  }

  if (functionName === "claimBribes" || functionName === "claimFees") {
    const distributorAddresses = Array.from(new Set(input.call.args.flatMap((arg) => flattenAddresses(arg))));
    const distributorAddress = distributorAddresses[0] ?? null;
    return {
      eventType: functionName === "claimBribes" ? "governance_bribe_claim" : "governance_fee_claim",
      eventFamily: "governance",
      coverageStatus: "partial",
      confidence: "high",
      reasonCodes: ["missing_distributor_pool_link"],
      evidence,
      metadataJson: {
        tokenId,
        lockTokenId: tokenId,
        votingEscrowAddress,
        distributorAddress,
        distributorAddresses,
        sourceContract: distributorAddress,
      },
    };
  }

  if (functionName === "claim" && input.call.entry?.expectedKind === "governance-rebase") {
    return {
      eventType: "governance_rebase_claim",
      eventFamily: "governance",
      coverageStatus: tokenId ? "full" : "partial",
      confidence: "high",
      reasonCodes: tokenId ? [] : ["missing_lock_origin"],
      evidence,
      metadataJson: {
        tokenId,
        lockTokenId: tokenId,
        votingEscrowAddress,
      },
    };
  }

  if (input.call.entry?.expectedKind === "governance-lock") {
    if (functionName === "createLock") {
      return {
        eventType: "governance_lock_created",
        eventFamily: "governance",
        coverageStatus: "full",
        confidence: "high",
        reasonCodes: [],
        evidence,
        metadataJson: { votingEscrowAddress: input.call.entry.address },
      };
    }
    if (functionName === "increaseAmount") {
      return {
        eventType: "governance_lock_increase",
        eventFamily: "governance",
        coverageStatus: "full",
        confidence: "high",
        reasonCodes: [],
        evidence,
        metadataJson: { votingEscrowAddress: input.call.entry.address },
      };
    }
    if (functionName === "increaseUnlockTime") {
      return {
        eventType: "governance_lock_extend",
        eventFamily: "governance",
        coverageStatus: tokenId ? "full" : "partial",
        confidence: "high",
        reasonCodes: tokenId ? [] : ["missing_lock_origin"],
        evidence,
        metadataJson: {
          tokenId,
          lockTokenId: tokenId,
          votingEscrowAddress: input.call.entry.address,
        },
      };
    }
    if (functionName === "withdraw") {
      return {
        eventType: "governance_lock_withdraw",
        eventFamily: "governance",
        coverageStatus: tokenId ? "full" : "partial",
        confidence: "high",
        reasonCodes: tokenId ? [] : ["missing_lock_origin"],
        evidence,
        metadataJson: {
          tokenId,
          lockTokenId: tokenId,
          votingEscrowAddress: input.call.entry.address,
        },
      };
    }
  }

  return null;
}

export function classifyGovernanceTransaction(input: {
  tx: MoralisDecodedTransaction;
  walletAddress: Address;
  registry: Map<Address, AbiRegistryEntry>;
}): EngineV2Classification | null {
  const decodedCalls = decodeCanonicalTransactionCalls({
    tx: input.tx,
    registry: input.registry,
  });
  const nativeClassification = decodedCalls
    .map((call) => governanceClassificationFromCall({ call, registry: input.registry }))
    .find((classification): classification is EngineV2Classification => Boolean(classification));
  if (nativeClassification) {
    return nativeClassification;
  }

  const classification = classifyBaseTransaction(input);
  if (!classification.eventType.startsWith("governance_")) return null;

  return {
    ...classification,
    eventFamily: "governance",
    evidence: {
      ...classification.evidence,
      identityRule: "explicit_lock_token_id_or_governance_abi",
      noTimeWindowOwnershipInference: true,
    },
  };
}

