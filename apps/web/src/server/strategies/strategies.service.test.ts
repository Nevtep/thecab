import assert from "node:assert/strict";
import test from "node:test";

import {
  buildStrategiesListResponse,
  buildStrategyDetailResponse,
} from "@/server/strategies/strategies.service";
import type { StrategyDetailView, StrategySummaryView } from "@/server/strategies/strategies.types";

function createSummary(overrides: Partial<StrategySummaryView> = {}): StrategySummaryView {
  return {
    id: "summary-1",
    strategyId: "strategy-1",
    strategyExposureId: "exposure-1",
    strategyLabel: "WETH / cbBTC-100",
    protocol: "mellow",
    primaryPoolId: "pool-1",
    poolLabel: "WETH / cbBTC CL 100",
    poolMappingStatus: "confirmed",
    status: "active",
    currentEstimatedValueUsd: 1000,
    depositedValueUsd: 800,
    withdrawnValueUsd: 0,
    currentSharesRaw: "123",
    shareSymbol: "mlWETHcbBTC",
    totalRewardsUsd: 25,
    realizedPnlUsd: 10,
    unrealizedPnlUsd: 15,
    totalReturnUsd: 50,
    totalReturnPct: 0.05,
    estimatedAnnualizedReturnPct: 0.12,
    coverageStatus: "full",
    confidence: "high",
    coverageReasonCodes: [],
    ...overrides,
  };
}

function createDetail(overrides: Partial<StrategyDetailView> = {}): StrategyDetailView {
  return {
    ...createSummary(),
    wrapperAddress: "0xwrap",
    stakingRewardsAddress: "0xstake",
    externalStrategyPositionReference: "71496797",
    externalStrategyPositionReferenceStatus: "resolved",
    sharesReceivedRaw: "123",
    sharesRedeemedRaw: "0",
    resolvedRewardCount: 1,
    unresolvedRewardCount: 1,
    history: [
      { dayUtc: "2026-05-20", estimatedValueUsd: 800, cumulativeRewardsUsd: 0 },
      { dayUtc: "2026-05-28", estimatedValueUsd: 1000, cumulativeRewardsUsd: 25 },
    ],
    rewards: [{
      id: "reward-1",
      tokenSymbol: "WETH",
      tokenAddress: "0xweth",
      amountRaw: "100",
      amountFormatted: "0.1",
      amountUsd: 25,
      claimedAt: "2026-05-24T10:21:00.000Z",
      txHash: "0xclaim",
      resolutionStatus: "resolved",
      coverageReasonCodes: [],
    }],
    lifecycle: [{
      id: "life-1",
      sequenceIndex: 1,
      eventType: "strategy_claim",
      occurredAt: "2026-05-24T10:21:00.000Z",
      txHash: "0xclaim",
      logIndex: 9,
      blockNumber: "123",
      usdValue: 25,
      shareDeltaRaw: null,
      tokenDeltas: [],
      priceSource: "alchemyHistorical",
      confidence: "high",
      coverageStatus: "share_level",
      coverageReasonCodes: [],
      metadata: {},
    }],
    coverageNote: {
      status: "full",
      titleKey: "strategies:coverageNote.full.title",
      bodyKey: "strategies:coverageNote.full.body",
      reasonCodes: [],
    },
    ...overrides,
  };
}

test("buildStrategiesListResponse aggregates mixed coverage KPIs and selected strategy", () => {
  const result = buildStrategiesListResponse({
    walletAddress: "0xabc",
    chainId: 8453,
    analysisStatus: "ready",
    request: {
      walletAddress: "0xabc",
      chainId: 8453,
      status: "all",
      protocol: "mellow",
      poolId: null,
      coverage: "all",
      returnSign: "any",
      search: "",
      sort: "current_value_desc",
      selectedStrategyId: "exposure-2",
      page: 1,
      pageSize: 10,
    },
    rows: [
      createSummary({ strategyExposureId: "exposure-1", currentEstimatedValueUsd: 1000, totalRewardsUsd: 25 }),
      createSummary({
        strategyExposureId: "exposure-2",
        currentEstimatedValueUsd: 500,
        totalRewardsUsd: 10,
        totalReturnUsd: null,
        coverageStatus: "share_level",
        coverageReasonCodes: ["shareLevelAccounting"],
      }),
    ],
    pageInfo: { page: 2, totalPages: 3, totalItems: 22 },
    selectedStrategy: null,
    availablePools: [{ poolId: "pool-1", label: "WETH / cbBTC CL 100" }],
  });

  assert.equal(result.kpis.currentStrategyValueUsd, 1500);
  assert.equal(result.kpis.activeStrategyCount, 2);
  assert.equal(result.kpis.totalClaimedRewardsUsd, 35);
  assert.equal(result.kpis.totalReturnUsd, 50);
  assert.equal(result.kpis.coverageStatus, "share_level");
  assert.deepEqual(result.kpis.coverageReasonCodes, ["shareLevelAccounting", "mixedCoverageAggregate"]);
  assert.deepEqual(result.page, { page: 2, pageSize: 10, totalPages: 3, totalItems: 22 });
  assert.equal(result.selectedStrategy?.strategyExposureId, "exposure-2");
});

test("buildStrategiesListResponse keeps unavailable valuation KPIs null and reports mixed coverage", () => {
  const result = buildStrategiesListResponse({
    walletAddress: "0xabc",
    chainId: 8453,
    analysisStatus: "ready",
    request: {
      walletAddress: "0xabc",
      chainId: 8453,
      status: "all",
      protocol: "mellow",
      poolId: null,
      coverage: "all",
      returnSign: "any",
      search: "",
      sort: "current_value_desc",
      selectedStrategyId: null,
      page: 1,
      pageSize: 10,
    },
    rows: [
      createSummary({
        strategyExposureId: "exposure-1",
        currentEstimatedValueUsd: null,
        totalReturnUsd: null,
        coverageStatus: "partial",
        coverageReasonCodes: ["missingShareValuation"],
      }),
      createSummary({
        strategyExposureId: "exposure-2",
        currentEstimatedValueUsd: null,
        totalReturnUsd: null,
        coverageStatus: "unknown",
        confidence: "unknown",
        coverageReasonCodes: ["poolMappingUnknown"],
      }),
    ],
    selectedStrategy: null,
    availablePools: [],
  });

  assert.equal(result.kpis.currentStrategyValueUsd, null);
  assert.equal(result.kpis.totalReturnUsd, null);
  assert.equal(result.kpis.protocolCoveragePct, null);
  assert.equal(result.kpis.coverageStatus, "unknown");
  assert.deepEqual(result.kpis.coverageReasonCodes, [
    "missingShareValuation",
    "poolMappingUnknown",
    "mixedCoverageAggregate",
  ]);
});

test("buildStrategyDetailResponse derives covered range and coverage note from selected strategy", () => {
  const result = buildStrategyDetailResponse({
    walletAddress: "0xabc",
    chainId: 8453,
    strategy: createDetail({
      coverageStatus: "partial",
      coverageReasonCodes: ["unresolvedStrategyReward"],
    }),
  });

  assert.equal(result.coveredRange.startDayUtc, "2026-05-20");
  assert.equal(result.coveredRange.endDayUtc, "2026-05-28");
  assert.equal(result.strategy.coverageNote.status, "partial");
  assert.equal(result.strategy.coverageNote.titleKey, "strategies:coverageNote.partial.title");
  assert.deepEqual(result.strategy.coverageNote.reasonCodes, ["unresolvedStrategyReward"]);
});
