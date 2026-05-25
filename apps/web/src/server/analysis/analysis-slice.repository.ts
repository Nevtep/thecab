import { and, asc, desc, eq, sql } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import { analysisSlices } from "@/server/db/schema";

export type AnalysisSliceStatus = "queued" | "running" | "complete" | "skipped_cached" | "failed";

export type AnalysisSliceProgressRow = {
  id: string;
  sliceIndex: number;
  status: AnalysisSliceStatus;
  sliceStartUtc: Date;
  sliceEndUtc: Date;
  txCountSeen: number;
  txCountProcessed: number;
  coverageReasonsJson: string[];
  startedAt: Date | null;
  completedAt: Date | null;
};

export async function createAnalysisSlices(
  slices: Array<{
    runId: string;
    walletAddress: string;
    chainId: number;
    sliceIndex: number;
    sliceStartUtc: Date;
    sliceEndUtc: Date;
  }>,
) {
  if (slices.length === 0) {
    return [];
  }

  const db = getDb();
  return db
    .insert(analysisSlices)
    .values(
      slices.map((slice) => ({
        ...slice,
        walletAddress: slice.walletAddress.toLowerCase(),
      })),
    )
    .returning();
}

export async function listRunSlices(runId: string) {
  const db = getDb();
  return db
    .select()
    .from(analysisSlices)
    .where(eq(analysisSlices.runId, runId))
    .orderBy(asc(analysisSlices.sliceIndex));
}

export async function listRunSliceProgress(runId: string): Promise<AnalysisSliceProgressRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: analysisSlices.id,
      sliceIndex: analysisSlices.sliceIndex,
      status: analysisSlices.status,
      sliceStartUtc: analysisSlices.sliceStartUtc,
      sliceEndUtc: analysisSlices.sliceEndUtc,
      txCountSeen: analysisSlices.txCountSeen,
      txCountProcessed: analysisSlices.txCountProcessed,
      coverageReasonsJson: analysisSlices.coverageReasonsJson,
      startedAt: analysisSlices.startedAt,
      completedAt: analysisSlices.completedAt,
    })
    .from(analysisSlices)
    .where(eq(analysisSlices.runId, runId))
    .orderBy(asc(analysisSlices.sliceIndex));

  return rows.map((row) => ({
    ...row,
    status: row.status as AnalysisSliceStatus,
    coverageReasonsJson: row.coverageReasonsJson ?? [],
  }));
}

export async function getAnalysisSlice(sliceId: string) {
  const db = getDb();
  const rows = await db.select().from(analysisSlices).where(eq(analysisSlices.id, sliceId)).limit(1);
  return rows[0] ?? null;
}

export async function findAnalysisSliceByWindow(input: {
  walletAddress: string;
  chainId: number;
  sliceStartUtc: Date;
  sliceEndUtc: Date;
}) {
  const db = getDb();
  const rows = await db
    .select()
    .from(analysisSlices)
    .where(
      and(
        eq(analysisSlices.walletAddress, input.walletAddress.toLowerCase()),
        eq(analysisSlices.chainId, input.chainId),
        eq(analysisSlices.sliceStartUtc, input.sliceStartUtc),
        eq(analysisSlices.sliceEndUtc, input.sliceEndUtc),
      ),
    )
    .orderBy(desc(analysisSlices.createdAt))
    .limit(1);

  return rows[0] ?? null;
}

export async function updateAnalysisSlice(input: {
  sliceId: string;
  status?: AnalysisSliceStatus;
  coverageReasonsJson?: string[];
  providerAttemptsJson?: Record<string, number>;
  txCountSeen?: number;
  txCountProcessed?: number;
  startedAt?: Date | null;
  completedAt?: Date | null;
  incrementAttemptCount?: boolean;
}) {
  const db = getDb();
  const [row] = await db
    .update(analysisSlices)
    .set({
      status: input.status,
      coverageReasonsJson: input.coverageReasonsJson,
      providerAttemptsJson: input.providerAttemptsJson,
      txCountSeen: input.txCountSeen,
      txCountProcessed: input.txCountProcessed,
      startedAt: input.startedAt === undefined ? undefined : input.startedAt,
      completedAt: input.completedAt === undefined ? undefined : input.completedAt,
      attemptCount: input.incrementAttemptCount
        ? sql`${analysisSlices.attemptCount} + 1`
        : undefined,
      updatedAt: new Date(),
    })
    .where(eq(analysisSlices.id, input.sliceId))
    .returning();

  return row ?? null;
}