import { NextRequest, NextResponse } from "next/server";

import {
  errorResponseSchema,
  reconstructionRunResponseSchema,
  startReconstructionRequestSchema
} from "@/domains/ledger/contracts/ledger-api-schemas";
import { AnalysisSessionStateRepository } from "@/domains/ledger/repositories/analysis-session-state-repository";
import { LedgerOutputRepository } from "@/domains/ledger/repositories/ledger-output-repository";
import { ReconstructionRunService } from "@/domains/ledger/services/reconstruction-run-service";
import { WalletDiscoveryCheckpointRepository } from "@/domains/ledger/repositories/wallet-discovery-checkpoint-repository";
import { markReconstructionRunActive } from "@/domains/ledger/services/active-reconstruction-run-registry";
import { ReconstructionExecutor } from "@/domains/ledger/services/reconstruction-executor";
import { ReconstructionRunRepository } from "@/domains/ledger/repositories/reconstruction-run-repository";
import { RawObservationRepository } from "@/domains/ledger/repositories/raw-observation-repository";
import { LedgerNormalizationService } from "@/domains/ledger/services/ledger-normalization-service";
import { SessionRepository } from "@/domains/wallet-session/repositories/session-repository";
import { getDb } from "@/infrastructure/db/client";

type RouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const payload = startReconstructionRequestSchema.parse(await request.json().catch(() => ({})));
    const { sessionId } = await context.params;

    const db = getDb();
    const sessionRepository = new SessionRepository(db);
    const reconstructionRunRepository = new ReconstructionRunRepository(db);
    const walletDiscoveryCheckpointRepository = new WalletDiscoveryCheckpointRepository(db);
    const reconstructionRunService = new ReconstructionRunService(
      reconstructionRunRepository,
      sessionRepository,
      walletDiscoveryCheckpointRepository
    );
    const reconstructionExecutor = new ReconstructionExecutor(
      sessionRepository,
      new RawObservationRepository(db),
      reconstructionRunService,
      new LedgerNormalizationService(new LedgerOutputRepository(db)),
      new AnalysisSessionStateRepository(db),
      walletDiscoveryCheckpointRepository
    );

    const run = await reconstructionRunService.startPendingRun({
      analysisSessionId: sessionId,
      mode: payload.mode,
      fromBlock: payload.fromBlock ?? null,
      toBlock: payload.toBlock ?? null
    });

    if (run.status === "pending") {
      markReconstructionRunActive(run.reconstructionRunId);
      void reconstructionExecutor.execute({
        analysisSessionId: sessionId,
        reconstructionRunId: run.reconstructionRunId,
        mode: payload.mode,
        fromBlock: run.fromBlock,
        toBlock: run.toBlock
      });
    }

    return NextResponse.json(
      reconstructionRunResponseSchema.parse({
        reconstructionRunId: run.reconstructionRunId,
        sessionId: run.analysisSessionId,
        runMode: run.runMode,
        status: run.status,
        classifierVersion: run.classifierVersion,
        heuristicsVersion: run.heuristicsVersion,
        fromBlock: run.fromBlock == null ? null : Number(run.fromBlock),
        toBlock: run.toBlock == null ? null : Number(run.toBlock),
        checkpointBlock: run.checkpointBlock == null ? null : Number(run.checkpointBlock),
        startedAt: run.startedAt.toISOString(),
        completedAt: run.completedAt?.toISOString() ?? null,
        errorSummary: run.errorSummary ?? null
      }),
      { status: 202 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start reconstruction run.";
    return NextResponse.json(errorResponseSchema.parse({ error: message }), { status: 400 });
  }
}