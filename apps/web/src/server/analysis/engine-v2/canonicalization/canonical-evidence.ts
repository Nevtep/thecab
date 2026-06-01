import type { MoralisDecodedTransaction } from "@/server/analysis/decoded-history";
import {
  canonicalInternalTransactions,
  canonicalTransactionLogs,
} from "@/server/db/schema";

import type { EngineV2Db } from "../repositories/types";

export function canonicalLogValues(transaction: MoralisDecodedTransaction) {
  return (transaction.logs ?? []).map((log, index) => ({
    txHash: transaction.hash.toLowerCase(),
    logIndex: Number(log.log_index ?? index),
    address: log.address?.toLowerCase() ?? "",
    topic0: log.topic0 ?? null,
    topic1: log.topic1 ?? null,
    topic2: log.topic2 ?? null,
    topic3: log.topic3 ?? null,
    data: log.data ?? null,
    decodedEventJson: log.decoded_event ?? null,
    rawJson: log as Record<string, unknown>,
  }));
}

export function canonicalInternalTransactionValues(transaction: MoralisDecodedTransaction) {
  return (transaction.internal_transactions ?? []).map((internalTx, index) => ({
    txHash: transaction.hash.toLowerCase(),
    traceIndex: index,
    fromAddress: internalTx.from?.toLowerCase() ?? null,
    toAddress: internalTx.to?.toLowerCase() ?? null,
    valueNativeRaw: internalTx.value ?? "0",
    callType: internalTx.type ?? null,
    error: internalTx.error ?? null,
    rawJson: internalTx as Record<string, unknown>,
  }));
}

export async function persistCanonicalEvidence(input: {
  db: EngineV2Db;
  canonicalTransactionId: string;
  chainId: number;
  transaction: MoralisDecodedTransaction;
}) {
  const logs = canonicalLogValues(input.transaction);
  const internalTransactions = canonicalInternalTransactionValues(input.transaction);

  if (logs.length > 0) {
    await input.db
      .insert(canonicalTransactionLogs)
      .values(logs.map((log) => ({
        ...log,
        canonicalTransactionId: input.canonicalTransactionId,
        chainId: input.chainId,
      })))
      .onConflictDoNothing();
  }

  if (internalTransactions.length > 0) {
    await input.db
      .insert(canonicalInternalTransactions)
      .values(internalTransactions.map((internalTx) => ({
        ...internalTx,
        canonicalTransactionId: input.canonicalTransactionId,
        chainId: input.chainId,
      })))
      .onConflictDoNothing();
  }

  return {
    logCount: logs.length,
    internalTransactionCount: internalTransactions.length,
  };
}
