import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";

import {
  getGovernanceErrorStatus,
  handleGovernanceGet,
  normalizeGovernanceQueryParams,
} from "@/server/governance/governance.route";
import { buildLockedGovernanceResponse, buildReadyGovernanceResponse } from "@/server/governance/governance.service";
import type { GovernanceRequest } from "@/server/governance/governance.types";

const walletAddress = "0x1111111111111111111111111111111111111111";
const selectedGovernanceId = "123e4567-e89b-12d3-a456-426614174000";
const poolId = "33333333-3333-4333-8333-333333333333";
const tokenAddress = "0x940181a94a35a4569e4529a3cdfb74e38fd98631";

function request(overrides: Partial<GovernanceRequest> = {}): GovernanceRequest {
  return {
    walletAddress,
    chainId: 8453,
    search: "",
    datePreset: "all",
    eventType: "all",
    rewardType: "all",
    protocolSurface: "all",
    epochId: null,
    poolId: null,
    tokenAddress: null,
    coverage: null,
    confidence: null,
    selectedKind: null,
    selectedGovernanceId: null,
    sort: { key: "occurredAt", direction: "desc" },
    page: 1,
    pageSize: 10,
    ...overrides,
  };
}

const readyAnalysis = {
  status: "ready" as const,
  runId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  completedAt: "2026-05-30T00:00:00.000Z",
  isStale: false,
};

test("normalizeGovernanceQueryParams applies aliases and defaults", () => {
  const normalized = normalizeGovernanceQueryParams(new URLSearchParams(
    `chainId=8453&range=90d&eventType=vote_cast&rewardType=bribe&protocolSurface=voter&coverage=partial&confidence=low&poolId=${poolId}&tokenAddress=${tokenAddress}&kind=reward&selected=${selectedGovernanceId}&sort=valueUsdAtClaim&direction=asc&page=2&pageSize=25`,
  ));

  assert.equal(normalized.chainId, 8453);
  assert.equal(normalized.datePreset, "90d");
  assert.equal(normalized.eventType, "vote_cast");
  assert.equal(normalized.rewardType, "bribe");
  assert.equal(normalized.protocolSurface, "voter");
  assert.equal(normalized.coverage, "partial");
  assert.equal(normalized.confidence, "low");
  assert.equal(normalized.poolId, poolId);
  assert.equal(normalized.tokenAddress, tokenAddress);
  assert.equal(normalized.selectedKind, "reward");
  assert.equal(normalized.selectedGovernanceId, selectedGovernanceId);
  assert.equal(normalized.sort, "valueUsdAtClaim");
  assert.equal(normalized.direction, "asc");
  assert.equal(normalized.page, 2);
  assert.equal(normalized.pageSize, 25);
});

test("normalizeGovernanceQueryParams accepts inbound governance and reward identity aliases", () => {
  const governance = normalizeGovernanceQueryParams(new URLSearchParams(`chainId=8453&governanceEventId=${selectedGovernanceId}`));
  assert.equal(governance.selectedKind, "event");
  assert.equal(governance.selectedGovernanceId, selectedGovernanceId);

  const reward = normalizeGovernanceQueryParams(new URLSearchParams(`chainId=8453&rewardEventId=${selectedGovernanceId}`));
  assert.equal(reward.selectedKind, "reward");
  assert.equal(reward.selectedGovernanceId, selectedGovernanceId);

  const epoch = normalizeGovernanceQueryParams(new URLSearchParams("chainId=8453&kind=epoch&selected=170"));
  assert.equal(epoch.selectedKind, "epoch");
  assert.equal(epoch.selectedGovernanceId, "170");
});

test("normalizeGovernanceQueryParams rejects unknown params and invalid controls", () => {
  assert.throws(() => normalizeGovernanceQueryParams(new URLSearchParams("chainId=8453&unexpected=1")), /INVALID_GOVERNANCE_FILTERS/);
  assert.throws(() => normalizeGovernanceQueryParams(new URLSearchParams("chainId=8453&pageSize=13")), /INVALID_GOVERNANCE_FILTERS/);
});

test("getGovernanceErrorStatus maps stable machine codes", () => {
  const parsed = z.object({ count: z.number() }).safeParse({ count: "bad" });
  assert.equal(parsed.success, false);
  if (parsed.success) return;

  assert.equal(getGovernanceErrorStatus(parsed.error).code, "INVALID_GOVERNANCE_FILTERS");
  assert.equal(getGovernanceErrorStatus(new Error("UNSUPPORTED_CHAIN:1")).code, "UNSUPPORTED_CHAIN");
  assert.equal(getGovernanceErrorStatus(new Error("GOVERNANCE_REQUEST_FAILED:UNAUTHENTICATED_WALLET")).status, 401);
  assert.equal(getGovernanceErrorStatus(new Error("GOVERNANCE_REQUEST_FAILED:INVALID_GOVERNANCE_FILTERS")).status, 400);
});

test("handleGovernanceGet returns locked response without treating it as an error", async () => {
  const input = request();
  const response = await handleGovernanceGet(new Request("https://cab.test/api/governance?chainId=8453"), {
    parseRequest: async () => input,
    readDataView: async () => buildLockedGovernanceResponse(input, {
      status: "queued",
      runId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      completedAt: null,
      isStale: false,
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(body.screenKind, "locked");
  assert.equal(body.rewards.pagination.totalRows, 0);
});

test("handleGovernanceGet returns ready route response from service payload", async () => {
  const input = request();
  const response = await handleGovernanceGet(new Request("https://cab.test/api/governance?chainId=8453"), {
    parseRequest: async () => input,
    readDataView: async () => buildReadyGovernanceResponse({
      request: input,
      analysis: readyAnalysis,
      repository: {
        allRewardRows: [],
        rewardRows: [],
        totalRewardRows: 0,
        lockPanel: null,
        epochs: [],
        events: [],
        selectedDetailTarget: null,
        metricSnapshot: null,
        availableFilters: { rewardTypes: [], tokens: [], epochs: [], protocolSurfaces: [] },
      },
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.analysis.status, "ready");
  assert.equal(body.screenKind, "empty");
});
