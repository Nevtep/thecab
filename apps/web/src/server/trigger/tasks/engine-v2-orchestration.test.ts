import assert from "node:assert/strict";
import test from "node:test";

import { runEngineV2AnalysisOrchestration } from "./analysis-run.task";
import { ENGINE_V2_TRIGGER_TASK_IDS } from "./engine-v2-index.task";

test("runEngineV2AnalysisOrchestration starts the frontend-triggered Engine V2 chain", async () => {
  const calls: string[] = [];
  const payloads: Record<string, unknown>[] = [];
  const result = await runEngineV2AnalysisOrchestration(
    { runId: "run-1", walletAddress: "0x0000000000000000000000000000000000000001", chainId: 8453, mode: "full_history" },
    {
      triggerAndWait: async (taskId, payload, options) => {
        calls.push(`${taskId}:${options?.idempotencyKey}`);
        payloads.push(payload);
        return { ok: true, output: {} };
      },
      updateAnalysisRunProgress: async () => undefined,
      finalizeAnalysisRun: async () => undefined,
    },
  );

  assert.equal(result.engine, "v2");
  assert.equal(result.queued, true);
  assert.deepEqual(calls.map((call) => call.split(":")[0]), ["engine-v2-start-collection"]);
  assert.ok(calls.every((call) => call.includes("run-1:engine-v2:")));
  assert.equal(payloads[0]?.analysisRunId, "run-1");
  assert.equal(payloads[0]?.mode, "full_history");
});

test("Engine V2 task discovery exports all task ids without changing trigger config", () => {
  assert.ok(ENGINE_V2_TRIGGER_TASK_IDS.includes("engine-v2-materialize-read-models"));
  assert.equal(new Set(ENGINE_V2_TRIGGER_TASK_IDS).size, ENGINE_V2_TRIGGER_TASK_IDS.length);
});
