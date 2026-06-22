import assert from "node:assert/strict";
import test from "node:test";

import {
  buildActivityApiQueryString,
  normalizeActivityFiltersForQueryKey,
  parseActivityUrlState,
  resetActivityFilter,
  serializeActivityUrlState,
} from "@/features/activity/activity.urlState";

const selectedActivityId = "123e4567-e89b-12d3-a456-426614174000";
const poolId = "33333333-3333-4333-8333-333333333333";

test("parse and serialize activity URL state round-trips filters and selected row", () => {
  const state = parseActivityUrlState(new URLSearchParams(
    `search=claim&surface=rewards&action=claim&coverage=partial&confidence=low&poolId=${poolId}&selected=${selectedActivityId}&sort=valueUsd&direction=asc&page=3&pageSize=50`,
  ));

  assert.equal(state.search, "claim");
  assert.equal(state.surface, "rewards");
  assert.equal(state.action, "claim");
  assert.equal(state.coverage, "partial");
  assert.equal(state.confidence, "low");
  assert.equal(state.poolId, poolId);
  assert.equal(state.selectedActivityId, selectedActivityId);
  assert.equal(state.sort.key, "valueUsd");
  assert.equal(state.sort.direction, "asc");
  assert.equal(state.page, 3);
  assert.equal(state.pageSize, 50);

  assert.equal(
    serializeActivityUrlState(state),
    `search=claim&surface=rewards&action=claim&coverage=partial&confidence=low&poolId=${poolId}&selected=${selectedActivityId}&sort=valueUsd&direction=asc&page=3&pageSize=50`,
  );
});

test("buildActivityApiQueryString carries chain and filter identity", () => {
  const state = parseActivityUrlState(new URLSearchParams(`surface=strategies&selected=${selectedActivityId}`));
  assert.equal(
    buildActivityApiQueryString({ chainId: 8453, state }),
    `chainId=8453&surface=strategies&selected=${selectedActivityId}`,
  );
  assert.equal(normalizeActivityFiltersForQueryKey(state).surface, "strategies");
});

test("resetActivityFilter clears one filter and selected row context", () => {
  const state = parseActivityUrlState(new URLSearchParams(`search=spam&coverage=excluded&poolId=${poolId}&selected=${selectedActivityId}&page=4`));
  const next = resetActivityFilter(state, "coverage");
  assert.equal(next.coverage, null);
  assert.equal(next.poolId, poolId);
  assert.equal(next.search, "spam");
  assert.equal(next.selectedActivityId, null);
  assert.equal(next.page, 1);
});
