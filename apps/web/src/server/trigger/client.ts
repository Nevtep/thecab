import { getEnv } from "@/server/env";

import { runs, tasks } from "@trigger.dev/sdk/v3";

import type { AnalysisRunTaskPayload } from "@/server/trigger/tasks/analysis-run.task";

export async function triggerAnalysisRunTask(payload: AnalysisRunTaskPayload) {
  getEnv();
  return tasks.trigger("analysis-run", payload, {
    idempotencyKey: `${payload.runId}:analysis-run`,
    concurrencyKey: `${payload.chainId}:${payload.walletAddress.toLowerCase()}`,
    tags: ["analysis", payload.walletAddress.toLowerCase()],
  });
}

export async function cancelTriggerRun(runHandleId: string) {
  getEnv();
  return runs.cancel(runHandleId);
}
