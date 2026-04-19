import { NextRequest, NextResponse } from "next/server";

import {
  errorResponseSchema,
  reconstructionRunResponseSchema,
  startReconstructionRequestSchema
} from "@/domains/ledger/contracts/ledger-api-schemas";
import { LedgerOutputRepository } from "@/domains/ledger/repositories/ledger-output-repository";
import { ReconstructionRunService } from "@/domains/ledger/services/reconstruction-run-service";
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
    const reconstructionRunService = new ReconstructionRunService(
      reconstructionRunRepository,
      sessionRepository
    );
    const reconstructionExecutor = new ReconstructionExecutor(
      sessionRepository,
      new RawObservationRepository(db),
      reconstructionRunService,
      new LedgerNormalizationService(new LedgerOutputRepository(db))
    );

    const run = await reconstructionRunService.startPendingRun({
      analysisSessionId: sessionId,
      mode: payload.mode,
      fromBlock: payload.fromBlock ?? null,
      toBlock: payload.toBlock ?? null
    });

    const completedRun =
      (await reconstructionExecutor.execute({
        analysisSessionId: sessionId,
        reconstructionRunId: run.reconstructionRunId,
        fromBlock: payload.fromBlock ?? null,
        toBlock: payload.toBlock ?? null
      })) ?? run;

    return NextResponse.json(
      reconstructionRunResponseSchema.parse({
        reconstructionRunId: completedRun.reconstructionRunId,
        sessionId: completedRun.analysisSessionId,
        status: completedRun.status,
        classifierVersion: completedRun.classifierVersion,
        heuristicsVersion: completedRun.heuristicsVersion,
        fromBlock: completedRun.fromBlock == null ? null : Number(completedRun.fromBlock),
        toBlock: completedRun.toBlock == null ? null : Number(completedRun.toBlock)
      }),
      { status: 202 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start reconstruction run.";
    return NextResponse.json(errorResponseSchema.parse({ error: message }), { status: 400 });
  }
}