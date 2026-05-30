import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeStrategiesCoverageFilter,
  normalizeStrategiesPage,
  normalizeStrategiesPageSize,
  normalizeStrategiesProtocolFilter,
  normalizeStrategiesReturnSignFilter,
  normalizeStrategiesSearch,
  normalizeStrategiesSort,
  normalizeStrategiesStatusFilter,
  normalizeStrategiesUuid,
  STRATEGIES_SEARCH_MAX_LENGTH,
} from "@/features/strategies/strategies.validation";

test("strategy validation normalizes enum filters and sort controls", () => {
  assert.equal(normalizeStrategiesStatusFilter("closed"), "closed");
  assert.equal(normalizeStrategiesStatusFilter("manual"), "active");
  assert.equal(normalizeStrategiesProtocolFilter("all"), "all");
  assert.equal(normalizeStrategiesProtocolFilter("aero"), "mellow");
  assert.equal(normalizeStrategiesCoverageFilter("share_level"), "share_level");
  assert.equal(normalizeStrategiesCoverageFilter("limited"), "all");
  assert.equal(normalizeStrategiesReturnSignFilter("negative"), "negative");
  assert.equal(normalizeStrategiesReturnSignFilter("zero"), "any");
  assert.equal(normalizeStrategiesSort("return_asc"), "return_asc");
  assert.equal(normalizeStrategiesSort("created_desc"), "current_value_desc");
});

test("strategy validation bounds search pagination and UUID controls", () => {
  const uuid = "123e4567-e89b-12d3-a456-426614174000";
  assert.equal(normalizeStrategiesUuid(uuid), uuid);
  assert.equal(normalizeStrategiesUuid("nope"), null);
  assert.equal(normalizeStrategiesSearch(`  ${"a".repeat(90)}  `).length, STRATEGIES_SEARCH_MAX_LENGTH);
  assert.equal(normalizeStrategiesPage("2.9"), 2);
  assert.equal(normalizeStrategiesPage("10001"), 1);
  assert.equal(normalizeStrategiesPageSize("25"), 25);
  assert.equal(normalizeStrategiesPageSize("13"), 10);
});
