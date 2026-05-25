import assert from "node:assert/strict";
import test from "node:test";

import {
  getOverviewNavigationItems,
  mapOverviewResponseToViewModel,
} from "@/features/overview/overview.mappers";
import type { OverviewViewModel } from "@/features/overview/overview.types";

function createOverviewViewModel(input: {
  analysisStatus: OverviewViewModel["analysis"]["status"];
  coverageStatus: OverviewViewModel["coverage"]["status"];
  coverageReasonCodes: OverviewViewModel["coverage"]["reasonCodes"];
}): OverviewViewModel {
  return {
    walletAddress: "0x0ECD939B7FCA4DC4A0675D8D28BAD12CEFAE0954",
    chainId: 8453,
    mode: "recent_view",
    selectedRange: "7d",
    analysis: {
      status: input.analysisStatus,
      runId: "run_123",
      mode: "incremental",
      stage: null,
      progressPct: 100,
      lastSuccessfulRunAt: "2026-05-24T12:00:00.000Z",
      lastUpdatedAt: "2026-05-24T12:05:00.000Z",
      lastError: null,
    },
    coverage: {
      status: input.coverageStatus,
      confidence: input.coverageStatus === "unknown" ? null : "high",
      reasonCodes: input.coverageReasonCodes,
      details: null,
    },
    summary: {
      source: "recent_provider_data",
      coverageStatus: input.coverageStatus,
      coverageReasonCodes: input.coverageReasonCodes,
      walletAddress: "0x0ECD939B7FCA4DC4A0675D8D28BAD12CEFAE0954",
      chainId: 8453,
      chainLabel: "Base",
      lastRefreshedAt: "2026-05-24T12:05:00.000Z",
      modeLabelKey: "overview:summary.mode.recent",
    },
    metrics: {
      source: "recent_provider_data",
      coverageStatus: input.coverageStatus,
      coverageReasonCodes: input.coverageReasonCodes,
      netPortfolioValueUsd: 1200,
      deployedValueUsd: 900,
      idleValueUsd: 300,
      changeOverSelectedPeriodPct: 1.5,
      estimatedRealizedRewardsUsd: 20,
      manualDepositsValueUsd: 400,
      automatedStrategiesValueUsd: 500,
      residualAttributedValueUsd: 0,
      governanceValueUsd: 300,
      exclusions: null,
    },
    chart: {
      source: "recent_provider_data",
      coverageStatus: input.coverageStatus,
      coverageReasonCodes: input.coverageReasonCodes,
      range: "7d",
      hasRewardMarkers: false,
      points: [
        {
          capturedAt: "2026-05-24T00:00:00.000Z",
          totalValueUsd: 1200,
          deployedValueUsd: 900,
          idleValueUsd: 300,
          rewardValueUsd: 20,
        },
        {
          capturedAt: "2026-05-23T00:00:00.000Z",
          totalValueUsd: 1150,
          deployedValueUsd: 850,
          idleValueUsd: 300,
          rewardValueUsd: 18,
        },
      ],
    },
    distribution: {
      source: "recent_provider_data",
      coverageStatus: input.coverageStatus,
      coverageReasonCodes: input.coverageReasonCodes,
      slices: [
        {
          dimension: "idle",
          label: "Idle",
          valueUsd: 300,
          coverageStatus: input.coverageStatus,
        },
        {
          dimension: "manual_deposit",
          label: "Deposits",
          valueUsd: 900,
          coverageStatus: input.coverageStatus,
        },
      ],
      exclusions: null,
    },
    assets: {
      source: "recent_provider_data",
      coverageStatus: input.coverageStatus,
      coverageReasonCodes: input.coverageReasonCodes,
      rows: [
        {
          tokenAddress: "0xabc",
          chainId: 8453,
          symbol: "AAA",
          name: "Token AAA",
          balance: "10",
          priceUsd: 2,
          valueUsd: 20,
          movement24hPct: null,
          movement7dPct: null,
          classification: "idle",
          priceConfidence: "high",
          trustStatus: "trusted",
          trustReasonCodes: ["hasReliablePrice", "hasReliablePrice"],
          isHiddenByDefault: false,
          classifierVersion: "v1",
        },
      ],
      hiddenSummary: null,
      defaultVisibleCount: 5,
    },
    protocolPositions: {
      source: "recent_provider_data",
      coverageStatus: input.coverageStatus === "recent" ? "full" : input.coverageStatus,
      coverageReasonCodes: input.coverageStatus === "partial" ? ["protocolValuationPartial"] : [],
      rows: [],
      summary: {
        totalCount: 0,
        familyCounts: {
          manualDeposit: 0,
          strategyExposure: 0,
          governanceLock: 0,
          stakedLp: 0,
        },
        hasPartialValuation: input.coverageStatus === "partial",
        hasShareLevelPositions: false,
        lastRefreshedAt: "2026-05-24T12:05:00.000Z",
      },
    },
    activity: {
      source: "recent_provider_data",
      coverageStatus: input.coverageStatus,
      coverageReasonCodes: input.coverageReasonCodes,
      items: [],
    },
  };
}

test("mapOverviewResponseToViewModel preserves full, partial, and unknown coverage states", () => {
  const cases = [
    {
      analysisStatus: "ready" as const,
      coverageStatus: "recent" as const,
      coverageReasonCodes: [] as const,
    },
    {
      analysisStatus: "ready" as const,
      coverageStatus: "partial" as const,
      coverageReasonCodes: ["providerPartial", "missingPrices", "providerPartial"] as const,
    },
    {
      analysisStatus: "not_analyzed" as const,
      coverageStatus: "unknown" as const,
      coverageReasonCodes: [] as const,
    },
  ];

  for (const testCase of cases) {
    const viewModel = mapOverviewResponseToViewModel(
      createOverviewViewModel({
        analysisStatus: testCase.analysisStatus,
        coverageStatus: testCase.coverageStatus,
        coverageReasonCodes: [...testCase.coverageReasonCodes],
      }),
    );

    assert.equal(viewModel.walletAddress, "0x0ecd939b7fca4dc4a0675d8d28bad12cefae0954");
    assert.equal(viewModel.analysis.status, testCase.analysisStatus);
    assert.equal(viewModel.coverage.status, testCase.coverageStatus);
    assert.deepEqual(
      viewModel.coverage.reasonCodes,
      Array.from(new Set(testCase.coverageReasonCodes)),
    );
    assert.equal(viewModel.summary.walletAddress, "0x0ecd939b7fca4dc4a0675d8d28bad12cefae0954");
    assert.deepEqual(
      viewModel.chart.points.map((point) => point.capturedAt),
      ["2026-05-23T00:00:00.000Z", "2026-05-24T00:00:00.000Z"],
    );
  }
});

test("overview navigation requires analysis until the analysis becomes ready", () => {
  const pendingItems = getOverviewNavigationItems("not_analyzed");
  const readyItems = getOverviewNavigationItems("ready");

  assert.equal(pendingItems[1]?.stateKey, "requiresAnalysis");
  assert.equal(readyItems[1]?.stateKey, "comingSoon");
});