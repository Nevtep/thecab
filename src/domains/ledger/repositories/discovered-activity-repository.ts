import { and, eq, sql } from "drizzle-orm";

import { discoveredActivities } from "@/infrastructure/db/schema";

type Database = ReturnType<typeof import("@/infrastructure/db/client").getDb>;

export type DiscoveredActivityRecord = typeof discoveredActivities.$inferSelect;

export class DiscoveredActivityRepository {
  constructor(private readonly db: Database) {}

  async upsertManyQueued(input: {
    reconstructionRunId: string;
    providerKey: string;
    providerCursor?: string | null;
    txHashes: string[];
  }) {
    if (input.txHashes.length === 0) {
      return [] as DiscoveredActivityRecord[];
    }

    const [first] = await this.db
      .insert(discoveredActivities)
      .values(
        input.txHashes.map((txHash) => ({
          reconstructionRunId: input.reconstructionRunId,
          txHash: txHash.toLowerCase(),
          providerKey: input.providerKey,
          providerCursor: input.providerCursor ?? null,
          hydrationStatus: "queued"
        }))
      )
      .onConflictDoNothing()
      .returning();

    if (!first) {
      return this.listByRun(input.reconstructionRunId);
    }

    return this.listByRun(input.reconstructionRunId);
  }

  async listByRun(reconstructionRunId: string) {
    return this.db
      .select()
      .from(discoveredActivities)
      .where(eq(discoveredActivities.reconstructionRunId, reconstructionRunId));
  }

  async listQueuedByRun(reconstructionRunId: string) {
    return this.db
      .select()
      .from(discoveredActivities)
      .where(
        and(
          eq(discoveredActivities.reconstructionRunId, reconstructionRunId),
          eq(discoveredActivities.hydrationStatus, "queued")
        )
      );
  }

  async summarizeByStatus(reconstructionRunId: string) {
    const rows = await this.db
      .select({
        hydrationStatus: discoveredActivities.hydrationStatus,
        count: sql<number>`count(*)`
      })
      .from(discoveredActivities)
      .where(eq(discoveredActivities.reconstructionRunId, reconstructionRunId))
      .groupBy(discoveredActivities.hydrationStatus);

    const summary = {
      queued: 0,
      hydrated: 0,
      failed: 0,
      total: 0
    };

    for (const row of rows) {
      const count = Number(row.count);
      summary.total += count;

      if (row.hydrationStatus === "queued") {
        summary.queued += count;
      } else if (row.hydrationStatus === "hydrated") {
        summary.hydrated += count;
      } else if (row.hydrationStatus === "failed") {
        summary.failed += count;
      }
    }

    return summary;
  }

  async markHydrated(input: {
    reconstructionRunId: string;
    txHash: string;
  }) {
    const [updated] = await this.db
      .update(discoveredActivities)
      .set({
        hydrationStatus: "hydrated",
        hydratedAt: new Date(),
        errorSummary: null
      })
      .where(
        and(
          eq(discoveredActivities.reconstructionRunId, input.reconstructionRunId),
          eq(discoveredActivities.txHash, input.txHash.toLowerCase())
        )
      )
      .returning();

    return updated ?? null;
  }

  async markFailed(input: {
    reconstructionRunId: string;
    txHash: string;
    errorSummary: string;
  }) {
    const [updated] = await this.db
      .update(discoveredActivities)
      .set({
        hydrationStatus: "failed",
        errorSummary: input.errorSummary
      })
      .where(
        and(
          eq(discoveredActivities.reconstructionRunId, input.reconstructionRunId),
          eq(discoveredActivities.txHash, input.txHash.toLowerCase())
        )
      )
      .returning();

    return updated ?? null;
  }
}
