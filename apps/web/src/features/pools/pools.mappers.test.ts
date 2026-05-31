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
    positions: {
      manualDeposits: [
        {
          depositId: "dep-1f3dcd44-b5d1-48f0-90f4-acde0001",
          tokenId: "18462",
          status: "open",
          coverageStatus: "full",
          tickLower: -120000,
          tickUpper: -119400,
          rangeLowerPrice: 95_000.125,
          rangeUpperPrice: 98_500.875,
          rangeQuoteTokenSymbol: "cbBTC",
          rangeDisplayFractionDigits: 3,
          isInRange: true,
          valueUsd: 3_000,
          tokens: [
            { symbol: "WETH", amount: 1.25 },
            { symbol: "cbBTC", amount: 0.0456 },
          ],
          annualizedReturnPct: null,
        },
        {
          depositId: "dep-closed-1",
          tokenId: "18463",
          status: "closed",
          coverageStatus: "full",
          tickLower: -125000,
          tickUpper: -124000,
          rangeLowerPrice: 90_000,
          rangeUpperPrice: 91_000,
          rangeQuoteTokenSymbol: "cbBTC",
          rangeDisplayFractionDigits: 2,
          isInRange: false,
          valueUsd: 0,
          tokens: [
            { symbol: "WETH", amount: 0 },
            { symbol: "cbBTC", amount: 0 },
          ],
          annualizedReturnPct: null,
        },
      ],
      automatedStrategies: [
        {
          exposureId: "exp-1",
          strategyId: "strat-1f3dcd44-b5d1-48f0-90f4-acde0002",
          strategyLabel: "Mellow steakhouse",
          coverageStatus: "share_level",
          valueUsd: 2_000,
          tokens: [
            { symbol: "WETH", amount: null },
            { symbol: "cbBTC", amount: null },
          ],
          annualizedReturnPct: null,
        },
      ],
    },
    related: { deposits: [], strategies: [], governanceRewards: [] },
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
  assert.equal(vm.header.formattedTokenPair, "WETH / cbBTC");
  assert.match(vm.segments.manual.formattedCurrentValueUsd, /\$3,000/);
  assert.match(vm.segments.strategy.formattedCurrentValueUsd, /\$2,000/);
  assert.equal(vm.chart.length, 1);
  assert.equal(vm.chart[0]?.deployedValueUsd, 5_000);
  assert.equal(vm.timeline.length, 1);
  assert.ok(vm.timeline[0]?.formattedOccurredAt);
  assert.match(vm.timeline[0]?.formattedAttributedValueUsd ?? "", /\$1,000/);
});

test("mapPoolDetailResponseToViewModel adds governance reward cross-links only from explicit related rewards", () => {
  const response = createDetailResponse();
  response.related.governanceRewards = [{ id: "reward-1", label: "governance_bribe_claim" }];
  const vm = mapPoolDetailResponseToViewModel(response, "en-US");

  assert.equal(vm.related.governanceRewards[0]?.id, "reward-1");
  assert.match(vm.related.governanceRewards[0]?.href ?? "", /^\/governance\?/);
  assert.match(vm.related.governanceRewards[0]?.href ?? "", /poolId=pool-1/);
});

test("mapPoolDetailResponseToViewModel de-dupes token symbols case-insensitively", () => {
  const response = createDetailResponse();
  response.header.tokenSymbols = ["WETH", "cbBTC", "CBBTC"];

  const vm = mapPoolDetailResponseToViewModel(response, "en-US");

  assert.deepEqual(vm.header.tokenSymbols, ["WETH", "cbBTC"]);
  assert.equal(vm.header.formattedTokenPair, "WETH / cbBTC");
});

test("mapPoolDetailResponseToViewModel maps manual deposits and automated strategies into composition rows", () => {
  const vm = mapPoolDetailResponseToViewModel(createDetailResponse(), "en-US");

  assert.equal(vm.composition.manualDeposits.length, 1);
  assert.equal(vm.composition.automatedStrategies.length, 1);
  assert.equal(vm.composition.manualDeposits[0]?.idLabel, "#18462");
  assert.equal(vm.composition.manualDeposits[0]?.rangeState, "active");
  assert.equal(vm.composition.manualDeposits[0]?.rangeDetail, "95,000.125 -> 98,500.875 cbBTC");
  assert.match(vm.composition.manualDeposits[0]?.underlyingLabel ?? "", /WETH/);
  assert.equal(vm.composition.manualDeposits[0]?.stakingState, "unstaked");
  assert.equal(vm.composition.manualDeposits[0]?.aprLabel, null);
  assert.equal(vm.composition.automatedStrategies[0]?.idLabel, "Mellow steakhouse");
  assert.equal(vm.composition.automatedStrategies[0]?.rangeState, "managed");
  assert.equal(vm.composition.automatedStrategies[0]?.stakingState, "staked");
});

test("mapPoolDetailResponseToViewModel hides closed deposits from composition rows", () => {
  const vm = mapPoolDetailResponseToViewModel(createDetailResponse(), "en-US");

  assert.equal(vm.composition.manualDeposits.some((row) => row.idLabel === "#18463"), false);
});

test("mapPoolDetailResponseToViewModel falls back to ticks when price range metadata is unavailable", () => {
  const response = createDetailResponse();
  response.positions.manualDeposits[0] = {
    ...response.positions.manualDeposits[0],
    rangeLowerPrice: null,
    rangeUpperPrice: null,
    rangeQuoteTokenSymbol: null,
    rangeDisplayFractionDigits: null,
  };

  const vm = mapPoolDetailResponseToViewModel(response, "en-US");

  assert.match(vm.composition.manualDeposits[0]?.rangeDetail ?? "", /-120,000 -> -119,400/);
});
