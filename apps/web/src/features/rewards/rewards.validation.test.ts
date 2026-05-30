import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeRewardsAddress,
  normalizeRewardsCoverage,
  normalizeRewardsPageSize,
  normalizeRewardsSource,
  normalizeRewardsUuid,
} from "@/features/rewards/rewards.validation";

test("rewards validation normalizes filter inputs conservatively", () => {
  assert.equal(normalizeRewardsSource("strategies"), "strategies");
  assert.equal(normalizeRewardsSource("unknown"), "all");
  assert.equal(normalizeRewardsCoverage("excluded"), "excluded");
  assert.equal(normalizeRewardsCoverage(null), null);
  assert.equal(normalizeRewardsPageSize("100"), 100);
  assert.equal(normalizeRewardsPageSize("13"), 25);
  assert.equal(normalizeRewardsUuid("123e4567-e89b-12d3-a456-426614174000"), "123e4567-e89b-12d3-a456-426614174000");
  assert.equal(normalizeRewardsUuid("bad"), null);
  assert.equal(normalizeRewardsAddress("0x000000000000000000000000000000000000000A"), "0x000000000000000000000000000000000000000a");
});
