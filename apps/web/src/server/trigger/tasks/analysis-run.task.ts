import { tasks, task } from "@trigger.dev/sdk/v3";

import {
  finalizeAnalysisRun,
  getAnalysisRunById,
  readRunProgressSnapshot,
  updateAnalysisRunProgress,
} from "@/server/analysis/analysis-run.repository";
import {
  createAnalysisSlices,
  listRunSlices,
  updateAnalysisSlice,
} from "@/server/analysis/analysis-slice.repository";
import { prepareAnalysisRunContext, type AnalysisMode } from "@/server/analysis/orchestrator";
import { readCoverageReasonsFromError } from "@/server/providers/providerErrors";

export type AnalysisRunTaskPayload = {
  runId: string;
  walletAddress: string;
  chainId: number;
  mode: AnalysisMode;
};

type AnalysisRunTaskDeps = {
  batchTriggerAndWait: (taskId: string, items: Array<{
    payload: {
      runId: string;
      sliceId: string;
      walletAddress: string;
      chainId: number;
      sliceIndex: number;
      isFullyCached: boolean;
    };
    options: {
      idempotencyKey: string;
    };
  }>) => Promise<{
    runs: Array<{ ok: boolean; error?: unknown }>;
  }>;
  triggerAndWait: (taskId: string, payload: {
    runId: string;
    walletAddress: string;
    chainId: number;
  }) => Promise<{
    ok: boolean;
    output?: Record<string, unknown>;
    error?: unknown;
  }>;
  finalizeAnalysisRun: (input: {
    runId: string;
    status: string;
    coverage: string;
    coverageReasonsJson: string[];
    lastError: string;
  }) => Promise<unknown>;
  getAnalysisRunById: (runId: string) => Promise<{
    id: string;
    status: string;
    triggeredAtUtc: Date;
  } | null>;
  readRunProgressSnapshot: (runId: string) => Promise<{
    completedSlices: number;
    totalSlices: number;
  }>;
  updateAnalysisRunProgress: (runId: string, input: {
    status: string;
    stage: string;
    progressPct: number;
  }) => Promise<unknown>;
  createAnalysisSlices: (rows: Array<{
    runId: string;
    walletAddress: string;
    chainId: number;
    sliceIndex: number;
    sliceStartUtc: Date;
    sliceEndUtc: Date;
  }>) => Promise<Array<{
    id: string;
    sliceIndex: number;
  }>>;
  listRunSlices: (runId: string) => Promise<Array<{
    id: string;
    sliceIndex: number;
  }>>;
  updateAnalysisSlice: (input: {
    sliceId: string;
    status: string;
    completedAt: Date;
    coverageReasonsJson: string[];
  }) => Promise<unknown>;
  prepareAnalysisRunContext: (input: {
    walletAddress: string;
    chainId: number;
    requestedMode?: AnalysisMode | null;
    triggeredAtUtc?: Date;
  }) => Promise<{
    mode: AnalysisMode;
    slices: Array<{
      sliceIndex: number;
      sliceStartUtc: Date;
      sliceEndUtc: Date;
      isFullyCached: boolean;
    }>;
  }>;
  readCoverageReasonsFromError: (error: unknown) => string[];
};

function getAnalysisRunTaskDeps(): AnalysisRunTaskDeps {
  return {
    batchTriggerAndWait: tasks.batchTriggerAndWait.bind(tasks),
    triggerAndWait: tasks.triggerAndWait.bind(tasks),
    finalizeAnalysisRun: finalizeAnalysisRun as AnalysisRunTaskDeps["finalizeAnalysisRun"],
    getAnalysisRunById,
    readRunProgressSnapshot,
    updateAnalysisRunProgress,
    createAnalysisSlices,
    listRunSlices,
    updateAnalysisSlice: updateAnalysisSlice as AnalysisRunTaskDeps["updateAnalysisSlice"],
    prepareAnalysisRunContext,
    readCoverageReasonsFromError,
  };
}

function getSliceProgressPct(completedSlices: number, totalSlices: number) {
  if (totalSlices <= 0) {
    return 15;
  }

  return Math.min(80, 15 + Math.round((completedSlices / totalSlices) * 65));
}

export async function runAnalysisRunTask(
  payload: AnalysisRunTaskPayload,
  deps: AnalysisRunTaskDeps = getAnalysisRunTaskDeps(),
) {
  const currentRun = await deps.getAnalysisRunById(payload.runId);
  if (!currentRun) {
    throw new Error(`ANALYSIS_RUN_NOT_FOUND:${payload.runId}`);
  }

  if (currentRun.status === "cancelled") {
    return { cancelled: true };
  }

  await deps.updateAnalysisRunProgress(payload.runId, {
    status: "running",
    stage: "planning",
    progressPct: 5,
  });

  try {
    const context = await deps.prepareAnalysisRunContext({
      walletAddress: payload.walletAddress,
      chainId: payload.chainId,
      requestedMode: payload.mode,
      triggeredAtUtc: currentRun.triggeredAtUtc,
    });
    const existingSlices = await deps.listRunSlices(payload.runId);
    const slices = existingSlices.length > 0
      ? existingSlices
      : await deps.createAnalysisSlices(
        context.slices.map((slice) => ({
          runId: payload.runId,
          walletAddress: payload.walletAddress,
          chainId: payload.chainId,
          sliceIndex: slice.sliceIndex,
          sliceStartUtc: slice.sliceStartUtc,
          sliceEndUtc: slice.sliceEndUtc,
        })),
      );

    await deps.updateAnalysisRunProgress(payload.runId, {
      status: "running",
      stage: "slices",
      progressPct: 15,
    });

    const slicePlanByIndex = new Map(context.slices.map((slice) => [slice.sliceIndex, slice] as const));
    const sliceResults = await deps.batchTriggerAndWait("analysis-slice", slices.map((slice) => ({
      payload: {
        runId: payload.runId,
        sliceId: slice.id,
        walletAddress: payload.walletAddress,
        chainId: payload.chainId,
        sliceIndex: slice.sliceIndex,
        isFullyCached: slicePlanByIndex.get(slice.sliceIndex)?.isFullyCached ?? false,
      },
      options: {
        idempotencyKey: `${payload.runId}:slice:${slice.id}`,
      },
    })));

    for (let index = 0; index < sliceResults.runs.length; index += 1) {
      const result = sliceResults.runs[index];
      const slice = slices[index];
      if (!result || !slice) {
        continue;
      }

      if (!result.ok) {
        const coverageReasons = deps.readCoverageReasonsFromError(result.error);
        await deps.updateAnalysisSlice({
          sliceId: slice.id,
          status: "failed",
          completedAt: new Date(),
          coverageReasonsJson: coverageReasons,
        });
      }
    }

    const sliceProgress = await deps.readRunProgressSnapshot(payload.runId);
    await deps.updateAnalysisRunProgress(payload.runId, {
      status: "running",
      stage: "activity",
      progressPct: getSliceProgressPct(sliceProgress.completedSlices, sliceProgress.totalSlices),
    });

    const activityResult = await deps.triggerAndWait("phase-activity", {
      runId: payload.runId,
      walletAddress: payload.walletAddress,
      chainId: payload.chainId,
    });
    if (!activityResult.ok) {
      await deps.finalizeAnalysisRun({
        runId: payload.runId,
        status: "failed",
        coverage: "partial",
        coverageReasonsJson: ["unknownError"],
        lastError: activityResult.error instanceof Error ? activityResult.error.message : "Activity phase failed",
      });
      throw activityResult.error;
    }

    await deps.updateAnalysisRunProgress(payload.runId, {
      status: "running",
      stage: "pools",
      progressPct: 88,
    });

    const poolsResult = await deps.triggerAndWait("phase-pools", {
      runId: payload.runId,
      walletAddress: payload.walletAddress,
      chainId: payload.chainId,
    });
    if (!poolsResult.ok) {
      await deps.finalizeAnalysisRun({
        runId: payload.runId,
        status: "failed",
        coverage: "partial",
        coverageReasonsJson: ["unknownError"],
        lastError: poolsResult.error instanceof Error ? poolsResult.error.message : "Pools phase failed",
      });
      throw poolsResult.error;
    }

    await deps.updateAnalysisRunProgress(payload.runId, {
      status: "running",
      stage: "finalize",
      progressPct: 96,
    });

    const finalizeResult = await deps.triggerAndWait("phase-finalize", {
      runId: payload.runId,
      walletAddress: payload.walletAddress,
      chainId: payload.chainId,
    });
    if (!finalizeResult.ok) {
      await deps.finalizeAnalysisRun({
        runId: payload.runId,
        status: "failed",
        coverage: "partial",
        coverageReasonsJson: ["unknownError"],
        lastError: finalizeResult.error instanceof Error ? finalizeResult.error.message : "Finalize phase failed",
      });
      throw finalizeResult.error;
    }

    return {
      sliceCount: slices.length,
      completedSlices: sliceProgress.completedSlices,
      mode: context.mode,
    };
  } catch (error) {
    const latestRun = await deps.getAnalysisRunById(payload.runId);
    if (latestRun && !["complete", "failed", "cancelled"].includes(latestRun.status)) {
      await deps.finalizeAnalysisRun({
        runId: payload.runId,
        status: "failed",
        coverage: "partial",
        coverageReasonsJson: deps.readCoverageReasonsFromError(error),
        lastError: error instanceof Error ? error.message : "Analysis run failed",
      });
    }

    throw error;
  }
}

export const analysisRunTask = task({
  id: "analysis-run",
  run: async (payload: AnalysisRunTaskPayload) => runAnalysisRunTask(payload),
});