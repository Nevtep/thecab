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

test("strategy validation bounds search pagination and opaque id controls", () => {
  const scopedId = "8453:0xcd975e6a5f55137755487f0918b8ca74acce7925";
  assert.equal(normalizeStrategiesUuid(scopedId), scopedId);
  assert.equal(normalizeStrategiesUuid("bad/strategy"), null);
  assert.equal(normalizeStrategiesSearch(`  ${"a".repeat(90)}  `).length, STRATEGIES_SEARCH_MAX_LENGTH);
  assert.equal(normalizeStrategiesPage("2.9"), 2);
  assert.equal(normalizeStrategiesPage("10001"), 1);
  assert.equal(normalizeStrategiesPageSize("25"), 25);
  assert.equal(normalizeStrategiesPageSize("13"), 10);
});
