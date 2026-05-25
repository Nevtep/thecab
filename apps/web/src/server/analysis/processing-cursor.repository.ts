import { and, eq } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import { processingCursors } from "@/server/db/schema";

export async function getProcessingCursor(walletAddress: string, chainId: number) {
  const db = getDb();
  const rows = await db
    .select()
    .from(processingCursors)
    .where(
      and(
        eq(processingCursors.walletAddress, walletAddress.toLowerCase()),
        eq(processingCursors.chainId, chainId),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function upsertProcessingCursor(input: {
  walletAddress: string;
  chainId: number;
  lastProcessedDayUtc?: string | null;
  lastProcessedBlockNumber?: string | null;
  lastSuccessfulRunId?: string | null;
  lastAdvancedAt?: Date | null;
  metadataJson?: Record<string, unknown>;
}) {
  const db = getDb();
  const [row] = await db
    .insert(processingCursors)
    .values({
      walletAddress: input.walletAddress.toLowerCase(),
      chainId: input.chainId,
      lastProcessedDayUtc: input.lastProcessedDayUtc ?? null,
      lastProcessedBlockNumber: input.lastProcessedBlockNumber ?? null,
      lastSuccessfulRunId: input.lastSuccessfulRunId ?? null,
      lastAdvancedAt:
        input.lastAdvancedAt === undefined
          ? input.lastProcessedDayUtc ? new Date() : null
          : input.lastAdvancedAt,
      metadataJson: input.metadataJson ?? {},
    })
    .onConflictDoUpdate({
      target: [processingCursors.chainId, processingCursors.walletAddress],
      set: {
        lastProcessedDayUtc: input.lastProcessedDayUtc ?? null,
        lastProcessedBlockNumber: input.lastProcessedBlockNumber ?? null,
        lastSuccessfulRunId: input.lastSuccessfulRunId ?? null,
        lastAdvancedAt:
          input.lastAdvancedAt === undefined
            ? input.lastProcessedDayUtc ? new Date() : null
            : input.lastAdvancedAt,
        metadataJson: input.metadataJson ?? {},
        updatedAt: new Date(),
      },
    })
    .returning();

  return row;
}