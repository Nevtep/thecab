import { NextResponse } from "next/server";

import {
  accountingErrorResponseSchema,
  accountingRebalanceFlowsResponseSchema
} from "@/domains/accounting/contracts/accounting-api-schemas";
import { AccountingRebalanceFlowService } from "@/domains/accounting/services/accounting-rebalance-flow-service";
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

    const payload = await new AccountingRebalanceFlowService(
      new SessionRepository(db),
      new ReconstructionRunRepository(db),
      new LedgerOutputRepository(db)
    ).getRebalanceFlows(sessionId);

    return NextResponse.json(accountingRebalanceFlowsResponseSchema.parse(payload));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load accounting rebalance flows.";
    return NextResponse.json(accountingErrorResponseSchema.parse({ error: message }), { status: 400 });
  }
}
