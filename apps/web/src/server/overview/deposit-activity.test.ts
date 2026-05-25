import assert from "node:assert/strict";
import test from "node:test";

import { resolveManualDepositMintTxHash } from "@/server/analysis/enginePersistence";
import {
  buildOverviewApprovalDetail,
  buildOverviewDepositMintDetail,
  buildOverviewRewardFallbackEvents,
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