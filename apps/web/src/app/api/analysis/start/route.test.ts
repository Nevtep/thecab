import assert from "node:assert/strict";
import test from "node:test";

import { SUPPORTED_CHAINS } from "@/chains/chains";
import { runStartAnalysis, type StartAnalysisDeps, type StartAnalysisPayload } from "@/app/api/analysis/start/start-analysis";

function createPayload(overrides: Partial<StartAnalysisPayload> = {}): StartAnalysisPayload {
  return {
    walletAddress: "0x0000000000000000000000000000000000000001",
    chainId: 8453,
    mode: "full_history",
    ...overrides,
  };
}

function createDeps() {
  const createdRuns: Array<Record<string, unknown>> = [];
  const triggeredTasks: Array<Record<string, unknown>> = [];
  const supersededRunIds: string[] = [];
  const mergedMetadata: Array<Record<string, unknown>> = [];
  const failedUpdates: Array<Record<string, unknown>> = [];

  const createRunRow = (input: Record<string, unknown>) => {
    const triggeredAtUtc = input.triggeredAtUtc instanceof Date
      ? input.triggeredAtUtc
      : new Date("2026-06-01T12:00:00.000Z");

    return {
      id: "run-1",
      walletAddress: String(input.walletAddress),
      chainId: Number(input.chainId),
      status: "queued",
      stage: "queued",
      progressPct: 0,
      mode: String(input.mode),
      triggeredAtUtc,
      utcDayBucket: "2026-06-01",
      coverage: "unknown",
      coverageReasonsJson: [],
      startedAt: triggeredAtUtc,
      completedAt: null,
      cancelledAt: null,
      cancelledReason: null,
      lastError: null,
      metadataJson: {},
      createdAt: triggeredAtUtc,
      updatedAt: triggeredAtUtc,
    };
  };

  return {
    deps: {
      assertSupportedChain: () => SUPPORTED_CHAINS.base,
      assertAuthenticatedWallet: async () => undefined,
      findActiveAnalysisRun: async () => null,
      findLatestSameDayAnalysisRun: async () => null,
      findLatestCompletedAnalysisRun: async () => null,
      shouldReuseCompletedSameDayRun: () => false,
      shouldSupersedeCompletedSameDayRunForDevelopment: () => false,
      supersedeCompletedRunForDevelopmentRerun: async (runId: string) => {
        supersededRunIds.push(runId);
      },
      createAnalysisRun: async (input: Record<string, unknown>) => {
        createdRuns.push(input);
        return createRunRow(input);
      },
      triggerAnalysisRunTask: async (input: Record<string, unknown>) => {
        triggeredTasks.push(input);
        return { id: "trigger-1" };
      },
      mergeAnalysisRunMetadata: async (_runId: string, input: Record<string, unknown>) => {
        mergedMetadata.push(input);
      },
      updateAnalysisRunProgress: async (_runId: string, input: Record<string, unknown>) => {
        failedUpdates.push(input);
      },
      now: () => new Date("2026-06-01T12:00:00.000Z"),
      todayUtcBucket: () => "2026-06-01",
    } as unknown as StartAnalysisDeps,
    createdRuns,
    triggeredTasks,
    supersededRunIds,
    mergedMetadata,
    failedUpdates,
  };
}

test("runStartAnalysis forwards incremental mode into the persisted run and trigger task", async () => {
  const { deps, createdRuns, triggeredTasks, mergedMetadata } = createDeps();

  const response = await runStartAnalysis(createPayload({ mode: "incremental" }), deps);
  const body = await response.json();

  assert.equal(response.status, 202);
  assert.equal(createdRuns[0]?.mode, "incremental");
  assert.equal(triggeredTasks[0]?.mode, "incremental");
  assert.equal(mergedMetadata[0]?.resolvedMode, "incremental");
  assert.equal(body.mode, "incremental");
});

test("runStartAnalysis reuses same-day completed runs only for full-history requests", async () => {
  const completedAt = new Date("2026-06-01T10:00:00.000Z");
  const sameDayRun = {
    id: "run-existing",
    walletAddress: "0x0000000000000000000000000000000000000001",
    chainId: 8453,
    status: "complete",
    stage: "complete",
    progressPct: 100,
    mode: "full_history",
    triggeredAtUtc: new Date("2026-06-01T09:00:00.000Z"),
    utcDayBucket: "2026-06-01",
    startedAt: new Date("2026-06-01T09:00:00.000Z"),
    completedAt,
    cancelledAt: null,
    cancelledReason: null,
    coverage: "full",
    coverageReasonsJson: [],
    lastError: null,
    metadataJson: {},
    createdAt: new Date("2026-06-01T09:00:00.000Z"),
    updatedAt: completedAt,
  };

  const fullHistoryCase = createDeps();
  const fullHistoryResponse = await runStartAnalysis(createPayload({ mode: "full_history" }), {
    ...fullHistoryCase.deps,
    findLatestSameDayAnalysisRun: async () => sameDayRun,
    shouldReuseCompletedSameDayRun: (input: { requestedMode?: "full_history" | "incremental" }) => input.requestedMode === "full_history",
  });
  const fullHistoryBody = await fullHistoryResponse.json();

  assert.equal(fullHistoryResponse.status, 200);
  assert.equal(fullHistoryBody.runId, "run-existing");
  assert.equal(fullHistoryCase.createdRuns.length, 0);

  const incrementalCase = createDeps();
  const incrementalResponse = await runStartAnalysis(createPayload({ mode: "incremental" }), {
    ...incrementalCase.deps,
    findLatestSameDayAnalysisRun: async () => sameDayRun,
    shouldReuseCompletedSameDayRun: (input: { requestedMode?: "full_history" | "incremental" }) => input.requestedMode === "full_history",
  });

  assert.equal(incrementalResponse.status, 202);
  assert.equal(incrementalCase.createdRuns[0]?.mode, "incremental");
});
