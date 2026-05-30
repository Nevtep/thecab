import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDepositsPoolHref,
  getStrategyDetailHref,
  getStrategiesListHref,
} from "@/features/deposits/deposits.navigation";

test("strategies routes point to the live strategy destination", () => {
  assert.equal(getStrategiesListHref(8453), "/strategies?chainId=8453");
  assert.equal(getStrategyDetailHref("strategy-123", 8453), "/strategies/strategy-123?chainId=8453");
});

test("buildDepositsPoolHref preserves chain and pool filter in the URL", () => {
  assert.equal(
    buildDepositsPoolHref({ chainId: 8453, poolId: "pool-123" }),
    "/deposits?chainId=8453&pool=pool-123",
  );
});
