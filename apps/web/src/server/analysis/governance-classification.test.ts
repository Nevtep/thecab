import assert from "node:assert/strict";
import test from "node:test";

import { classifyGovernanceSurface } from "@/server/analysis/governance-classification";

test("classifies explicit governance surfaces with high confidence", () => {
  const voterClaim = classifyGovernanceSurface({
    txHash: "0x1",
    surfaceKind: "governance_voter_claim",
  });
  assert.equal(voterClaim.isGovernance, true);
  assert.equal(voterClaim.eventType, "governance_reward");
  assert.equal(voterClaim.protocolSurface, "reward_distributor");
  assert.equal(voterClaim.coverageState, "full");
  assert.equal(voterClaim.confidence, "high");

  const vote = classifyGovernanceSurface({
    txHash: "0x2",
    surfaceKind: "governance_vote",
  });
  assert.equal(vote.eventType, "vote_cast");
  assert.equal(vote.protocolSurface, "voter");
});

test("classifies text evidence conservatively as partial governance", () => {
  const lock = classifyGovernanceSurface({
    txHash: "0x3",
    summary: "Increase voting escrow lock for veAERO",
  });
  assert.equal(lock.isGovernance, true);
  assert.equal(lock.eventType, "lock_increased");
  assert.equal(lock.protocolSurface, "voting_escrow");
  assert.equal(lock.coverageState, "partial");
  assert.equal(lock.confidence, "medium");

  const bribe = classifyGovernanceSurface({
    txHash: "0x4",
    summary: "Claim bribe from Aerodrome Briber",
  });
  assert.equal(bribe.eventType, "bribe_claim");
  assert.equal(bribe.protocolSurface, "briber");
});

test("does not promote router-only, generic transfer, or airdrop spam to governance", () => {
  assert.equal(classifyGovernanceSurface({
    txHash: "0x5",
    protocol: "1inch",
    summary: "Router swap WETH for cbBTC",
  }).isGovernance, false);
  assert.equal(classifyGovernanceSurface({
    txHash: "0x6",
    category: "token receive",
    summary: "Received AERO",
  }).isGovernance, false);
  assert.equal(classifyGovernanceSurface({
    txHash: "0x7",
    category: "airdrop",
    summary: "Airdrop phishing token",
  }).isGovernance, false);
});
