import { topicAddress, ZERO_ADDRESS, type MoralisDecodedLog, type MoralisDecodedTransaction } from "@/server/analysis/decoded-history";
import { canonicalAssetMovements } from "@/server/db/schema";

import type { EngineV2Db } from "../repositories/types";

function getDecodedParam(log: MoralisDecodedLog, name: string) {
  return log.decoded_event?.params?.find((param) => param.name === name)?.value ?? null;
}

export function extractCanonicalMovements(input: {
  walletAddress: string;
  transaction: MoralisDecodedTransaction;
}) {
  const walletAddress = input.walletAddress.toLowerCase();
  const movements: Array<Omit<
    typeof canonicalAssetMovements.$inferInsert,
    "id" | "canonicalTransactionId" | "chainId" | "walletAddress"
  >> = [];
  const tx = input.transaction;

  if (tx.value && tx.value !== "0") {
    movements.push({
      assetType: "native",
      txHash: tx.hash.toLowerCase(),
      movementIndex: movements.length,
      fromAddress: tx.from_address?.toLowerCase() ?? null,
      toAddress: tx.to_address?.toLowerCase() ?? null,
      amountRaw: tx.value,
      direction: tx.to_address?.toLowerCase() === walletAddress ? "in" : "out",
      movementKind: "native_transfer",
      evidenceJson: { source: "transaction.value" },
    });
  }

  for (const log of tx.logs ?? []) {
    if (log.decoded_event?.label !== "Transfer") continue;
    const from = (getDecodedParam(log, "from") ?? topicAddress(log.topic1)).toLowerCase();
    const to = (getDecodedParam(log, "to") ?? topicAddress(log.topic2)).toLowerCase();
    const amount = getDecodedParam(log, "amount") ?? getDecodedParam(log, "value") ?? null;
    const tokenId = getDecodedParam(log, "tokenId") ?? (log.topic3 ? BigInt(log.topic3).toString() : null);
    const isErc721 = amount === null && tokenId !== null;

    movements.push({
      assetType: isErc721 ? "erc721" : "erc20",
      txHash: tx.hash.toLowerCase(),
      movementIndex: movements.length,
      tokenAddress: log.address?.toLowerCase() ?? null,
      tokenId,
      fromAddress: from || null,
      toAddress: to || null,
      amountRaw: amount ?? (isErc721 ? "1" : null),
      direction: to === walletAddress ? "in" : from === walletAddress ? "out" : "internal",
      movementKind: from === ZERO_ADDRESS ? "mint" : to === ZERO_ADDRESS ? "burn" : "transfer",
      evidenceJson: { logIndex: log.log_index ?? null, decodedEvent: log.decoded_event },
    });
  }

  for (const internalTx of tx.internal_transactions ?? []) {
    if (!internalTx.value || internalTx.value === "0") continue;
    movements.push({
      assetType: "native",
      txHash: tx.hash.toLowerCase(),
      movementIndex: movements.length,
      fromAddress: internalTx.from?.toLowerCase() ?? null,
      toAddress: internalTx.to?.toLowerCase() ?? null,
      amountRaw: internalTx.value,
      direction: internalTx.to?.toLowerCase() === walletAddress ? "in" : internalTx.from?.toLowerCase() === walletAddress ? "out" : "internal",
      movementKind: internalTx.error ? "failed_internal_transfer" : "internal_transfer",
      evidenceJson: { source: "internal_transaction", error: internalTx.error ?? null },
    });
  }

  return movements;
}

export async function persistCanonicalMovements(input: {
  db: EngineV2Db;
  canonicalTransactionId: string;
  chainId: number;
  walletAddress: string;
  transaction: MoralisDecodedTransaction;
}) {
  const movements = extractCanonicalMovements({
    walletAddress: input.walletAddress,
    transaction: input.transaction,
  });

  if (movements.length === 0) {
    return { movementCount: 0 };
  }

  await input.db
    .insert(canonicalAssetMovements)
    .values(movements.map((movement) => ({
      ...movement,
      canonicalTransactionId: input.canonicalTransactionId,
      chainId: input.chainId,
      walletAddress: input.walletAddress.toLowerCase(),
    })))
    .onConflictDoNothing();

  return { movementCount: movements.length };
}
