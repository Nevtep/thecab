import assert from "node:assert/strict";
import test from "node:test";

import { planAnalysisSlices, resolveAnalysisMode } from "@/server/analysis/orchestrator";
import {
  projectAnalysisProgress,
  projectAnalysisStatus,
} from "@/server/analysis/status-projection";

function ensureTestEnv() {
  process.env.MORALIS_API_KEY ??= "test-moralis-key";
  process.env.ALCHEMY_API_KEY ??= "test-alchemy-key";
  process.env.ALCHEMY_BASE_RPC_URL ??= "https://example.com";
  process.env.DATABASE_URL ??= "postgres://postgres:postgres@localhost:5432/thecab_test";
  process.env.TRIGGER_SECRET_KEY ??= "trigger_secret_test";
  process.env.ANALYSIS_HISTORY_DAYS ??= "365";
  process.env.ANALYSIS_SLICE_DAYS ??= "90";
  process.env.ANALYSIS_STATUS_STALE_DAYS ??= "7";
}

ensureTestEnv();

test("resolveAnalysisMode defaults to incremental when a prior completed run exists", () => {
  assert.equal(resolveAnalysisMode({ hasCompletedRun: true }), "incremental");
  assert.equal(resolveAnalysisMode({ hasCompletedRun: false }), "full_history");
  assert.equal(
    resolveAnalysisMode({ requestedMode: "full_history", hasCompletedRun: true }),
    "full_history",
  );
});

test("planAnalysisSlices does not cache-skip windows during full_history reruns", () => {
  const slices = planAnalysisSlices({
    triggeredAtUtc: new Date("2026-05-24T12:00:00.000Z"),
    mode: "full_history",
    lastProcessedDayUtc: "2026-03-01",
  });

  assert.equal(slices.length > 1, true);
  assert.equal(slices[0]?.isFullyCached, false);
  assert.equal(slices.some((slice) => slice.isFullyCached), false);
});

test("planAnalysisSlices keeps the full-year horizon for incremental runs while skipping cached windows", () => {
  const triggeredAtUtc = new Date("2026-05-24T12:00:00.000Z");
  const slices = planAnalysisSlices({
    triggeredAtUtc,
    mode: "incremental",
    lastProcessedDayUtc: "2026-03-01",
  });

  assert.equal(slices.length >= 4, true);
  assert.equal(slices[0]?.sliceEndUtc.toISOString(), "2026-05-25T00:00:00.000Z");
  assert.equal((slices.at(-1)?.sliceStartUtc.getTime() ?? 0) <= triggeredAtUtc.getTime() - (300 * 24 * 60 * 60 * 1000), true);
  assert.equal(slices.some((slice) => slice.isFullyCached), true);
  assert.equal(slices.some((slice) => !slice.isFullyCached), true);
});

test("projectAnalysisStatus reports partial coverage after retry exhaustion while preserving canonical status", () => {
  const projected = projectAnalysisStatus({
    latestRunStatus: "complete",
    lastSuccessfulRunAt: new Date("2099-05-24T12:00:00.000Z"),
    coverageReasons: ["providerThrottled", "providerThrottled", "missingPrices"],
    failedSliceCount: 1,
  });

  assert.equal(projected.status, "ready");
  assert.equal(projected.coverage, "partial");
  assert.deepEqual(projected.coverageReasons, ["providerThrottled", "missingPrices"]);
});

test("projectAnalysisStatus maps cancelled and failed runs back to canonical post-run statuses", () => {
  const cancelledWithoutSuccess = projectAnalysisStatus({
    latestRunStatus: "cancelled",
    lastSuccessfulRunAt: null,
  });
  const failedWithPriorSuccess = projectAnalysisStatus({
    latestRunStatus: "failed",
    lastSuccessfulRunAt: new Date(),
  });

  assert.equal(cancelledWithoutSuccess.status, "not_analyzed");
  assert.equal(cancelledWithoutSuccess.coverage, "unknown");
  assert.equal(failedWithPriorSuccess.status, "ready");
});

test("projectAnalysisProgress exposes slice and phase progress for the UI contract", () => {
  const projected = projectAnalysisProgress({
    latestRunStatus: "running",
    currentStage: "activity",
    totalSlices: 2,
    completedSlices: 1,
    failedSlices: 0,
    slices: [
      {
        id: "slice-0",
        sliceIndex: 0,
        status: "complete",
        sliceStartUtc: new Date("2026-02-24T00:00:00.000Z"),
        sliceEndUtc: new Date("2026-05-24T00:00:00.000Z"),
        txCountSeen: 8,
        txCountProcessed: 8,
        coverageReasonsJson: [],
        startedAt: new Date("2026-05-24T12:00:00.000Z"),
        completedAt: new Date("2026-05-24T12:01:00.000Z"),
      },
      {
        id: "slice-1",
        sliceIndex: 1,
        status: "running",
        sliceStartUtc: new Date("2025-11-24T00:00:00.000Z"),
        sliceEndUtc: new Date("2026-02-24T00:00:00.000Z"),
        txCountSeen: 3,
        txCountProcessed: 1,
        coverageReasonsJson: ["providerError"],
        startedAt: new Date("2026-05-24T12:02:00.000Z"),
        completedAt: null,
      },
    ],
  });

  assert.deepEqual(projected.phases.deposits, {
    status: "running",
    completedSlices: 1,
    totalSlices: 2,
  });
  assert.equal(projected.phases.activity.status, "running");
  assert.equal(projected.phases.pools.status, "queued");
  assert.equal(projected.slices[1]?.coverageReasons[0], "providerError");
});