import { NextResponse } from "next/server";
import { z } from "zod";

import { getLatestAnalysisRun } from "@/server/analysis/analysis-run.repository";
import { assertSupportedChain, SUPPORTED_CHAIN_ID } from "@/server/chains";
import { readOverviewFreshness } from "@/server/overview/overview.repository";

const statusQuerySchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  chainId: z.coerce.number().int().positive().default(SUPPORTED_CHAIN_ID),
});

function isStale(lastSuccessfulRunAt: Date | null) {
  if (!lastSuccessfulRunAt) {
    return false;
  }

  return Date.now() - lastSuccessfulRunAt.getTime() > 7 * 24 * 60 * 60 * 1000;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const payload = statusQuerySchema.parse({
      walletAddress: searchParams.get("walletAddress"),
      chainId: searchParams.get("chainId") ?? SUPPORTED_CHAIN_ID,
    });

    assertSupportedChain(payload.chainId);

    const [run, freshness] = await Promise.all([
      getLatestAnalysisRun(payload.walletAddress, payload.chainId),
      readOverviewFreshness({
        walletAddress: payload.walletAddress,
        chainId: payload.chainId,
      }),
    ]);

    const lastSuccessfulRunAt = freshness?.lastAnalyzedAt ?? run?.completedAt ?? null;
    const status = run?.status === "queued" || run?.status === "running"
      ? run.status
      : run?.status === "failed"
        ? "failed"
        : isStale(lastSuccessfulRunAt)
          ? "stale"
          : lastSuccessfulRunAt
            ? "ready"
            : "not_analyzed";

    return NextResponse.json({
      walletAddress: payload.walletAddress.toLowerCase(),
      chainId: payload.chainId,
      status,
      runId: run?.id ?? freshness?.lastSuccessfulRunId ?? null,
      stage:
        run?.stage ?? (status === "ready" || status === "stale" ? "completed" : "idle"),
      progressPct: run?.progressPct ?? (status === "ready" || status === "stale" ? 100 : 0),
      lastSuccessfulRunAt: lastSuccessfulRunAt ? lastSuccessfulRunAt.toISOString() : null,
      lastUpdatedAt: run?.updatedAt ? run.updatedAt.toISOString() : null,
      lastError: run?.lastError ?? null,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          code: "VALIDATION_FAILED",
          details: error.issues,
        },
        { status: 400 },
      );
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    const code = message.startsWith("UNSUPPORTED_CHAIN") ? "UNSUPPORTED_CHAIN" : "ANALYSIS_STATUS_FAILED";

    return NextResponse.json(
      {
        code,
      },
      { status: code === "UNSUPPORTED_CHAIN" ? 400 : 500 },
    );
  }
}
