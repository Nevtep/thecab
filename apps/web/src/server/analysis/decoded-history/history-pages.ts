import type { MoralisDecodedTransaction } from "./types";

export type MoralisDecodedTransactionsPage = {
  cursor?: string | null;
  result?: MoralisDecodedTransaction[];
};

export function decodedTransactionsFromPagePayload(payload: unknown): MoralisDecodedTransaction[] {
  if (Array.isArray(payload)) return payload as MoralisDecodedTransaction[];
  if (payload && typeof payload === "object" && Array.isArray((payload as MoralisDecodedTransactionsPage).result)) {
    return (payload as MoralisDecodedTransactionsPage).result ?? [];
  }
  return [];
}

export function sortDecodedTransactionsChronologically(transactions: MoralisDecodedTransaction[]) {
  return [...transactions].sort((a, b) => {
    const time = new Date(a.block_timestamp ?? 0).getTime() - new Date(b.block_timestamp ?? 0).getTime();
    if (time !== 0) return time;
    return Number(a.transaction_index ?? 0) - Number(b.transaction_index ?? 0);
  });
}

export function dedupeDecodedTransactions(transactions: MoralisDecodedTransaction[]) {
  const seen = new Set<string>();
  const deduped: MoralisDecodedTransaction[] = [];
  for (const tx of transactions) {
    if (seen.has(tx.hash)) continue;
    seen.add(tx.hash);
    deduped.push(tx);
  }
  return deduped;
}
