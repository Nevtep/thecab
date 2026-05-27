import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";

import { getPoolsErrorStatus } from "@/server/pools/pools.route";

test("getPoolsErrorStatus maps Zod errors to invalid_payload", () => {
  const schema = z.object({ limit: z.number().int() });
  const parseResult = schema.safeParse({ limit: "nope" });
  assert.equal(parseResult.success, false);
  if (parseResult.success) return;

  const mapped = getPoolsErrorStatus(parseResult.error);
  assert.equal(mapped.code, "invalid_payload");
  assert.equal(mapped.status, 400);
  assert.ok(Array.isArray(mapped.details));
});

test("getPoolsErrorStatus maps unsupported chain to 400", () => {
  const mapped = getPoolsErrorStatus(new Error("UNSUPPORTED_CHAIN:1"));
  assert.equal(mapped.code, "unsupported_chain");
  assert.equal(mapped.status, 400);
});

test("getPoolsErrorStatus maps unauthorized to 401", () => {
  const mapped = getPoolsErrorStatus(new Error("POOLS_REQUEST_FAILED:UNAUTHORIZED"));
  assert.equal(mapped.code, "unauthorized");
  assert.equal(mapped.status, 401);
});

test("getPoolsErrorStatus maps analysis_required to 423", () => {
  const mapped = getPoolsErrorStatus(new Error("POOLS_REQUEST_FAILED:ANALYSIS_REQUIRED"));
  assert.equal(mapped.code, "analysis_required");
  assert.equal(mapped.status, 423);
});

test("getPoolsErrorStatus maps pool_not_found to 404", () => {
  const mapped = getPoolsErrorStatus(new Error("POOLS_REQUEST_FAILED:POOL_NOT_FOUND"));
  assert.equal(mapped.code, "pool_not_found");
  assert.equal(mapped.status, 404);
});

test("getPoolsErrorStatus falls back to internal_error", () => {
  const mapped = getPoolsErrorStatus(new Error("unexpected boom"));
  assert.equal(mapped.code, "internal_error");
  assert.equal(mapped.status, 500);
});
