import assert from "node:assert/strict";
import test from "node:test";

import {
  buildStrategiesApiQueryString,
  normalizeStrategiesFiltersForQueryKey,
  parseStrategiesListUrlState,
  serializeStrategiesListUrlState,
} from "@/features/strategies/strategies.urlState";

const poolId = "123e4567-e89b-12d3-a456-426614174000";
const selectedStrategyId = "123e4567-e89b-12d3-a456-426614174111";

test("parse and serialize strategies URL state round-trip all list controls", () => {
  const state = parseStrategiesListUrlState(new URLSearchParams(
    `status=closed&protocol=all&pool=${poolId}&coverage=partial&returnSign=negative&search=cbBTC&sort=return_asc&page=2&pageSize=25&selectedStrategyId=${selectedStrategyId}`,
  ));

  assert.deepEqual(state, {
    status: "closed",
    protocol: "all",
    poolId,
    coverage: "partial",
    returnSign: "negative",
    search: "cbBTC",
    sort: "return_asc",
    page: 2,
    pageSize: 25,
    selectedStrategyId,
  });
  assert.equal(
    serializeStrategiesListUrlState(state),
    `status=closed&protocol=all&pool=${poolId}&coverage=partial&returnSign=negative&search=cbBTC&sort=return_asc&page=2&pageSize=25&selectedStrategyId=${selectedStrategyId}`,
  );
});

test("parseStrategiesListUrlState drops invalid query values", () => {
  const state = parseStrategiesListUrlState(new URLSearchParams(
    "status=weird&protocol=bad&pool=not-a-uuid&coverage=nope&returnSign=no&page=99999&pageSize=13&selectedStrategyId=nope",
  ));

  assert.deepEqual(state, {
    status: "active",
    protocol: "mellow",
    poolId: null,
    coverage: "all",
    returnSign: "any",
    search: "",
    sort: "current_value_desc",
    page: 1,
    pageSize: 10,
    selectedStrategyId: null,
  });
});

test("normalizeStrategiesFiltersForQueryKey includes selected strategy for master-detail cache identity", () => {
  const filters = normalizeStrategiesFiltersForQueryKey({
    status: "active",
    protocol: "mellow",
    poolId,
    coverage: "share_level",
    returnSign: "positive",
    search: "weth",
    sort: "coverage_desc",
    page: 1,
    pageSize: 10,
    selectedStrategyId,
  });

  assert.equal(filters.poolId, poolId);
  assert.equal(filters.selectedStrategyId, selectedStrategyId);
});

test("buildStrategiesApiQueryString emits explicit DB request controls", () => {
  const query = buildStrategiesApiQueryString({
    chainId: 8453,
    state: {
      status: "all",
      protocol: "all",
      poolId,
      coverage: "unknown",
      returnSign: "positive",
      search: "aero",
      sort: "coverage_asc",
      page: 3,
      pageSize: 50,
      selectedStrategyId,
    },
  });

  assert.equal(
    query,
    `chainId=8453&status=all&protocol=all&pool=${poolId}&coverage=unknown&returnSign=positive&search=aero&sort=coverage_asc&page=3&pageSize=50&selectedStrategyId=${selectedStrategyId}`,
  );
});
