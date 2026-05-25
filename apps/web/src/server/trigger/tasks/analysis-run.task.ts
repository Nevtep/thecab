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

function getSliceProgressPct(completedSlices: number, totalSlices: number) {
  if (totalSlices <= 0) {
    return 15;
  }

  return Math.min(80, 15 + Math.round((completedSlices / totalSlices) * 65));
}

export const analysisRunTask = task({
  id: "analysis-run",
  run: async (payload: AnalysisRunTaskPayload) => {
    const currentRun = await getAnalysisRunById(payload.runId);
    if (!currentRun) {
      throw new Error(`ANALYSIS_RUN_NOT_FOUND:${payload.runId}`);
    }

    if (currentRun.status === "cancelled") {
      return { cancelled: true };
    }

    await updateAnalysisRunProgress(payload.runId, {
      status: "running",
      stage: "planning",
      progressPct: 5,
    });

    try {
      const context = await prepareAnalysisRunContext({
        walletAddress: payload.walletAddress,
        chainId: payload.chainId,
        requestedMode: payload.mode,
        triggeredAtUtc: currentRun.triggeredAtUtc,
      });
      const existingSlices = await listRunSlices(payload.runId);
      const slices = existingSlices.length > 0
        ? existingSlices
        : await createAnalysisSlices(
          context.slices.map((slice) => ({
            runId: payload.runId,
            walletAddress: payload.walletAddress,
            chainId: payload.chainId,
            sliceIndex: slice.sliceIndex,
            sliceStartUtc: slice.sliceStartUtc,
            sliceEndUtc: slice.sliceEndUtc,
          })),
        );

      await updateAnalysisRunProgress(payload.runId, {
        status: "running",
        stage: "slices",
        progressPct: 15,
      });

      const slicePlanByIndex = new Map(context.slices.map((slice) => [slice.sliceIndex, slice] as const));
      const sliceResults = await tasks.batchTriggerAndWait("analysis-slice", slices.map((slice) => ({
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
          const coverageReasons = readCoverageReasonsFromError(result.error);
          await updateAnalysisSlice({
            sliceId: slice.id,
            status: "failed",
            completedAt: new Date(),
            coverageReasonsJson: coverageReasons,
          });
        }
      }

      const sliceProgress = await readRunProgressSnapshot(payload.runId);
      await updateAnalysisRunProgress(payload.runId, {
        status: "running",
        stage: "activity",
        progressPct: getSliceProgressPct(sliceProgress.completedSlices, sliceProgress.totalSlices),
      });

      const activityResult = await tasks.triggerAndWait("phase-activity", {
        runId: payload.runId,
        walletAddress: payload.walletAddress,
        chainId: payload.chainId,
      });
      if (!activityResult.ok) {
        await finalizeAnalysisRun({
          runId: payload.runId,
          status: "failed",
          coverage: "partial",
          coverageReasonsJson: ["unknownError"],
          lastError: activityResult.error instanceof Error ? activityResult.error.message : "Activity phase failed",
        });
        throw activityResult.error;
      }

      await updateAnalysisRunProgress(payload.runId, {
        status: "running",
        stage: "pools",
        progressPct: 88,
      });

      const poolsResult = await tasks.triggerAndWait("phase-pools", {
        runId: payload.runId,
        walletAddress: payload.walletAddress,
        chainId: payload.chainId,
      });
      if (!poolsResult.ok) {
        await finalizeAnalysisRun({
          runId: payload.runId,
          status: "failed",
          coverage: "partial",
          coverageReasonsJson: ["unknownError"],
          lastError: poolsResult.error instanceof Error ? poolsResult.error.message : "Pools phase failed",
        });
        throw poolsResult.error;
      }

      await updateAnalysisRunProgress(payload.runId, {
        status: "running",
        stage: "finalize",
        progressPct: 96,
      });

      const finalizeResult = await tasks.triggerAndWait("phase-finalize", {
        runId: payload.runId,
        walletAddress: payload.walletAddress,
        chainId: payload.chainId,
      });
      if (!finalizeResult.ok) {
        await finalizeAnalysisRun({
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
      const latestRun = await getAnalysisRunById(payload.runId);
      if (latestRun && !["complete", "failed", "cancelled"].includes(latestRun.status)) {
        await finalizeAnalysisRun({
          runId: payload.runId,
          status: "failed",
          coverage: "partial",
          coverageReasonsJson: readCoverageReasonsFromError(error),
          lastError: error instanceof Error ? error.message : "Analysis run failed",
        });
      }

      throw error;
    }
  },
});