import { NextResponse } from "next/server";

import {
  accountingErrorResponseSchema,
  accountingTimeSeriesResponseSchema
} from "@/domains/accounting/contracts/accounting-api-schemas";
import { AccountingTimeSeriesService } from "@/domains/accounting/services/accounting-time-series-service";
import { LedgerOutputRepository } from "@/domains/ledger/repositories/ledger-output-repository";
import { ReconstructionRunRepository } from "@/domains/ledger/repositories/reconstruction-run-repository";
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

    const payload = await new AccountingTimeSeriesService(
      new SessionRepository(db),
      new ReconstructionRunRepository(db),
      new LedgerOutputRepository(db),
      new PricePointRepository(db)
    ).getTimeSeries(sessionId);

    return NextResponse.json(accountingTimeSeriesResponseSchema.parse(payload));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load accounting time series.";
    return NextResponse.json(accountingErrorResponseSchema.parse({ error: message }), { status: 400 });
  }
}
