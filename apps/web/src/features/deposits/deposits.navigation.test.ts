import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDepositsPoolHref,
  getStrategyDetailHref,
  getStrategiesListHref,
} from "@/features/deposits/deposits.navigation";

test("strategies routes remain disabled until the route flag is enabled", () => {
  assert.equal(getStrategiesListHref(), null);
  assert.equal(getStrategyDetailHref("strategy-123"), null);
});

test("buildDepositsPoolHref preserves chain and pool filter in the URL", () => {
  assert.equal(
    buildDepositsPoolHref({ chainId: 8453, poolId: "pool-123" }),
    "/deposits?chainId=8453&pool=pool-123",
  );
});
