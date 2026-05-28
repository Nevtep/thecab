import assert from "node:assert/strict";
import test from "node:test";

import {
  mapDepositDetailResponseToViewModel,
  getDepositConfidenceLabelKey,
  getDepositCoverageLabelKey,
  mapDepositUnattributedReasonLabels,
  mapDepositsListResponseToViewModel,
} from "@/features/deposits/deposits.mappers";
import type { DepositDetailResponse, DepositsListResponse } from "@/features/deposits/deposits.types";

test("mapDepositsListResponseToViewModel derives total-return sign", () => {
  const response: DepositsListResponse = {
    walletAddress: "0xabc",
    chainId: 8453,
    analysisStatus: "ready",
    coveredRange: {
      startDayUtc: "2026-01-01",
      endDayUtc: "2026-05-28",
    },
    summary: {
      totalCount: 2,
      openActiveCount: 1,
      openOutOfRangeCount: 0,
      closedCount: 1,
      currentValueUsd: 1200,
      totalRewardsUsd: 100,
      weightedAnnualizedReturnPct: 0.12,
      capitalDeployedPctOfManual: 0.8,
      hasAutomatedExposure: false,
      coverageStatus: "partial",
      coverageReasonCodes: ["priceUnavailable"],
    },
    items: [
      {
        depositId: "123e4567-e89b-12d3-a456-426614174000",
        poolId: "123e4567-e89b-12d3-a456-426614174001",
        poolLabel: "Pool A",
        positionLabel: "ETH / USDC · CL #1",
        poolKind: "cl",
        feeTierBps: 30,
        tokenId: "1",
        token0Symbol: "ETH",
        token1Symbol: "USDC",
        status: "open_active",
        openedAt: "2026-01-01T00:00:00.000Z",
        closedAt: null,
        openedByTransferIn: false,
        openedValueUsd: 1000,
        currentValueUsd: 1200,
        capitalEnteredUsd: 1000,
        capitalWithdrawnUsd: 0,
        totalRewardsUsd: 100,
        realizedPnlUsd: 0,
        unrealizedPnlUsd: 200,
        totalReturnUsd: 300,
        totalReturnPct: 0.3,
        estimatedAnnualizedReturnPct: 0.12,
        isInRange: true,
        rangeLowerPrice: 1,
        rangeUpperPrice: 2,
        coverageStatus: "full",
        confidence: "high",
        coverageReasonCodes: [],
        coveredStartDayUtc: "2026-01-01",
        coveredEndDayUtc: "2026-05-28",
        mellowStrategyCrossLinkId: null,
      },
      {
        depositId: "123e4567-e89b-12d3-a456-426614174002",
        poolId: "123e4567-e89b-12d3-a456-426614174003",
        poolLabel: "Pool B",
        positionLabel: "cbBTC / ETH · CL #2",
        poolKind: "cl",
        feeTierBps: 30,
        tokenId: "2",
        token0Symbol: "cbBTC",
        token1Symbol: "ETH",
        status: "closed",
        openedAt: "2026-01-02T00:00:00.000Z",
        closedAt: "2026-03-01T00:00:00.000Z",
        openedByTransferIn: true,
        openedValueUsd: 500,
        currentValueUsd: 0,
        capitalEnteredUsd: 500,
        capitalWithdrawnUsd: 450,
        totalRewardsUsd: 0,
        realizedPnlUsd: -50,
        unrealizedPnlUsd: 0,
        totalReturnUsd: -50,
        totalReturnPct: -0.1,
        estimatedAnnualizedReturnPct: null,
        isInRange: null,
        rangeLowerPrice: null,
        rangeUpperPrice: null,
        coverageStatus: "partial",
        confidence: "degraded",
        coverageReasonCodes: ["transferInOrigin"],
        coveredStartDayUtc: "2026-01-02",
        coveredEndDayUtc: "2026-03-01",
        mellowStrategyCrossLinkId: "123e4567-e89b-12d3-a456-426614174004",
      },
    ],
    page: {
      page: 1,
      pageSize: 25,
      totalCount: 2,
      hasMore: false,
    },
  };

  const viewModel = mapDepositsListResponseToViewModel(response);

  assert.equal(viewModel.items[0]?.totalReturnSign, "positive");
  assert.equal(viewModel.items[1]?.totalReturnSign, "negative");
});

test("coverage and confidence helpers resolve the expected i18n keys", () => {
  assert.equal(getDepositCoverageLabelKey("share_level"), "coverage:level.share_level");
  assert.equal(getDepositConfidenceLabelKey("degraded"), "coverage:confidence.degraded");
});

test("mapDepositUnattributedReasonLabels prefers deposits copy and falls back to coverage copy", () => {
  const labels = mapDepositUnattributedReasonLabels({
    reasonCodes: ["unattributedResidual", "priceUnavailable", "customReason"],
    translate: (key, options) => ({
      "deposits:unattributed.reasonCodes.unattributedResidual": "Residual remains unattributed",
      "coverage:reasons.priceUnavailable": "No defendable historical price was available",
    })[key] ?? options?.defaultValue ?? key,
  });

  assert.deepEqual(labels, [
    "Residual remains unattributed",
    "No defendable historical price was available",
    "customReason",
  ]);
});

test("mapDepositDetailResponseToViewModel maps range lifecycle decomposition and secondary stats", () => {
  const response: DepositDetailResponse = {
    walletAddress: "0xabc",
    chainId: 8453,
    analysisStatus: "ready",
    coveredRange: {
      startDayUtc: "2026-01-01",
      endDayUtc: "2026-05-28",
    },
    deposit: {
      depositId: "123e4567-e89b-12d3-a456-426614174000",
      poolId: "123e4567-e89b-12d3-a456-426614174001",
      poolLabel: "WETH / cbBTC",
      positionLabel: "WETH / cbBTC · CL · 100 #71093441",
      poolKind: "cl",
      feeTierBps: 100,
      tokenId: "71093441",
      token0Address: "0x4200000000000000000000000000000000000006",
      token0Symbol: "WETH",
      token1Address: "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf",
      token1Symbol: "cbBTC",
      status: "open_active",
      openedAt: "2026-01-10T00:00:00.000Z",
      closedAt: null,
      openedByTransferIn: false,
      openedValueUsd: 1000,
      currentValueUsd: 1200,
      capitalEnteredUsd: 1000,
      capitalWithdrawnUsd: 250,
      totalRewardsUsd: 25,
      realizedPnlUsd: -10,
      unrealizedPnlUsd: 185,
      totalReturnUsd: 200,
      totalReturnPct: 0.2,
      estimatedAnnualizedReturnPct: 0.15,
      isInRange: true,
      rangeLowerPrice: 0.02456,
      rangeUpperPrice: 0.02891,
      tickLower: -1,
      tickUpper: 1,
      coverageStatus: "partial",
      confidence: "degraded",
      coverageReasonCodes: ["rangeUnavailable"],
      coveredStartDayUtc: "2026-01-15",
      coveredEndDayUtc: "2026-05-20",
      mellowStrategyCrossLinkId: "strategy-1",
      decomposition: {
        totalReturnUsd: 200,
        rewardsUsd: 25,
        feesUsd: 5,
        assetPriceEffectUsd: 80,
        rebalanceEffectUsd: -20,
        realizedPnlUsd: -10,
        unrealizedPnlUsd: 110,
        unattributedUsd: 10,
        unattributedReasonCodes: ["priceUnavailable"],
        componentPercentages: {},
      },
      lifecycle: [
        {
          id: "event-open",
          sequenceIndex: 0,
          eventType: "mint_position",
          occurredAt: "2026-01-10T00:00:00.000Z",
          txHash: "0xopen",
          logIndex: 0,
          blockNumber: 90,
          usdValue: -1000,
          signedTokenDeltas: [],
          priceSource: "event",
          confidence: "high",
          inferredActionId: null,
          coverageReasonCodes: [],
          metadata: {},
        },
        {
          id: "event-1",
          sequenceIndex: 1,
          eventType: "claim_reward",
          occurredAt: "2026-03-01T00:00:00.000Z",
          txHash: "0xreward",
          logIndex: 1,
          blockNumber: 100,
          usdValue: 25,
          signedTokenDeltas: [
            {
              tokenAddress: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
              symbol: "AERO",
              direction: "in",
              amountRaw: "1000000000000000000",
              amountFormatted: "1",
              usdValue: 25,
              priceSource: "event",
            },
          ],
          priceSource: "event",
          confidence: "medium",
          inferredActionId: null,
          coverageReasonCodes: ["coverageGap"],
          metadata: {},
        },
        {
          id: "event-close",
          sequenceIndex: 2,
          eventType: "close",
          occurredAt: "2026-04-01T00:00:00.000Z",
          txHash: "0xclose",
          logIndex: 2,
          blockNumber: 110,
          usdValue: 180,
          signedTokenDeltas: [],
          priceSource: "pricePointFallback",
          confidence: "medium",
          inferredActionId: null,
          coverageReasonCodes: ["priceFallbackDca"],
          metadata: {
            rebalanceEffectUsd: -20,
            hodlBenchmarkUsd: 200,
            withdrawalValueUsd: 180,
          },
        },
      ],
    },
    valueChart: {
      series: [],
      gaps: [],
    },
  };

  const viewModel = mapDepositDetailResponseToViewModel({
    response,
    locale: "en-US",
    translate: (key, options) => ({
      "deposits:status.open_active": "Open · in range",
      "deposits:detail.coveredRange.shorterThanWindow": "Covered range is shorter than the requested window.",
      "coverage:level.partial": "Partial",
      "coverage:confidence.degraded": "Degraded",
      "coverage:confidence.medium": "Medium",
      "deposits:events.claim_reward": "Claim reward",
      "deposits:events.mint_position": "Mint position",
      "deposits:events.close": "Close",
      "coverage:reasons.coverageGap": "Coverage gap",
      "coverage:reasons.priceFallbackDca": "Price fallback",
      "deposits:detail.movements.priceSourceValues.event": "Event price",
      "deposits:detail.movements.priceSourceValues.pricePointFallback": "Price fallback",
      "deposits:detail.decomposition.components.rewards": "Rewards",
      "deposits:detail.decomposition.components.fees": "Fees",
      "deposits:detail.decomposition.components.assetPriceEffect": "Asset price effect",
      "deposits:detail.decomposition.components.rebalanceEffect": "Rebalance / IL effect",
      "deposits:detail.decomposition.components.realizedPnl": "Realized PnL",
      "deposits:detail.decomposition.components.unrealizedPnl": "Unrealized PnL",
      "deposits:detail.decomposition.components.unattributed": "Unattributed",
      "coverage:reasons.priceUnavailable": "Price unavailable",
    })[key] ?? options?.defaultValue ?? key,
  });

  assert.equal(viewModel.range?.lowerLabel.includes("cbBTC"), true);
  assert.equal(viewModel.coveredRange.hint, "Covered range is shorter than the requested window.");
  assert.equal(viewModel.lifecycle.events.find((event) => event.id === "event-1")?.title, "Claim reward");
  assert.equal(viewModel.lifecycle.events.find((event) => event.id === "event-1")?.movements[0]?.priceSourceLabel, "Event price");
  assert.equal(viewModel.decomposition.capitalEnteredTooltipLabel?.includes("Mint position"), true);
  assert.equal(viewModel.decomposition.capitalEnteredTooltipLabel?.includes("Event price"), true);
  assert.equal(viewModel.decomposition.capitalWithdrawnTooltipLabel?.includes("Close"), true);
  assert.equal(viewModel.decomposition.capitalWithdrawnTooltipLabel?.includes("Price fallback"), true);
  assert.equal(viewModel.decomposition.rows.find((row) => row.key === "rebalanceEffectUsd")?.tooltipLabel?.includes("$200.00 → $180.00"), true);
  assert.equal(viewModel.decomposition.rows.find((row) => row.key === "unattributedUsd")?.tooltipLabel, "Price unavailable");
  assert.equal(viewModel.secondaryStats.find((row) => row.key === "coverage")?.value, "Partial");
});