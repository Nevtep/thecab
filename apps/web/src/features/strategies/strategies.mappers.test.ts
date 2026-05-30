import assert from "node:assert/strict";
import test from "node:test";

import {
  getStrategyConfidenceLabelKey,
  getStrategyCoverageLabelKey,
  mapStrategiesListResponseToViewModel,
} from "@/features/strategies/strategies.mappers";
import type { StrategiesListResponse } from "@/features/strategies/strategies.types";

test("mapStrategiesListResponseToViewModel derives row signs and selected state", () => {
  const response: StrategiesListResponse = {
    walletAddress: "0xabc",
    chainId: 8453,
    analysisStatus: "ready",
    coveredRange: { startDayUtc: "2026-05-20", endDayUtc: "2026-05-28" },
    kpis: {
      currentStrategyValueUsd: 1000,
      activeStrategyCount: 1,
      totalClaimedRewardsUsd: 20,
      totalReturnUsd: 50,
      protocolCoveragePct: 1,
      coverageStatus: "share_level",
      coverageReasonCodes: ["shareLevelAccounting"],
      trends: {},
    },
    filters: { applied: {}, availablePools: [] },
    page: { page: 1, pageSize: 10, totalPages: 1, totalItems: 1 },
    strategies: [{
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
      totalRewardsUsd: 20,
      realizedPnlUsd: 10,
      unrealizedPnlUsd: 20,
      totalReturnUsd: 50,
      totalReturnPct: 0.05,
      estimatedAnnualizedReturnPct: 0.12,
      coverageStatus: "share_level",
      confidence: "high",
      coverageReasonCodes: ["shareLevelAccounting"],
    }],
    selectedStrategy: null,
  };

  const viewModel = mapStrategiesListResponseToViewModel(response);

  assert.equal(viewModel.items[0]?.totalReturnSign, "positive");
  assert.equal(viewModel.items[0]?.isSelected, false);
  assert.equal(viewModel.formattedKpis.activeStrategyCount, "1");
});

test("strategy coverage and confidence helpers resolve i18n keys", () => {
  assert.equal(getStrategyCoverageLabelKey("share_level"), "coverage:level.share_level");
  assert.equal(getStrategyConfidenceLabelKey("degraded"), "coverage:confidence.degraded");
});

