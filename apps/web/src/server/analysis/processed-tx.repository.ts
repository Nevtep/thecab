import { and, eq, gt, inArray } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import { processedTxs } from "@/server/db/schema";

export async function listProcessedTxs(input: {
  walletAddress: string;
  chainId: number;
  txHashes?: string[];
}) {
  const db = getDb();
  const predicates = [
    eq(processedTxs.walletAddress, input.walletAddress.toLowerCase()),
    eq(processedTxs.chainId, input.chainId),
  ];

  if (input.txHashes && input.txHashes.length > 0) {
    predicates.push(inArray(processedTxs.txHash, input.txHashes.map((txHash) => txHash.toLowerCase())));
  }

  return db.select().from(processedTxs).where(and(...predicates));
}

export async function listSoftReorgProcessedTxs(input: {
  chainId: number;
  walletAddress: string;
  minimumBlockNumberExclusive: string;
}) {
  const db = getDb();
  return db
    .select()
    .from(processedTxs)
    .where(
      and(
        eq(processedTxs.chainId, input.chainId),
        eq(processedTxs.walletAddress, input.walletAddress.toLowerCase()),
        gt(processedTxs.blockNumber, input.minimumBlockNumberExclusive),
      ),
    );
}

export async function insertProcessedTxs(
  rows: Array<{
    chainId: number;
    txHash: string;
    walletAddress: string;
    blockNumber: string;
    firstRunId: string;
    firstSliceId: string;
    processedAtUtc?: Date;
  }>,
) {
  if (rows.length === 0) {
    return [];
  }

  const db = getDb();
  return db
    .insert(processedTxs)
    .values(
      rows.map((row) => ({
        ...row,
        txHash: row.txHash.toLowerCase(),
        walletAddress: row.walletAddress.toLowerCase(),
        processedAtUtc: row.processedAtUtc ?? new Date(),
      })),
    )
    .onConflictDoNothing()
    .returning();
}