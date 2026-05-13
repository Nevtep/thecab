import { NextResponse } from "next/server";
import { z } from "zod";

import { getLatestAnalysisRun } from "@/server/analysis/analysis-run.repository";
import { assertSupportedChain, SUPPORTED_CHAIN_ID } from "@/server/chains";

const statusQuerySchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  chainId: z.coerce.number().int().positive().default(SUPPORTED_CHAIN_ID),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const payload = statusQuerySchema.parse({
      walletAddress: searchParams.get("walletAddress"),
      chainId: searchParams.get("chainId") ?? SUPPORTED_CHAIN_ID,
    });

    assertSupportedChain(payload.chainId);

    const run = await getLatestAnalysisRun(payload.walletAddress, payload.chainId);

    if (!run) {
      return NextResponse.json({
        walletAddress: payload.walletAddress.toLowerCase(),
        chainId: payload.chainId,
        status: "not_analyzed",
        stage: "idle",
        progressPct: 0,
        lastUpdatedAt: null,
        lastError: null,
      });
    }

    return NextResponse.json({
      walletAddress: run.walletAddress,
      chainId: run.chainId,
      status: run.status,
      stage: run.stage,
      progressPct: run.progressPct,
      lastUpdatedAt: run.updatedAt,
      lastError: run.lastError,
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
        message,
      },
      { status: 500 },
    );
  }
}
