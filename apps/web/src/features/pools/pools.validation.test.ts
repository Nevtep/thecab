import assert from "node:assert/strict";
import test from "node:test";

import {
  mapPoolDetailResponseToViewModel,
  mapPoolsListResponseToViewModel,
} from "@/features/pools/pools.mappers";
import type { PoolDetailResponse, PoolsListResponse } from "@/features/pools/pools.types";

function listResponse(): PoolsListResponse {
  return {
    walletAddress: "0x2222222222222222222222222222222222222222",
    chainId: 8453,
    analysisStatus: "ready",
    coveredRange: { startDayUtc: null, endDayUtc: null },
    summary: {
      poolCount: 0,
      activePoolCount: 0,
      activeInRangePoolCount: 0,
      currentAttributedValueUsd: 0,
      totalRewardsUsd: 0,
      weightedAnnualizedReturnPct: null,
      series: {
        activePoolCount: [],
        currentAttributedValueUsd: [],
        totalRewardsUsd: [],
        estimatedAnnualizedReturnPct: [],
      },
      coverageStatus: "unknown",
      coverageReasonCodes: [],
    },
    items: [],
    page: { nextCursor: null, hasMore: false },
  };
}

test("EN and ES locales produce different currency formatting", () => {
  const en = mapPoolsListResponseToViewModel(
    { ...listResponse(), summary: { ...listResponse().summary, currentAttributedValueUsd: 1234.5 } },
    "en-US",
  );
  const es = mapPoolsListResponseToViewModel(
    { ...listResponse(), summary: { ...listResponse().summary, currentAttributedValueUsd: 1234.5 } },
    "es-ES",
  );
  assert.notEqual(en.formattedSummary.currentAttributedValueUsd, es.formattedSummary.currentAttributedValueUsd);
});

test("covered range messaging is nullable when range is null", () => {
  const vm = mapPoolsListResponseToViewModel(listResponse(), "en-US");
  assert.ok(vm.formattedCoveredRange === null || typeof vm.formattedCoveredRange === "string");
});

test("partial-attribution items expose coverage labels through view model", () => {
  const response = listResponse();
  response.items = [
    {
      poolId: "p1",
      label: "WETH / USDC",
      poolAddress: "0xpool",
      tokenSymbols: ["WETH", "USDC"],
      feeTierLabel: null,
      poolType: "volatile",
      protocolFamily: "aerodrome",
      status: "active",
      exposureMix: "manual",
      currentAttributedValueUsd: 100,
      capitalInvestedUsd: 100,
      capitalEnteredUsd: 100,
      capitalWithdrawnUsd: 0,
      realizedPnlUsd: null,
      unrealizedPnlUsd: 0,
      totalRewardsUsd: 0,
      investedDays: 10,
      totalReturnPct: 0,
      annualizedReturnPct: 0,
      isInRange: null,
      coverageStatus: "partial",
      coverageReasonCodes: ["missing_price"],
      latestActivityAt: null,
      strategyLabels: [],
      metricsEstimated: true,
    },
  ];
  response.summary.currentAttributedValueUsd = 100;
  const vm = mapPoolsListResponseToViewModel(response, "en-US");
  assert.equal(vm.items[0]?.coverageStatus, "partial");
  assert.deepEqual(vm.items[0]?.coverageReasonCodes, ["missing_price"]);
  assert.equal(vm.items[0]?.metricsEstimated, true);
});

test("detail view model preserves coverage metadata across header, segments, and history", () => {
  const detail: PoolDetailResponse = {
    walletAddress: "0x3333333333333333333333333333333333333333",
    chainId: 8453,
    analysisStatus: "ready",
    coveredRange: { startDayUtc: "2025-05-01", endDayUtc: "2026-05-01" },
    selectedRange: "1y",
    header: {
      poolId: "p1",
      label: "WETH / USDC",
      poolAddress: "0xpool",
      tokenSymbols: ["WETH", "USDC"],
      feeTierLabel: null,
      poolType: "volatile",
      protocolFamily: "aerodrome",
      status: "active",
      currentAttributedValueUsd: 0,
      capitalInvestedUsd: 0,
      capitalEnteredUsd: 0,
      capitalWithdrawnUsd: 0,
      totalRewardsUsd: 0,
      investedDays: null,
      totalReturnPct: null,
      realizedPnlUsd: null,
      unrealizedPnlUsd: null,
      annualizedReturnPct: null,
      isInRange: false,
      coverageStatus: "share_level",
      coverageReasonCodes: ["share_level_strategy"],
      strategyLabels: ["Mellow"],
      metricsEstimated: true,
    },
    segments: {
      manual: { currentValueUsd: 0, coverageStatus: "full" },
      strategy: { currentValueUsd: 0, coverageStatus: "share_level" },
      residual: { currentValueUsd: 0, coverageStatus: "partial" },
    },
    currentComposition: [],
    positions: {
      manualDeposits: [],
      automatedStrategies: [],
    },
    history: { points: [], coverageStatus: "share_level", coverageReasonCodes: ["share_level_strategy"] },
    timeline: { items: [], nextCursor: null, hasMore: false },
    related: { deposits: [], strategies: [], governanceRewards: [] },
  };
  const vm = mapPoolDetailResponseToViewModel(detail, "en-US");
  assert.equal(vm.header.coverageStatus, "share_level");
  assert.deepEqual(vm.header.coverageReasonCodes, ["share_level_strategy"]);
  assert.equal(vm.segments.strategy.coverageStatus, "share_level");
  assert.equal(vm.history.coverageStatus, "share_level");
});
