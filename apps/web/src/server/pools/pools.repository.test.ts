import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import * as repository from "@/server/pools/pools.repository";

test("pools repository exports listPoolSummaries, readPoolSummarySeries, readPoolHistory, readPoolTimeline", () => {
  assert.equal(typeof repository.listPoolSummaries, "function");
  assert.equal(typeof repository.readPoolSummarySeries, "function");
  assert.equal(typeof repository.readPoolHistory, "function");
  assert.equal(typeof repository.readPoolTimeline, "function");
});

test("pools repository keeps v2 pool ids away from legacy uuid tables", () => {
  const source = readFileSync(resolve(process.cwd(), "src/server/pools/pools.repository.ts"), "utf8");

  assert.match(
    source,
    /export async function readPoolSummarySeries[\s\S]*readEngineV2SurfaceRows[\s\S]*hasRichEngineV2PoolRow[\s\S]*from\(poolHistorySnapshots\)/,
  );
  assert.match(
    source,
    /export async function readPoolTimeline[\s\S]*readEngineV2SurfaceRows[\s\S]*hasRichEngineV2PoolRow[\s\S]*from\(poolTimelineEvents\)/,
  );
  assert.match(
    source,
    /export async function readPoolPositions[\s\S]*readEngineV2SurfaceRows[\s\S]*hasRichEngineV2PoolRow[\s\S]*from\(deposits\)[\s\S]*from\(strategyExposures\)/,
  );
});

test("normalizeEngineV2PoolSummaryRow prefers the latest cumulative rewards from history", () => {
  const row = repository.normalizeEngineV2PoolSummaryRow({
    poolId: "8453:0xpool",
    label: "WETH / USDC 100",
    poolAddress: "0xpool",
    tokenSymbols: ["WETH", "USDC"],
    feeTierLabel: "100",
    poolType: "cl",
    protocolFamily: "aerodrome",
    status: "active",
    exposureMix: "mixed",
    currentAttributedValueUsd: 1000,
    capitalEnteredUsd: 1000,
    capitalWithdrawnUsd: 0,
    capitalInvestedUsd: 1000,
    realizedPnlUsd: null,
    unrealizedPnlUsd: null,
    totalRewardsUsd: 1000000,
    investedDays: null,
    totalReturnPct: null,
    annualizedReturnPct: null,
    isInRange: null,
    coverageStatus: "full",
    coverageReasonCodes: [],
    latestActivityAt: "2026-06-01T00:00:00.000Z",
    strategyLabels: [],
    metricsEstimated: true,
    coveredStartDayUtc: "2026-05-01",
    coveredEndDayUtc: "2026-06-01",
    currentManualValueUsd: 500,
    currentStrategyValueUsd: 500,
    currentResidualValueUsd: 0,
    history: {
      points: [
        { dayUtc: "2026-05-31", rewardValueUsd: 100, cumulativeRewardsUsd: 25000 },
        { dayUtc: "2026-06-01", rewardValueUsd: 150, cumulativeRewardsUsd: 25150 },
      ],
    },
  });

  assert.equal(row.totalRewardsUsd, 25150);
});

test("list pool normalization keeps only pools backed by manual or strategy exposure", () => {
  const visible = repository.normalizeEngineV2PoolSummaryRow({
    poolId: "8453:0xpool-visible",
    label: "WETH / USDC 100",
    poolAddress: "0xpool-visible",
    tokenSymbols: ["WETH", "USDC"],
    feeTierLabel: "100",
    poolType: "cl",
    protocolFamily: "aerodrome",
    status: "active",
    exposureMix: "manual",
    currentAttributedValueUsd: 0,
    capitalEnteredUsd: 1000,
    capitalWithdrawnUsd: 1000,
    capitalInvestedUsd: 0,
    realizedPnlUsd: null,
    unrealizedPnlUsd: null,
    totalRewardsUsd: 10,
    investedDays: null,
    totalReturnPct: null,
    annualizedReturnPct: null,
    isInRange: null,
    coverageStatus: "full",
    coverageReasonCodes: [],
    latestActivityAt: null,
    strategyLabels: [],
    metricsEstimated: true,
    coveredStartDayUtc: "2026-05-01",
    coveredEndDayUtc: "2026-06-01",
    currentManualValueUsd: 0,
    currentStrategyValueUsd: 0,
    currentResidualValueUsd: 0,
    positions: { manualDeposits: [{ depositId: "dep-1" }], automatedStrategies: [] },
  });

  assert.equal(visible.label, "WETH / USDC 100");
});
