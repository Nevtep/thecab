import assert from "node:assert/strict";
import test from "node:test";

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

test("isGovernanceRewardCandidate detects Aerodrome Voting Escrow relock claims for governance persistence", async () => {
  const { isGovernanceRewardCandidate } = await import("@/server/trigger/tasks/phase-rewards.task");

  assert.equal(isGovernanceRewardCandidate({
    classification: "governance",
    category: "contract interaction",
    methodLabel: "claim",
    summary: "Aerodrome: Voting Escrow claim and relock",
  }), true);
});

test("isGovernanceRewardCandidate keeps standard reward claims in reward processing", async () => {
  const { isGovernanceRewardCandidate } = await import("@/server/trigger/tasks/phase-rewards.task");

  assert.equal(isGovernanceRewardCandidate({
    classification: "claim",
    category: "token receive",
    methodLabel: "getReward",
    summary: "Received AERO from Aerodrome Finance: CLGauge",
  }), false);
});

test("isExcludedAirdropRewardLedgerRow marks known phishing airdrop txs as excluded reward activity", async () => {
  const { isExcludedAirdropRewardLedgerRow } = await import("@/server/trigger/tasks/phase-rewards.task");
  const phishingTxHash = "0xca23a1618b416be4f082ae26e59dd9bfcea5e028f00a2cd9f1b8dd95fbff77ea";

  assert.equal(phishingTxHash.startsWith("0xca23a161"), true);
  assert.equal(isExcludedAirdropRewardLedgerRow({
    classification: "airdrop",
    metadataJson: {
      economicExclusionReason: "airdrop_spam",
    },
  }), true);
  assert.equal(isExcludedAirdropRewardLedgerRow({
    classification: "claim",
    metadataJson: {},
  }), false);
});

test("resolveRewardClaimTarget leaves Aerodrome claims unresolved when token identity is absent", async () => {
  const { resolveRewardClaimTarget } = await import("@/server/trigger/tasks/phase-rewards.task");

  const result = resolveRewardClaimTarget({
    candidate: {
      txHash: "0xreward",
      occurredAt: new Date("2026-05-24T12:00:00.000Z"),
      category: "reward",
      summary: "Claimed gauge rewards",
      protocol: "aerodrome",
      targetType: "deposit",
      targetTokenId: null,
      targetStakingRewardsAddress: null,
      sameTxTokenId: null,
      shareLifecycleWrapperAddress: null,
      targetWrapperAddress: null,
    },
    depositTargets: [{ depositId: "deposit-1", poolId: "pool-1", tokenId: "123", protocol: "aerodrome" }],
    strategyTargets: [],
  });

  assert.equal(result.depositOrStrategyId, null);
  assert.equal(result.resolutionStatus, "unresolved");
  assert.equal(result.targetType, "deposit");
  assert.deepEqual(result.resolutionReasonCodes, ["missingTokenId"]);
});

test("resolveRewardClaimTarget resolves Mellow claims only from explicit wrapper identity", async () => {
  const { resolveRewardClaimTarget } = await import("@/server/trigger/tasks/phase-rewards.task");

  const result = resolveRewardClaimTarget({
    candidate: {
      txHash: "0xreward",
      occurredAt: new Date("2026-05-24T12:00:00.000Z"),
      category: "reward",
      summary: "Claimed strategy rewards",
      protocol: "mellow",
      targetType: "strategy",
      targetTokenId: null,
      targetStakingRewardsAddress: null,
      sameTxTokenId: null,
      shareLifecycleWrapperAddress: null,
      targetWrapperAddress: "0xwrapper",
    },
    depositTargets: [],
    strategyTargets: [{
      strategyId: "strategy-1",
      strategyExposureId: "exposure-1",
      primaryPoolId: "pool-1",
      wrapperAddress: "0xwrapper",
      stakingRewardsAddress: null,
      protocol: "mellow",
      externalStrategyPositionReference: null,
    }],
  });

  assert.equal(result.depositOrStrategyId, "strategy-1");
  assert.equal(result.targetType, "strategy");
  assert.equal(result.strategyExposureId, "exposure-1");
  assert.equal(result.resolvedPoolId, "pool-1");
  assert.equal(result.resolutionBasis, "strategy_wrapper_pair");
  assert.equal(result.resolutionStatus, "resolved");
});

test("resolveRewardClaimTarget carries excluded airdrop status into persistence input", async () => {
  const { resolveRewardClaimTarget } = await import("@/server/trigger/tasks/phase-rewards.task");

  const result = resolveRewardClaimTarget({
    candidate: {
      txHash: "0xairdrop",
      occurredAt: new Date("2026-05-24T12:00:00.000Z"),
      category: "airdrop",
      summary: "Suspicious airdrop",
      protocol: "unknown",
      targetType: null,
      targetTokenId: null,
      targetStakingRewardsAddress: null,
      sameTxTokenId: null,
      shareLifecycleWrapperAddress: null,
      targetWrapperAddress: null,
      surfaceKind: "airdrop_spam",
      economicComponentKind: "excluded_airdrop",
    },
    depositTargets: [],
    strategyTargets: [],
  });

  assert.equal(result.resolutionStatus, "excluded");
  assert.equal(result.depositOrStrategyId, null);
  assert.deepEqual(result.resolutionReasonCodes, ["excludedAirdrop"]);
});
