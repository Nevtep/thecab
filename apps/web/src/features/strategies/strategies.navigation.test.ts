import assert from "node:assert/strict";
import test from "node:test";

import {
  buildStrategiesListHref,
  buildStrategyDetailHref,
  getStrategiesListHref,
  getStrategyDetailHref,
} from "@/features/strategies/strategies.navigation";

test("buildStrategiesListHref preserves pool and selected strategy context", () => {
  assert.equal(
    buildStrategiesListHref({
      chainId: 8453,
      poolId: "pool-1",
      selectedStrategyId: "strategy-exposure-1",
    }),
    "/strategies?chainId=8453&pool=pool-1&selectedStrategyId=strategy-exposure-1",
  );
});

test("strategy navigation helpers point to live chain-aware routes", () => {
  assert.equal(getStrategiesListHref(8453), "/strategies?chainId=8453");
  assert.equal(
    buildStrategyDetailHref({ chainId: 8453, strategyId: "strategy-exposure-1" }),
    "/strategies/strategy-exposure-1?chainId=8453",
  );
  assert.equal(getStrategyDetailHref("strategy-exposure-1", 8453), "/strategies/strategy-exposure-1?chainId=8453");
});
