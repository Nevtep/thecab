import assert from "node:assert/strict";
import test from "node:test";

import { buildPortfolioEvolutionModel } from "@/features/overview/portfolio-evolution/portfolioEvolution.utils";
import type { OverviewViewModel } from "@/features/overview/overview.types";

function createViewModel(): Pick<OverviewViewModel, "chart" | "metrics"> {
  return {
    metrics: {
      source: "recent_provider_data",
      coverageStatus: "recent",
      coverageReasonCodes: [],
      netPortfolioValueUsd: 310000,
      deployedValueUsd: 300000,
      idleValueUsd: 10000,
      changeOverSelectedPeriodPct: 0.108,
      estimatedRealizedRewardsUsd: 1985.32,
      manualDepositsValueUsd: 100000,
      automatedStrategiesValueUsd: 150000,
      residualAttributedValueUsd: 50000,
      governanceValueUsd: 10000,
      exclusions: null,
    },
    chart: {
      source: "recent_provider_data",
      coverageStatus: "recent",
      coverageReasonCodes: [],
      range: "30d",
      hasRewardMarkers: true,
      events: [],
      points: [
        {
          capturedAt: "2026-05-18T00:00:00.000Z",
          totalValueUsd: 278842.11,
          deployedValueUsd: 270000,
          idleValueUsd: 8842.11,
          rewardValueUsd: 0,
        },
        {
          capturedAt: "2026-05-19T00:00:00.000Z",
          totalValueUsd: 289000,
          deployedValueUsd: 275000,
          idleValueUsd: 14000,
          rewardValueUsd: 1200,
        },
        {
          capturedAt: "2026-05-20T00:00:00.000Z",
          totalValueUsd: 308999.65,
          deployedValueUsd: 300375.04,
          idleValueUsd: 8624.61,
          rewardValueUsd: 785.32,
        },
      ],
    },
  };
}

test("buildPortfolioEvolutionModel computes summary, cumulative rewards, and marker buckets", () => {
  const model = buildPortfolioEvolutionModel({
    viewModel: createViewModel(),
    range: "30d",
    locale: "es",
    activity: {
      source: "recent_provider_data",
      coverageStatus: "recent",
      coverageReasonCodes: [],
      items: [
        {
          id: "claim-1",
          occurredAt: "2026-05-19T13:45:00.000Z",
          eventType: "claim",
          classification: "claim",
          labelKey: "overview:activity.classifications.claim",
          detail: "AERO claim",
          txHash: "0xclaim",
          confidence: "high",
          isUnclassified: false,
        },
        {
          id: "rebalance-1",
          occurredAt: "2026-05-20T13:45:00.000Z",
          eventType: "rebalance",
          classification: "rebalance",
          labelKey: "overview:activity.classifications.rebalance",
          detail: "Moved idle capital back into strategies",
          txHash: "0xrebalance",
          confidence: "high",
          isUnclassified: false,
        },
      ],
    },
  });

  assert.equal(model.summary.initialValueUsd, 278842.11);
  assert.equal(model.summary.finalValueUsd, 308999.65);
  assert.equal(model.summary.detectedRebalanceCount, 1);
  assert.equal(model.data[1]?.cumulativeRewardValueUsd, 1200);
  assert.equal(model.data[2]?.cumulativeRewardValueUsd, 1985.32);
  assert.equal(model.data[1]?.events[0]?.type, "claim");
  assert.equal(model.data[2]?.events[0]?.type, "rebalance");
});

test("buildPortfolioEvolutionModel maps deposits and withdrawals to capital-state markers", () => {
  const model = buildPortfolioEvolutionModel({
    viewModel: createViewModel(),
    range: "30d",
    locale: "en",
    activity: {
      source: "recent_provider_data",
      coverageStatus: "recent",
      coverageReasonCodes: [],
      items: [
        {
          id: "withdraw-1",
          occurredAt: "2026-05-19T18:00:00.000Z",
          eventType: "withdraw",
          classification: "withdraw",
          labelKey: "overview:activity.classifications.withdraw",
          detail: "Moved capital back to wallet",
          txHash: null,
          confidence: "medium",
          isUnclassified: false,
        },
        {
          id: "deposit-1",
          occurredAt: "2026-05-20T18:00:00.000Z",
          eventType: "deposit",
          classification: "deposit",
          labelKey: "overview:activity.classifications.deposit",
          detail: "Redeployed idle capital",
          txHash: null,
          confidence: "medium",
          isUnclassified: false,
        },
      ],
    },
  });

  assert.equal(model.data[1]?.events[0]?.type, "move_to_idle");
  assert.equal(model.data[2]?.events[0]?.type, "redeploy");
});

test("buildPortfolioEvolutionModel falls back to backend chart events for aero rewards and rebalance markers", () => {
  const viewModel = createViewModel();
  viewModel.metrics.estimatedRealizedRewardsUsd = 0;
  viewModel.chart.points = viewModel.chart.points.map((point) => ({
    ...point,
    rewardValueUsd: 0,
  }));
  viewModel.chart.events = [
    {
      id: "claim-aero-1",
      type: "claim",
      occurredAt: "2026-05-19T13:45:00.000Z",
      capturedAt: "2026-05-19T00:00:00.000Z",
      detail: "AERO claim",
      txHash: "0xclaim-aero",
      rewardValueUsd: 95.4,
    },
    {
      id: "rebalance-23may",
      type: "rebalance",
      occurredAt: "2026-05-20T13:45:00.000Z",
      capturedAt: "2026-05-20T00:00:00.000Z",
      detail: "Internal capital rebalance",
      txHash: "0x7d77f5de2f4bc449d7e6eaab7fdb4553809151898a8f4a503d33f6c8aa84dc0a",
      rewardValueUsd: null,
    },
  ];

  const model = buildPortfolioEvolutionModel({
    viewModel,
    range: "30d",
    locale: "es",
    activity: null,
  });

  assert.equal(model.data[1]?.rewardValueUsd, 95.4);
  assert.equal(model.data[0]?.rewardValueUsd, 0);
  assert.equal(model.data[0]?.cumulativeRewardValueUsd, 0);
  assert.equal(model.data[1]?.cumulativeRewardValueUsd, 95.4);
  assert.equal(model.data[2]?.events[0]?.type, "rebalance");
  assert.equal(model.summary.accumulatedRewardsUsd, 95.4);
  assert.equal(model.summary.detectedRebalanceCount, 1);
});

test("buildPortfolioEvolutionModel preserves backend cash-out markers with detail and tx hash", () => {
  const viewModel = createViewModel();
  viewModel.chart.events = [
    {
      id: "cashout-27apr",
      type: "cash_out",
      occurredAt: "2026-05-20T15:55:25.000Z",
      capturedAt: "2026-05-20T00:00:00.000Z",
      detail: "Swapped rewards to USDC and transferred out",
      txHash: "0xcashout",
      rewardValueUsd: null,
    },
  ];

  const model = buildPortfolioEvolutionModel({
    viewModel,
    range: "30d",
    locale: "en",
    activity: null,
  });

  assert.equal(model.data[2]?.events[0]?.type, "cash_out");
  assert.equal(model.data[2]?.events[0]?.detail, "Swapped rewards to USDC and transferred out");
  assert.equal(model.data[2]?.events[0]?.txHash, "0xcashout");
  assert.deepEqual(model.availableEventTypes, ["cash_out"]);
});

test("buildPortfolioEvolutionModel normalizes rewards to zero across every bucket when rewards coverage is known", () => {
  const viewModel = createViewModel();
  viewModel.metrics.estimatedRealizedRewardsUsd = 0;
  viewModel.chart.hasRewardMarkers = true;
  viewModel.chart.points = viewModel.chart.points.map((point) => ({
    ...point,
    rewardValueUsd: null,
  }));

  const model = buildPortfolioEvolutionModel({
    viewModel,
    range: "30d",
    locale: "es",
    activity: null,
  });

  assert.equal(model.data.length, viewModel.chart.points.length);
  assert.deepEqual(
    model.data.map((point) => point.rewardValueUsd),
    [0, 0, 0],
  );
  assert.deepEqual(
    model.data.map((point) => point.cumulativeRewardValueUsd),
    [0, 0, 0],
  );
  assert.equal(model.summary.accumulatedRewardsUsd, 0);
});

test("buildPortfolioEvolutionModel formats 30d bucket labels in UTC day buckets", () => {
  const viewModel = createViewModel();
  viewModel.chart.points = [
    {
      capturedAt: "2026-05-25T00:00:00.000Z",
      totalValueUsd: 308999.65,
      deployedValueUsd: 300375.04,
      idleValueUsd: 8624.61,
      rewardValueUsd: 0,
    },
  ];

  const model = buildPortfolioEvolutionModel({
    viewModel,
    range: "30d",
    locale: "en",
    activity: null,
  });

  assert.equal(model.data[0]?.axisLabel, "May 25");
});