import assert from "node:assert/strict";
import test from "node:test";

import { normalizeLatestPoolTotals, runPhasePoolsTask } from "@/server/trigger/tasks/phase-pools.task";

test("normalizeLatestPoolTotals filters non-objects and coerces ids and usd values", () => {
  assert.deepEqual(
    normalizeLatestPoolTotals([
      { poolId: "pool-1", valueUsd: "12.5" },
      { poolId: 2, valueUsd: null },
      null,
      "bad",
    ]),
    [
      { poolId: "pool-1", valueUsd: 12.5 },
      { poolId: "2", valueUsd: 0 },
    ],
  );
});

test("runPhasePoolsTask returns early for missing or cancelled runs", async () => {
  const missingRunResult = await runPhasePoolsTask({ runId: "run-1", walletAddress: "0xabc", chainId: 8453 }, {
    getAnalysisRunById: async () => null,
    persistPoolSnapshots: async () => 99,
    syncAerodromeMetadata: async () => ({ synced: true }),
    syncMellowStrategies: async () => ({ synced: true }),
  });

  const cancelledRunResult = await runPhasePoolsTask({ runId: "run-1", walletAddress: "0xabc", chainId: 8453 }, {
    getAnalysisRunById: async () => ({ status: "cancelled", metadataJson: {}, utcDayBucket: "2026-05-28" }),
    persistPoolSnapshots: async () => 99,
    syncAerodromeMetadata: async () => ({ synced: true }),
    syncMellowStrategies: async () => ({ synced: true }),
  });

  assert.deepEqual(missingRunResult, { poolCount: 0 });
  assert.deepEqual(cancelledRunResult, { poolCount: 0 });
});

test("runPhasePoolsTask persists normalized totals and syncs metadata", async () => {
  const persistCalls: Array<Record<string, unknown>> = [];

  const result = await runPhasePoolsTask({ runId: "run-1", walletAddress: "0xabc", chainId: 8453 }, {
    getAnalysisRunById: async () => ({
      status: "running",
      utcDayBucket: "2026-05-28",
      metadataJson: {
        latestPoolTotals: [
          { poolId: "pool-1", valueUsd: "12.5" },
          { poolId: 42, valueUsd: 7 },
          null,
        ],
      },
    }),
    persistPoolSnapshots: async (input) => {
      persistCalls.push(input as unknown as Record<string, unknown>);
      return 2;
    },
    syncAerodromeMetadata: async () => ({ poolsSynced: 3 }),
    syncMellowStrategies: async () => ({ strategiesSynced: 4 }),
  });

  assert.deepEqual(persistCalls[0], {
    chainId: 8453,
    dayUtc: "2026-05-28",
    poolTotals: [
      { poolId: "pool-1", valueUsd: 12.5 },
      { poolId: "42", valueUsd: 7 },
    ],
  });
  assert.deepEqual(result, {
    poolCount: 2,
    aerodromeMetadata: { poolsSynced: 3 },
    mellowMetadata: { strategiesSynced: 4 },
  });
});