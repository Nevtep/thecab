import assert from "node:assert/strict";
import test from "node:test";

import {
  applyStrategiesListRequest,
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

test("applyStrategiesListRequest filters sorts paginates and selects first visible strategy", () => {
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
  assert.equal(result.selectedStrategyId, "high");
  assert.equal(result.totalItems, 2);
});

