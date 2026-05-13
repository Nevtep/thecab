import { and, desc, eq } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import { analysisRuns } from "@/server/db/schema";

type AnalysisRunInput = {
  walletAddress: string;
  chainId: number;
  mode: "full_history" | "incremental";
};

export async function createAnalysisRun(input: AnalysisRunInput) {
  const db = getDb();
  const [row] = await db
    .insert(analysisRuns)
    .values({
      walletAddress: input.walletAddress.toLowerCase(),
      chainId: input.chainId,
      mode: input.mode,
      status: "queued",
      stage: "queued",
      progressPct: 0,
    })
    .returning();

  return row;
}

export async function getLatestAnalysisRun(walletAddress: string, chainId: number) {
  const db = getDb();
  const rows = await db
    .select()
    .from(analysisRuns)
    .where(
      and(
        eq(analysisRuns.walletAddress, walletAddress.toLowerCase()),
        eq(analysisRuns.chainId, chainId),
      ),
    )
    .orderBy(desc(analysisRuns.createdAt))
    .limit(1);

  return rows[0] ?? null;
}

export async function updateAnalysisRunProgress(
  runId: string,
  input: { status: string; stage: string; progressPct: number; lastError?: string | null },
) {
  const db = getDb();
  const [row] = await db
    .update(analysisRuns)
    .set({
      status: input.status,
      stage: input.stage,
      progressPct: input.progressPct,
      lastError: input.lastError ?? null,
      completedAt: input.status === "ready" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(analysisRuns.id, runId))
    .returning();

  return row;
}
