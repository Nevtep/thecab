import { tasks, task } from "@trigger.dev/sdk/v3";

import { getAnalysisRunById, updateAnalysisRunProgress } from "@/server/analysis/analysis-run.repository";
import { getAnalysisSlice, updateAnalysisSlice } from "@/server/analysis/analysis-slice.repository";
import { readCoverageReasonsFromError } from "@/server/providers/providerErrors";

export type AnalysisSliceTaskPayload = {
  runId: string;
  sliceId: string;
  walletAddress: string;
  chainId: number;
  sliceIndex: number;
  isFullyCached: boolean;
};

export const analysisSliceTask = task({
  id: "analysis-slice",
  run: async (payload: AnalysisSliceTaskPayload) => {
    const run = await getAnalysisRunById(payload.runId);
    if (!run || run.status === "cancelled") {
      return { cancelled: true };
    }

    const slice = await getAnalysisSlice(payload.sliceId);
    if (!slice) {
      throw new Error(`ANALYSIS_SLICE_NOT_FOUND:${payload.sliceId}`);
    }

    if (payload.isFullyCached) {
      await updateAnalysisSlice({
        sliceId: payload.sliceId,
        status: "skipped_cached",
        startedAt: slice.startedAt ?? new Date(),
        completedAt: new Date(),
        providerAttemptsJson: {
          moralis: 0,
          alchemyRpc: 0,
          alchemyPrices: 0,
        },
        txCountSeen: slice.txCountSeen,
        txCountProcessed: slice.txCountProcessed,
      });

      return {
        sliceId: payload.sliceId,
        status: "skipped_cached",
        coverageReasons: [],
        txCountSeen: slice.txCountSeen,
        txCountProcessed: slice.txCountProcessed,
      };
    }

    await updateAnalysisSlice({
      sliceId: payload.sliceId,
      status: "running",
      startedAt: new Date(),
      incrementAttemptCount: true,
    });
    await updateAnalysisRunProgress(payload.runId, {
      status: "running",
      stage: `slice:${payload.sliceIndex}`,
      progressPct: 25,
    });

    const depositsResult = await tasks.triggerAndWait("phase-deposits", {
      runId: payload.runId,
      sliceId: payload.sliceId,
      walletAddress: payload.walletAddress,
      chainId: payload.chainId,
    });
    if (!depositsResult.ok) {
      const coverageReasons = readCoverageReasonsFromError(depositsResult.error);
      await updateAnalysisSlice({
        sliceId: payload.sliceId,
        status: "failed",
        completedAt: new Date(),
        coverageReasonsJson: coverageReasons,
      });
      throw depositsResult.error;
    }

    const rewardsResult = await tasks.triggerAndWait("phase-rewards", {
      runId: payload.runId,
      sliceId: payload.sliceId,
      walletAddress: payload.walletAddress,
      chainId: payload.chainId,
    });
    if (!rewardsResult.ok) {
      const coverageReasons = readCoverageReasonsFromError(rewardsResult.error);
      await updateAnalysisSlice({
        sliceId: payload.sliceId,
        status: "failed",
        completedAt: new Date(),
        coverageReasonsJson: coverageReasons,
      });
      throw rewardsResult.error;
    }

    const coverageReasons = Array.from(new Set([
      ...(depositsResult.output.coverageReasons ?? []),
      ...(rewardsResult.output.coverageReasons ?? []),
    ]));

    await updateAnalysisSlice({
      sliceId: payload.sliceId,
      status: "complete",
      completedAt: new Date(),
      coverageReasonsJson: coverageReasons,
      providerAttemptsJson: {
        moralis: depositsResult.output.providerAttempts?.moralis ?? 0,
        alchemyRpc:
          (depositsResult.output.providerAttempts?.alchemyRpc ?? 0) +
          (rewardsResult.output.providerAttempts?.alchemyRpc ?? 0),
        alchemyPrices:
          (depositsResult.output.providerAttempts?.alchemyPrices ?? 0) +
          (rewardsResult.output.providerAttempts?.alchemyPrices ?? 0),
      },
      txCountSeen: depositsResult.output.txCountSeen,
      txCountProcessed: depositsResult.output.txCountProcessed,
    });

    return {
      sliceId: payload.sliceId,
      status: "complete",
      coverageReasons,
      txCountSeen: depositsResult.output.txCountSeen,
      txCountProcessed: depositsResult.output.txCountProcessed,
      rewardEventCount: rewardsResult.output.rewardEventCount,
    };
  },
});