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
