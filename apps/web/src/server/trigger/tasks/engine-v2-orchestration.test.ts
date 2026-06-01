import assert from "node:assert/strict";
import test from "node:test";

import { runEngineV2AnalysisOrchestration, shouldUseEngineV2AnalysisRun } from "./analysis-run.task";
import { ENGINE_V2_TRIGGER_TASK_IDS } from "./engine-v2-index.task";

test("shouldUseEngineV2AnalysisRun is opt-in and preserves legacy fallback by default", () => {
  assert.equal(shouldUseEngineV2AnalysisRun({ mode: "full_history" }, {}), false);
  assert.equal(shouldUseEngineV2AnalysisRun({ mode: "full_history" }, { ANALYSIS_ENGINE_V2_TRIGGER: "1" }), true);
});

test("runEngineV2AnalysisOrchestration triggers ordered Engine V2 tasks with idempotency keys", async () => {
  const calls: string[] = [];
  const result = await runEngineV2AnalysisOrchestration(
    { runId: "run-1", walletAddress: "0x0000000000000000000000000000000000000001", chainId: 8453, mode: "full_history" },
    {
      triggerAndWait: async (taskId, _payload, options) => {
        calls.push(`${taskId}:${options?.idempotencyKey}`);
        return { ok: true, output: {} };
      },
      updateAnalysisRunProgress: async () => undefined,
      finalizeAnalysisRun: async () => undefined,
    },
  );

  assert.equal(result.engine, "v2");
  assert.deepEqual(calls.map((call) => call.split(":")[0]), [
    "engine-v2-collect-decoded-history-page",
    "engine-v2-finalize-collection",
    "engine-v2-canonicalize-history",
    "engine-v2-protocol-bootstrap",
    "engine-v2-ensure-abi-registry",
    "engine-v2-decode-canonical-calls",
    "engine-v2-classify-chronological",
    "engine-v2-plan-enrichment",
    "engine-v2-run-enrichment-batch",
    "engine-v2-account-chronological",
    "engine-v2-materialize-read-models",
  ]);
  assert.ok(calls.every((call) => call.includes("run-1:engine-v2:")));
});

test("Engine V2 task discovery exports all task ids without changing trigger config", () => {
  assert.ok(ENGINE_V2_TRIGGER_TASK_IDS.includes("engine-v2-materialize-read-models"));
  assert.equal(new Set(ENGINE_V2_TRIGGER_TASK_IDS).size, ENGINE_V2_TRIGGER_TASK_IDS.length);
});
