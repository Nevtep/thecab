import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeActivityAction,
  normalizeActivityConfidence,
  normalizeActivityCoverage,
  normalizeActivityPageSize,
  normalizeActivitySurface,
  normalizeActivityUuid,
} from "@/features/activity/activity.validation";

test("activity validation normalizes filter inputs conservatively", () => {
  assert.equal(normalizeActivitySurface("strategies"), "strategies");
  assert.equal(normalizeActivitySurface("bad"), "all");
  assert.equal(normalizeActivityAction("airdrop"), "airdrop");
  assert.equal(normalizeActivityAction("bad"), "all");
  assert.equal(normalizeActivityCoverage("excluded"), "excluded");
  assert.equal(normalizeActivityCoverage(null), null);
  assert.equal(normalizeActivityConfidence("none"), "none");
  assert.equal(normalizeActivityConfidence("bad"), null);
  assert.equal(normalizeActivityPageSize("100"), 100);
  assert.equal(normalizeActivityPageSize("13"), 10);
  assert.equal(normalizeActivityUuid("123e4567-e89b-12d3-a456-426614174000"), "123e4567-e89b-12d3-a456-426614174000");
  assert.equal(normalizeActivityUuid("activity:8453:0xabc:manual_position_created"), "activity:8453:0xabc:manual_position_created");
  assert.equal(normalizeActivityUuid("bad/path"), null);
});
