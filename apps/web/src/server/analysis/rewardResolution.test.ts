import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveRewardOwnership,
  type RewardCandidateInput,
  type RewardDepositTarget,
  type RewardStrategyTarget,
} from "@/server/analysis/rewardResolution";

function buildCandidate(overrides: Partial<RewardCandidateInput> = {}): RewardCandidateInput {
  return {
    txHash: "0xreward",
    occurredAt: new Date("2026-05-24T12:00:00.000Z"),
    category: "reward",
    summary: "Claimed rewards",
    protocol: "aerodrome",
    targetType: "deposit",
    targetTokenId: null,
    targetWrapperAddress: null,
    targetStakingRewardsAddress: null,
    sameTxTokenId: null,
    ...overrides,
  };
}

function buildDepositTarget(overrides: Partial<RewardDepositTarget> = {}): RewardDepositTarget {
  return {
    depositId: "deposit-1",
    poolId: "pool-1",
    tokenId: "123",
    protocol: "aerodrome",
    ...overrides,
  };
}

function buildStrategyTarget(overrides: Partial<RewardStrategyTarget> = {}): RewardStrategyTarget {
  return {
    strategyId: "strategy-1",
    strategyExposureId: "exposure-1",
    primaryPoolId: "pool-1",
    wrapperAddress: "0xwrapper",
    stakingRewardsAddress: "0xstaking",
    protocol: "mellow",
    externalStrategyPositionReference: null,
    ...overrides,
  };
}

test("resolveRewardOwnership resolves manual rewards from explicit token id", () => {
  const result = resolveRewardOwnership({
    candidate: buildCandidate({ targetTokenId: "123" }),
    depositTargets: [buildDepositTarget()],
    strategyTargets: [],
  });

  assert.equal(result.resolutionStatus, "resolved");
  assert.equal(result.ownerType, "deposit");
  assert.equal(result.depositId, "deposit-1");
  assert.equal(result.resolvedPoolId, "pool-1");
  assert.equal(result.resolutionBasis, "explicit_token_id");
  assert.deepEqual(result.resolutionReasonCodes, []);
});

test("resolveRewardOwnership resolves manual rewards from same-transaction token proof", () => {
  const result = resolveRewardOwnership({
    candidate: buildCandidate({ sameTxTokenId: "123" }),
    depositTargets: [buildDepositTarget()],
    strategyTargets: [],
  });

  assert.equal(result.resolutionStatus, "resolved");
  assert.equal(result.ownerType, "deposit");
  assert.equal(result.depositId, "deposit-1");
  assert.equal(result.resolutionBasis, "same_tx_token_context");
});

test("resolveRewardOwnership resolves strategy rewards through strategy exposure and keeps additive position reference", () => {
  const result = resolveRewardOwnership({
    candidate: buildCandidate({
      protocol: "mellow",
      targetType: "strategy",
      targetWrapperAddress: "0xwrapper",
    }),
    depositTargets: [],
    strategyTargets: [buildStrategyTarget({ externalStrategyPositionReference: "71496797" })],
  });

  assert.equal(result.resolutionStatus, "resolved");
  assert.equal(result.ownerType, "strategy");
  assert.equal(result.strategyId, "strategy-1");
  assert.equal(result.strategyExposureId, "exposure-1");
  assert.equal(result.resolvedPoolId, "pool-1");
  assert.equal(result.resolutionBasis, "strategy_wrapper_pair");
  assert.equal(result.externalStrategyPositionReference, "71496797");
  assert.equal(result.externalStrategyPositionReferenceStatus, "resolved");
});

test("resolveRewardOwnership keeps strategy ownership resolved when external position reference is absent", () => {
  const result = resolveRewardOwnership({
    candidate: buildCandidate({
      protocol: "mellow",
      targetType: "strategy",
      targetWrapperAddress: "0xwrapper",
    }),
    depositTargets: [],
    strategyTargets: [buildStrategyTarget()],
  });

  assert.equal(result.resolutionStatus, "resolved");
  assert.equal(result.ownerType, "strategy");
  assert.equal(result.externalStrategyPositionReference, null);
  assert.equal(result.externalStrategyPositionReferenceStatus, "unresolved");
});

test("resolveRewardOwnership resolves strategy rewards from staking rewards pairing", () => {
  const result = resolveRewardOwnership({
    candidate: buildCandidate({
      protocol: "mellow",
      targetType: "strategy",
      targetStakingRewardsAddress: "0xstaking",
    }),
    depositTargets: [],
    strategyTargets: [buildStrategyTarget()],
  });

  assert.equal(result.resolutionStatus, "resolved");
  assert.equal(result.ownerType, "strategy");
  assert.equal(result.resolutionBasis, "staking_rewards_pair");
});

test("resolveRewardOwnership leaves manual rewards unresolved when token identity is absent", () => {
  const result = resolveRewardOwnership({
    candidate: buildCandidate(),
    depositTargets: [buildDepositTarget()],
    strategyTargets: [],
  });

  assert.equal(result.resolutionStatus, "unresolved");
  assert.equal(result.ownerType, "deposit");
  assert.equal(result.depositId, null);
  assert.equal(result.resolutionBasis, "unresolved");
  assert.deepEqual(result.resolutionReasonCodes, ["missingTokenId"]);
});

test("resolveRewardOwnership leaves strategy rewards unresolved when exposure is not proven", () => {
  const result = resolveRewardOwnership({
    candidate: buildCandidate({
      protocol: "mellow",
      targetType: "strategy",
      targetWrapperAddress: "0xmissing",
    }),
    depositTargets: [],
    strategyTargets: [buildStrategyTarget()],
  });

  assert.equal(result.resolutionStatus, "unresolved");
  assert.equal(result.ownerType, "strategy");
  assert.deepEqual(result.resolutionReasonCodes, ["missingStrategyExposure"]);
});

test("resolveRewardOwnership does not fall back to manual deposit ownership for strategy-shaped rewards in the same pool", () => {
  const result = resolveRewardOwnership({
    candidate: buildCandidate({
      protocol: "mellow",
      targetType: "strategy",
      targetPoolId: "pool-1",
      targetWrapperAddress: null,
      targetStakingRewardsAddress: null,
    }),
    depositTargets: [buildDepositTarget({ poolId: "pool-1" })],
    strategyTargets: [buildStrategyTarget({ primaryPoolId: "pool-1", wrapperAddress: "0xother" })],
  });

  assert.equal(result.resolutionStatus, "unresolved");
  assert.equal(result.ownerType, "strategy");
  assert.equal(result.depositId, null);
  assert.equal(result.strategyExposureId, null);
  assert.deepEqual(result.resolutionReasonCodes, ["providerDecodedOnly"]);
});

test("resolveRewardOwnership rejects manual-strategy conflicts instead of guessing", () => {
  const result = resolveRewardOwnership({
    candidate: buildCandidate({
      targetType: "deposit",
      targetTokenId: "123",
      targetWrapperAddress: "0xwrapper",
    }),
    depositTargets: [buildDepositTarget()],
    strategyTargets: [buildStrategyTarget()],
  });

  assert.equal(result.resolutionStatus, "unresolved");
  assert.equal(result.depositId, null);
  assert.equal(result.strategyId, null);
  assert.deepEqual(result.resolutionReasonCodes, ["manualStrategyConflict"]);
});

test("resolveRewardOwnership attributes pool fee claims by wallet-pool holder", () => {
  const result = resolveRewardOwnership({
    candidate: buildCandidate({
      economicComponentKind: "fee_claim",
      surfaceKind: "pool_fee_claim",
      targetPoolId: "pool-1",
      targetType: "deposit",
    }),
    depositTargets: [buildDepositTarget()],
    strategyTargets: [],
  });

  assert.equal(result.resolutionStatus, "resolved");
  assert.equal(result.ownerType, "deposit");
  assert.equal(result.depositId, "deposit-1");
  assert.equal(result.resolvedPoolId, "pool-1");
  assert.equal(result.resolutionBasis, "wallet_pool_single_holder");
  assert.equal(result.feeAttributionBasis, "wallet_pool_single_holder");
});

test("resolveRewardOwnership leaves pool fee claims unresolved without a pool holder", () => {
  const result = resolveRewardOwnership({
    candidate: buildCandidate({
      economicComponentKind: "fee_claim",
      surfaceKind: "pool_fee_claim",
      targetPoolId: "pool-1",
      targetType: "deposit",
    }),
    depositTargets: [],
    strategyTargets: [],
  });

  assert.equal(result.resolutionStatus, "unresolved");
  assert.equal(result.resolvedPoolId, "pool-1");
  assert.deepEqual(result.resolutionReasonCodes, ["feeClaimNoActivePosition"]);
});
