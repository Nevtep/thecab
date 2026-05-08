import { NextResponse } from "next/server";

import {
  accountingErrorResponseSchema,
  dashboardTimelineResponseSchema
} from "@/domains/accounting/contracts/accounting-api-schemas";
import { AccountingTimeSeriesService } from "@/domains/accounting/services/accounting-time-series-service";
import { LedgerOutputRepository } from "@/domains/ledger/repositories/ledger-output-repository";
import { ReconstructionRunRepository } from "@/domains/ledger/repositories/reconstruction-run-repository";
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

    const session = await sessionRepository.findById(sessionId);

    if (!session) {
      throw new Error("Analysis session not found.");
    }

    const timeSeries = await new AccountingTimeSeriesService(
      sessionRepository,
      reconstructionRunRepository,
      new LedgerOutputRepository(db)
    ).getTimeSeries(sessionId);

    return NextResponse.json(
      dashboardTimelineResponseSchema.parse({
        sessionId,
        acceptedRunId: timeSeries.acceptedRunId,
        markers: timeSeries.eventMarkers
      })
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load dashboard timeline.";
    return NextResponse.json(accountingErrorResponseSchema.parse({ error: message }), { status: 400 });
  }
}
