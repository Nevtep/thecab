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
import {
  shouldReuseCompletedSameDayRun,
  shouldSupersedeCompletedSameDayRunForDevelopment,
} from "@/server/analysis/start-policy";
import { assertAuthenticatedWallet } from "@/server/analysis/assertAuthenticatedWallet";
import { triggerAnalysisRunTask } from "@/server/trigger/client";

const RESPONSE_HEADERS = {
  "Cache-Control": "no-store",
};

export const startAnalysisSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).transform((value) => value.toLowerCase()),
  chainId: z.number().int().positive().default(SUPPORTED_CHAIN_ID),
  mode: z.enum(["full_history", "incremental"]).default("full_history"),
});

export type StartAnalysisPayload = z.infer<typeof startAnalysisSchema>;

export type StartAnalysisDeps = {
  assertSupportedChain: typeof assertSupportedChain;
  assertAuthenticatedWallet: typeof assertAuthenticatedWallet;
  findActiveAnalysisRun: typeof findActiveAnalysisRun;
  findLatestSameDayAnalysisRun: typeof findLatestSameDayAnalysisRun;
  findLatestCompletedAnalysisRun: typeof findLatestCompletedAnalysisRun;
  shouldReuseCompletedSameDayRun: typeof shouldReuseCompletedSameDayRun;
  shouldSupersedeCompletedSameDayRunForDevelopment: typeof shouldSupersedeCompletedSameDayRunForDevelopment;
  supersedeCompletedRunForDevelopmentRerun: typeof supersedeCompletedRunForDevelopmentRerun;
  createAnalysisRun: typeof createAnalysisRun;
  triggerAnalysisRunTask: typeof triggerAnalysisRunTask;
  mergeAnalysisRunMetadata: typeof mergeAnalysisRunMetadata;
  updateAnalysisRunProgress: typeof updateAnalysisRunProgress;
  now: () => Date;
  todayUtcBucket: () => string;
};

export function getStartAnalysisDeps(): StartAnalysisDeps {
  return {
    assertSupportedChain,
    assertAuthenticatedWallet,
    findActiveAnalysisRun,
    findLatestSameDayAnalysisRun,
    findLatestCompletedAnalysisRun,
    shouldReuseCompletedSameDayRun,
    shouldSupersedeCompletedSameDayRunForDevelopment,
    supersedeCompletedRunForDevelopmentRerun,
    createAnalysisRun,
    triggerAnalysisRunTask,
    mergeAnalysisRunMetadata,
    updateAnalysisRunProgress,
    now: () => new Date(),
    todayUtcBucket,
  };
}

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

export function errorResponse(code: string, status: number, details?: unknown) {
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

export async function runStartAnalysis(
  payload: StartAnalysisPayload,
  deps: StartAnalysisDeps = getStartAnalysisDeps(),
) {
  deps.assertSupportedChain(payload.chainId);
  await deps.assertAuthenticatedWallet(payload.walletAddress);

  const [activeRun, sameDayRun, latestCompletedRun] = await Promise.all([
    deps.findActiveAnalysisRun(payload.walletAddress, payload.chainId),
    deps.findLatestSameDayAnalysisRun(payload.walletAddress, payload.chainId, deps.todayUtcBucket()),
    deps.findLatestCompletedAnalysisRun(payload.walletAddress, payload.chainId),
  ]);

  if (activeRun) {
    return errorResponse("run_already_in_progress", 409, {
      run: serializeRunResponse(activeRun, true),
    });
  }

  if (deps.shouldReuseCompletedSameDayRun({
    sameDayRunStatus: sameDayRun?.status,
    requestedMode: payload.mode,
  })) {
    return NextResponse.json(serializeRunResponse(sameDayRun, true), {
      status: 200,
      headers: RESPONSE_HEADERS,
    });
  }

  if (sameDayRun && deps.shouldSupersedeCompletedSameDayRunForDevelopment({
    sameDayRunStatus: sameDayRun.status,
    requestedMode: payload.mode,
  })) {
    await deps.supersedeCompletedRunForDevelopmentRerun(sameDayRun.id);
  }
  const triggeredAtUtc = deps.now();
  const resolvedMode = payload.mode;

  const run = await deps.createAnalysisRun({
    walletAddress: payload.walletAddress,
    chainId: payload.chainId,
    mode: resolvedMode,
    triggeredAtUtc,
  });

  try {
    const handle = await deps.triggerAnalysisRunTask({
      runId: run.id,
      walletAddress: payload.walletAddress,
      chainId: payload.chainId,
      mode: resolvedMode,
    });
    await deps.mergeAnalysisRunMetadata(run.id, {
      triggerRunId: handle.id,
      plannedSliceCount: 1,
      resolvedMode,
      latestCompletedRunId: latestCompletedRun?.id ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await deps.updateAnalysisRunProgress(run.id, {
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
}