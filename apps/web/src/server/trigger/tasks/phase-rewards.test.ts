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

test("isGovernanceRewardCandidate excludes Aerodrome Voting Escrow relock claims from reward processing", async () => {
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
      targetWrapperAddress: null,
    },
    depositTargets: [{ id: "deposit-1", tokenId: "123", protocol: "aerodrome" }],
    strategyTargets: [],
  });

  assert.equal(result.depositOrStrategyId, null);
  assert.equal(result.targetType, "deposit");
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
      targetWrapperAddress: "0xwrapper",
    },
    depositTargets: [],
    strategyTargets: [{ id: "strategy-1", wrapperAddress: "0xwrapper", protocol: "mellow" }],
  });

  assert.equal(result.depositOrStrategyId, "strategy-1");
  assert.equal(result.targetType, "strategy");
});
