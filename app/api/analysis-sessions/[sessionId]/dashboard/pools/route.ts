import { NextResponse } from "next/server";

import {
  accountingErrorResponseSchema,
  accountingResponseSchema,
  poolDashboardListResponseSchema
} from "@/domains/accounting/contracts/accounting-api-schemas";
import { AccountingBreakdownService } from "@/domains/accounting/services/accounting-breakdown-service";
import { AccountingSnapshotService } from "@/domains/accounting/services/accounting-snapshot-service";
import { AnalysisSessionStateRepository } from "@/domains/ledger/repositories/analysis-session-state-repository";
import { LedgerOutputRepository } from "@/domains/ledger/repositories/ledger-output-repository";
import { ReconstructionRunRepository } from "@/domains/ledger/repositories/reconstruction-run-repository";
import { RawObservationRepository } from "@/domains/ledger/repositories/raw-observation-repository";
import { PricePointRepository } from "@/domains/pricing/repositories/price-point-repository";
import { SessionRepository } from "@/domains/wallet-session/repositories/session-repository";
import { getDb } from "@/infrastructure/db/client";

type RouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const db = getDb();

    const sessionRepository = new SessionRepository(db);
    const reconstructionRunRepository = new ReconstructionRunRepository(db);

    const [session, latestAcceptedRun] = await Promise.all([
      sessionRepository.findById(sessionId),
      reconstructionRunRepository.findLatestAcceptedBySession(sessionId)
    ]);

    if (!session) {
      throw new Error("Analysis session not found.");
    }

    if (!latestAcceptedRun) {
      return NextResponse.json(
        poolDashboardListResponseSchema.parse({
          sessionId,
          acceptedRunId: null,
          pools: []
        })
      );
    }

    const snapshot = accountingResponseSchema.parse(
      await new AccountingSnapshotService(
      sessionRepository,
      reconstructionRunRepository,
      new LedgerOutputRepository(db),
      new PricePointRepository(db),
      new RawObservationRepository(db),
      new AnalysisSessionStateRepository(db)
    ).getLatestSnapshot(sessionId)
    );

    const pools = new AccountingBreakdownService().buildPoolList(snapshot);

    return NextResponse.json(
      poolDashboardListResponseSchema.parse({
        sessionId,
        acceptedRunId: latestAcceptedRun.reconstructionRunId,
        pools
      })
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load dashboard pools.";
    return NextResponse.json(accountingErrorResponseSchema.parse({ error: message }), { status: 400 });
  }
}
