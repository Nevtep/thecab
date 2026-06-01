import assert from "node:assert/strict";
import test from "node:test";

import { runAnalysisRunTask, type AnalysisRunTaskPayload } from "@/server/trigger/tasks/analysis-run.task";

function createPayload(): AnalysisRunTaskPayload {
  return {
    runId: "run-1",
    walletAddress: "0xabc",
    chainId: 8453,
    mode: "full_history",
  };
}

function createDeps(overrides: Partial<Parameters<typeof runAnalysisRunTask>[1]> = {}) {
  const updateRunProgressCalls: Array<Record<string, unknown>> = [];
  const finalizeCalls: Array<Record<string, unknown>> = [];
  const triggeredTasks: Array<{
    taskId: string;
    payload: Record<string, unknown>;
    options?: { idempotencyKey?: string };
  }> = [];

  const deps = {
    triggerAndWait: async (
      taskId: string,
      payload: Record<string, unknown>,
      options?: { idempotencyKey?: string },
    ) => {
      triggeredTasks.push({ taskId, payload, options });
      return { ok: true, output: {} };
    },
    finalizeAnalysisRun: async (input: Record<string, unknown>) => {
      finalizeCalls.push(input);
    },
    getAnalysisRunById: async () => ({
      id: "run-1",
      status: "running",
      triggeredAtUtc: new Date("2026-05-28T00:00:00.000Z"),
    }),
    updateAnalysisRunProgress: async (_runId: string, input: Record<string, unknown>) => {
      updateRunProgressCalls.push(input);
    },
    ...overrides,
  } as Parameters<typeof runAnalysisRunTask>[1];

  return {
    deps,
    updateRunProgressCalls,
    finalizeCalls,
    triggeredTasks,
  };
}

test("runAnalysisRunTask starts the Engine V2 collection chain", async () => {
  const { deps, updateRunProgressCalls, triggeredTasks, finalizeCalls } = createDeps();

  const result = await runAnalysisRunTask(createPayload(), deps);

  assert.deepEqual(result, {
    engine: "v2",
    queued: true,
    mode: "full_history",
  });
  assert.deepEqual(
    updateRunProgressCalls.map((call) => call.stage),
    ["engine_v2_collection"],
  );
  assert.equal(triggeredTasks.length, 1);
  assert.equal(triggeredTasks[0]?.taskId, "engine-v2-start-collection");
  assert.deepEqual(triggeredTasks[0]?.payload, {
    analysisRunId: "run-1",
    walletAddress: "0xabc",
    chainId: 8453,
    mode: "full_history",
  });
  assert.equal(triggeredTasks[0]?.options?.idempotencyKey, "run-1:engine-v2:start");
  assert.equal(finalizeCalls.length, 0);
});

test("runAnalysisRunTask throws when the analysis run does not exist", async () => {
  const { deps } = createDeps({
    getAnalysisRunById: async () => null,
  });

  await assert.rejects(() => runAnalysisRunTask(createPayload(), deps), /ANALYSIS_RUN_NOT_FOUND:run-1/);
});

test("runAnalysisRunTask exits early when the analysis run is already cancelled", async () => {
  const { deps, updateRunProgressCalls, triggeredTasks } = createDeps({
    getAnalysisRunById: async () => ({
      id: "run-1",
      status: "cancelled",
      triggeredAtUtc: new Date("2026-05-28T00:00:00.000Z"),
    }),
  });

  const result = await runAnalysisRunTask(createPayload(), deps);

  assert.deepEqual(result, { cancelled: true });
  assert.equal(updateRunProgressCalls.length, 0);
  assert.equal(triggeredTasks.length, 0);
});

test("runAnalysisRunTask finalizes when Engine V2 collection startup fails", async () => {
  const { deps, finalizeCalls } = createDeps({
    triggerAndWait: async () => ({ ok: false, error: new Error("v2 boom") }),
  });

  await assert.rejects(() => runAnalysisRunTask(createPayload(), deps), /v2 boom/);

  assert.equal(finalizeCalls.length, 1);
  assert.equal(finalizeCalls[0]?.coverage, "partial");
  assert.deepEqual(finalizeCalls[0]?.coverageReasonsJson, ["engineV2TaskFailed", "engine-v2-start-collection"]);
});
