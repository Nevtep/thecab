import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";

import type { AnalysisSliceProgressRow } from "@/server/analysis/analysis-slice.repository";
import { getDb } from "@/server/db/client";
import { analysisRuns, analysisSlices, walletContexts } from "@/server/db/schema";

export type AnalysisRunStatus = "queued" | "running" | "complete" | "failed" | "cancelled";
export type AnalysisRunCoverage = "full" | "partial" | "unknown";

type AnalysisStatusContextRun = {
  id: string;
  walletAddress: string;
  chainId: number;
  status: string;
  mode: string;
  stage: string;
  progressPct: number;
  triggeredAtUtc: Date;
  completedAt: Date | null;
  updatedAt: Date;
  coverageReasonsJson: string[];
  lastError: string | null;
};

type AnalysisStatusContextFreshness = {
  lastAnalyzedAt: Date | null;
  lastSuccessfulRunId: string | null;
};

type AnalysisRunInput = {
  walletAddress: string;
  chainId: number;
  mode: "full_history" | "incremental";
  triggeredAtUtc?: Date;
};

function toUtcDayBucket(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function createAnalysisRun(input: AnalysisRunInput) {
  const db = getDb();
  const triggeredAtUtc = input.triggeredAtUtc ?? new Date();
  const [row] = await db
    .insert(analysisRuns)
    .values({
      walletAddress: input.walletAddress.toLowerCase(),
      chainId: input.chainId,
      mode: input.mode,
      status: "queued",
      stage: "queued",
      progressPct: 0,
      triggeredAtUtc,
      utcDayBucket: toUtcDayBucket(triggeredAtUtc),
      coverage: "unknown",
      coverageReasonsJson: [],
    })
    .returning();

  return row;
}

export async function findLatestCompletedAnalysisRun(walletAddress: string, chainId: number) {
  const db = getDb();
  const rows = await db
    .select()
    .from(analysisRuns)
    .where(
      and(
        eq(analysisRuns.walletAddress, walletAddress.toLowerCase()),
        eq(analysisRuns.chainId, chainId),
        eq(analysisRuns.status, "complete"),
      ),
    )
    .orderBy(desc(analysisRuns.triggeredAtUtc), desc(analysisRuns.createdAt))
    .limit(1);

  return rows[0] ?? null;
}

export async function getAnalysisRunById(runId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(analysisRuns)
    .where(eq(analysisRuns.id, runId))
    .limit(1);

  return rows[0] ?? null;
}

export async function findLatestSameDayAnalysisRun(walletAddress: string, chainId: number, utcDayBucket: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(analysisRuns)
    .where(
      and(
        eq(analysisRuns.walletAddress, walletAddress.toLowerCase()),
        eq(analysisRuns.chainId, chainId),
        eq(analysisRuns.utcDayBucket, utcDayBucket),
      ),
    )
    .orderBy(desc(analysisRuns.createdAt))
    .limit(1);

  return rows[0] ?? null;
}

export async function findActiveAnalysisRun(walletAddress: string, chainId: number) {
  const db = getDb();
  const rows = await db
    .select()
    .from(analysisRuns)
    .where(
      and(
        eq(analysisRuns.walletAddress, walletAddress.toLowerCase()),
        eq(analysisRuns.chainId, chainId),
        inArray(analysisRuns.status, ["queued", "running"]),
      ),
    )
    .orderBy(desc(analysisRuns.createdAt))
    .limit(1);

  return rows[0] ?? null;
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

export async function readAnalysisStatusContext(input: {
  walletAddress: string;
  chainId: number;
  runId?: string;
}) {
  const db = getDb();
  const normalizedWalletAddress = input.walletAddress.toLowerCase();
  const selectedRun = (input.runId
    ? db
      .select({
        id: analysisRuns.id,
        walletAddress: analysisRuns.walletAddress,
        chainId: analysisRuns.chainId,
        status: analysisRuns.status,
        mode: analysisRuns.mode,
        stage: analysisRuns.stage,
        progressPct: analysisRuns.progressPct,
        triggeredAtUtc: analysisRuns.triggeredAtUtc,
        completedAt: analysisRuns.completedAt,
        updatedAt: analysisRuns.updatedAt,
        coverageReasonsJson: analysisRuns.coverageReasonsJson,
        lastError: analysisRuns.lastError,
      })
      .from(analysisRuns)
      .where(
        and(
          eq(analysisRuns.id, input.runId),
          eq(analysisRuns.walletAddress, normalizedWalletAddress),
          eq(analysisRuns.chainId, input.chainId),
        ),
      )
      .limit(1)
    : db
      .select({
        id: analysisRuns.id,
        walletAddress: analysisRuns.walletAddress,
        chainId: analysisRuns.chainId,
        status: analysisRuns.status,
        mode: analysisRuns.mode,
        stage: analysisRuns.stage,
        progressPct: analysisRuns.progressPct,
        triggeredAtUtc: analysisRuns.triggeredAtUtc,
        completedAt: analysisRuns.completedAt,
        updatedAt: analysisRuns.updatedAt,
        coverageReasonsJson: analysisRuns.coverageReasonsJson,
        lastError: analysisRuns.lastError,
      })
      .from(analysisRuns)
      .where(
        and(
          eq(analysisRuns.walletAddress, normalizedWalletAddress),
          eq(analysisRuns.chainId, input.chainId),
        ),
      )
      .orderBy(desc(analysisRuns.createdAt))
      .limit(1))
    .as("selected_run");

  const selectedFreshness = db
    .select({
      lastAnalyzedAt: walletContexts.lastAnalyzedAt,
      lastSuccessfulRunId: walletContexts.lastSuccessfulRunId,
    })
    .from(walletContexts)
    .where(
      and(
        eq(walletContexts.walletAddress, normalizedWalletAddress),
        eq(walletContexts.chainId, input.chainId),
      ),
    )
    .limit(1)
    .as("selected_freshness");

  const rows = await db
    .select({
      runId: selectedRun.id,
      runWalletAddress: selectedRun.walletAddress,
      runChainId: selectedRun.chainId,
      runStatus: selectedRun.status,
      runMode: selectedRun.mode,
      runStage: selectedRun.stage,
      runProgressPct: selectedRun.progressPct,
      runTriggeredAtUtc: selectedRun.triggeredAtUtc,
      runCompletedAt: selectedRun.completedAt,
      runUpdatedAt: selectedRun.updatedAt,
      runCoverageReasonsJson: selectedRun.coverageReasonsJson,
      runLastError: selectedRun.lastError,
      freshnessLastAnalyzedAt: selectedFreshness.lastAnalyzedAt,
      freshnessLastSuccessfulRunId: selectedFreshness.lastSuccessfulRunId,
      sliceId: analysisSlices.id,
      sliceIndex: analysisSlices.sliceIndex,
      sliceStatus: analysisSlices.status,
      sliceStartUtc: analysisSlices.sliceStartUtc,
      sliceEndUtc: analysisSlices.sliceEndUtc,
      sliceTxCountSeen: analysisSlices.txCountSeen,
      sliceTxCountProcessed: analysisSlices.txCountProcessed,
      sliceCoverageReasonsJson: analysisSlices.coverageReasonsJson,
      sliceStartedAt: analysisSlices.startedAt,
      sliceCompletedAt: analysisSlices.completedAt,
    })
    .from(selectedRun)
    .leftJoin(selectedFreshness, sql`true`)
    .leftJoin(analysisSlices, eq(analysisSlices.runId, selectedRun.id))
    .orderBy(asc(analysisSlices.sliceIndex));

  if (rows.length === 0) {
    const freshnessRows = await db
      .select({
        lastAnalyzedAt: walletContexts.lastAnalyzedAt,
        lastSuccessfulRunId: walletContexts.lastSuccessfulRunId,
      })
      .from(walletContexts)
      .where(
        and(
          eq(walletContexts.walletAddress, normalizedWalletAddress),
          eq(walletContexts.chainId, input.chainId),
        ),
      )
      .limit(1);

    return {
      run: null,
      freshness: freshnessRows[0] ?? null,
      slices: [] as AnalysisSliceProgressRow[],
    };
  }

  const firstRow = rows[0];
  const run: AnalysisStatusContextRun | null = firstRow?.runId
    ? {
        id: firstRow.runId,
        walletAddress: firstRow.runWalletAddress,
        chainId: firstRow.runChainId,
        status: firstRow.runStatus,
        mode: firstRow.runMode,
        stage: firstRow.runStage,
        progressPct: firstRow.runProgressPct,
        triggeredAtUtc: firstRow.runTriggeredAtUtc,
        completedAt: firstRow.runCompletedAt,
        updatedAt: firstRow.runUpdatedAt,
        coverageReasonsJson: firstRow.runCoverageReasonsJson ?? [],
        lastError: firstRow.runLastError,
      }
    : null;
  const freshness: AnalysisStatusContextFreshness | null = firstRow
    ? {
        lastAnalyzedAt: firstRow.freshnessLastAnalyzedAt,
        lastSuccessfulRunId: firstRow.freshnessLastSuccessfulRunId,
      }
    : null;

  return {
    run,
    freshness,
    slices: rows
      .filter((row) => Boolean(row.sliceId))
      .map((row) => ({
        id: row.sliceId as string,
        sliceIndex: row.sliceIndex ?? 0,
        status: row.sliceStatus as AnalysisSliceProgressRow["status"],
        sliceStartUtc: row.sliceStartUtc as Date,
        sliceEndUtc: row.sliceEndUtc as Date,
        txCountSeen: row.sliceTxCountSeen ?? 0,
        txCountProcessed: row.sliceTxCountProcessed ?? 0,
        coverageReasonsJson: row.sliceCoverageReasonsJson ?? [],
        startedAt: row.sliceStartedAt,
        completedAt: row.sliceCompletedAt,
      })),
  };
}

export async function updateAnalysisRunProgress(
  runId: string,
  input: {
    status: string;
    stage: string;
    progressPct: number;
    lastError?: string | null;
    coverage?: AnalysisRunCoverage;
    coverageReasonsJson?: string[];
  },
) {
  const db = getDb();
  const [row] = await db
    .update(analysisRuns)
    .set({
      status: input.status,
      stage: input.stage,
      progressPct: input.progressPct,
      startedAt:
        input.status === "running"
          ? sql`coalesce(${analysisRuns.startedAt}, now())`
          : input.status === "queued"
            ? null
            : undefined,
      coverage: input.coverage,
      coverageReasonsJson: input.coverageReasonsJson,
      lastError: input.lastError ?? null,
      completedAt:
        input.status === "complete" || input.status === "ready"
          ? new Date()
          : input.status === "queued" || input.status === "running"
            ? null
            : undefined,
      updatedAt: new Date(),
    })
    .where(eq(analysisRuns.id, runId))
    .returning();

  return row;
}

export async function mergeAnalysisRunMetadata(runId: string, metadataPatch: Record<string, unknown>) {
  const existing = await getAnalysisRunById(runId);
  if (!existing) {
    return null;
  }

  const db = getDb();
  const [row] = await db
    .update(analysisRuns)
    .set({
      metadataJson: {
        ...(existing.metadataJson ?? {}),
        ...metadataPatch,
      },
      updatedAt: new Date(),
    })
    .where(eq(analysisRuns.id, runId))
    .returning();

  return row ?? null;
}

export async function markAnalysisRunCancelled(runId: string, reason = "user_requested") {
  const db = getDb();
  const [row] = await db
    .update(analysisRuns)
    .set({
      status: "cancelled",
      cancelledAt: new Date(),
      cancelledReason: reason,
      updatedAt: new Date(),
    })
    .where(and(eq(analysisRuns.id, runId), ne(analysisRuns.status, "complete")))
    .returning();

  return row ?? null;
}

export async function supersedeCompletedRunForDevelopmentRerun(runId: string) {
  const existing = await getAnalysisRunById(runId);
  if (!existing || existing.status !== "complete") {
    return existing;
  }

  const db = getDb();
  const [row] = await db
    .update(analysisRuns)
    .set({
      status: "cancelled",
      stage: "cancelled",
      completedAt: null,
      cancelledAt: new Date(),
      cancelledReason: "development_rerun",
      updatedAt: new Date(),
      metadataJson: {
        ...(existing.metadataJson ?? {}),
        supersededForDevelopmentRerunAt: new Date().toISOString(),
      },
    })
    .where(eq(analysisRuns.id, runId))
    .returning();

  return row ?? null;
}

export async function finalizeAnalysisRun(input: {
  runId: string;
  status?: AnalysisRunStatus;
  coverage: AnalysisRunCoverage;
  coverageReasonsJson: string[];
  lastError?: string | null;
}) {
  const db = getDb();
  const status = input.status ?? "complete";
  const now = new Date();

  const row = await db.transaction(async (tx) => {
    if (status === "complete") {
      const current = await tx.query.analysisRuns.findFirst({
        where: eq(analysisRuns.id, input.runId),
      });

      if (current) {
        await tx
          .update(analysisRuns)
          .set({
            status: "cancelled",
            stage: "cancelled",
            completedAt: null,
            cancelledAt: now,
            cancelledReason: "superseded_by_newer_complete_run",
            updatedAt: now,
          })
          .where(and(
            eq(analysisRuns.walletAddress, current.walletAddress),
            eq(analysisRuns.chainId, current.chainId),
            eq(analysisRuns.utcDayBucket, current.utcDayBucket),
            eq(analysisRuns.status, "complete"),
            ne(analysisRuns.id, current.id),
          ));
      }
    }

    const [updated] = await tx
      .update(analysisRuns)
      .set({
        status,
        coverage: input.coverage,
        coverageReasonsJson: input.coverageReasonsJson,
        lastError: input.lastError ?? null,
        completedAt: status === "failed" ? null : now,
        stage: status === "failed" ? "failed" : "completed",
        progressPct: 100,
        updatedAt: now,
      })
      .where(eq(analysisRuns.id, input.runId))
      .returning();

    return updated;
  });

  return row;
}

export async function readRunSliceCoverage(runId: string) {
  const db = getDb();
  const slices = await db
    .select({
      status: analysisSlices.status,
      coverageReasonsJson: analysisSlices.coverageReasonsJson,
    })
    .from(analysisSlices)
    .where(eq(analysisSlices.runId, runId));

  const coverageReasons = Array.from(
    new Set(slices.flatMap((slice) => slice.coverageReasonsJson ?? [])),
  );
  const failedSliceCount = slices.filter((slice) => slice.status === "failed").length;

  return {
    coverage: (failedSliceCount > 0 || coverageReasons.length > 0 ? "partial" : "full") as AnalysisRunCoverage,
    coverageReasons,
    failedSliceCount,
  };
}

export async function readRunProgressSnapshot(runId: string) {
  const db = getDb();
  const rows = await db
    .select({
      totalSlices: sql<number>`count(*)::int`,
      completedSlices: sql<number>`count(*) filter (where ${analysisSlices.status} in ('complete', 'skipped_cached'))::int`,
      failedSlices: sql<number>`count(*) filter (where ${analysisSlices.status} = 'failed')::int`,
    })
    .from(analysisSlices)
    .where(eq(analysisSlices.runId, runId));

  return rows[0] ?? { totalSlices: 0, completedSlices: 0, failedSlices: 0 };
}
