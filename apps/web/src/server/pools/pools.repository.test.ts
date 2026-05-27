import assert from "node:assert/strict";
import test from "node:test";

import * as repository from "@/server/pools/pools.repository";

test("pools repository exports listPoolSummaries, readPoolSummarySeries, readPoolHistory, readPoolTimeline", () => {
  assert.equal(typeof repository.listPoolSummaries, "function");
  assert.equal(typeof repository.readPoolSummarySeries, "function");
  assert.equal(typeof repository.readPoolHistory, "function");
  assert.equal(typeof repository.readPoolTimeline, "function");
});
