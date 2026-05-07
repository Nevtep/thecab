import { asc, eq, inArray } from "drizzle-orm";

import {
  assetMovements,
  canonicalLedgerRecords,
  discardedActivity,
  ledgerRecordSources,
  residualHoldings
} from "@/infrastructure/db/schema";

type Database = ReturnType<typeof import("@/infrastructure/db/client").getDb>;

type CanonicalLedgerRecordInsert = typeof canonicalLedgerRecords.$inferInsert;
type LedgerRecordSourceInsert = typeof ledgerRecordSources.$inferInsert;
type AssetMovementInsert = typeof assetMovements.$inferInsert;
type ResidualHoldingInsert = typeof residualHoldings.$inferInsert;
type DiscardedActivityInsert = typeof discardedActivity.$inferInsert;

export class LedgerOutputRepository {
  constructor(private readonly db: Database) {}

  async appendCanonicalLedgerRecords(records: CanonicalLedgerRecordInsert[]) {
    if (records.length === 0) {
      return [];
    }

    return this.db
      .insert(canonicalLedgerRecords)
      .values(records)
      .onConflictDoNothing({ target: canonicalLedgerRecords.ledgerRecordId })
      .returning();
  }

  async appendLedgerRecordSources(sources: LedgerRecordSourceInsert[]) {
    if (sources.length === 0) {
      return [];
    }

    return this.db
      .insert(ledgerRecordSources)
      .values(sources)
      .onConflictDoNothing({
        target: [ledgerRecordSources.ledgerRecordId, ledgerRecordSources.rawObservationId]
      })
      .returning();
  }

  async appendAssetMovements(movements: AssetMovementInsert[]) {
    if (movements.length === 0) {
      return [];
    }

    return this.db
      .insert(assetMovements)
      .values(movements)
      .onConflictDoNothing({ target: assetMovements.assetMovementId })
      .returning();
  }

  async appendResidualHoldings(holdings: ResidualHoldingInsert[]) {
    if (holdings.length === 0) {
      return [];
    }

    return this.db
      .insert(residualHoldings)
      .values(holdings)
      .onConflictDoNothing({ target: residualHoldings.residualHoldingId })
      .returning();
  }

  async appendDiscardedActivity(items: DiscardedActivityInsert[]) {
    if (items.length === 0) {
      return [];
    }

    return this.db
      .insert(discardedActivity)
      .values(items)
      .onConflictDoNothing({ target: discardedActivity.discardedActivityId })
      .returning();
  }

  async listCanonicalLedgerRecordsByRun(reconstructionRunId: string) {
    return this.db
      .select()
      .from(canonicalLedgerRecords)
      .where(eq(canonicalLedgerRecords.reconstructionRunId, reconstructionRunId));
  }

  async listCanonicalLedgerRecordsByRuns(reconstructionRunIds: string[]) {
    if (reconstructionRunIds.length === 0) {
      return [];
    }

    return this.db
      .select()
      .from(canonicalLedgerRecords)
      .where(inArray(canonicalLedgerRecords.reconstructionRunId, reconstructionRunIds))
      .orderBy(
        asc(canonicalLedgerRecords.blockNumber),
        asc(canonicalLedgerRecords.timestamp),
        asc(canonicalLedgerRecords.eventSequence)
      );
  }

  async findCanonicalLedgerRecord(ledgerRecordId: string) {
    const [record] = await this.db
      .select()
      .from(canonicalLedgerRecords)
      .where(eq(canonicalLedgerRecords.ledgerRecordId, ledgerRecordId))
      .limit(1);

    return record ?? null;
  }

  async listLedgerRecordSources(ledgerRecordId: string) {
    return this.db
      .select()
      .from(ledgerRecordSources)
      .where(eq(ledgerRecordSources.ledgerRecordId, ledgerRecordId));
  }

  async listAssetMovements(ledgerRecordId: string) {
    return this.db
      .select()
      .from(assetMovements)
      .where(eq(assetMovements.ledgerRecordId, ledgerRecordId));
  }

  async listAssetMovementsByLedgerRecordIds(ledgerRecordIds: string[]) {
    if (ledgerRecordIds.length === 0) {
      return [];
    }

    return this.db
      .select()
      .from(assetMovements)
      .where(inArray(assetMovements.ledgerRecordId, ledgerRecordIds));
  }

  async listResidualHoldingsByRun(reconstructionRunId: string) {
    return this.db
      .select()
      .from(residualHoldings)
      .where(eq(residualHoldings.reconstructionRunId, reconstructionRunId));
  }

  async listDiscardedActivityByRun(reconstructionRunId: string) {
    return this.db
      .select()
      .from(discardedActivity)
      .where(eq(discardedActivity.reconstructionRunId, reconstructionRunId));
  }

  async listDiscardedActivityByRuns(reconstructionRunIds: string[]) {
    if (reconstructionRunIds.length === 0) {
      return [];
    }

    return this.db
      .select()
      .from(discardedActivity)
      .where(inArray(discardedActivity.reconstructionRunId, reconstructionRunIds))
      .orderBy(asc(discardedActivity.blockNumber), asc(discardedActivity.timestamp));
  }
}