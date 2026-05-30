import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRewardsApiQueryString,
  normalizeRewardsFiltersForQueryKey,
  parseRewardsUrlState,
  serializeRewardsUrlState,
} from "@/features/rewards/rewards.urlState";

const poolId = "123e4567-e89b-12d3-a456-426614174000";
const depositId = "123e4567-e89b-12d3-a456-426614174111";
const selectedRewardEventId = "123e4567-e89b-12d3-a456-426614174222";

test("parse and serialize rewards URL state round-trips core filters and selection", () => {
  const state = parseRewardsUrlState(new URLSearchParams(
    `search=aero&datePreset=90d&source=deposits&pool=${poolId}&deposit=${depositId}&coverage=partial&resolutionStatus=resolved&selected=${selectedRewardEventId}&sort=valueUsd&direction=asc&page=2&pageSize=50`,
  ));

  assert.equal(state.search, "aero");
  assert.equal(state.datePreset, "90d");
  assert.equal(state.source, "deposits");
  assert.equal(state.poolId, poolId);
  assert.equal(state.depositId, depositId);
  assert.equal(state.coverage, "partial");
  assert.equal(state.resolutionStatus, "resolved");
  assert.equal(state.selectedRewardEventId, selectedRewardEventId);
  assert.equal(state.sort.key, "valueUsd");
  assert.equal(state.sort.direction, "asc");
  assert.equal(state.page, 2);
  assert.equal(state.pageSize, 50);

  assert.equal(
    serializeRewardsUrlState(state),
    `search=aero&datePreset=90d&source=deposits&pool=${poolId}&deposit=${depositId}&coverage=partial&resolutionStatus=resolved&selected=${selectedRewardEventId}&sort=valueUsd&direction=asc&page=2&pageSize=50`,
  );
});

test("parseRewardsUrlState normalizes invalid values to safe defaults", () => {
  const state = parseRewardsUrlState(new URLSearchParams("datePreset=nope&source=bad&pool=no&coverage=maybe&page=-1&pageSize=13"));
  assert.equal(state.datePreset, "all");
  assert.equal(state.source, "all");
  assert.equal(state.poolId, null);
  assert.equal(state.coverage, "full");
  assert.equal(state.page, 1);
  assert.equal(state.pageSize, 25);
});

test("buildRewardsApiQueryString carries chain and filter identity", () => {
  const query = buildRewardsApiQueryString({
    chainId: 8453,
    state: {
      ...parseRewardsUrlState(new URLSearchParams(`pool=${poolId}&selected=${selectedRewardEventId}`)),
      pageSize: 100,
    },
  });
  assert.equal(query, `chainId=8453&pool=${poolId}&selected=${selectedRewardEventId}&pageSize=100`);
  assert.equal(normalizeRewardsFiltersForQueryKey(parseRewardsUrlState(new URLSearchParams(`pool=${poolId}`))).poolId, poolId);
});
