import { tasks, task } from "@trigger.dev/sdk/v3";

import {
  finalizeAnalysisRun,
  getAnalysisRunById,
  updateAnalysisRunProgress,
} from "@/server/analysis/analysis-run.repository";

export type AnalysisMode = "full_history" | "incremental";

export type AnalysisRunTaskPayload = {
  runId: string;
  walletAddress: string;
  chainId: number;
  mode: AnalysisMode;
};

type AnalysisRunTaskDeps = {
  triggerAndWait: (taskId: string, payload: Record<string, unknown>, options?: {
    idempotencyKey?: string;
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
  updateAnalysisRunProgress: (runId: string, input: {
    status: string;
    stage: string;
    progressPct: number;
  }) => Promise<unknown>;
};

function getAnalysisRunTaskDeps(): AnalysisRunTaskDeps {
  return {
    triggerAndWait: tasks.triggerAndWait.bind(tasks),
    finalizeAnalysisRun: finalizeAnalysisRun as AnalysisRunTaskDeps["finalizeAnalysisRun"],
    getAnalysisRunById,
    updateAnalysisRunProgress,
  };
}

export async function runEngineV2AnalysisOrchestration(
  payload: AnalysisRunTaskPayload,
  deps: Pick<AnalysisRunTaskDeps, "triggerAndWait" | "updateAnalysisRunProgress" | "finalizeAnalysisRun">,
) {
  const enginePayload = {
    analysisRunId: payload.runId,
    walletAddress: payload.walletAddress,
    chainId: payload.chainId,
    mode: payload.mode,
  };

  await deps.updateAnalysisRunProgress(payload.runId, {
    status: "running",
    stage: "engine_v2_collection",
    progressPct: 5,
  });
  const result = await deps.triggerAndWait("engine-v2-start-collection", enginePayload, {
    idempotencyKey: `${payload.runId}:engine-v2:start`,
  });
  if (!result.ok) {
    await deps.finalizeAnalysisRun({
      runId: payload.runId,
      status: "failed",
      coverage: "partial",
      coverageReasonsJson: ["engineV2TaskFailed", "engine-v2-start-collection"],
      lastError: result.error instanceof Error ? result.error.message : "engine-v2-start-collection failed",
    });
    throw result.error ?? new Error("engine-v2-start-collection failed");
  }

  return {
    engine: "v2",
    queued: true,
    mode: payload.mode,
  };
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

  return runEngineV2AnalysisOrchestration(payload, deps);
}

export const analysisRunTask = task({
  id: "analysis-run",
  run: async (payload: AnalysisRunTaskPayload) => runAnalysisRunTask(payload),
});
