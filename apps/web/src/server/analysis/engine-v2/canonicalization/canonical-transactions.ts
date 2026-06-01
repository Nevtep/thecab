import type { MoralisDecodedTransaction } from "@/server/analysis/decoded-history";
import { canonicalTransactions } from "@/server/db/schema";

import { normalizeAddress, normalizeTxHash } from "../collection/history-normalizer";
import type { EngineV2Db } from "../repositories/types";

export function summarizeCanonicalTransactions(transactions: MoralisDecodedTransaction[]) {
  const providerRowCount = transactions.length;
  const distinctHashes = new Set(transactions.map((tx) => normalizeTxHash(tx.hash)).filter(Boolean));

  return {
    providerRowCount,
    distinctTxCount: distinctHashes.size,
    duplicateTxCount: providerRowCount - distinctHashes.size,
  };
}

export function toCanonicalTransactionValues(input: {
  chainId: number;
  walletAddress: string;
  transaction: MoralisDecodedTransaction;
  sourceEndpoint: string;
  providerPageId?: string | null;
  collectionRunId?: string | null;
}) {
  const tx = input.transaction;
  const txHash = normalizeTxHash(tx.hash);
  if (!txHash) throw new Error("CANONICAL_TX_HASH_MISSING");

  return {
    chainId: input.chainId,
    walletAddress: input.walletAddress.toLowerCase(),
    txHash,
    blockNumber: tx.block_number ?? "0",
    blockTimestamp: tx.block_timestamp ? new Date(tx.block_timestamp) : new Date(0),
    transactionIndex: Number(tx.transaction_index ?? 0),
    fromAddress: normalizeAddress(tx.from_address) || null,
    toAddress: normalizeAddress(tx.to_address) || null,
    valueNativeRaw: tx.value ?? "0",
    input: tx.input ?? null,
    receiptStatus: tx.receipt_status ?? "unknown",
    gasUsed: tx.receipt_gas_used ?? null,
    transactionFeeNative: tx.transaction_fee ?? null,
    decodedCallJson: tx.decoded_call ?? null,
    sourceEndpoint: input.sourceEndpoint,
    providerPageId: input.providerPageId ?? null,
    collectionRunId: input.collectionRunId ?? null,
    metadataJson: {
      blockHash: tx.block_hash ?? null,
      nonce: tx.nonce ?? null,
      gas: tx.gas ?? null,
      gasPrice: tx.gas_price ?? null,
    },
  };
}

export async function upsertCanonicalTransaction(input: {
  db: EngineV2Db;
  chainId: number;
  walletAddress: string;
  transaction: MoralisDecodedTransaction;
  sourceEndpoint: string;
  providerPageId?: string | null;
  collectionRunId?: string | null;
}) {
  const values = toCanonicalTransactionValues(input);
  const [row] = await input.db
    .insert(canonicalTransactions)
    .values(values)
    .onConflictDoUpdate({
      target: [
        canonicalTransactions.chainId,
        canonicalTransactions.walletAddress,
        canonicalTransactions.txHash,
      ],
      set: {
        blockNumber: values.blockNumber,
        blockTimestamp: values.blockTimestamp,
        transactionIndex: values.transactionIndex,
        fromAddress: values.fromAddress,
        toAddress: values.toAddress,
        valueNativeRaw: values.valueNativeRaw,
        input: values.input,
        receiptStatus: values.receiptStatus,
        gasUsed: values.gasUsed,
        transactionFeeNative: values.transactionFeeNative,
        decodedCallJson: values.decodedCallJson,
        sourceEndpoint: values.sourceEndpoint,
        providerPageId: values.providerPageId,
        collectionRunId: values.collectionRunId,
        metadataJson: values.metadataJson,
        canonicalizedAt: new Date(),
      },
    })
    .returning();

  return row;
}
