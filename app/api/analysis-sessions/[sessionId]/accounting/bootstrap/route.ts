import { NextResponse } from "next/server";

import {
  accountingBootstrapResponseSchema,
  accountingErrorResponseSchema
} from "@/domains/accounting/contracts/accounting-api-schemas";
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

const RUNNING_STATUSES = new Set(["pending", "ingesting", "normalizing", "projecting"]);

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const db = getDb();
    const sessionRepository = new SessionRepository(db);
    const reconstructionRunRepository = new ReconstructionRunRepository(db);

    const [session, latestAcceptedRun, latestRun] = await Promise.all([
      sessionRepository.findById(sessionId),
      reconstructionRunRepository.findLatestAcceptedBySession(sessionId),
      reconstructionRunRepository.findLatestBySession(sessionId)
    ]);

    if (!session) {
      throw new Error("Analysis session not found.");
    }

    const snapshotService = new AccountingSnapshotService(
      sessionRepository,
      reconstructionRunRepository,
      new LedgerOutputRepository(db),
      new PricePointRepository(db),
      new RawObservationRepository(db),
      new AnalysisSessionStateRepository(db)
    );

    const snapshot = latestAcceptedRun ? await snapshotService.getLatestSnapshot(sessionId) : null;

    const hasAcceptedSnapshot = Boolean(latestAcceptedRun);
    const isReconstructionRunning = Boolean(latestRun && RUNNING_STATUSES.has(latestRun.status));

    return NextResponse.json(
      accountingBootstrapResponseSchema.parse({
        contractVersion: "1.0.0",
        sessionId,
        walletAddress: session.walletAddress,
        chainId: session.chainId,
        hasAcceptedSnapshot,
        isReconstructionRunning,
        bootstrapState: hasAcceptedSnapshot ? (isReconstructionRunning ? "warming" : "ready") : "empty",
        snapshot,
        latestRun: latestRun
          ? {
              reconstructionRunId: latestRun.reconstructionRunId,
              runMode: latestRun.runMode,
              status: latestRun.status,
              fromBlock: latestRun.fromBlock == null ? null : Number(latestRun.fromBlock),
              toBlock: latestRun.toBlock == null ? null : Number(latestRun.toBlock),
              checkpointBlock: latestRun.checkpointBlock == null ? null : Number(latestRun.checkpointBlock),
              startedAt: latestRun.startedAt.toISOString(),
              completedAt: latestRun.completedAt?.toISOString() ?? null,
              errorSummary: latestRun.errorSummary ?? null
            }
          : null
      })
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load accounting bootstrap.";
    return NextResponse.json(accountingErrorResponseSchema.parse({ error: message }), { status: 400 });
  }
}
