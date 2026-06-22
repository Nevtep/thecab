import assert from "node:assert/strict";
import test from "node:test";

import { resolveManualDepositMintTxHash } from "@/server/analysis/enginePersistence";
import {
  buildOverviewAnalyzedActivityReadInput,
  buildOverviewApprovalDetail,
  buildOverviewChartEvents,
  buildOverviewEngineV2ChartEvents,
  buildOverviewDepositMintDetail,
  buildOverviewRewardPriceState,
  buildOverviewRewardFallbackEvents,
  resolveOverviewClaimRewardValueUsd,
} from "@/server/overview/getRecentOverview";

function ensureTestEnv() {
  process.env.MORALIS_API_KEY ??= "test-moralis-key";
  process.env.ALCHEMY_API_KEY ??= "test-alchemy-key";
  process.env.ALCHEMY_BASE_RPC_URL ??= "https://example.com";
  process.env.DATABASE_URL ??= "postgres://postgres:postgres@localhost:5432/thecab_test";
  process.env.TRIGGER_SECRET_KEY ??= "trigger_secret_test";
  process.env.ANALYSIS_HISTORY_DAYS ??= "365";
  process.env.ANALYSIS_SLICE_DAYS ??= "90";
  process.env.ANALYSIS_STATUS_STALE_DAYS ??= "7";
}

ensureTestEnv();

test("resolveManualDepositMintTxHash returns the mint tx for the matching token id", () => {
  const mintTxHash = resolveManualDepositMintTxHash({
    tokenId: "71272831",
    lifecycle: [
      {
        txHash: "0xcollect",
        tokenId: "71272831",
        action: "collect",
      },
      {
        txHash: "0xb921a2908fe01da4919dc40e0bde94065e93ee88505be328a95099f1fdb73dd2",
        tokenId: "71272831",
        action: "mint",
      },
      {
        txHash: "0xothermint",
        tokenId: "999",
        action: "mint",
      },
    ],
  });

  assert.equal(mintTxHash, "0xb921a2908fe01da4919dc40e0bde94065e93ee88505be328a95099f1fdb73dd2");
});

test("buildOverviewDepositMintDetail prefers pool plus token id for Aerodrome deposit mints", () => {
  const detail = buildOverviewDepositMintDetail({
    classification: "deposit",
    depositContext: {
      tokenId: "71272831",
      poolLabel: "WETH / USDC",
      protocol: "aerodrome",
      primaryTokenSymbol: "WETH",
      secondaryTokenSymbol: "USDC",
    },
  });

  assert.equal(detail, "WETH / USDC · #71272831");
});

test("buildOverviewDepositMintDetail ignores non-Aerodrome deposit contexts", () => {
  const detail = buildOverviewDepositMintDetail({
    classification: "deposit",
    depositContext: {
      tokenId: "71272831",
      poolLabel: "WETH / USDC",
      protocol: "mellow",
      primaryTokenSymbol: "WETH",
      secondaryTokenSymbol: "USDC",
    },
  });

  assert.equal(detail, null);
});

test("buildOverviewApprovalDetail renders explicit Aerodrome LP NFT gauge approvals", () => {
  const detail = buildOverviewApprovalDetail({
    classification: "approve",
    approvalContext: {
      tokenId: "71272831",
      spenderAddress: "0xf33a96b5932d9e9b9a0eda447abd8c9d48d2e0c8",
      spenderContractType: "gauge",
      protocol: "aerodrome",
      poolLabel: "WETH / USDC",
    },
  });

  assert.equal(detail, "Approved LP NFT #71272831 for WETH / USDC gauge");
});

test("buildOverviewRewardFallbackEvents emits claim markers for persisted rewards without analyzed activity rows", () => {
  const events = buildOverviewRewardFallbackEvents({
    range: "30d",
    rewardRows: [
      {
        txHash: "0xrewardtx",
        occurredAt: new Date("2026-04-27T15:45:49.000Z"),
        amountUsd: "4807.318526677795",
      },
    ],
    existingTxHashes: [],
  });

  assert.equal(events.length, 1);
  assert.deepEqual(events[0], {
    id: "reward-0xrewardtx",
    type: "claim",
    occurredAt: "2026-04-27T15:45:49.000Z",
    capturedAt: "2026-04-27T00:00:00.000Z",
    detail: null,
    txHash: "0xrewardtx",
    rewardValueUsd: 4807.318526677795,
  });
});

test("buildOverviewAnalyzedActivityReadInput keeps activity lists limited but charts range-bounded", () => {
  const startAt = new Date("2026-05-01T00:00:00.000Z");
  const endAt = new Date("2026-05-30T23:59:59.000Z");

  assert.deepEqual(
    buildOverviewAnalyzedActivityReadInput({
      surface: "activity",
      walletAddress: "0xabc",
      chainId: 8453,
      range: "30d",
    }),
    {
      walletAddress: "0xabc",
      chainId: 8453,
      limit: 48,
    },
  );

  for (const range of ["30d", "90d", "full_history"] as const) {
    assert.deepEqual(
      buildOverviewAnalyzedActivityReadInput({
        surface: "chart",
        walletAddress: "0xabc",
        chainId: 8453,
        range,
        startAt,
        endAt,
      }),
      {
        walletAddress: "0xabc",
        chainId: 8453,
        startAt,
        endAt,
      },
    );
  }
});

test("resolveOverviewClaimRewardValueUsd backfills claim USD from historical prices when movement USD is null", () => {
  const rewardPriceState = buildOverviewRewardPriceState({
    granularity: "day",
    tokenAddresses: ["0x940181a94a35a4569e4529a3cdfb74e38fd98631"],
    currentPriceLookup: new Map(),
    priceRows: [
      {
        tokenAddress: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
        pricedAt: new Date("2026-04-27T00:00:00.000Z"),
        priceUsd: "2.5",
      },
    ],
  });

  const rewardValueUsd = resolveOverviewClaimRewardValueUsd({
    chainId: 8453,
    occurredAt: new Date("2026-04-27T15:45:49.000Z"),
    granularity: "day",
    movements: [
      {
        tokenAddress: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
        amountRaw: "2000000000000000000",
        directionIn: true,
        amountUsd: null,
        metadataJson: {
          symbol: "AERO",
          decimals: 18,
        },
      },
    ],
    priceState: rewardPriceState,
  });

  assert.equal(rewardValueUsd, 5);
});

test("buildOverviewChartEvents keeps governance reward-like activity out of overview rewards", () => {
  const events = buildOverviewChartEvents({
    chainId: 8453,
    range: "30d",
    rows: [
      {
        id: "ledger-gov",
        txHash: "0xgov",
        eventType: "claim",
        occurredAt: new Date("2026-05-28T15:45:49.000Z"),
        classification: "governance",
        confidence: "high",
        metadataJson: {
          summary: "Vote on Aerodrome voting escrow",
        },
        movements: [
          {
            ledgerEventId: "ledger-gov",
            tokenAddress: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
            amountRaw: "1000000000000000000",
            directionIn: true,
            amountUsd: null,
            metadataJson: {
              symbol: "AERO",
              decimals: 18,
            },
          },
        ],
        depositContext: null,
        approvalContext: null,
        rebalanceMembership: null,
      },
    ],
    rewardValueByTxHash: new Map([["0xgov", 123]]),
    rewardPriceState: buildOverviewRewardPriceState({
      granularity: "day",
      tokenAddresses: ["0x940181a94a35a4569e4529a3cdfb74e38fd98631"],
      currentPriceLookup: new Map(),
      priceRows: [
        {
          tokenAddress: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
          pricedAt: new Date("2026-05-28T00:00:00.000Z"),
          priceUsd: "3",
        },
      ],
    }),
    rewardRows: [
      {
        txHash: "0xgov",
        occurredAt: new Date("2026-05-28T15:45:49.000Z"),
        amountUsd: "123",
      },
    ],
  });

  assert.equal(events.length, 1);
  assert.equal(events[0]?.type, "vote");
  assert.equal(events[0]?.rewardValueUsd, null);
});

test("buildOverviewEngineV2ChartEvents restores persisted rebalance and swap markers", () => {
  const events = buildOverviewEngineV2ChartEvents({
    range: "30d",
    startAt: new Date("2026-06-01T00:00:00.000Z"),
    endAt: new Date("2026-06-03T00:00:00.000Z"),
    rows: [
      {
        activityId: "rebalance-1",
        action: "rebalance_same_pool",
        summary: "rebalance_same_pool",
        occurredAt: "2026-06-02T15:37:31.000Z",
        txHash: "0xrebalance",
        selectedDetail: { actionSummary: "rebalance_same_pool" },
      },
      {
        activityId: "swap-1",
        action: "swap",
        summary: "swap",
        occurredAt: "2026-06-02T15:35:37.000Z",
        txHash: "0xswap",
      },
      {
        activityId: "approval-1",
        action: "approval_router",
        summary: "approval_router",
        occurredAt: "2026-06-02T15:30:00.000Z",
        txHash: "0xapproval",
      },
    ],
  });

  assert.deepEqual(events.map((event) => event.type), ["swap", "rebalance"]);
  assert.equal(events[0]?.capturedAt, "2026-06-02T00:00:00.000Z");
});
