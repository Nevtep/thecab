import { NextResponse } from "next/server";

import {
  discardedActivityListResponseSchema,
  errorResponseSchema
} from "@/domains/ledger/contracts/ledger-api-schemas";
import { AnalysisSessionStateRepository } from "@/domains/ledger/repositories/analysis-session-state-repository";
import { LedgerProjectionService } from "@/domains/ledger/projections/ledger-projection-service";
import { LedgerOutputRepository } from "@/domains/ledger/repositories/ledger-output-repository";
import { ReconstructionRunRepository } from "@/domains/ledger/repositories/reconstruction-run-repository";
import { RawObservationRepository } from "@/domains/ledger/repositories/raw-observation-repository";
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
    const discardedActivity = await new LedgerProjectionService(
      new SessionRepository(db),
      new ReconstructionRunRepository(db),
      new LedgerOutputRepository(db),
      new RawObservationRepository(db),
      new AnalysisSessionStateRepository(db)
    ).listDiscardedActivity(sessionId);

    return NextResponse.json(discardedActivityListResponseSchema.parse(discardedActivity));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load discarded activity.";
    return NextResponse.json(errorResponseSchema.parse({ error: message }), { status: 400 });
  }
}