import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import * as repository from "@/server/pools/pools.repository";

test("pools repository exports listPoolSummaries, readPoolSummarySeries, readPoolHistory, readPoolTimeline", () => {
  assert.equal(typeof repository.listPoolSummaries, "function");
  assert.equal(typeof repository.readPoolSummarySeries, "function");
  assert.equal(typeof repository.readPoolHistory, "function");
  assert.equal(typeof repository.readPoolTimeline, "function");
});

test("pools repository keeps v2 pool ids away from legacy uuid tables", () => {
  const source = readFileSync(resolve(process.cwd(), "src/server/pools/pools.repository.ts"), "utf8");

  assert.match(
    source,
    /export async function readPoolSummarySeries[\s\S]*readEngineV2SurfaceRows[\s\S]*hasRichEngineV2PoolRow[\s\S]*from\(poolHistorySnapshots\)/,
  );
  assert.match(
    source,
    /export async function readPoolTimeline[\s\S]*readEngineV2SurfaceRows[\s\S]*hasRichEngineV2PoolRow[\s\S]*from\(poolTimelineEvents\)/,
  );
  assert.match(
    source,
    /export async function readPoolPositions[\s\S]*readEngineV2SurfaceRows[\s\S]*hasRichEngineV2PoolRow[\s\S]*from\(deposits\)[\s\S]*from\(strategyExposures\)/,
  );
});
