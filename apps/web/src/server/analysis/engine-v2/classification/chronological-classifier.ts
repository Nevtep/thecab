import type { AbiRegistryEntry, Address, MoralisDecodedTransaction } from "@/server/analysis/decoded-history";
import { dedupeDecodedTransactions, sortDecodedTransactionsChronologically } from "@/server/analysis/engine-v2/collection";

import { classifyBaseTransaction, type EngineV2Classification } from "./base-classifiers";
import { classifyGovernanceTransaction } from "./governance-classifier";
import { classifyManualDepositTransaction } from "./manual-deposit-classifier";
import { classifyStrategyTransaction } from "./strategy-classifier";

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
  const registry = input.registry ?? new Map();
  return sortDecodedTransactionsChronologically(dedupeDecodedTransactions(input.transactions)).map((tx, index): EngineV2ClassifiedTransaction => ({
    tx,
    sequenceIndex: index,
    classification: (
      classifyManualDepositTransaction({ tx, walletAddress: input.walletAddress, registry }) ??
      classifyStrategyTransaction({ tx, walletAddress: input.walletAddress, registry }) ??
      classifyGovernanceTransaction({ tx, walletAddress: input.walletAddress, registry }) ??
      classifyBaseTransaction({ tx, walletAddress: input.walletAddress, registry })
    ),
  }));
}
