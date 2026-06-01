import type { AbiRegistryEntry, Address, MoralisDecodedTransaction } from "@/server/analysis/decoded-history";
import { sortDecodedTransactionsChronologically } from "@/server/analysis/engine-v2/collection";

import { classifyBaseTransaction, type EngineV2Classification } from "./base-classifiers";

export type EngineV2ClassifiedTransaction = {
  tx: MoralisDecodedTransaction;
  sequenceIndex: number;
  classification: EngineV2Classification;
};

export function classifyTransactionsChronologically(input: {
  transactions: MoralisDecodedTransaction[];
  walletAddress: Address;
  registry?: Map<Address, AbiRegistryEntry>;
}) {
  return sortDecodedTransactionsChronologically(input.transactions).map((tx, index): EngineV2ClassifiedTransaction => ({
    tx,
    sequenceIndex: index,
    classification: classifyBaseTransaction({
      tx,
      walletAddress: input.walletAddress,
      registry: input.registry ?? new Map(),
    }),
  }));
}

