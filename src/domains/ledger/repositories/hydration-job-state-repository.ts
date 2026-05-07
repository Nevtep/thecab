import { and, asc, eq, inArray, isNull, or, sql } from "drizzle-orm";

import { hydrationJobStates } from "@/infrastructure/db/schema";

type Database = ReturnType<typeof import("@/infrastructure/db/client").getDb>;

export type HydrationJobStateRecord = typeof hydrationJobStates.$inferSelect;

export class HydrationJobStateRepository {
  constructor(private readonly db: Database) {}

  async enqueueMany(input: {
    reconstructionRunId: string;
    txHashes: string[];
  }) {
    if (input.txHashes.length === 0) {
      return [] as HydrationJobStateRecord[];
    }

    return this.db
      .insert(hydrationJobStates)
      .values(
        input.txHashes.map((txHash) => ({
          reconstructionRunId: input.reconstructionRunId,
          txHash: txHash.toLowerCase(),
          jobStatus: "queued"
        }))
      )
      .onConflictDoNothing()
      .returning();
  }

  async claimBatch(input: {
    reconstructionRunId: string;
    leaseOwner: string;
    limit: number;
  }) {
    const candidates = await this.db
      .select({ txHash: hydrationJobStates.txHash })
      .from(hydrationJobStates)
      .where(
        and(
          eq(hydrationJobStates.reconstructionRunId, input.reconstructionRunId),
          or(
            eq(hydrationJobStates.jobStatus, "queued"),
            and(
              eq(hydrationJobStates.jobStatus, "retry"),
              or(isNull(hydrationJobStates.nextRetryAt), sql`${hydrationJobStates.nextRetryAt} <= NOW()`)
            )
          )
        )
      )
      .orderBy(asc(hydrationJobStates.txHash))
      .limit(Math.max(1, input.limit));

    const txHashes = candidates.map((candidate) => candidate.txHash);
    if (txHashes.length === 0) {
      return [] as HydrationJobStateRecord[];
    }

    return this.db
      .update(hydrationJobStates)
      .set({
        jobStatus: "processing",
        leaseOwner: input.leaseOwner,
        leasedAt: new Date(),
        attemptCount: sql`${hydrationJobStates.attemptCount} + 1`,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(hydrationJobStates.reconstructionRunId, input.reconstructionRunId),
          inArray(hydrationJobStates.txHash, txHashes)
        )
      )
      .returning();
  }

  async markHydrated(input: {
    reconstructionRunId: string;
    txHash: string;
  }) {
    const [updated] = await this.db
      .update(hydrationJobStates)
      .set({
        jobStatus: "hydrated",
        lastError: null,
        nextRetryAt: null,
        leaseOwner: null,
        leasedAt: null,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(hydrationJobStates.reconstructionRunId, input.reconstructionRunId),
          eq(hydrationJobStates.txHash, input.txHash.toLowerCase())
        )
      )
      .returning();

    return updated ?? null;
  }

  async markFailed(input: {
    reconstructionRunId: string;
    txHash: string;
    errorSummary: string;
    retryAt?: Date;
  }) {
    const [updated] = await this.db
      .update(hydrationJobStates)
      .set({
        jobStatus: input.retryAt ? "retry" : "failed",
        lastError: input.errorSummary,
        nextRetryAt: input.retryAt ?? null,
        leaseOwner: null,
        leasedAt: null,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(hydrationJobStates.reconstructionRunId, input.reconstructionRunId),
          eq(hydrationJobStates.txHash, input.txHash.toLowerCase())
        )
      )
      .returning();

    return updated ?? null;
  }

  async listByRun(reconstructionRunId: string) {
    return this.db
      .select()
      .from(hydrationJobStates)
      .where(eq(hydrationJobStates.reconstructionRunId, reconstructionRunId));
  }

  async summarizeByStatus(reconstructionRunId: string) {
    const rows = await this.db
      .select({
        jobStatus: hydrationJobStates.jobStatus,
        count: sql<number>`count(*)`
      })
      .from(hydrationJobStates)
      .where(eq(hydrationJobStates.reconstructionRunId, reconstructionRunId))
      .groupBy(hydrationJobStates.jobStatus);

    const summary = {
      queued: 0,
      processing: 0,
      retry: 0,
      hydrated: 0,
      failed: 0,
      total: 0
    };

    for (const row of rows) {
      const count = Number(row.count);
      summary.total += count;

      if (row.jobStatus === "queued") {
        summary.queued += count;
      } else if (row.jobStatus === "processing") {
        summary.processing += count;
      } else if (row.jobStatus === "retry") {
        summary.retry += count;
      } else if (row.jobStatus === "hydrated") {
        summary.hydrated += count;
      } else if (row.jobStatus === "failed") {
        summary.failed += count;
      }
    }

    return summary;
  }
}
