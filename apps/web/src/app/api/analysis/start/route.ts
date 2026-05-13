import { NextResponse } from "next/server";
import { z } from "zod";

import { assertSupportedChain, SUPPORTED_CHAIN_ID } from "@/server/chains";
import {
  createAnalysisRun,
  updateAnalysisRunProgress,
} from "@/server/analysis/analysis-run.repository";
import { runAnalyzeWalletTask } from "@/server/analysis/analyzeWalletTask";
import { triggerAnalyzeWalletTask } from "@/server/trigger/client";

const startAnalysisSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  chainId: z.number().int().positive().default(SUPPORTED_CHAIN_ID),
  mode: z.enum(["full_history", "incremental"]).default("full_history"),
});

export async function POST(request: Request) {
  try {
    const payload = startAnalysisSchema.parse(await request.json());
    assertSupportedChain(payload.chainId);

    const run = await createAnalysisRun({
      walletAddress: payload.walletAddress,
      chainId: payload.chainId,
      mode: payload.mode,
    });

    await triggerAnalyzeWalletTask({
      runId: run.id,
      walletAddress: payload.walletAddress,
      chainId: payload.chainId,
      mode: payload.mode,
    });

    // Phase 0 skeleton: run in-process to validate lifecycle before queue extraction.
    void runAnalyzeWalletTask({
      runId: run.id,
      walletAddress: payload.walletAddress,
      chainId: payload.chainId,
      mode: payload.mode,
    }).catch(async (error) => {
      const message = error instanceof Error ? error.message : "Unknown error";
      await updateAnalysisRunProgress(run.id, {
        status: "failed",
        stage: "failed",
        progressPct: 100,
        lastError: message,
      });
    });

    return NextResponse.json(
      {
        runId: run.id,
        walletAddress: run.walletAddress,
        chainId: run.chainId,
        status: run.status,
        stage: run.stage,
        progressPct: run.progressPct,
      },
      { status: 202 },
    );
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
    const code = message.startsWith("UNSUPPORTED_CHAIN") ? "UNSUPPORTED_CHAIN" : "ANALYSIS_START_FAILED";

    return NextResponse.json(
      {
        code,
        message,
      },
      { status: 500 },
    );
  }
}
