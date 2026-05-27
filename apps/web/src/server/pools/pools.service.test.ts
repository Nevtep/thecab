import assert from "node:assert/strict";
import test from "node:test";

import * as service from "@/server/pools/pools.service";

test("pools service exports getPoolsList and getPoolDetail", () => {
  assert.equal(typeof service.getPoolsList, "function");
  assert.equal(typeof service.getPoolDetail, "function");
});
