import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";

import { buildLockedRewardsResponse, buildReadyResponse } from "@/server/rewards/rewards.service";
import { getRewardsErrorStatus, handleRewardsGet, normalizeRewardsQueryParams } from "@/server/rewards/rewards.route";
import type { RewardsRequest } from "@/server/rewards/rewards.types";

const poolId = "123e4567-e89b-12d3-a456-426614174000";
const walletAddress = "0x1111111111111111111111111111111111111111";

function requestInput(overrides: Partial<RewardsRequest> = {}): RewardsRequest {
  return {
    walletAddress,
    chainId: 8453,
    search: "",
    datePreset: "all",
    dateStart: null,
    dateEnd: null,
    source: "all",
    tokenAddress: null,
    poolId: null,
    depositId: null,
    strategyExposureId: null,
    rewardType: null,
    coverage: null,
    resolutionStatus: null,
    selectedRewardEventId: null,
    sort: { key: "occurredAt", direction: "desc" },
    page: 1,
    pageSize: 25,
    ...overrides,
  };
}

test("normalizeRewardsQueryParams applies aliases and defaults", () => {
  const normalized = normalizeRewardsQueryParams(new URLSearchParams(
    `chainId=8453&source=strategies&pool=${poolId}&sort=coverage&direction=asc&page=3&pageSize=100`,
  ));

  assert.equal(normalized.chainId, 8453);
  assert.equal(normalized.datePreset, "all");
  assert.equal(normalized.source, "strategies");
  assert.equal(normalized.poolId, poolId);
  assert.equal(normalized.sort, "coverage");
  assert.equal(normalized.direction, "asc");
  assert.equal(normalized.page, 3);
  assert.equal(normalized.pageSize, 100);
});

test("normalizeRewardsQueryParams rejects unknown params and incomplete custom range", () => {
  assert.throws(() => normalizeRewardsQueryParams(new URLSearchParams("chainId=8453&unexpected=1")), /INVALID_REWARDS_FILTERS/);
  assert.throws(() => normalizeRewardsQueryParams(new URLSearchParams("chainId=8453&datePreset=custom")), /CUSTOM_RANGE_REQUIRED/);
  assert.throws(
    () => normalizeRewardsQueryParams(new URLSearchParams("chainId=8453&datePreset=custom&dateStart=2026-05-30&dateEnd=2026-05-01")),
    /CUSTOM_RANGE_INVALID/,
  );
  assert.throws(
    () => normalizeRewardsQueryParams(new URLSearchParams("chainId=8453&datePreset=custom&dateStart=05-30-2026&dateEnd=2026-05-31")),
    /INVALID_REWARDS_FILTERS/,
  );
});

test("normalizeRewardsQueryParams accepts composed filters used by ready and locked route responses", () => {
  const normalized = normalizeRewardsQueryParams(new URLSearchParams(
    `chainId=8453&datePreset=custom&dateStart=2026-05-01&dateEnd=2026-05-30&token=0x940181a94a35a4569e4529a3cdfb74e38fd98631&pool=${poolId}&rewardType=reward_claim&coverage=full&resolutionStatus=resolved&page=2&pageSize=10`,
  ));

  assert.equal(normalized.datePreset, "custom");
  assert.equal(normalized.dateStart, "2026-05-01");
  assert.equal(normalized.dateEnd, "2026-05-30");
  assert.equal(normalized.tokenAddress, "0x940181a94a35a4569e4529a3cdfb74e38fd98631");
  assert.equal(normalized.coverage, "full");
  assert.equal(normalized.resolutionStatus, "resolved");
  assert.equal(normalized.pageSize, 10);
});

test("getRewardsErrorStatus maps stable machine codes", () => {
  const parsed = z.object({ count: z.number() }).safeParse({ count: "bad" });
  assert.equal(parsed.success, false);
  if (parsed.success) return;

  assert.equal(getRewardsErrorStatus(parsed.error).code, "INVALID_REWARDS_FILTERS");
  assert.equal(getRewardsErrorStatus(new Error("UNSUPPORTED_CHAIN:1")).code, "UNSUPPORTED_CHAIN");
  assert.equal(getRewardsErrorStatus(new Error("REWARDS_REQUEST_FAILED:UNAUTHENTICATED_WALLET")).status, 401);
  assert.equal(getRewardsErrorStatus(new Error("REWARDS_REQUEST_FAILED:INVALID_REWARDS_FILTERS")).status, 400);
});

test("handleRewardsGet returns locked route response without treating it as an error", async () => {
  const input = requestInput();
  const response = await handleRewardsGet(new Request("https://cab.test/api/rewards?chainId=8453"), {
    parseRequest: async () => input,
    readDataView: async () => buildLockedRewardsResponse({ request: input, runId: "run-locked", completedAt: null }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(body.analysis.status, "locked");
  assert.equal(body.summary, null);
});

test("handleRewardsGet returns ready route response from the service payload", async () => {
  const input = requestInput();
  const response = await handleRewardsGet(new Request("https://cab.test/api/rewards?chainId=8453"), {
    parseRequest: async () => input,
    readDataView: async () => buildReadyResponse({
      request: input,
      repository: {
        summaryRows: [],
        allRows: [],
        rows: [],
        totalRows: 0,
        historicalCapital: [],
        availableFilters: { tokens: [], pools: [], rewardTypes: [] },
      },
      analysisStatus: "ready",
      runId: "run-ready",
      completedAt: "2026-05-30T00:00:00.000Z",
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.analysis.status, "ready");
  assert.equal(body.events.pagination.totalRows, 0);
});
