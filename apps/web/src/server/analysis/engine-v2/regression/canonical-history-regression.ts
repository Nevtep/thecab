import {
  parseMoralisDecodedHistoryPage,
  sortDecodedTransactionsChronologically,
} from "@/server/analysis/engine-v2/collection";
import { summarizeCanonicalTransactions } from "@/server/analysis/engine-v2/canonicalization";

import { loadMoralisDecodedHistoryFixtures, type EngineV2FixturePage } from "./fixtures";

export type CanonicalHistoryRegressionResult = {
  fixturePageCount: number;
  providerRowCount: number;
  distinctTxCount: number;
  duplicateTxCount: number;
  chronological: boolean;
};

function selectCanonicalHistoryFixtures(pages: EngineV2FixturePage[]) {
  const paginatedFixtures = pages.filter((page) => /^address-transactions-decoded-page\d+-response\.json$/.test(page.fileName));
  return paginatedFixtures.length > 0 ? paginatedFixtures : pages;
}

export function runCanonicalHistoryRegression(fixtureDirectory?: string): CanonicalHistoryRegressionResult {
  const pages = selectCanonicalHistoryFixtures(loadMoralisDecodedHistoryFixtures(fixtureDirectory));
  if (pages.length === 0) {
    throw new Error("ENGINE_V2_CANONICAL_HISTORY_FIXTURES_NOT_FOUND");
  }

  const transactions = pages.flatMap((page) => parseMoralisDecodedHistoryPage(page.payload).transactions);
  const summary = summarizeCanonicalTransactions(transactions);
  const sorted = sortDecodedTransactionsChronologically(transactions);
  const chronological = sorted.every((transaction, index) => {
    const previous = sorted[index - 1];
    if (!previous) return true;
    const previousTime = new Date(previous.block_timestamp ?? 0).getTime();
    const currentTime = new Date(transaction.block_timestamp ?? 0).getTime();
    if (previousTime !== currentTime) return previousTime <= currentTime;

    return Number(previous.transaction_index ?? 0) <= Number(transaction.transaction_index ?? 0);
  });

  if (summary.providerRowCount < summary.distinctTxCount) {
    throw new Error("ENGINE_V2_PROVIDER_ROWS_LESS_THAN_DISTINCT_TXS");
  }
  if (summary.duplicateTxCount !== summary.providerRowCount - summary.distinctTxCount) {
    throw new Error("ENGINE_V2_DUPLICATE_TX_COUNT_MISMATCH");
  }
  if (!chronological) {
    throw new Error("ENGINE_V2_CANONICAL_HISTORY_NOT_CHRONOLOGICAL");
  }

  return {
    fixturePageCount: pages.length,
    ...summary,
    chronological,
  };
}

