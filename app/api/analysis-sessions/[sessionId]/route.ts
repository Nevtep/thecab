import { NextResponse } from "next/server";

import {
  errorResponseSchema,
  sessionStatusResponseSchema
} from "@/domains/ledger/contracts/ledger-api-schemas";
import { ReconstructionRunRepository } from "@/domains/ledger/repositories/reconstruction-run-repository";
import { SessionStatusService } from "@/domains/wallet-session/services/session-status-service";
import { SessionRepository } from "@/domains/wallet-session/repositories/session-repository";
import { getDb } from "@/infrastructure/db/client";

type RouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

function serializeRun(
  run: {
    reconstructionRunId: string;
    sessionId: string;
    runMode: "initial" | "incremental" | "replay";
    status: "pending" | "ingesting" | "normalizing" | "projecting" | "accepted" | "failed";
    classifierVersion: string;
    heuristicsVersion: string;
    fromBlock: bigint | null;
    toBlock: bigint | null;
    startedAt: Date;
    completedAt: Date | null;
    errorSummary: string | null;
  } | null
) {
  if (!run) {
    return null;
  }

  return {
    reconstructionRunId: run.reconstructionRunId,
    sessionId: run.sessionId,
    runMode: run.runMode,
    status: run.status,
    classifierVersion: run.classifierVersion,
    heuristicsVersion: run.heuristicsVersion,
    fromBlock: run.fromBlock == null ? null : Number(run.fromBlock),
    toBlock: run.toBlock == null ? null : Number(run.toBlock),
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
    errorSummary: run.errorSummary
  };
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const db = getDb();
    const status = await new SessionStatusService(
      new SessionRepository(db),
      new ReconstructionRunRepository(db)
    ).getStatus(sessionId);

    return NextResponse.json(
      sessionStatusResponseSchema.parse({
        session: {
          sessionId: status.sessionId,
          walletAddress: status.walletAddress,
          chainId: status.chainId,
          status: status.sessionStatus,
          reusedSession: status.reusedSession,
          latestAcceptedRunId: status.latestAcceptedRun?.reconstructionRunId ?? null
        },
        latestAcceptedRun: serializeRun(status.latestAcceptedRun),
        latestRun: serializeRun(status.latestRun),
        lastFailure: serializeRun(status.lastFailure),
        hasAcceptedProjection: status.hasAcceptedProjection
      })
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load session status.";
    return NextResponse.json(errorResponseSchema.parse({ error: message }), { status: 400 });
  }
}