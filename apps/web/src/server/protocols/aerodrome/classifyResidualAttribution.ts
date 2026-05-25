import { and, eq, inArray } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import { assetMovements, attributionSourceLots, attributionStates, ledgerEvents } from "@/server/db/schema";

export async function classifyResidualAttribution(input: {
  walletAddress: string;
  chainId: number;
  txHashes: string[];
}) {
  if (input.txHashes.length === 0) {
    return {
      sourceLotCount: 0,
      residualStateCount: 0,
    };
  }

  const db = getDb();
  const rows = await db
    .select({
      ledgerEventId: ledgerEvents.id,
      txHash: ledgerEvents.txHash,
      classification: ledgerEvents.classification,
      occurredAt: ledgerEvents.occurredAt,
      tokenAddress: assetMovements.tokenAddress,
      directionIn: assetMovements.directionIn,
      amountRaw: assetMovements.amountRaw,
      metadataJson: assetMovements.metadataJson,
    })
    .from(assetMovements)
    .innerJoin(ledgerEvents, eq(assetMovements.ledgerEventId, ledgerEvents.id))
    .where(
      and(
        eq(assetMovements.walletAddress, input.walletAddress.toLowerCase()),
        eq(assetMovements.chainId, input.chainId),
        inArray(ledgerEvents.txHash, input.txHashes.map((txHash) => txHash.toLowerCase())),
      ),
    );

  let sourceLotCount = 0;
  let residualStateCount = 0;

  for (const row of rows) {
    if (row.directionIn) {
      await db
        .insert(attributionSourceLots)
        .values({
          chainId: input.chainId,
          walletAddress: input.walletAddress.toLowerCase(),
          tokenAddress: row.tokenAddress.toLowerCase(),
          sourceType: row.classification ?? "other",
          sourceLedgerEventId: row.ledgerEventId,
          amountRaw: row.amountRaw,
          metadataJson: {
            txHash: row.txHash,
            occurredAt: row.occurredAt.toISOString(),
            ...(row.metadataJson ?? {}),
          },
        })
        .onConflictDoUpdate({
          target: [attributionSourceLots.chainId, attributionSourceLots.sourceLedgerEventId, attributionSourceLots.tokenAddress],
          set: {
            sourceType: row.classification ?? "other",
            amountRaw: row.amountRaw,
            metadataJson: {
              txHash: row.txHash,
              occurredAt: row.occurredAt.toISOString(),
              ...(row.metadataJson ?? {}),
            },
          },
        });
      sourceLotCount += 1;
      continue;
    }

    await db
      .delete(attributionStates)
      .where(
        and(
          eq(attributionStates.chainId, input.chainId),
          eq(attributionStates.walletAddress, input.walletAddress.toLowerCase()),
          eq(attributionStates.sourceLedgerEventId, row.ledgerEventId),
          eq(attributionStates.tokenAddress, row.tokenAddress.toLowerCase()),
        ),
      );

    await db.insert(attributionStates).values({
      chainId: input.chainId,
      walletAddress: input.walletAddress.toLowerCase(),
      poolId: null,
      tokenAddress: row.tokenAddress.toLowerCase(),
      sourceLedgerEventId: row.ledgerEventId,
      residualAmountRaw: row.amountRaw,
      resolutionStatus: row.classification?.startsWith("rebalance_") ? "resolved" : "still_waiting",
      metadataJson: {
        classification: row.classification,
        txHash: row.txHash,
        occurredAt: row.occurredAt.toISOString(),
        ...(row.metadataJson ?? {}),
      },
    });
    residualStateCount += 1;
  }

  return {
    sourceLotCount,
    residualStateCount,
  };
}