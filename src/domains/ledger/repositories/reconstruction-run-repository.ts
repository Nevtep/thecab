import { desc, eq } from "drizzle-orm";

import { reconstructionRuns } from "@/infrastructure/db/schema";

type Database = ReturnType<typeof import("@/infrastructure/db/client").getDb>;

export type ReconstructionRunRecord = typeof reconstructionRuns.$inferSelect;
export type ReconstructionRunInsert = typeof reconstructionRuns.$inferInsert;

export class ReconstructionRunRepository {
  constructor(private readonly db: Database) {}

  async create(run: ReconstructionRunInsert) {
    const [created] = await this.db.insert(reconstructionRuns).values(run).returning();
    return created;
  }

  async findById(reconstructionRunId: string) {
    const [run] = await this.db
      .select()
      .from(reconstructionRuns)
      .where(eq(reconstructionRuns.reconstructionRunId, reconstructionRunId))
      .limit(1);

    return run ?? null;
  }

  async listBySession(analysisSessionId: string) {
    return this.db
      .select()
      .from(reconstructionRuns)
      .where(eq(reconstructionRuns.analysisSessionId, analysisSessionId))
      .orderBy(desc(reconstructionRuns.startedAt));
  }

  async findLatestAcceptedBySession(analysisSessionId: string) {
    const runs = await this.db
      .select()
      .from(reconstructionRuns)
      .where(eq(reconstructionRuns.analysisSessionId, analysisSessionId))
      .orderBy(desc(reconstructionRuns.startedAt))
      .limit(20);

    return runs.find((run) => run.status === "accepted") ?? null;
  }

  async findLatestBySession(analysisSessionId: string) {
    const [run] = await this.db
      .select()
      .from(reconstructionRuns)
      .where(eq(reconstructionRuns.analysisSessionId, analysisSessionId))
      .orderBy(desc(reconstructionRuns.startedAt))
      .limit(1);

    return run ?? null;
  }

  async findLatestFailedBySession(analysisSessionId: string) {
    const runs = await this.db
      .select()
      .from(reconstructionRuns)
      .where(eq(reconstructionRuns.analysisSessionId, analysisSessionId))
      .orderBy(desc(reconstructionRuns.startedAt))
      .limit(20);

    return runs.find((run) => run.status === "failed") ?? null;
  }

  async updateStatus(
    reconstructionRunId: string,
    input: {
      status: string;
      checkpointBlock?: bigint | null;
      completedAt?: Date | null;
      errorSummary?: string | null;
    }
  ) {
    const [updated] = await this.db
      .update(reconstructionRuns)
      .set({
        status: input.status,
        checkpointBlock: input.checkpointBlock,
        completedAt: input.completedAt ?? undefined,
        errorSummary: input.errorSummary ?? undefined
      })
      .where(eq(reconstructionRuns.reconstructionRunId, reconstructionRunId))
      .returning();

    return updated ?? null;
  }
}