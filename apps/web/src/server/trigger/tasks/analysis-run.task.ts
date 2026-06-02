import { tasks, task } from "@trigger.dev/sdk/v3";

import {
  finalizeAnalysisRun,
  getAnalysisRunById,
  updateAnalysisRunProgress,
} from "@/server/analysis/analysis-run.repository";
import { taskInfo, taskWarn, withTaskLogging } from "@/server/trigger/tasks/task-logging";

export const ANALYSIS_RUN_TASK_ID = "analysis-run-v2";

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
  taskInfo(ANALYSIS_RUN_TASK_ID, "triggering engine-v2-start-collection", {
    runId: payload.runId,
    walletAddress: payload.walletAddress,
    chainId: payload.chainId,
    mode: payload.mode,
  });
  const result = await deps.triggerAndWait("engine-v2-start-collection", enginePayload, {
    idempotencyKey: `${payload.runId}:engine-v2:start`,
  });
  if (!result.ok) {
    taskWarn(ANALYSIS_RUN_TASK_ID, "engine-v2-start-collection returned a non-ok result", {
      runId: payload.runId,
      error: result.error instanceof Error ? result.error.message : result.error,
    });
    await deps.finalizeAnalysisRun({
      runId: payload.runId,
      status: "failed",
      coverage: "partial",
      coverageReasonsJson: ["engineV2TaskFailed", "engine-v2-start-collection"],
      lastError: result.error instanceof Error ? result.error.message : "engine-v2-start-collection failed",
    });
    throw result.error ?? new Error("engine-v2-start-collection failed");
  }

  taskInfo(ANALYSIS_RUN_TASK_ID, "engine-v2-start-collection accepted the run", {
    runId: payload.runId,
    mode: payload.mode,
  });

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
    taskWarn(ANALYSIS_RUN_TASK_ID, "analysis run is already cancelled; skipping orchestration", {
      runId: payload.runId,
    });
    return { cancelled: true };
  }

  return runEngineV2AnalysisOrchestration(payload, deps);
}

export const analysisRunTask = task({
  id: ANALYSIS_RUN_TASK_ID,
  run: async (payload: AnalysisRunTaskPayload) => withTaskLogging(ANALYSIS_RUN_TASK_ID, payload, () => runAnalysisRunTask(payload)),
});
