import assert from "node:assert/strict";
import test from "node:test";

import {
  aggregateHistoricalCapitalFromEngineV2Pools,
  applyRewardsFilters,
  calculateAvailableRewardFilters,
  mapRewardEventRow,
  normalizeEngineV2RewardRow,
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
  assert.equal(governance.owner.entityId, "cccccccc-cccc-4ccc-8ccc-cccccccccccc");
  assert.match(governance.owner.route ?? "", /^\/governance\?/);
  assert.equal(governance.poolContribution.countingRule, "governance_unassociated_no_pool");
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

test("aggregateHistoricalCapitalFromEngineV2Pools sums persisted pool history points by day", () => {
  const historicalCapital = aggregateHistoricalCapitalFromEngineV2Pools({
    rows: [
      {
        history: {
          points: [
            { dayUtc: "2026-05-01", totalValueUsd: 100 },
            { dayUtc: "2026-05-02", totalValueUsd: 80 },
          ],
        },
      },
      {
        history: {
          points: [
            { dayUtc: "2026-05-01", totalValueUsd: 40 },
            { dayUtc: "2026-05-03", totalValueUsd: 25.5 },
          ],
        },
      },
    ],
    range: {
      start: Date.parse("2026-05-01T00:00:00.000Z"),
      end: Date.parse("2026-05-02T23:59:59.999Z"),
    },
  });

  assert.deepEqual(historicalCapital, [
    { dayUtc: "2026-05-01", valueUsd: "140", coverageStatus: "time_weighted_estimated" },
    { dayUtc: "2026-05-02", valueUsd: "80", coverageStatus: "time_weighted_estimated" },
  ]);
});

test("normalizeEngineV2RewardRow formats raw token amounts with persisted token decimals", () => {
  const usdc = normalizeEngineV2RewardRow({
    rewardEventId: "usdc-fee",
    chainId: 8453,
    walletAddress,
    txHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    rewardType: "fee_claim",
    ownerStatus: "manual_deposit",
    linkedEntityId: depositId,
    poolId,
    poolLabel: "USDC / AERO Volatile",
    coverageStatus: "partial",
    confidence: "high",
    tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    tokenSymbol: "USDC",
    tokenDecimals: 6,
    amountRaw: "223",
    amountUsd: "0.0002229437793808",
    occurredAt: "2026-06-02T12:42:00.000Z",
  });
  const aero = normalizeEngineV2RewardRow({
    rewardEventId: "aero-reward",
    chainId: 8453,
    walletAddress,
    txHash: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    rewardType: "reward_claim",
    ownerStatus: "strategy",
    linkedEntityId: strategyExposureId,
    poolId,
    poolLabel: "WETH / cbBTC 100",
    coverageStatus: "full",
    confidence: "high",
    tokenAddress: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
    tokenSymbol: "AERO",
    tokenDecimals: 18,
    amountRaw: "14171535420739919393",
    amountUsd: "5.107447798397512173",
    occurredAt: "2026-06-02T12:43:00.000Z",
  });

  assert.equal(usdc.tokenAmount, "0.000223");
  assert.equal(aero.tokenAmount, "14.171535420739919393");
});
