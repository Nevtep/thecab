import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";

import {
  getStrategiesErrorStatus,
  normalizeStrategyDetailParams,
  normalizeStrategiesListQueryParams,
} from "@/server/strategies/strategies.route";

test("normalizeStrategiesListQueryParams applies defaults aliases and selected strategy", () => {
  const normalized = normalizeStrategiesListQueryParams(new URLSearchParams(
    "chainId=8453&pool=123e4567-e89b-12d3-a456-426614174000&coverage=share_level&returnSign=positive&sort=return_desc&page=2&pageSize=25&selectedStrategyId=123e4567-e89b-12d3-a456-426614174111",
  ));

  assert.equal(normalized.chainId, 8453);
  assert.equal(normalized.status, "active");
  assert.equal(normalized.protocol, "mellow");
  assert.equal(normalized.poolId, "123e4567-e89b-12d3-a456-426614174000");
  assert.equal(normalized.coverage, "share_level");
  assert.equal(normalized.returnSign, "positive");
  assert.equal(normalized.selectedStrategyId, "123e4567-e89b-12d3-a456-426614174111");
});

test("normalizeStrategiesListQueryParams rejects unknown params and invalid values", () => {
  assert.throws(
    () => normalizeStrategiesListQueryParams(new URLSearchParams("chainId=8453&surprise=true")),
    /INVALID_REQUEST/,
  );
  assert.throws(
    () => normalizeStrategiesListQueryParams(new URLSearchParams("sort=nope")),
    /INVALID_REQUEST/,
  );
});

test("getStrategiesErrorStatus maps stable strategy errors", () => {
  const schema = z.object({ limit: z.number().int() });
  const parsed = schema.safeParse({ limit: "nope" });
  assert.equal(parsed.success, false);
  if (parsed.success) return;

  assert.equal(getStrategiesErrorStatus(parsed.error).code, "invalid_request");
  assert.equal(getStrategiesErrorStatus(new Error("UNSUPPORTED_CHAIN:1")).code, "chain_unsupported");
  assert.equal(getStrategiesErrorStatus(new Error("STRATEGIES_REQUEST_FAILED:UNAUTHORIZED")).status, 401);
  assert.equal(getStrategiesErrorStatus(new Error("STRATEGIES_REQUEST_FAILED:ANALYSIS_NOT_READY")).status, 409);
  assert.equal(getStrategiesErrorStatus(new Error("STRATEGIES_REQUEST_FAILED:STRATEGY_NOT_FOUND")).status, 404);
});

test("normalizeStrategyDetailParams validates chain and strategy identity", () => {
  const normalized = normalizeStrategyDetailParams(
    new URLSearchParams("chainId=8453"),
    "8453:0xcd975e6a5f55137755487f0918b8ca74acce7925",
  );

  assert.equal(normalized.chainId, 8453);
  assert.equal(normalized.strategyId, "8453:0xcd975e6a5f55137755487f0918b8ca74acce7925");

  assert.throws(
    () => normalizeStrategyDetailParams(new URLSearchParams("chainId=8453"), "bad/strategy"),
    /INVALID_REQUEST/,
  );
  assert.throws(
    () => normalizeStrategyDetailParams(new URLSearchParams("chainId=1"), "8453:0xcd975e6a5f55137755487f0918b8ca74acce7925"),
    /UNSUPPORTED_CHAIN/,
  );
});
