import type { AbiRegistryEntry, Address, MoralisDecodedTransaction } from "@/server/analysis/decoded-history";

import { classifyBaseTransaction, type EngineV2Classification } from "./base-classifiers";

export function classifyManualDepositTransaction(input: {
  tx: MoralisDecodedTransaction;
  walletAddress: Address;
  registry: Map<Address, AbiRegistryEntry>;
}): EngineV2Classification | null {
  const classification = classifyBaseTransaction(input);
  if (!classification.eventType.startsWith("manual_")) return null;

  return {
    ...classification,
    eventFamily: "deposit",
    evidence: {
      ...classification.evidence,
      identityRule: "explicit_token_id_or_position_manager_call",
      governanceInternalLogGuard: true,
    },
  };
}

