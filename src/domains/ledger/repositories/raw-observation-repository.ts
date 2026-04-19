import { asc, eq } from "drizzle-orm";

import { rawObservations } from "@/infrastructure/db/schema";

type Database = ReturnType<typeof import("@/infrastructure/db/client").getDb>;

export type RawObservationRecord = typeof rawObservations.$inferSelect;
export type RawObservationInsert = typeof rawObservations.$inferInsert;

export class RawObservationRepository {
  constructor(private readonly db: Database) {}

  async append(observation: RawObservationInsert) {
    const [created] = await this.db
      .insert(rawObservations)
      .values(observation)
      .onConflictDoNothing({ target: rawObservations.rawObservationId })
      .returning();

    return created ?? null;
  }

  async appendMany(observations: RawObservationInsert[]) {
    if (observations.length === 0) {
      return [];
    }

    return this.db
      .insert(rawObservations)
      .values(observations)
      .onConflictDoNothing({ target: rawObservations.rawObservationId })
      .returning();
  }

  async listByRun(reconstructionRunId: string) {
    return this.db
      .select()
      .from(rawObservations)
      .where(eq(rawObservations.reconstructionRunId, reconstructionRunId))
      .orderBy(asc(rawObservations.ingestedAt));
  }
}