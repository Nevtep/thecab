import type { AbiRegistryEntry, Address, MoralisDecodedTransaction } from "@/server/analysis/decoded-history";

import { classifyBaseTransaction, type EngineV2Classification } from "./base-classifiers";

export function classifyGovernanceTransaction(input: {
  tx: MoralisDecodedTransaction;
  walletAddress: Address;
  registry: Map<Address, AbiRegistryEntry>;
}): EngineV2Classification | null {
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

