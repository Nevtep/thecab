import assert from "node:assert/strict";
import test from "node:test";

import {
  applyStrategiesListRequest,
  mapStrategyLifecycleRow,
  mapStrategyRewardRow,
  mapStrategySummaryRow,
  type StrategySummaryRowRecord,
} from "@/server/strategies/strategies.repository";

function createRow(overrides: Partial<StrategySummaryRowRecord> = {}): StrategySummaryRowRecord {
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
    currentEstimatedValueUsd: "1000",
    depositedValueUsd: "800",
    withdrawnValueUsd: "0",
    currentSharesRaw: "123",
    shareSymbol: "mlWETHcbBTC",
    totalRewardsUsd: "25",
    realizedPnlUsd: "10",
    unrealizedPnlUsd: "15",
    totalReturnUsd: "50",
    totalReturnPct: "0.05",
    estimatedAnnualizedReturnPct: "0.12",
    coverageStatus: "full",
    confidence: "high",
    coverageReasonCodes: [],
    wrapperAddress: "0xwrap",
    stakingRewardsAddress: null,
    externalStrategyPositionReference: null,
    externalStrategyPositionReferenceStatus: "unresolved",
    sharesReceivedRaw: "123",
    sharesRedeemedRaw: "0",
    resolvedRewardCount: 1,
    unresolvedRewardCount: 0,
    openedAt: new Date("2026-05-20T00:00:00.000Z"),
    closedAt: null,
    coveredStartDayUtc: "2026-05-20",
    coveredEndDayUtc: "2026-05-28",
    metadataJson: {},
    ...overrides,
  };
}

test("mapStrategySummaryRow normalizes persisted strategy values", () => {
  const mapped = mapStrategySummaryRow(createRow({
    status: "weird",
    coverageStatus: "bogus",
    confidence: "n/a",
    totalReturnPct: "",
    coverageReasonCodes: null,
  }));

  assert.equal(mapped.status, "unknown");
  assert.equal(mapped.coverageStatus, "unknown");
  assert.equal(mapped.confidence, "unknown");
  assert.equal(mapped.totalReturnPct, null);
  assert.deepEqual(mapped.coverageReasonCodes, []);
  assert.equal(mapped.currentEstimatedValueUsd, 1000);
});

test("applyStrategiesListRequest filters sorts paginates and clears selected strategy excluded by filters", () => {
  const result = applyStrategiesListRequest({
    request: {
      walletAddress: "0xabc",
      chainId: 8453,
      status: "active",
      protocol: "mellow",
      poolId: "pool-1",
      coverage: "all",
      returnSign: "positive",
      search: "btc",
      sort: "current_value_desc",
      selectedStrategyId: "missing",
      page: 1,
      pageSize: 10,
    },
    rows: [
      mapStrategySummaryRow(createRow({ strategyExposureId: "low", currentEstimatedValueUsd: "100", totalReturnUsd: "1" })),
      mapStrategySummaryRow(createRow({ strategyExposureId: "high", currentEstimatedValueUsd: "500", totalReturnUsd: "3" })),
      mapStrategySummaryRow(createRow({ strategyExposureId: "manual", primaryPoolId: "pool-2", strategyLabel: "AERO / USDC", totalReturnUsd: "-1" })),
    ],
  });

  assert.deepEqual(result.items.map((item) => item.strategyExposureId), ["high", "low"]);
  assert.equal(result.selectedStrategyId, null);
  assert.equal(result.totalItems, 2);
});

test("applyStrategiesListRequest composes coverage search sorting pagination and selected fallback", () => {
  const rows = [
    mapStrategySummaryRow(createRow({
      strategyExposureId: "exposure-a",
      strategyLabel: "WETH / cbBTC-100",
      primaryPoolId: "pool-1",
      currentEstimatedValueUsd: "500",
      totalReturnUsd: "25",
      coverageStatus: "share_level",
    })),
    mapStrategySummaryRow(createRow({
      strategyExposureId: "exposure-b",
      strategyLabel: "USDC / cbBTC-100",
      primaryPoolId: "pool-1",
      currentEstimatedValueUsd: "300",
      totalReturnUsd: "10",
      coverageStatus: "share_level",
    })),
    mapStrategySummaryRow(createRow({
      strategyExposureId: "exposure-c",
      strategyLabel: "WETH / USDC-100",
      primaryPoolId: "pool-2",
      currentEstimatedValueUsd: "700",
      totalReturnUsd: "-5",
      coverageStatus: "partial",
    })),
  ];

  const result = applyStrategiesListRequest({
    request: {
      walletAddress: "0xabc",
      chainId: 8453,
      status: "active",
      protocol: "mellow",
      poolId: "pool-1",
      coverage: "share_level",
      returnSign: "positive",
      search: "btc",
      sort: "return_asc",
      selectedStrategyId: "exposure-a",
      page: 3,
      pageSize: 10,
    },
    rows,
  });

  assert.equal(result.page, 1);
  assert.equal(result.totalPages, 1);
  assert.equal(result.totalItems, 2);
  assert.deepEqual(result.items.map((item) => item.strategyExposureId), ["exposure-b", "exposure-a"]);
  assert.equal(result.selectedStrategyId, "exposure-a");
});

test("strategy detail row mappers preserve rewards lifecycle traceability and coverage", () => {
  const reward = mapStrategyRewardRow({
    id: "reward-1",
    tokenSymbol: "WETH",
    tokenAddress: "0xweth",
    amountRaw: "124300000000000000",
    amountFormatted: "0.1243",
    amountUsd: "340.21",
    claimedAt: new Date("2026-05-24T10:21:00.000Z"),
    txHash: "0xclaim",
    resolutionStatus: "resolved",
    coverageReasonCodes: ["shareLevelAccounting"],
  });
  const unresolvedReward = mapStrategyRewardRow({
    id: "reward-2",
    tokenSymbol: "AERO",
    tokenAddress: "0xaero",
    amountRaw: "128470000000000000000",
    amountFormatted: "128.47",
    amountUsd: null,
    claimedAt: "2026-05-25T06:13:00.000Z",
    txHash: "0xunresolved",
    resolutionStatus: "candidate",
    coverageReasonCodes: ["unresolvedStrategyReward"],
  });
  const lifecycle = mapStrategyLifecycleRow({
    id: "life-1",
    sequenceIndex: 2,
    eventType: "strategy_claim",
    occurredAt: new Date("2026-05-24T10:21:00.000Z"),
    txHash: "0xclaim",
    logIndex: 9,
    blockNumber: "123",
    usdValue: "340.21",
    shareDeltaRaw: null,
    tokenDeltasJson: [{
      tokenAddress: "0xweth",
      symbol: "WETH",
      direction: "in",
      amountRaw: "124300000000000000",
      amountFormatted: "0.1243",
      usdValue: "340.21",
      priceSource: "alchemyHistorical",
    }],
    priceSource: "alchemyHistorical",
    confidence: "high",
    coverageStatus: "share_level",
    coverageReasonCodes: ["shareLevelAccounting"],
    metadataJson: { rewardType: "aerodrome_gauge" },
  });

  assert.equal(reward.claimedAt, "2026-05-24T10:21:00.000Z");
  assert.equal(reward.amountUsd, 340.21);
  assert.equal(unresolvedReward.resolutionStatus, "unresolved");
  assert.equal(lifecycle.eventType, "strategy_claim");
  assert.equal(lifecycle.tokenDeltas[0]?.priceSource, "alchemyHistorical");
  assert.equal(lifecycle.metadata.rewardType, "aerodrome_gauge");
});
