import { NextResponse } from "next/server";

import {
  errorResponseSchema,
  reconstructionProgressResponseSchema
} from "@/domains/ledger/contracts/ledger-api-schemas";
import { HydrationJobStateRepository } from "@/domains/ledger/repositories/hydration-job-state-repository";
import { ReconstructionRunRepository } from "@/domains/ledger/repositories/reconstruction-run-repository";
import { SessionRepository } from "@/domains/wallet-session/repositories/session-repository";
import { getDb } from "@/infrastructure/db/client";

type RouteContext = {
  params: Promise<{
    sessionId: string;
    reconstructionRunId: string;
  }>;
};

function buildProgress(input: {
  fromBlock: bigint | null;
  toBlock: bigint | null;
  latestProcessedBlock: bigint | null;
}) {
  const { fromBlock, toBlock, latestProcessedBlock } = input;
  if (fromBlock == null || toBlock == null || latestProcessedBlock == null) {
    return null;
  }

  if (toBlock < fromBlock) {
    return null;
  }

  const covered = latestProcessedBlock < fromBlock
    ? 0n
    : latestProcessedBlock > toBlock
      ? toBlock - fromBlock + 1n
      : latestProcessedBlock - fromBlock + 1n;
  const total = toBlock - fromBlock + 1n;
  if (total <= 0n) {
    return null;
  }

  const percent = Number((covered * 100n) / total);
  return Math.max(0, Math.min(100, percent));
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { sessionId, reconstructionRunId } = await context.params;
    const db = getDb();
    const sessionRepository = new SessionRepository(db);
    const reconstructionRunRepository = new ReconstructionRunRepository(db);
    const hydrationJobStateRepository = new HydrationJobStateRepository(db);

    const [session, run] = await Promise.all([
      sessionRepository.findById(sessionId),
      reconstructionRunRepository.findById(reconstructionRunId)
    ]);

    if (!session) {
      throw new Error("Analysis session not found.");
    }

    if (!run || run.analysisSessionId !== sessionId) {
      throw new Error("Reconstruction run not found for the requested session.");
    }

    const hydration = await hydrationJobStateRepository.summarizeByStatus(reconstructionRunId);

    const latestProcessedBlock = run.checkpointBlock ?? (run.status === "accepted" ? run.toBlock : null);

    return NextResponse.json(
      reconstructionProgressResponseSchema.parse({
        reconstructionRunId: run.reconstructionRunId,
        sessionId: run.analysisSessionId,
        runMode: run.runMode,
        status: run.status,
        fromBlock: run.fromBlock == null ? null : Number(run.fromBlock),
        toBlock: run.toBlock == null ? null : Number(run.toBlock),
        checkpointBlock: run.checkpointBlock == null ? null : Number(run.checkpointBlock),
        latestProcessedBlock: latestProcessedBlock == null ? null : Number(latestProcessedBlock),
        progressPercent: buildProgress({
          fromBlock: run.fromBlock,
          toBlock: run.toBlock,
          latestProcessedBlock
        }),
        startedAt: run.startedAt.toISOString(),
        completedAt: run.completedAt?.toISOString() ?? null,
        errorSummary: run.errorSummary ?? null,
        hydration
      })
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load reconstruction progress.";
    return NextResponse.json(errorResponseSchema.parse({ error: message }), { status: 400 });
  }
}
