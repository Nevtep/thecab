import { NextResponse } from "next/server";
import { z } from "zod";

import { assertSupportedChain, SUPPORTED_CHAIN_ID } from "@/server/chains";
import {
  findActiveAnalysisRun,
  findLatestCompletedAnalysisRun,
  findLatestSameDayAnalysisRun,
  createAnalysisRun,
  mergeAnalysisRunMetadata,
  supersedeCompletedRunForDevelopmentRerun,
  updateAnalysisRunProgress,
} from "@/server/analysis/analysis-run.repository";
import { prepareAnalysisRunContext } from "@/server/analysis/orchestrator";
import {
  shouldReuseCompletedSameDayRun,
  shouldSupersedeCompletedSameDayRunForDevelopment,
} from "@/server/analysis/start-policy";
import { assertAuthenticatedWallet } from "@/server/analysis/assertAuthenticatedWallet";
import { triggerAnalysisRunTask } from "@/server/trigger/client";

const RESPONSE_HEADERS = {
  "Cache-Control": "no-store",
};

const startAnalysisSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).transform((value) => value.toLowerCase()),
  chainId: z.number().int().positive().default(SUPPORTED_CHAIN_ID),
  mode: z.enum(["full_history", "incremental"]).optional(),
});

function serializeRunResponse(run: {
  id: string;
  walletAddress: string;
  chainId: number;
  status: string;
  mode: string;
  coverage?: string | null;
  coverageReasonsJson?: string[];
  triggeredAtUtc?: Date | null;
  updatedAt?: Date | null;
  completedAt?: Date | null;
  lastError?: string | null;
}, reused: boolean) {
  return {
    runId: run.id,
    walletAddress: run.walletAddress,
    chainId: run.chainId,
    status: run.status,
    mode: run.mode,
    utcDayBucket: run.triggeredAtUtc?.toISOString().slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    coverage: run.coverage ?? "unknown",
    coverageReasons: run.coverageReasonsJson ?? [],
    isExistingRun: reused,
    triggeredAtUtc: run.triggeredAtUtc?.toISOString() ?? null,
    lastUpdatedAt: run.updatedAt?.toISOString() ?? null,
    completedAt: run.completedAt?.toISOString() ?? null,
    lastError: run.lastError ?? null,
  };
}

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

function todayUtcBucket() {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  try {
    const payload = startAnalysisSchema.parse(await request.json());
    assertSupportedChain(payload.chainId);
    await assertAuthenticatedWallet(payload.walletAddress);

    const [activeRun, sameDayRun, latestCompletedRun] = await Promise.all([
      findActiveAnalysisRun(payload.walletAddress, payload.chainId),
      findLatestSameDayAnalysisRun(payload.walletAddress, payload.chainId, todayUtcBucket()),
      findLatestCompletedAnalysisRun(payload.walletAddress, payload.chainId),
    ]);

    if (activeRun) {
      return errorResponse("run_already_in_progress", 409, {
        run: serializeRunResponse(activeRun, true),
      });
    }

    if (shouldReuseCompletedSameDayRun({ sameDayRunStatus: sameDayRun?.status })) {
      return NextResponse.json(serializeRunResponse(sameDayRun, true), {
        status: 200,
        headers: RESPONSE_HEADERS,
      });
    }

    if (sameDayRun && shouldSupersedeCompletedSameDayRunForDevelopment({ sameDayRunStatus: sameDayRun.status })) {
      await supersedeCompletedRunForDevelopmentRerun(sameDayRun.id);
    }

    const context = await prepareAnalysisRunContext({
      walletAddress: payload.walletAddress,
      chainId: payload.chainId,
      requestedMode: payload.mode ?? (latestCompletedRun ? "incremental" : null),
    });

    const run = await createAnalysisRun({
      walletAddress: payload.walletAddress,
      chainId: payload.chainId,
      mode: context.mode,
      triggeredAtUtc: context.triggeredAtUtc,
    });

    try {
      const handle = await triggerAnalysisRunTask({
        runId: run.id,
        walletAddress: payload.walletAddress,
        chainId: payload.chainId,
        mode: context.mode,
      });
      await mergeAnalysisRunMetadata(run.id, {
        triggerRunId: handle.id,
        plannedSliceCount: context.slices.length,
        resolvedMode: context.mode,
        latestCompletedRunId: latestCompletedRun?.id ?? null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await updateAnalysisRunProgress(run.id, {
        status: "failed",
        stage: "failed",
        progressPct: 100,
        coverage: "partial",
        coverageReasonsJson: ["unknownError"],
        lastError: message,
      });
      throw error;
    }

    return NextResponse.json(serializeRunResponse(run, false), {
      status: 202,
      headers: RESPONSE_HEADERS,
    });
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
