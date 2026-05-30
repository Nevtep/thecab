import assert from "node:assert/strict";
import test from "node:test";

import {
  applyRewardsFilters,
  calculateAvailableRewardFilters,
  mapRewardEventRow,
  type RewardEventDbRow,
} from "@/server/rewards/rewards.repository";
import type { RewardsRequest } from "@/server/rewards/rewards.types";

const walletAddress = "0x1111111111111111111111111111111111111111";
const depositId = "11111111-1111-4111-8111-111111111111";
const strategyExposureId = "22222222-2222-4222-8222-222222222222";
const poolId = "33333333-3333-4333-8333-333333333333";

function request(overrides: Partial<RewardsRequest> = {}): RewardsRequest {
  return {
    walletAddress,
    chainId: 8453,
    search: "",
    datePreset: "all",
    dateStart: null,
    dateEnd: null,
    source: "all",
    tokenAddress: null,
    poolId: null,
    depositId: null,
    strategyExposureId: null,
    rewardType: null,
    coverage: null,
    resolutionStatus: null,
    selectedRewardEventId: null,
    sort: { key: "occurredAt", direction: "desc" },
    page: 1,
    pageSize: 25,
    ...overrides,
  };
}

function row(overrides: Partial<RewardEventDbRow> = {}): RewardEventDbRow {
  return {
    rewardEventId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    chainId: 8453,
    walletAddress,
    txHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    logIndex: 0,
    rewardType: "reward_claim",
    depositOrStrategyId: depositId,
    strategyExposureId: null,
    resolvedPoolId: poolId,
    poolLabel: "WETH / USDC-100",
    resolutionBasis: "explicit_token_id",
    resolutionReasonCodes: [],
    tokenAddress: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
    amountRaw: "1250000000000000000000",
    amountUsd: "1245.18",
    occurredAt: "2026-05-16T14:32:18.000Z",
    resolutionStatus: "resolved",
    metadataJson: {
      tokenSymbol: "AERO",
      amountFormatted: "1250.0000",
      sourceSurface: "manual_deposit_gauge_claim",
    },
    ...overrides,
  };
}

test("mapRewardEventRow preserves manual, strategy, governance, unresolved, and excluded ownership evidence", () => {
  const manual = mapRewardEventRow(row());
  const strategy = mapRewardEventRow(row({
    rewardEventId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    depositOrStrategyId: "44444444-4444-4444-8444-444444444444",
    strategyExposureId,
    metadataJson: { tokenSymbol: "WETH", sourceSurface: "strategy_wrapper_reward_claim" },
  }));
  const governance = mapRewardEventRow(row({
    rewardEventId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    depositOrStrategyId: null,
    resolvedPoolId: null,
    rewardType: "governance_reward",
    resolutionBasis: "governance_claim",
    resolutionReasonCodes: ["governanceReward"],
    metadataJson: { tokenSymbol: "AERO", sourceSurface: "governance_voter_claim" },
  }));
  const unresolved = mapRewardEventRow(row({
    rewardEventId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    depositOrStrategyId: null,
    resolvedPoolId: null,
    amountUsd: null,
    resolutionStatus: "unresolved",
    resolutionReasonCodes: ["missingOwnerEvidence"],
    metadataJson: { tokenSymbol: "AERO", sourceSurface: "gauge_reward_unknown_surface" },
  }));
  const excluded = mapRewardEventRow(row({
    rewardEventId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    depositOrStrategyId: null,
    resolvedPoolId: null,
    resolutionStatus: "excluded",
    resolutionReasonCodes: ["excludedAirdrop"],
    metadataJson: { tokenSymbol: "AERO", sourceSurface: "airdrop_spam" },
  }));

  assert.equal(manual.owner.status, "manual_deposit");
  assert.equal(manual.poolContribution.status, "contributes");
  assert.equal(strategy.owner.status, "strategy");
  assert.equal(strategy.owner.entityId, strategyExposureId);
  assert.equal(governance.owner.status, "governance");
  assert.equal(unresolved.coverageState, "unresolved");
  assert.equal(unresolved.poolContribution.status, "unresolved");
  assert.equal(excluded.owner.status, "excluded");
  assert.equal(excluded.confidence, "none");
});

test("applyRewardsFilters composes owner, pool, token, coverage, search, sort, and pagination-safe row sets", () => {
  const rows = [
    mapRewardEventRow(row()),
    mapRewardEventRow(row({
      rewardEventId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      txHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      strategyExposureId,
      amountUsd: "300.00",
      occurredAt: "2026-05-15T14:32:18.000Z",
      metadataJson: { tokenSymbol: "WETH", sourceSurface: "strategy_wrapper_reward_claim" },
    })),
    mapRewardEventRow(row({
      rewardEventId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      txHash: "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      depositOrStrategyId: null,
      resolvedPoolId: null,
      amountUsd: null,
      occurredAt: "2026-05-14T14:32:18.000Z",
      resolutionStatus: "unresolved",
      resolutionReasonCodes: ["unknownRewardSurface"],
      metadataJson: { tokenSymbol: "AERO", sourceSurface: "gauge_reward_unknown_surface" },
    })),
  ];

  const strategyRows = applyRewardsFilters(rows, request({ source: "strategies", poolId }));
  const unresolvedRows = applyRewardsFilters(rows, request({ resolutionStatus: "unresolved" }));
  const searchedRows = applyRewardsFilters(rows, request({ search: "strategy_wrapper", sort: { key: "valueUsd", direction: "asc" } }));

  assert.deepEqual(strategyRows.map((item) => item.rewardEventId), ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"]);
  assert.deepEqual(unresolvedRows.map((item) => item.rewardEventId), ["dddddddd-dddd-4ddd-8ddd-dddddddddddd"]);
  assert.deepEqual(searchedRows.map((item) => item.rewardEventId), ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"]);
});

test("calculateAvailableRewardFilters derives option lists from persisted reward rows", () => {
  const filters = calculateAvailableRewardFilters([
    mapRewardEventRow(row()),
    mapRewardEventRow(row({
      rewardEventId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      rewardType: "fee_claim",
      tokenAddress: "0x4200000000000000000000000000000000000006",
      metadataJson: { tokenSymbol: "WETH", sourceSurface: "pool_fee_claim" },
    })),
  ]);

  assert.deepEqual(filters.rewardTypes, ["fee_claim", "reward_claim"]);
  assert.equal(filters.pools[0]?.poolId, poolId);
  assert.deepEqual(filters.tokens.map((item) => item.symbol).sort(), ["AERO", "WETH"]);
});
