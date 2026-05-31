import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGovernanceApiQueryString,
  normalizeGovernanceFiltersForQueryKey,
  parseGovernanceUrlState,
  resetGovernanceFilter,
  serializeGovernanceUrlState,
} from "@/features/governance/governance.urlState";

const selectedGovernanceId = "123e4567-e89b-12d3-a456-426614174000";
const poolId = "33333333-3333-4333-8333-333333333333";

test("parse and serialize governance URL state round-trips filters and selected row", () => {
  const state = parseGovernanceUrlState(new URLSearchParams(
    `search=bribe&range=90d&eventType=bribe_claim&rewardType=bribe&protocolSurface=briber&coverage=partial&confidence=low&poolId=${poolId}&kind=reward&selected=${selectedGovernanceId}&sort=valueUsdAtClaim&direction=asc&page=3&pageSize=50`,
  ));

  assert.equal(state.search, "bribe");
  assert.equal(state.datePreset, "90d");
  assert.equal(state.eventType, "bribe_claim");
  assert.equal(state.rewardType, "bribe");
  assert.equal(state.protocolSurface, "briber");
  assert.equal(state.coverage, "partial");
  assert.equal(state.confidence, "low");
  assert.equal(state.poolId, poolId);
  assert.equal(state.selectedKind, "reward");
  assert.equal(state.selectedGovernanceId, selectedGovernanceId);
  assert.equal(state.sort.key, "valueUsdAtClaim");
  assert.equal(state.sort.direction, "asc");
  assert.equal(state.page, 3);
  assert.equal(state.pageSize, 50);

  assert.equal(
    serializeGovernanceUrlState(state),
    `search=bribe&range=90d&eventType=bribe_claim&rewardType=bribe&protocolSurface=briber&poolId=${poolId}&coverage=partial&confidence=low&kind=reward&selected=${selectedGovernanceId}&sort=valueUsdAtClaim&direction=asc&page=3&pageSize=50`,
  );
});

test("buildGovernanceApiQueryString carries chain and filter identity", () => {
  const state = parseGovernanceUrlState(new URLSearchParams(`eventType=vote_cast&kind=event&selected=${selectedGovernanceId}`));
  assert.equal(
    buildGovernanceApiQueryString({ chainId: 8453, state }),
    `chainId=8453&eventType=vote_cast&kind=event&selected=${selectedGovernanceId}`,
  );
  assert.equal(normalizeGovernanceFiltersForQueryKey(state).eventType, "vote_cast");
});

test("resetGovernanceFilter clears one filter while preserving selected row", () => {
  const state = parseGovernanceUrlState(new URLSearchParams(`search=relay&coverage=partial&poolId=${poolId}&kind=event&selected=${selectedGovernanceId}&page=4`));
  const next = resetGovernanceFilter(state, "coverage");
  assert.equal(next.coverage, null);
  assert.equal(next.poolId, poolId);
  assert.equal(next.search, "relay");
  assert.equal(next.selectedKind, "event");
  assert.equal(next.selectedGovernanceId, selectedGovernanceId);
  assert.equal(next.page, 1);
});
