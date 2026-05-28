import assert from "node:assert/strict";
import test from "node:test";

import {
  getDepositConfidenceLabelKey,
  getDepositCoverageLabelKey,
  mapDepositUnattributedReasonLabels,
  mapDepositsListResponseToViewModel,
} from "@/features/deposits/deposits.mappers";
import type { DepositsListResponse } from "@/features/deposits/deposits.types";

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