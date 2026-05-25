import { NextResponse } from "next/server";
import { z } from "zod";

import {
  readAnalysisStatusContext,
} from "@/server/analysis/analysis-run.repository";
import { assertAuthenticatedWallet } from "@/server/analysis/assertAuthenticatedWallet";
import { projectAnalysisProgress, projectAnalysisStatus } from "@/server/analysis/status-projection";
import { assertSupportedChain, SUPPORTED_CHAIN_ID } from "@/server/chains";

const RESPONSE_HEADERS = {
  "Cache-Control": "no-store",
};

const statusQuerySchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).transform((value) => value.toLowerCase()),
  chainId: z.coerce.number().int().positive().default(SUPPORTED_CHAIN_ID),
  runId: z.string().uuid().optional(),
});

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

function summarizeSliceProgress(
  slices: Array<{
    status: string;
  }>,
) {
  return {
    totalSlices: slices.length,
    completedSlices: slices.filter((slice) => slice.status === "complete" || slice.status === "skipped_cached").length,
    failedSlices: slices.filter((slice) => slice.status === "failed").length,
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const payload = statusQuerySchema.parse({
      walletAddress: searchParams.get("walletAddress"),
      chainId: searchParams.get("chainId") ?? SUPPORTED_CHAIN_ID,
    });

    assertSupportedChain(payload.chainId);
    await assertAuthenticatedWallet(payload.walletAddress);

    const { run, freshness, slices } = await readAnalysisStatusContext({
      walletAddress: payload.walletAddress,
      chainId: payload.chainId,
      runId: payload.runId,
    });

    if (payload.runId && !run) {
      return errorResponse("run_not_found", 404);
    }

    const progress = summarizeSliceProgress(slices);

    const lastSuccessfulRunAt = freshness?.lastAnalyzedAt ?? run?.completedAt ?? null;
    const projected = projectAnalysisStatus({
      latestRunStatus: run?.status ?? null,
      lastSuccessfulRunAt,
      coverageReasons: run?.coverageReasonsJson ?? [],
      failedSliceCount: progress.failedSlices,
    });
    const progressProjection = projectAnalysisProgress({
      latestRunStatus: run?.status ?? null,
      currentStage: run?.stage ?? null,
      totalSlices: progress.totalSlices,
      completedSlices: progress.completedSlices,
      failedSlices: progress.failedSlices,
      slices,
    });

    return NextResponse.json({
      walletAddress: payload.walletAddress,
      chainId: payload.chainId,
      status: projected.status,
      runId: run?.id ?? freshness?.lastSuccessfulRunId ?? null,
      mode: run?.mode ?? null,
      stage: run?.stage ?? null,
      progressPct: run?.progressPct ?? 0,
      triggeredAtUtc: run?.triggeredAtUtc?.toISOString() ?? null,
      completedAtUtc: run?.completedAt?.toISOString() ?? null,
      coverage: projected.coverage,
      coverageReasons: projected.coverageReasons,
      lastSuccessfulRunAt: lastSuccessfulRunAt ? lastSuccessfulRunAt.toISOString() : null,
      lastUpdatedAt: run?.updatedAt ? run.updatedAt.toISOString() : null,
      lastError: run?.lastError ?? null,
      phases: progressProjection.phases,
      slices: progressProjection.slices,
    }, { headers: RESPONSE_HEADERS });
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
