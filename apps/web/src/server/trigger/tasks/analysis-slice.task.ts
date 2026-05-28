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

type AnalysisSliceTaskDeps = {
  triggerAndWait: (taskId: string, payload: {
    runId: string;
    sliceId: string;
    walletAddress: string;
    chainId: number;
  }) => Promise<{
    ok: boolean;
    output?: {
      coverageReasons?: string[];
      providerAttempts?: {
        moralis?: number;
        alchemyRpc?: number;
        alchemyPrices?: number;
      };
      txCountSeen?: number;
      txCountProcessed?: number;
      rewardEventCount?: number;
    };
    error?: unknown;
  }>;
  getAnalysisRunById: (runId: string) => Promise<{
    id: string;
    status: string;
  } | null>;
  updateAnalysisRunProgress: (runId: string, input: {
    status: string;
    stage: string;
    progressPct: number;
  }) => Promise<unknown>;
  getAnalysisSlice: (sliceId: string) => Promise<{
    id: string;
    startedAt: Date | null;
    txCountSeen: number | null;
    txCountProcessed: number | null;
  } | null>;
  updateAnalysisSlice: (input: {
    sliceId: string;
    status: string;
    startedAt?: Date;
    completedAt?: Date;
    incrementAttemptCount?: boolean;
    providerAttemptsJson?: {
      moralis: number;
      alchemyRpc: number;
      alchemyPrices: number;
    };
    coverageReasonsJson?: string[];
    txCountSeen?: number | null;
    txCountProcessed?: number | null;
  }) => Promise<unknown>;
  readCoverageReasonsFromError: (error: unknown) => string[];
};

function getAnalysisSliceTaskDeps(): AnalysisSliceTaskDeps {
  return {
    triggerAndWait: tasks.triggerAndWait.bind(tasks),
    getAnalysisRunById,
    updateAnalysisRunProgress,
    getAnalysisSlice,
    updateAnalysisSlice: updateAnalysisSlice as AnalysisSliceTaskDeps["updateAnalysisSlice"],
    readCoverageReasonsFromError,
  };
}

export async function runAnalysisSliceTask(
  payload: AnalysisSliceTaskPayload,
  deps: AnalysisSliceTaskDeps = getAnalysisSliceTaskDeps(),
) {
  const run = await deps.getAnalysisRunById(payload.runId);
  if (!run || run.status === "cancelled") {
    return { cancelled: true };
  }

  const slice = await deps.getAnalysisSlice(payload.sliceId);
  if (!slice) {
    throw new Error(`ANALYSIS_SLICE_NOT_FOUND:${payload.sliceId}`);
  }

  if (payload.isFullyCached) {
    await deps.updateAnalysisSlice({
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

  await deps.updateAnalysisSlice({
    sliceId: payload.sliceId,
    status: "running",
    startedAt: new Date(),
    incrementAttemptCount: true,
  });
  await deps.updateAnalysisRunProgress(payload.runId, {
    status: "running",
    stage: `slice:${payload.sliceIndex}`,
    progressPct: 25,
  });

  const depositsResult = await deps.triggerAndWait("phase-deposits", {
    runId: payload.runId,
    sliceId: payload.sliceId,
    walletAddress: payload.walletAddress,
    chainId: payload.chainId,
  });
  if (!depositsResult.ok) {
    const coverageReasons = deps.readCoverageReasonsFromError(depositsResult.error);
    await deps.updateAnalysisSlice({
      sliceId: payload.sliceId,
      status: "failed",
      completedAt: new Date(),
      coverageReasonsJson: coverageReasons,
    });
    throw depositsResult.error;
  }
  const depositsOutput = depositsResult.output ?? {};

  const rewardsResult = await deps.triggerAndWait("phase-rewards", {
    runId: payload.runId,
    sliceId: payload.sliceId,
    walletAddress: payload.walletAddress,
    chainId: payload.chainId,
  });
  if (!rewardsResult.ok) {
    const coverageReasons = deps.readCoverageReasonsFromError(rewardsResult.error);
    await deps.updateAnalysisSlice({
      sliceId: payload.sliceId,
      status: "failed",
      completedAt: new Date(),
      coverageReasonsJson: coverageReasons,
    });
    throw rewardsResult.error;
  }
  const rewardsOutput = rewardsResult.output ?? {};

  const coverageReasons = Array.from(new Set([
    ...(depositsOutput.coverageReasons ?? []),
    ...(rewardsOutput.coverageReasons ?? []),
  ]));

  await deps.updateAnalysisSlice({
    sliceId: payload.sliceId,
    status: "complete",
    completedAt: new Date(),
    coverageReasonsJson: coverageReasons,
    providerAttemptsJson: {
      moralis: depositsOutput.providerAttempts?.moralis ?? 0,
      alchemyRpc:
        (depositsOutput.providerAttempts?.alchemyRpc ?? 0) +
        (rewardsOutput.providerAttempts?.alchemyRpc ?? 0),
      alchemyPrices:
        (depositsOutput.providerAttempts?.alchemyPrices ?? 0) +
        (rewardsOutput.providerAttempts?.alchemyPrices ?? 0),
    },
    txCountSeen: depositsOutput.txCountSeen,
    txCountProcessed: depositsOutput.txCountProcessed,
  });

  return {
    sliceId: payload.sliceId,
    status: "complete",
    coverageReasons,
    txCountSeen: depositsOutput.txCountSeen,
    txCountProcessed: depositsOutput.txCountProcessed,
    rewardEventCount: rewardsOutput.rewardEventCount,
  };
}

export const analysisSliceTask = task({
  id: "analysis-slice",
  run: async (payload: AnalysisSliceTaskPayload) => runAnalysisSliceTask(payload),
});