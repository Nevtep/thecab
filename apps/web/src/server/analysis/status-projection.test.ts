import assert from "node:assert/strict";
import test from "node:test";

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
  process.env.ANALYSIS_STATUS_STALE_DAYS ??= "7";
}

ensureTestEnv();

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

test("projectAnalysisProgress marks zero-slice and failed runs across all phases", () => {
  const queued = projectAnalysisProgress({
    latestRunStatus: "queued",
    currentStage: null,
    totalSlices: 0,
    completedSlices: 0,
    failedSlices: 0,
    slices: [],
  });
  const failed = projectAnalysisProgress({
    latestRunStatus: "failed",
    currentStage: "pools",
    totalSlices: 2,
    completedSlices: 1,
    failedSlices: 1,
    slices: [],
  });

  assert.equal(queued.phases.deposits.status, "queued");
  assert.equal(queued.phases.activity.status, "queued");
  assert.equal(failed.phases.deposits.status, "failed");
  assert.equal(failed.phases.activity.status, "failed");
  assert.equal(failed.phases.pools.status, "failed");
  assert.equal(failed.phases.finalize.status, "failed");
});

test("projectAnalysisStatus reports stale and canonical coverage transitions", () => {
  const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

  const staleCancelled = projectAnalysisStatus({
    latestRunStatus: "cancelled",
    lastSuccessfulRunAt: oldDate,
  });
  const failedWithoutSuccess = projectAnalysisStatus({
    latestRunStatus: "failed",
    lastSuccessfulRunAt: null,
  });
  const completeWithoutReasons = projectAnalysisStatus({
    latestRunStatus: "complete",
    lastSuccessfulRunAt: new Date(),
  });

  assert.equal(staleCancelled.status, "stale");
  assert.equal(failedWithoutSuccess.status, "failed");
  assert.equal(failedWithoutSuccess.coverage, "unknown");
  assert.equal(completeWithoutReasons.status, "ready");
  assert.equal(completeWithoutReasons.coverage, "full");
});