import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDepositDetailResponse,
  buildDepositsListResponse,
} from "@/server/deposits/deposits.service";
import type { DepositDetailView, DepositSummaryView } from "@/server/deposits/deposits.types";

function createSummary(overrides: Partial<DepositSummaryView> = {}): DepositSummaryView {
  return {
    depositId: "deposit-1",
    poolId: "pool-1",
    poolLabel: "WETH / cbBTC 100",
    positionLabel: "WETH / cbBTC · CL · 100 #71093441",
    poolKind: "cl",
    feeTierBps: 100,
    tokenId: "71093441",
    token0Symbol: "WETH",
    token1Symbol: "cbBTC",
    status: "open_active",
    openedAt: "2026-05-20T22:45:21.000Z",
    closedAt: null,
    openedByTransferIn: false,
    openedValueUsd: 1000,
    currentValueUsd: 1200,
    capitalEnteredUsd: 1000,
    capitalWithdrawnUsd: 0,
    totalRewardsUsd: 50,
    realizedPnlUsd: 25,
    unrealizedPnlUsd: 25,
    totalReturnUsd: 100,
    totalReturnPct: 0.1,
    estimatedAnnualizedReturnPct: 0.12,
    isInRange: true,
    rangeLowerPrice: 0.02,
    rangeUpperPrice: 0.03,
    coverageStatus: "full",
    confidence: "high",
    coverageReasonCodes: [],
    coveredStartDayUtc: "2026-05-20",
    coveredEndDayUtc: "2026-05-28",
    mellowStrategyCrossLinkId: null,
    ...overrides,
  };
}

function createDetail(overrides: Partial<DepositDetailView> = {}): DepositDetailView {
  return {
    ...createSummary(),
    token0Address: "0x4200000000000000000000000000000000000006",
    token1Address: "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf",
    tickLower: -266400,
    tickUpper: -265900,
    decomposition: {
      totalReturnUsd: 100,
      rewardsUsd: 10,
      feesUsd: 5,
      assetPriceEffectUsd: 20,
      rebalanceEffectUsd: 15,
      realizedPnlUsd: 30,
      unrealizedPnlUsd: 10,
      unattributedUsd: 10,
      unattributedReasonCodes: ["priceUnavailable"],
      componentPercentages: {},
    },
    lifecycle: [
      {
        id: "event-open",
        sequenceIndex: 1,
        eventType: "mint_position",
        occurredAt: "2026-05-20T22:45:21.000Z",
        txHash: "0xopen",
        logIndex: 0,
        blockNumber: 1,
        usdValue: 1000,
        signedTokenDeltas: [],
        priceSource: "event",
        confidence: "high",
        inferredActionId: null,
        coverageReasonCodes: [],
        metadata: {},
      },
      {
        id: "event-reward",
        sequenceIndex: 2,
        eventType: "claim_reward",
        occurredAt: "2026-05-22T00:00:00.000Z",
        txHash: "0xreward",
        logIndex: 1,
        blockNumber: 2,
        usdValue: 10,
        signedTokenDeltas: [],
        priceSource: "pricePointFallback",
        confidence: "degraded",
        inferredActionId: null,
        coverageReasonCodes: ["priceFallbackDca"],
        metadata: {},
      },
      {
        id: "event-withdraw",
        sequenceIndex: 3,
        eventType: "withdraw",
        occurredAt: "2026-05-24T00:00:00.000Z",
        txHash: "0xwithdraw",
        logIndex: 2,
        blockNumber: 3,
        usdValue: -50,
        signedTokenDeltas: [],
        priceSource: "unavailable",
        confidence: "degraded",
        inferredActionId: null,
        coverageReasonCodes: ["priceUnavailable"],
        metadata: {},
      },
    ],
    ...overrides,
    mellowStrategyCrossLinkId: overrides.mellowStrategyCrossLinkId ?? null,
  };
}

test("buildDepositsListResponse filters sorts paginates and aggregates deposits", () => {
  const result = buildDepositsListResponse({
    walletAddress: "0xabc",
    chainId: 8453,
    analysisStatus: "ready",
    request: {
      status: "all",
      poolId: null,
      returnSign: "positive",
      startDayUtc: "2026-05-19",
      endDayUtc: "2026-05-28",
      sort: "estApr",
      direction: "desc",
      page: 1,
      pageSize: 1,
    },
    rows: [
      createSummary({ depositId: "deposit-b", estimatedAnnualizedReturnPct: 0.05, totalReturnUsd: 50, totalRewardsUsd: 10, realizedPnlUsd: 20, unrealizedPnlUsd: 20 }),
      createSummary({ depositId: "deposit-a", estimatedAnnualizedReturnPct: 0.2, totalReturnUsd: 120, totalRewardsUsd: 20, realizedPnlUsd: 40, unrealizedPnlUsd: 60, coverageStatus: "partial", coverageReasonCodes: ["unattributedResidual"] }),
      createSummary({ depositId: "deposit-c", totalReturnUsd: -10, totalRewardsUsd: 0, realizedPnlUsd: -5, unrealizedPnlUsd: -5 }),
    ],
    hasAutomatedExposure: true,
  });

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0]?.depositId, "deposit-a");
  assert.equal(result.page.hasMore, true);
  assert.equal(result.summary.totalCount, 3);
  assert.equal(result.summary.hasAutomatedExposure, true);
  assert.equal(result.summary.coverageStatus, "partial");
  assert.deepEqual(result.summary.coverageReasonCodes, ["unattributedResidual"]);
});

test("buildDepositsListResponse rejects deposits with reconciliation drift", () => {
  assert.throws(() => buildDepositsListResponse({
    walletAddress: "0xabc",
    chainId: 8453,
    analysisStatus: "ready",
    request: {
      status: "all",
      poolId: null,
      returnSign: "all",
      startDayUtc: null,
      endDayUtc: null,
      sort: "openedAt",
      direction: "desc",
      page: 1,
      pageSize: 25,
    },
    rows: [createSummary({ totalReturnUsd: 500, totalRewardsUsd: 10, realizedPnlUsd: 10, unrealizedPnlUsd: 10 })],
    hasAutomatedExposure: false,
  }), /RECONCILIATION_DRIFT/);
});

test("buildDepositDetailResponse derives chart series and coverage gaps", () => {
  const result = buildDepositDetailResponse({
    walletAddress: "0xabc",
    chainId: 8453,
    analysisStatus: "stale",
    deposit: createDetail(),
  });

  assert.equal(result.analysisStatus, "stale");
  assert.equal(result.valueChart.series.find((series) => series.key === "openedValue")?.points.length, 1);
  assert.equal(result.valueChart.series.find((series) => series.key === "rewards")?.points[0]?.usd, 10);
  assert.equal(result.valueChart.series.find((series) => series.key === "currentValue")?.points[0]?.usd, 1200);
  assert.equal(result.valueChart.gaps[0]?.reasonCode, "priceFallbackDca");
});

test("buildDepositDetailResponse rejects decomposition drift", () => {
  assert.throws(() => buildDepositDetailResponse({
    walletAddress: "0xabc",
    chainId: 8453,
    analysisStatus: "ready",
    deposit: createDetail({
      decomposition: {
        totalReturnUsd: 999,
        rewardsUsd: 1,
        feesUsd: 1,
        assetPriceEffectUsd: 1,
        rebalanceEffectUsd: 1,
        realizedPnlUsd: 1,
        unrealizedPnlUsd: 1,
        unattributedUsd: 1,
        unattributedReasonCodes: [],
        componentPercentages: {},
      },
    }),
  }), /RECONCILIATION_DRIFT/);
});