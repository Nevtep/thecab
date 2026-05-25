import { NextResponse } from "next/server";
import { z } from "zod";

import { assertAuthenticatedWallet } from "@/server/analysis/assertAuthenticatedWallet";
import {
  findLatestCompletedAnalysisRun,
  getAnalysisRunById,
  markAnalysisRunCancelled,
} from "@/server/analysis/analysis-run.repository";
import { projectCanonicalAnalysisStatus } from "@/server/analysis/status-projection";
import { assertSupportedChain, SUPPORTED_CHAIN_ID } from "@/server/chains";
import { cancelTriggerRun } from "@/server/trigger/client";

const RESPONSE_HEADERS = {
  "Cache-Control": "no-store",
};

const cancelAnalysisSchema = z.object({
  runId: z.string().uuid(),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).transform((value) => value.toLowerCase()),
  chainId: z.number().int().positive().default(SUPPORTED_CHAIN_ID),
}).strict();

function errorResponse(code: string, status: number, details?: unknown) {
  return NextResponse.json(
    {
      error: {
        code,
        ...(details === undefined ? {} : { details }),
      },
    },
    {
      status,
      headers: RESPONSE_HEADERS,
    },
  );
}

export async function POST(request: Request) {
  try {
    const payload = cancelAnalysisSchema.parse(await request.json());
    assertSupportedChain(payload.chainId);
    await assertAuthenticatedWallet(payload.walletAddress);

    const run = await getAnalysisRunById(payload.runId);
    if (!run || run.walletAddress !== payload.walletAddress || run.chainId !== payload.chainId) {
      return errorResponse("run_not_found", 404);
    }

    const cancelledRun = await markAnalysisRunCancelled(payload.runId);
    const triggerRunId = typeof run.metadataJson.triggerRunId === "string" ? run.metadataJson.triggerRunId : null;
    if (triggerRunId) {
      await cancelTriggerRun(triggerRunId);
    }

    const latestCompletedRun = await findLatestCompletedAnalysisRun(payload.walletAddress, payload.chainId);
    const projectedStatus = projectCanonicalAnalysisStatus({
      latestRunStatus: cancelledRun?.status ?? run.status,
      lastSuccessfulRunAt: latestCompletedRun?.completedAt ?? null,
    });

    return NextResponse.json(
      {
        runId: payload.runId,
        status: projectedStatus,
        cancelledAtUtc: cancelledRun?.cancelledAt?.toISOString() ?? new Date().toISOString(),
      },
      { headers: RESPONSE_HEADERS },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse("invalid_payload", 400, error.issues);
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    const code = message.startsWith("UNSUPPORTED_CHAIN")
      ? "unsupported_chain"
      : message.startsWith("ANALYSIS_REQUEST_FAILED:UNAUTHORIZED")
        ? "unauthorized"
        : "internal_error";

    return errorResponse(
      code,
      code === "unsupported_chain" ? 400 : code === "unauthorized" ? 401 : 500,
    );
  }
}