import { getEnv } from "@/server/env";

import { runs, tasks } from "@trigger.dev/sdk/v3";

import { ANALYSIS_RUN_TASK_ID, type AnalysisRunTaskPayload } from "@/server/trigger/tasks/analysis-run.task";

export async function triggerAnalysisRunTask(payload: AnalysisRunTaskPayload) {
  getEnv();
  return tasks.trigger(ANALYSIS_RUN_TASK_ID, payload, {
    idempotencyKey: `${payload.runId}:${ANALYSIS_RUN_TASK_ID}`,
    concurrencyKey: `${payload.chainId}:${payload.walletAddress.toLowerCase()}`,
    tags: ["analysis", payload.walletAddress.toLowerCase()],
  });
}

export async function cancelTriggerRun(runHandleId: string) {
  getEnv();
  return runs.cancel(runHandleId);
}
