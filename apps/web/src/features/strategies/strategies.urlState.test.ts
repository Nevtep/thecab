import assert from "node:assert/strict";
import test from "node:test";

import {
  buildStrategiesApiQueryString,
  normalizeStrategiesFiltersForQueryKey,
  parseStrategiesListUrlState,
  serializeStrategiesListUrlState,
} from "@/features/strategies/strategies.urlState";

const poolId = "8453:0x70acdf2ad0bf2402c957154f944c19ef4e1cbae1";
const selectedStrategyId = "8453:0xcd975e6a5f55137755487f0918b8ca74acce7925";
const encodedPoolId = encodeURIComponent(poolId);
const encodedSelectedStrategyId = encodeURIComponent(selectedStrategyId);

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
    `status=closed&protocol=all&pool=${encodedPoolId}&coverage=partial&returnSign=negative&search=cbBTC&sort=return_asc&page=2&pageSize=25&selectedStrategyId=${encodedSelectedStrategyId}`,
  );
});

test("parseStrategiesListUrlState drops invalid query values", () => {
  const state = parseStrategiesListUrlState(new URLSearchParams(
    "status=weird&protocol=bad&pool=bad%2Fpool&coverage=nope&returnSign=no&page=99999&pageSize=13&selectedStrategyId=bad%2Fstrategy",
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
    `chainId=8453&status=all&protocol=all&pool=${encodedPoolId}&coverage=unknown&returnSign=positive&search=aero&sort=coverage_asc&page=3&pageSize=50&selectedStrategyId=${encodedSelectedStrategyId}`,
  );
});
