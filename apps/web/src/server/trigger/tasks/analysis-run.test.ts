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
  const updateSliceCalls: Array<Record<string, unknown>> = [];
  const finalizeCalls: Array<Record<string, unknown>> = [];
  const triggeredPhases: string[] = [];
  const batchCalls: Array<Record<string, unknown>> = [];
  let runReadCount = 0;

  const deps = {
    batchTriggerAndWait: async (_taskId: string, runs: Array<Record<string, unknown>>) => {
      batchCalls.push({ runs });
      return {
        runs: runs.map(() => ({ ok: true, output: {} })),
      };
    },
    triggerAndWait: async (taskId: string) => {
      triggeredPhases.push(taskId);
      return { ok: true, output: {} };
    },
    finalizeAnalysisRun: async (input: Record<string, unknown>) => {
      finalizeCalls.push(input);
    },
    getAnalysisRunById: async () => {
      runReadCount += 1;
      return {
        id: "run-1",
        status: "running",
        triggeredAtUtc: new Date("2026-05-28T00:00:00.000Z"),
      };
    },
    readRunProgressSnapshot: async () => ({ completedSlices: 2, totalSlices: 4 }),
    updateAnalysisRunProgress: async (_runId: string, input: Record<string, unknown>) => {
      updateRunProgressCalls.push(input);
    },
    createAnalysisSlices: async (rows: Array<{
      runId: string;
      walletAddress: string;
      chainId: number;
      sliceIndex: number;
      sliceStartUtc: Date;
      sliceEndUtc: Date;
    }>) => rows.map((row, index) => ({
      id: `slice-${index}`,
      sliceIndex: row.sliceIndex,
    })),
    listRunSlices: async () => [],
    updateAnalysisSlice: async (input: Record<string, unknown>) => {
      updateSliceCalls.push(input);
    },
    prepareAnalysisRunContext: async () => ({
      mode: "full_history" as const,
      slices: [
        {
          sliceIndex: 0,
          sliceStartUtc: new Date("2026-05-01T00:00:00.000Z"),
          sliceEndUtc: new Date("2026-05-10T00:00:00.000Z"),
          isFullyCached: false,
        },
        {
          sliceIndex: 1,
          sliceStartUtc: new Date("2026-04-20T00:00:00.000Z"),
          sliceEndUtc: new Date("2026-05-01T00:00:00.000Z"),
          isFullyCached: true,
        },
      ],
    }),
    readCoverageReasonsFromError: () => ["providerError"],
    ...overrides,
  } as Parameters<typeof runAnalysisRunTask>[1];

  return {
    deps,
    updateRunProgressCalls,
    updateSliceCalls,
    finalizeCalls,
    triggeredPhases,
    batchCalls,
    getRunReadCount: () => runReadCount,
  };
}

test("runAnalysisRunTask orchestrates slices and downstream phases in order", async () => {
  const { deps, updateRunProgressCalls, updateSliceCalls, triggeredPhases, finalizeCalls } = createDeps({
    batchTriggerAndWait: async (_taskId, runs) => ({
      runs: [
        { ok: false, error: new Error("slice failed") },
        { ok: true, output: {} },
      ].slice(0, runs.length),
    }),
  });

  const result = await runAnalysisRunTask(createPayload(), deps);

  assert.deepEqual(result, {
    sliceCount: 2,
    completedSlices: 2,
    mode: "full_history",
  });
  assert.deepEqual(
    updateRunProgressCalls.map((call) => call.stage),
    ["planning", "slices", "activity", "governance", "pools", "finalize"],
  );
  assert.deepEqual(triggeredPhases, ["phase-activity", "phase-governance", "phase-pools", "phase-finalize"]);
  assert.equal(updateSliceCalls.length, 1);
  assert.equal(updateSliceCalls[0]?.status, "failed");
  assert.equal(finalizeCalls.length, 0);
});

test("runAnalysisRunTask throws when the analysis run does not exist", async () => {
  const { deps } = createDeps({
    getAnalysisRunById: async () => null,
  });

  await assert.rejects(() => runAnalysisRunTask(createPayload(), deps), /ANALYSIS_RUN_NOT_FOUND:run-1/);
});

test("runAnalysisRunTask exits early when the analysis run is already cancelled", async () => {
  const { deps, updateRunProgressCalls, triggeredPhases } = createDeps({
    getAnalysisRunById: async () => ({
      id: "run-1",
      status: "cancelled",
      triggeredAtUtc: new Date("2026-05-28T00:00:00.000Z"),
    }),
  });

  const result = await runAnalysisRunTask(createPayload(), deps);

  assert.deepEqual(result, { cancelled: true });
  assert.equal(updateRunProgressCalls.length, 0);
  assert.equal(triggeredPhases.length, 0);
});

test("runAnalysisRunTask finalizes once on activity failure when the run is already marked failed afterward", async () => {
  let runReadCount = 0;
  const { deps, finalizeCalls } = createDeps({
    triggerAndWait: async (taskId: string) => {
      if (taskId === "phase-activity") {
        return { ok: false, error: new Error("activity boom") };
      }

      return { ok: true, output: {} };
    },
    getAnalysisRunById: async () => {
      runReadCount += 1;

      if (runReadCount === 1) {
        return {
          id: "run-1",
          status: "running",
          triggeredAtUtc: new Date("2026-05-28T00:00:00.000Z"),
        };
      }

      return {
        id: "run-1",
        status: "failed",
        triggeredAtUtc: new Date("2026-05-28T00:00:00.000Z"),
      };
    },
  });

  await assert.rejects(() => runAnalysisRunTask(createPayload(), deps), /activity boom/);

  assert.equal(finalizeCalls.length, 1);
  assert.equal(finalizeCalls[0]?.coverage, "partial");
  assert.deepEqual(finalizeCalls[0]?.coverageReasonsJson, ["unknownError"]);
});

test("runAnalysisRunTask finalizes with provider-derived reasons when planning fails before terminalization", async () => {
  const { deps, finalizeCalls } = createDeps({
    prepareAnalysisRunContext: async () => {
      throw new Error("provider throttle");
    },
    readCoverageReasonsFromError: () => ["providerThrottled"],
    getAnalysisRunById: async () => ({
      id: "run-1",
      status: finalizeCalls.length > 0 ? "failed" : "running",
      triggeredAtUtc: new Date("2026-05-28T00:00:00.000Z"),
    }),
  });

  await assert.rejects(() => runAnalysisRunTask(createPayload(), deps), /provider throttle/);

  assert.equal(finalizeCalls.length, 1);
  assert.deepEqual(finalizeCalls[0]?.coverageReasonsJson, ["providerThrottled"]);
});
