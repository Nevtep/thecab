import { and, eq } from "drizzle-orm";

import { buildAnalysisSessionId } from "@/domains/ledger/model/ids";
import { analysisSessions } from "@/infrastructure/db/schema";

type Database = ReturnType<typeof import("@/infrastructure/db/client").getDb>;

export type AnalysisSessionRecord = typeof analysisSessions.$inferSelect;
export type AnalysisSessionRecordWithReuse = AnalysisSessionRecord & {
  reusedSession: boolean;
};

export class SessionRepository {
  constructor(private readonly db: Database) {}

  toSessionWithReuseState(session: AnalysisSessionRecord): AnalysisSessionRecordWithReuse {
    return {
      ...session,
      reusedSession: session.lastRequestedAt.getTime() > session.createdAt.getTime()
    };
  }

  async findById(analysisSessionId: string) {
    const [session] = await this.db
      .select()
      .from(analysisSessions)
      .where(eq(analysisSessions.analysisSessionId, analysisSessionId))
      .limit(1);

    return session ?? null;
  }

  async findByWallet(walletAddress: string, chainId: number) {
    const [session] = await this.db
      .select()
      .from(analysisSessions)
      .where(
        and(
          eq(analysisSessions.walletAddress, walletAddress.toLowerCase()),
          eq(analysisSessions.chainId, chainId)
        )
      )
      .limit(1);

    return session ?? null;
  }

  async createOrResume(input: {
    walletAddress: string;
    chainId: number;
    connectionSource: string;
  }) {
    const existing = await this.findByWallet(input.walletAddress, input.chainId);
    if (existing) {
      const [updated] = await this.db
        .update(analysisSessions)
        .set({ lastRequestedAt: new Date() })
        .where(eq(analysisSessions.analysisSessionId, existing.analysisSessionId))
        .returning();

      return {
        ...(updated ?? existing),
        reusedSession: true
      };
    }

    const [created] = await this.db
      .insert(analysisSessions)
      .values({
        analysisSessionId: buildAnalysisSessionId(input.chainId, input.walletAddress),
        walletAddress: input.walletAddress.toLowerCase(),
        chainId: input.chainId,
        connectionSource: input.connectionSource,
        status: "active"
      })
      .returning();

    return {
      ...created,
      reusedSession: false
    };
  }

  async setLatestAcceptedRun(analysisSessionId: string, reconstructionRunId: string) {
    const [updated] = await this.db
      .update(analysisSessions)
      .set({ latestAcceptedRunId: reconstructionRunId })
      .where(eq(analysisSessions.analysisSessionId, analysisSessionId))
      .returning();

    return updated ?? null;
  }
}