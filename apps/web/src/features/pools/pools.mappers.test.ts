import assert from "node:assert/strict";
import test from "node:test";

import {
  getPoolsCoverageLabelKey,
  mapPoolDetailResponseToViewModel,
  mapPoolsListResponseToViewModel,
} from "@/features/pools/pools.mappers";
import type { PoolDetailResponse, PoolsListResponse } from "@/features/pools/pools.types";

function createListResponse(overrides: Partial<PoolsListResponse> = {}): PoolsListResponse {
  return {
    walletAddress: "0x1111111111111111111111111111111111111111",
    chainId: 8453,
    analysisStatus: "ready",
    coveredRange: { startDayUtc: "2025-05-01", endDayUtc: "2026-05-01" },
    summary: {
      poolCount: 4,
      activePoolCount: 3,
      activeInRangePoolCount: 2,
      currentAttributedValueUsd: 10_000,
      totalRewardsUsd: 250.5,
      weightedAnnualizedReturnPct: 12.34,
      series: {
        activePoolCount: [3],
        currentAttributedValueUsd: [10_000],
        totalRewardsUsd: [250.5],
        estimatedAnnualizedReturnPct: [12.34],
      },
      coverageStatus: "full",
      coverageReasonCodes: [],
    },
    items: [
      {
        poolId: "pool-1",
        label: "WETH / cbBTC",
        poolAddress: "0xabc",
        tokenSymbols: ["WETH", "cbBTC"],
        feeTierLabel: "0.05%",
        poolType: "cl",
        protocolFamily: "aerodrome",
        status: "active",
        exposureMix: "manual",
        currentAttributedValueUsd: 5_000,
        capitalInvestedUsd: 4_500,
        capitalEnteredUsd: 4_500,
        capitalWithdrawnUsd: 0,
        realizedPnlUsd: null,
        unrealizedPnlUsd: 500,
        totalRewardsUsd: 120,
        investedDays: 45,
        totalReturnPct: 11.11,
        annualizedReturnPct: 18.5,
        isInRange: true,
        coverageStatus: "partial",
        coverageReasonCodes: ["missing_price"],
        latestActivityAt: "2026-05-20T12:00:00.000Z",
        strategyLabels: [],
        metricsEstimated: true,
      },
    ],
    page: { nextCursor: null, hasMore: false },
    ...overrides,
  };
}

function createDetailResponse(): PoolDetailResponse {
  return {
    walletAddress: "0x1111111111111111111111111111111111111111",
    chainId: 8453,
    analysisStatus: "ready",
    coveredRange: { startDayUtc: "2025-05-01", endDayUtc: "2026-05-01" },
    selectedRange: "90d",
    header: {
      poolId: "pool-1",
      label: "WETH / cbBTC",
      poolAddress: "0xabc",
      tokenSymbols: ["WETH", "cbBTC"],
      feeTierLabel: "0.05%",
      poolType: "cl",
      protocolFamily: "aerodrome",
      status: "active",
      currentAttributedValueUsd: 5_000,
      capitalInvestedUsd: 4_500,
      capitalEnteredUsd: 4_500,
      capitalWithdrawnUsd: 0,
      totalRewardsUsd: 120,
      investedDays: 45,
      totalReturnPct: 11.11,
      realizedPnlUsd: null,
      unrealizedPnlUsd: 500,
      annualizedReturnPct: 18.5,
      isInRange: true,
      coverageStatus: "share_level",
      coverageReasonCodes: ["share_level_strategy"],
      strategyLabels: ["Mellow steakhouse"],
      metricsEstimated: false,
    },
    segments: {
      manual: { currentValueUsd: 3_000, coverageStatus: "full" },
      strategy: { currentValueUsd: 2_000, coverageStatus: "share_level" },
      residual: { currentValueUsd: 0, coverageStatus: "full" },
    },
    currentComposition: [],
    history: {
      points: [
        {
          dayUtc: "2026-05-19",
          totalValueUsd: 5_000,
          deployedValueUsd: 5_000,
          residualValueUsd: 0,
          manualValueUsd: 3_000,
          strategyValueUsd: 2_000,
          rewardValueUsd: 2,
          cumulativeRewardsUsd: 120,
          capitalInUsd: 0,
          capitalOutUsd: 0,
          metadata: {},
        },
      ],
      coverageStatus: "full",
      coverageReasonCodes: [],
    },
    timeline: {
      items: [
        {
          eventKey: "evt-1",
          eventType: "deposit",
          occurredAt: "2026-05-15T10:00:00.000Z",
          confidence: "high",
          coverageStatus: "full",
          attributedValueUsd: 1_000,
          relatedDepositId: "dep-1",
          relatedStrategyId: null,
          metadata: {},
        },
      ],
      nextCursor: null,
      hasMore: false,
    },
    related: { deposits: [], strategies: [] },
  };
}

test("getPoolsCoverageLabelKey routes through coverage namespace", () => {
  assert.equal(getPoolsCoverageLabelKey("full"), "coverage:level.full");
  assert.equal(getPoolsCoverageLabelKey("partial"), "coverage:level.partial");
});

test("mapPoolsListResponseToViewModel formats USD, percentages, share, and covered range", () => {
  const vm = mapPoolsListResponseToViewModel(createListResponse(), "en-US");
  assert.match(vm.formattedSummary.currentAttributedValueUsd, /\$10,000/);
  assert.match(vm.formattedSummary.totalRewardsUsd, /\$250/);
  assert.match(vm.formattedSummary.weightedAnnualizedReturnPct ?? "", /12\.34%/);
  assert.equal(vm.items.length, 1);
  const [item] = vm.items;
  assert.match(item.formattedPortfolioSharePct, /50/);
  assert.match(item.formattedCurrentAttributedValueUsd, /\$5,000/);
  assert.match(item.formattedTotalReturnPct ?? "", /11\.11%/);
  assert.match(item.formattedAnnualizedReturnPct ?? "", /18\.5/);
  assert.ok(item.formattedLatestActivityAt && item.formattedLatestActivityAt.length > 0);
  assert.ok(vm.formattedCoveredRange && vm.formattedCoveredRange.length > 0);
});

test("mapPoolsListResponseToViewModel handles zero-value summary safely", () => {
  const response = createListResponse({
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
  });
  const vm = mapPoolsListResponseToViewModel(response, "en-US");
  assert.equal(vm.formattedSummary.weightedAnnualizedReturnPct, null);
  assert.equal(vm.items.length, 0);
});

test("mapPoolDetailResponseToViewModel formats header, segments, chart, and timeline", () => {
  const vm = mapPoolDetailResponseToViewModel(createDetailResponse(), "en-US");
  assert.match(vm.header.formattedCurrentAttributedValueUsd, /\$5,000/);
  assert.equal(vm.header.formattedProtocolFamily, "Aerodrome");
  assert.equal(vm.header.formattedPoolType, "CL");
  assert.match(vm.segments.manual.formattedCurrentValueUsd, /\$3,000/);
  assert.match(vm.segments.strategy.formattedCurrentValueUsd, /\$2,000/);
  assert.equal(vm.chart.length, 1);
  assert.equal(vm.chart[0]?.deployedValueUsd, 5_000);
  assert.equal(vm.timeline.length, 1);
  assert.ok(vm.timeline[0]?.formattedOccurredAt);
  assert.match(vm.timeline[0]?.formattedAttributedValueUsd ?? "", /\$1,000/);
});
