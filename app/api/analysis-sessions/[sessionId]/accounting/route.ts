import { NextResponse } from "next/server";

import {
  accountingErrorResponseSchema,
  accountingResponseSchema
} from "@/domains/accounting/contracts/accounting-api-schemas";
import { AnalysisSessionStateRepository } from "@/domains/ledger/repositories/analysis-session-state-repository";
import { AccountingSnapshotService } from "@/domains/accounting/services/accounting-snapshot-service";
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
    const snapshot = await new AccountingSnapshotService(
      new SessionRepository(db),
      new ReconstructionRunRepository(db),
      new LedgerOutputRepository(db),
      new PricePointRepository(db),
      new RawObservationRepository(db),
      new AnalysisSessionStateRepository(db)
    ).getLatestSnapshot(sessionId);

    return NextResponse.json(accountingResponseSchema.parse(snapshot));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load accounting snapshot.";
    return NextResponse.json(accountingErrorResponseSchema.parse({ error: message }), { status: 400 });
  }
}