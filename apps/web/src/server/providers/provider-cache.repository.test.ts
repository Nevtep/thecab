import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_PROVIDER_CACHE_READ_ORDER } from "@/server/providers/provider-cache.repository";

test("provider cache defaults to DB-first read order", () => {
  assert.equal(DEFAULT_PROVIDER_CACHE_READ_ORDER, "db-first");
});