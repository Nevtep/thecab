import { NextResponse } from "next/server";

import {
  accountingBootstrapResponseSchema,
  accountingErrorResponseSchema
} from "@/domains/accounting/contracts/accounting-api-schemas";
import { DashboardCompositionService } from "@/domains/accounting/services/dashboard-composition-service";
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

    const snapshotService = new AccountingSnapshotService(
      sessionRepository,
      reconstructionRunRepository,
      new LedgerOutputRepository(db),
      new PricePointRepository(db),
      new RawObservationRepository(db),
      new AnalysisSessionStateRepository(db)
    );

    const composition = await new DashboardCompositionService(
      sessionRepository,
      reconstructionRunRepository,
      snapshotService
    ).composeBootstrap(sessionId);

    return NextResponse.json(
      accountingBootstrapResponseSchema.parse({
        contractVersion: "1.0.0",
        sessionId,
        walletAddress: composition.session.walletAddress,
        chainId: composition.session.chainId,
        hasAcceptedSnapshot: composition.hasAcceptedSnapshot,
        isReconstructionRunning: composition.isReconstructionRunning,
        bootstrapState: composition.bootstrapState,
        snapshot: composition.snapshot,
        latestRun: composition.latestRun
          ? {
              reconstructionRunId: composition.latestRun.reconstructionRunId,
              runMode: composition.latestRun.runMode,
              status: composition.latestRun.status,
              fromBlock: composition.latestRun.fromBlock == null ? null : Number(composition.latestRun.fromBlock),
              toBlock: composition.latestRun.toBlock == null ? null : Number(composition.latestRun.toBlock),
              checkpointBlock: composition.latestRun.checkpointBlock == null ? null : Number(composition.latestRun.checkpointBlock),
              startedAt: composition.latestRun.startedAt.toISOString(),
              completedAt: composition.latestRun.completedAt?.toISOString() ?? null,
              errorSummary: composition.latestRun.errorSummary ?? null
            }
          : null
      })
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load accounting bootstrap.";
    return NextResponse.json(accountingErrorResponseSchema.parse({ error: message }), { status: 400 });
  }
}
