import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeGovernanceAddress,
  normalizeGovernanceConfidence,
  normalizeGovernanceCoverage,
  normalizeGovernanceDatePreset,
  normalizeGovernanceEventType,
  normalizeGovernancePageSize,
  normalizeGovernanceProtocolSurface,
  normalizeGovernanceRewardType,
  normalizeGovernanceSelectionKind,
  normalizeGovernanceUuid,
} from "@/features/governance/governance.validation";

test("governance validation normalizes filter inputs conservatively", () => {
  assert.equal(normalizeGovernanceDatePreset("90d"), "90d");
  assert.equal(normalizeGovernanceDatePreset("bad"), "all");
  assert.equal(normalizeGovernanceEventType("vote_cast"), "vote_cast");
  assert.equal(normalizeGovernanceEventType("swap"), "all");
  assert.equal(normalizeGovernanceRewardType("bribe"), "bribe");
  assert.equal(normalizeGovernanceRewardType("claim"), "all");
  assert.equal(normalizeGovernanceProtocolSurface("voting_escrow"), "voting_escrow");
  assert.equal(normalizeGovernanceProtocolSurface("router"), "all");
  assert.equal(normalizeGovernanceCoverage("partial"), "partial");
  assert.equal(normalizeGovernanceCoverage("bad"), null);
  assert.equal(normalizeGovernanceConfidence("low"), "low");
  assert.equal(normalizeGovernanceConfidence("bad"), null);
  assert.equal(normalizeGovernanceSelectionKind("lock"), "lock");
  assert.equal(normalizeGovernanceSelectionKind("reward"), "reward");
  assert.equal(normalizeGovernanceSelectionKind("tx"), null);
  assert.equal(normalizeGovernancePageSize("50"), 50);
  assert.equal(normalizeGovernancePageSize("100"), 10);
  assert.equal(normalizeGovernanceUuid("123e4567-e89b-12d3-a456-426614174000"), "123e4567-e89b-12d3-a456-426614174000");
  assert.equal(normalizeGovernanceUuid("bad"), null);
  assert.equal(normalizeGovernanceAddress("0x940181a94a35a4569e4529a3cdfb74e38fd98631"), "0x940181a94a35a4569e4529a3cdfb74e38fd98631");
  assert.equal(normalizeGovernanceAddress("bad"), null);
});
