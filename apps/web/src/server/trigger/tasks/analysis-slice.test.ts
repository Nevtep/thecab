import assert from "node:assert/strict";
import test from "node:test";

import { runAnalysisSliceTask, type AnalysisSliceTaskPayload } from "@/server/trigger/tasks/analysis-slice.task";

function createPayload(overrides: Partial<AnalysisSliceTaskPayload> = {}): AnalysisSliceTaskPayload {
  return {
    runId: "run-1",
    sliceId: "slice-1",
    walletAddress: "0xabc",
    chainId: 8453,
    sliceIndex: 3,
    isFullyCached: false,
    ...overrides,
  };
}

function createDeps(overrides: Partial<Parameters<typeof runAnalysisSliceTask>[1]> = {}) {
  const updateSliceCalls: Array<Record<string, unknown>> = [];
  const updateRunCalls: Array<Record<string, unknown>> = [];
  const phaseCalls: string[] = [];

  const deps = {
    triggerAndWait: async (taskId: string) => {
      phaseCalls.push(taskId);

      if (taskId === "phase-deposits") {
        return {
          ok: true,
          output: {
            coverageReasons: ["providerError"],
            providerAttempts: { moralis: 2, alchemyRpc: 1, alchemyPrices: 3 },
            txCountSeen: 10,
            txCountProcessed: 7,
          },
        };
      }

      return {
        ok: true,
        output: {
          coverageReasons: ["pricingPartial"],
          providerAttempts: { alchemyRpc: 4, alchemyPrices: 5 },
          rewardEventCount: 6,
        },
      };
    },
    getAnalysisRunById: async () => ({ id: "run-1", status: "running" }),
    updateAnalysisRunProgress: async (_runId: string, input: Record<string, unknown>) => {
      updateRunCalls.push(input);
    },
    getAnalysisSlice: async () => ({
      id: "slice-1",
      startedAt: null,
      txCountSeen: 12,
      txCountProcessed: 9,
    }),
    updateAnalysisSlice: async (input: Record<string, unknown>) => {
      updateSliceCalls.push(input);
    },
    readCoverageReasonsFromError: () => ["providerError"],
    ...overrides,
  } as Parameters<typeof runAnalysisSliceTask>[1];

  return { deps, updateSliceCalls, updateRunCalls, phaseCalls };
}

test("runAnalysisSliceTask skips cached slices without invoking phase tasks", async () => {
  const { deps, updateSliceCalls, phaseCalls } = createDeps();

  const result = await runAnalysisSliceTask(createPayload({ isFullyCached: true }), deps);

  assert.deepEqual(result, {
    sliceId: "slice-1",
    status: "skipped_cached",
    coverageReasons: [],
    txCountSeen: 12,
    txCountProcessed: 9,
  });
  assert.equal(phaseCalls.length, 0);
  assert.equal(updateSliceCalls.length, 1);
  assert.equal(updateSliceCalls[0]?.status, "skipped_cached");
});

test("runAnalysisSliceTask exits early when the parent run is cancelled", async () => {
  const { deps, updateRunCalls, updateSliceCalls, phaseCalls } = createDeps({
    getAnalysisRunById: async () => ({ id: "run-1", status: "cancelled" }),
  });

  const result = await runAnalysisSliceTask(createPayload(), deps);

  assert.deepEqual(result, { cancelled: true });
  assert.equal(updateRunCalls.length, 0);
  assert.equal(updateSliceCalls.length, 0);
  assert.equal(phaseCalls.length, 0);
});

test("runAnalysisSliceTask throws when the slice record is missing", async () => {
  const { deps } = createDeps({
    getAnalysisSlice: async () => null,
  });

  await assert.rejects(() => runAnalysisSliceTask(createPayload(), deps), /ANALYSIS_SLICE_NOT_FOUND:slice-1/);
});

test("runAnalysisSliceTask merges coverage reasons and provider attempts on success", async () => {
  const { deps, updateSliceCalls, updateRunCalls, phaseCalls } = createDeps();

  const result = await runAnalysisSliceTask(createPayload(), deps);

  assert.deepEqual(result, {
    sliceId: "slice-1",
    status: "complete",
    coverageReasons: ["providerError", "pricingPartial"],
    txCountSeen: 10,
    txCountProcessed: 7,
    rewardEventCount: 6,
  });
  assert.deepEqual(phaseCalls, ["phase-deposits", "phase-rewards"]);
  assert.equal(updateRunCalls[0]?.stage, "slice:3");
  assert.equal(updateSliceCalls.at(-1)?.status, "complete");
  assert.deepEqual(updateSliceCalls.at(-1)?.providerAttemptsJson, {
    moralis: 2,
    alchemyRpc: 5,
    alchemyPrices: 8,
  });
});

test("runAnalysisSliceTask marks the slice failed when deposit processing errors", async () => {
  const { deps, updateSliceCalls } = createDeps({
    triggerAndWait: async () => ({ ok: false, error: new Error("deposit boom") }),
  });

  await assert.rejects(() => runAnalysisSliceTask(createPayload(), deps), /deposit boom/);

  assert.equal(updateSliceCalls.at(-1)?.status, "failed");
  assert.deepEqual(updateSliceCalls.at(-1)?.coverageReasonsJson, ["providerError"]);
});

test("runAnalysisSliceTask marks the slice failed when reward processing errors", async () => {
  const { deps, updateSliceCalls } = createDeps({
    triggerAndWait: async (taskId: string) => {
      if (taskId === "phase-deposits") {
        return {
          ok: true,
          output: {
            coverageReasons: [],
            providerAttempts: { moralis: 1, alchemyRpc: 0, alchemyPrices: 0 },
            txCountSeen: 3,
            txCountProcessed: 3,
          },
        };
      }

      return { ok: false, error: new Error("reward boom") };
    },
  });

  await assert.rejects(() => runAnalysisSliceTask(createPayload(), deps), /reward boom/);

  assert.equal(updateSliceCalls.at(-1)?.status, "failed");
  assert.deepEqual(updateSliceCalls.at(-1)?.coverageReasonsJson, ["providerError"]);
});