import type { AbiRegistryEntry, Address, MoralisDecodedTransaction } from "@/server/analysis/decoded-history";

import { classifyBaseTransaction, type EngineV2Classification } from "./base-classifiers";

export function classifyStrategyTransaction(input: {
  tx: MoralisDecodedTransaction;
  walletAddress: Address;
  registry: Map<Address, AbiRegistryEntry>;
}): EngineV2Classification | null {
  const classification = classifyBaseTransaction(input);
  if (!classification.eventType.startsWith("strategy_")) return null;

  return {
    ...classification,
    eventFamily: "strategy",
    evidence: {
      ...classification.evidence,
      identityRule: "explicit_wrapper_or_share_contract",
      manualDepositExcluded: true,
    },
  };
}

