import assert from "node:assert/strict";
import test from "node:test";

import { buildStrategiesListResponse } from "@/server/strategies/strategies.service";
import type { StrategySummaryView } from "@/server/strategies/strategies.types";

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
    selectedStrategy: null,
    availablePools: [{ poolId: "pool-1", label: "WETH / cbBTC CL 100" }],
  });

  assert.equal(result.kpis.currentStrategyValueUsd, 1500);
  assert.equal(result.kpis.activeStrategyCount, 2);
  assert.equal(result.kpis.totalClaimedRewardsUsd, 35);
  assert.equal(result.kpis.totalReturnUsd, 50);
  assert.equal(result.kpis.coverageStatus, "share_level");
  assert.deepEqual(result.kpis.coverageReasonCodes, ["shareLevelAccounting", "mixedCoverageAggregate"]);
  assert.equal(result.selectedStrategy?.strategyExposureId, "exposure-2");
});

