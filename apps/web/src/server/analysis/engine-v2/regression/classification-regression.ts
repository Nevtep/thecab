import { classifyTransactionsChronologically } from "@/server/analysis/engine-v2/classification";
import { parseMoralisDecodedHistoryPage } from "@/server/analysis/engine-v2/collection";

import { loadMoralisDecodedHistoryFixtures } from "./fixtures";

export function runClassificationRegression(input: { fixtureDirectory?: string; walletAddress?: string }) {
  const pages = loadMoralisDecodedHistoryFixtures(input.fixtureDirectory)
    .filter((page) => /^address-transactions-decoded-page\d+-response\.json$/.test(page.fileName));
  if (pages.length === 0) {
    throw new Error("ENGINE_V2_CLASSIFICATION_FIXTURES_NOT_FOUND");
  }

  const transactions = pages.flatMap((page) => parseMoralisDecodedHistoryPage(page.payload).transactions);
  const walletAddress = input.walletAddress ?? inferMostObservedWalletAddress(transactions);
  if (!walletAddress) {
    throw new Error("ENGINE_V2_CLASSIFICATION_WALLET_NOT_RESOLVED");
  }
  const classified = classifyTransactionsChronologically({
    transactions,
    walletAddress: walletAddress as `0x${string}`,
    registry: new Map(),
  });
  const families = new Set(classified.map((item) => item.classification.eventFamily));
  const unresolvedCount = classified.filter((item) => item.classification.coverageStatus === "partial" || item.classification.coverageStatus === "unresolved").length;

  if (classified.length !== transactions.length) {
    throw new Error("ENGINE_V2_CLASSIFICATION_COUNT_MISMATCH");
  }
  if (families.size === 0) {
    throw new Error("ENGINE_V2_CLASSIFICATION_EMPTY_FAMILIES");
  }

  return {
    transactionCount: classified.length,
    walletAddress,
    families: [...families].sort(),
    unresolvedCount,
  };
}

function inferMostObservedWalletAddress(transactions: Array<{ from_address?: string | null; to_address?: string | null }>) {
  const counts = new Map<string, number>();
  for (const tx of transactions) {
    for (const address of [tx.from_address, tx.to_address]) {
      if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) continue;
      const normalized = address.toLowerCase();
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}
