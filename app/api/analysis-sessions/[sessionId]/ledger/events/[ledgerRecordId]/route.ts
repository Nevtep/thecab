import { NextResponse } from "next/server";

import {
  errorResponseSchema,
  ledgerRecordDetailResponseSchema
} from "@/domains/ledger/contracts/ledger-api-schemas";
import { LedgerProjectionService } from "@/domains/ledger/projections/ledger-projection-service";
import { LedgerOutputRepository } from "@/domains/ledger/repositories/ledger-output-repository";
import { ReconstructionRunRepository } from "@/domains/ledger/repositories/reconstruction-run-repository";
import { RawObservationRepository } from "@/domains/ledger/repositories/raw-observation-repository";
import { SessionRepository } from "@/domains/wallet-session/repositories/session-repository";
import { getDb } from "@/infrastructure/db/client";

type RouteContext = {
  params: Promise<{
    sessionId: string;
    ledgerRecordId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { sessionId, ledgerRecordId } = await context.params;
    const db = getDb();
    const projection = await new LedgerProjectionService(
      new SessionRepository(db),
      new ReconstructionRunRepository(db),
      new LedgerOutputRepository(db),
      new RawObservationRepository(db)
    ).getLedgerRecordDetail(sessionId, ledgerRecordId);

    return NextResponse.json(ledgerRecordDetailResponseSchema.parse(projection));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load ledger record detail.";
    return NextResponse.json(errorResponseSchema.parse({ error: message }), { status: 400 });
  }
}