import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";

import {
  getActivityErrorStatus,
  handleActivityGet,
  normalizeActivityQueryParams,
} from "@/server/activity/activity.route";
import { buildLockedActivityResponse, buildReadyActivityResponse } from "@/server/activity/activity.service";
import type { ActivityRequest } from "@/server/activity/activity.types";

const walletAddress = "0x1111111111111111111111111111111111111111";
const selectedActivityId = "123e4567-e89b-12d3-a456-426614174000";
const poolId = "33333333-3333-4333-8333-333333333333";

function request(overrides: Partial<ActivityRequest> = {}): ActivityRequest {
  return {
    walletAddress,
    chainId: 8453,
    search: "",
    surface: "all",
    action: "all",
    coverage: null,
    confidence: null,
    poolId: null,
    depositId: null,
    strategyId: null,
    rewardEventId: null,
    governanceEventId: null,
    selectedActivityId: null,
    sort: { key: "occurredAt", direction: "desc" },
    page: 1,
    pageSize: 25,
    ...overrides,
  };
}

test("normalizeActivityQueryParams applies aliases and defaults", () => {
  const normalized = normalizeActivityQueryParams(new URLSearchParams(
    `chainId=8453&surface=rewards&action=claim&coverage=partial&confidence=low&poolId=${poolId}&selected=${selectedActivityId}&sort=valueUsd&direction=asc&page=2&pageSize=50`,
  ));

  assert.equal(normalized.chainId, 8453);
  assert.equal(normalized.surface, "rewards");
  assert.equal(normalized.action, "claim");
  assert.equal(normalized.coverage, "partial");
  assert.equal(normalized.confidence, "low");
  assert.equal(normalized.poolId, poolId);
  assert.equal(normalized.selectedActivityId, selectedActivityId);
  assert.equal(normalized.sort, "valueUsd");
  assert.equal(normalized.direction, "asc");
  assert.equal(normalized.page, 2);
  assert.equal(normalized.pageSize, 50);
});

test("normalizeActivityQueryParams rejects unknown params and invalid controls", () => {
  assert.throws(() => normalizeActivityQueryParams(new URLSearchParams("chainId=8453&unexpected=1")), /INVALID_ACTIVITY_FILTERS/);
  assert.throws(() => normalizeActivityQueryParams(new URLSearchParams("chainId=8453&pageSize=13")), /INVALID_ACTIVITY_FILTERS/);
});

test("getActivityErrorStatus maps stable machine codes", () => {
  const parsed = z.object({ count: z.number() }).safeParse({ count: "bad" });
  assert.equal(parsed.success, false);
  if (parsed.success) return;

  assert.equal(getActivityErrorStatus(parsed.error).code, "INVALID_ACTIVITY_FILTERS");
  assert.equal(getActivityErrorStatus(new Error("UNSUPPORTED_CHAIN:1")).code, "UNSUPPORTED_CHAIN");
  assert.equal(getActivityErrorStatus(new Error("ACTIVITY_REQUEST_FAILED:UNAUTHENTICATED_WALLET")).status, 401);
  assert.equal(getActivityErrorStatus(new Error("ACTIVITY_REQUEST_FAILED:INVALID_ACTIVITY_FILTERS")).status, 400);
});

test("handleActivityGet returns locked route response without treating it as an error", async () => {
  const input = request();
  const response = await handleActivityGet(new Request("https://cab.test/api/activity?chainId=8453"), {
    parseRequest: async () => input,
    readDataView: async () => buildLockedActivityResponse(input, {
      status: "queued",
      coverage: "unknown",
      coverageReasons: ["analysisPending"],
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(body.screenKind, "locked");
});

test("handleActivityGet returns ready route response from the service payload", async () => {
  const input = request();
  const response = await handleActivityGet(new Request("https://cab.test/api/activity?chainId=8453"), {
    parseRequest: async () => input,
    readDataView: async () => buildReadyActivityResponse({
      request: input,
      analysis: { status: "ready", coverage: "full", coverageReasons: [] },
      repository: {
        allRows: [],
        rows: [],
        totalRows: 0,
        availableFilters: { actions: [], surfaces: [], tokens: [] },
      },
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.analysis.status, "ready");
  assert.equal(body.events.pagination.totalRows, 0);
});
