import { eq } from "drizzle-orm";

import { type AnalysisSessionStateSnapshot, type ResidualHoldingSnapshot } from "@/domains/ledger/model/analysis-session-state";
import { type MellowPositionState } from "@/domains/ledger/classifiers/classification-engine";
import { type ManualPositionState } from "@/domains/protocols/aerodrome/manual-position-lifecycle-service";
import { analysisSessionStates } from "@/infrastructure/db/schema";

type Database = ReturnType<typeof import("@/infrastructure/db/client").getDb>;

type StoredPoolAddressMapping = {
  poolAddress: string;
  poolId: string;
};

export class AnalysisSessionStateRepository {
  constructor(private readonly db: Database) {}

  async findBySession(analysisSessionId: string): Promise<AnalysisSessionStateSnapshot | null> {
    const [snapshot] = await this.db
      .select()
      .from(analysisSessionStates)
      .where(eq(analysisSessionStates.analysisSessionId, analysisSessionId))
      .limit(1);

    if (!snapshot) {
      return null;
    }

    return {
      analysisSessionId: snapshot.analysisSessionId,
      latestAcceptedRunId: snapshot.latestAcceptedRunId,
      manualPositions: snapshot.manualPositionsJson as ManualPositionState[],
      mellowPositions: snapshot.mellowPositionsJson as MellowPositionState[],
      poolAddressToId: snapshot.poolAddressToIdJson as StoredPoolAddressMapping[],
      residualHoldings: snapshot.residualHoldingsJson as ResidualHoldingSnapshot[],
      updatedAt: snapshot.updatedAt
    };
  }

  async upsert(input: {
    analysisSessionId: string;
    latestAcceptedRunId: string | null;
    manualPositions: ManualPositionState[];
    mellowPositions: MellowPositionState[];
    poolAddressToId: StoredPoolAddressMapping[];
    residualHoldings: ResidualHoldingSnapshot[];
  }) {
    const [snapshot] = await this.db
      .insert(analysisSessionStates)
      .values({
        analysisSessionId: input.analysisSessionId,
        latestAcceptedRunId: input.latestAcceptedRunId,
        manualPositionsJson: input.manualPositions,
        mellowPositionsJson: input.mellowPositions,
        poolAddressToIdJson: input.poolAddressToId,
        residualHoldingsJson: input.residualHoldings,
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: analysisSessionStates.analysisSessionId,
        set: {
          latestAcceptedRunId: input.latestAcceptedRunId,
          manualPositionsJson: input.manualPositions,
          mellowPositionsJson: input.mellowPositions,
          poolAddressToIdJson: input.poolAddressToId,
          residualHoldingsJson: input.residualHoldings,
          updatedAt: new Date()
        }
      })
      .returning();

    return snapshot;
  }
}