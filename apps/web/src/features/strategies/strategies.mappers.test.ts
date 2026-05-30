import assert from "node:assert/strict";
import test from "node:test";

import {
  getStrategyConfidenceLabelKey,
  getStrategyCoverageTone,
  getStrategyCoverageLabelKey,
  getStrategyLifecycleLabelKey,
  getStrategyTxExplorerUrl,
  mapStrategyDetailResponseToViewModel,
  mapStrategiesListResponseToViewModel,
} from "@/features/strategies/strategies.mappers";
import type { StrategiesListResponse, StrategyDetailResponse } from "@/features/strategies/strategies.types";

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

test("mapStrategyDetailResponseToViewModel formats lifecycle rewards and explorer links", () => {
  const response: StrategyDetailResponse = {
    walletAddress: "0xabc",
    chainId: 8453,
    coveredRange: { startDayUtc: "2026-05-20", endDayUtc: "2026-05-28" },
    strategy: {
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
      wrapperAddress: "0xwrap",
      stakingRewardsAddress: "0xstake",
      externalStrategyPositionReference: "71496797",
      externalStrategyPositionReferenceStatus: "resolved",
      sharesReceivedRaw: "123",
      sharesRedeemedRaw: "0",
      resolvedRewardCount: 1,
      unresolvedRewardCount: 0,
      history: [],
      rewards: [{
        id: "reward-1",
        tokenSymbol: "WETH",
        tokenAddress: "0xweth",
        amountRaw: "100",
        amountFormatted: "0.1",
        amountUsd: 20,
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
        usdValue: 20,
        shareDeltaRaw: null,
        tokenDeltas: [],
        priceSource: "alchemyHistorical",
        confidence: "high",
        coverageStatus: "share_level",
        coverageReasonCodes: [],
        metadata: {},
      }],
      coverageNote: {
        status: "share_level",
        titleKey: "strategies:coverageNote.share_level.title",
        bodyKey: "strategies:coverageNote.share_level.body",
        reasonCodes: ["shareLevelAccounting"],
      },
    },
  };

  const viewModel = mapStrategyDetailResponseToViewModel(response);

  assert.equal(viewModel.formattedHeader.currentValue, "$1,000.00");
  assert.equal(viewModel.rewardsRows[0]?.formattedAmountUsd, "$20.00");
  assert.equal(viewModel.rewardsRows[0]?.explorerUrl, "https://basescan.org/tx/0xclaim");
  assert.equal(viewModel.lifecycleRows[0]?.labelKey, "strategies:lifecycle.eventTypes.strategy_claim");
  assert.equal(viewModel.lifecycleRows[0]?.explorerUrl, "https://basescan.org/tx/0xclaim");
  assert.equal(viewModel.coverageNoteView.tone, "warning");
  assert.equal(viewModel.coverageNoteView.isProminent, true);
  assert.deepEqual(viewModel.coverageNoteView.reasonLabelKeys, ["coverage:reasons.shareLevelAccounting"]);
  assert.equal(getStrategyLifecycleLabelKey("unresolved_strategy_reward"), "strategies:lifecycle.eventTypes.unresolved_strategy_reward");
  assert.equal(getStrategyTxExplorerUrl(8453, null), null);
});

test("coverage note tone mapping distinguishes full, degraded, and unknown strategy accounting", () => {
  assert.equal(getStrategyCoverageTone("full"), "success");
  assert.equal(getStrategyCoverageTone("share_level"), "warning");
  assert.equal(getStrategyCoverageTone("partial"), "warning");
  assert.equal(getStrategyCoverageTone("unknown"), "danger");
});
