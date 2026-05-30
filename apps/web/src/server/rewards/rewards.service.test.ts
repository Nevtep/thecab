import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLockedRewardsResponse,
  buildReadyResponse,
  buildRewardsSummary,
} from "@/server/rewards/rewards.service";
import type { RewardsRepositoryResult } from "@/server/rewards/rewards.repository";
import type { RewardEventRow, RewardsRequest } from "@/server/rewards/rewards.types";

const walletAddress = "0x1111111111111111111111111111111111111111";
const rewardId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const unresolvedId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function request(overrides: Partial<RewardsRequest> = {}): RewardsRequest {
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

function reward(overrides: Partial<RewardEventRow> = {}): RewardEventRow {
  return {
    rewardEventId: rewardId,
    occurredAt: "2026-05-16T14:32:18.000Z",
    token: { address: "0x940181a94a35a4569e4529a3cdfb74e38fd98631", symbol: "AERO", iconUrl: null },
    tokenAmount: "1250.0000",
    usdValueAtClaim: "100.00",
    owner: {
      status: "manual_deposit",
      labelKey: "rewards:sources.manualDeposit",
      entityId: "11111111-1111-4111-8111-111111111111",
      entityLabel: "Dep-1111...1111",
      route: "/deposits/11111111-1111-4111-8111-111111111111",
    },
    sourceSurface: "manual_deposit_gauge_claim",
    poolContribution: {
      status: "contributes",
      poolId: "33333333-3333-4333-8333-333333333333",
      poolLabel: "WETH / USDC-100",
      route: "/pools/33333333-3333-4333-8333-333333333333",
      countingRule: "owner_resolved_pool",
    },
    rewardType: "reward_claim",
    coverageState: "full",
    confidence: "high",
    confidenceDots: 5,
    resolutionReasonCodes: [],
    txHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    externalTxUrl: "https://basescan.org/tx/0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    ...overrides,
  };
}

function repository(rows: RewardEventRow[]): RewardsRepositoryResult {
  return {
    allRows: rows,
    rows,
    totalRows: rows.length,
    historicalCapital: [
      { dayUtc: "2026-05-16", valueUsd: "1000.00", coverageStatus: "daily_snapshot" },
      { dayUtc: "2026-05-15", valueUsd: "1000.00", coverageStatus: "daily_snapshot" },
    ],
    availableFilters: {
      tokens: [{ tokenAddress: "0x940181a94a35a4569e4529a3cdfb74e38fd98631", symbol: "AERO" }],
      pools: [{ poolId: "33333333-3333-4333-8333-333333333333", label: "WETH / USDC-100" }],
      rewardTypes: ["reward_claim"],
    },
  };
}

test("buildLockedRewardsResponse returns an explicit locked response without fabricating empty rewards", () => {
  const response = buildLockedRewardsResponse({
    request: request({ source: "strategies" }),
    runId: "run-1",
    completedAt: null,
  });

  assert.equal(response.analysis.status, "locked");
  assert.equal(response.analysis.reasonCode, "analysisNotReady");
  assert.equal(response.summary, null);
  assert.equal(response.events.pagination.totalRows, 0);
  assert.deepEqual(response.filters.activeChips.map((chip) => chip.id), ["source"]);
});

test("buildRewardsSummary separates resolved value from unresolved and excluded value", () => {
  const summary = buildRewardsSummary([
    reward({ usdValueAtClaim: "100.00" }),
    reward({
      rewardEventId: unresolvedId,
      usdValueAtClaim: "25.00",
      owner: { status: "unresolved", labelKey: "rewards:sources.unresolved", entityId: null, entityLabel: null, route: null },
      coverageState: "unresolved",
      confidence: "low",
      confidenceDots: 2,
      resolutionReasonCodes: ["missingOwnerEvidence"],
    }),
    reward({
      rewardEventId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      usdValueAtClaim: "10.00",
      owner: { status: "excluded", labelKey: "rewards:sources.excluded", entityId: null, entityLabel: null, route: null },
      coverageState: "excluded",
      confidence: "none",
      confidenceDots: 0,
      resolutionReasonCodes: ["excludedAirdrop"],
    }),
  ], [{ dayUtc: "2026-05-16", valueUsd: "1000.00", coverageStatus: "daily_snapshot" }]);

  assert.equal(summary.totalClaimedRewardsUsd, "135.00");
  assert.equal(summary.resolvedRewardsUsd, "100.00");
  assert.equal(summary.unresolvedExcludedUsd, "35.00");
  assert.equal(summary.coverageState, "unresolved");
  assert.ok(summary.coverageReasonCodes.includes("missingOwnerEvidence"));
});

test("buildReadyResponse assembles ready data with historical-capital reward return and selected rail context", () => {
  const unresolved = reward({
    rewardEventId: unresolvedId,
    occurredAt: "2026-05-15T14:32:18.000Z",
    usdValueAtClaim: null,
    owner: { status: "unresolved", labelKey: "rewards:sources.unresolved", entityId: null, entityLabel: null, route: null },
    poolContribution: { status: "unresolved", poolId: null, poolLabel: null, route: null, countingRule: "unresolved_owner" },
    coverageState: "unresolved",
    confidence: "low",
    confidenceDots: 2,
    resolutionReasonCodes: ["unknownRewardSurface"],
  });
  const response = buildReadyResponse({
    request: request({ selectedRewardEventId: rewardId }),
    repository: repository([reward(), unresolved]),
    analysisStatus: "ready",
    runId: "run-ready",
    completedAt: "2026-05-17T00:00:00.000Z",
  });

  assert.equal(response.analysis.status, "ready");
  assert.equal(response.summary?.estimatedRewardReturnCoverage, "partial");
  assert.equal(response.selectedReward?.rewardEventId, rewardId);
  assert.equal(response.selectedReward?.unresolvedExcludedActivity[0]?.rewardEventId, unresolvedId);
  assert.equal(response.overTime.buckets.length, 2);
  assert.equal(response.events.pagination.totalPages, 1);
});

test("buildReadyResponse reports empty ready responses separately from locked responses", () => {
  const response = buildReadyResponse({
    request: request(),
    repository: repository([]),
    analysisStatus: "stale",
    runId: "run-stale",
    completedAt: "2026-05-17T00:00:00.000Z",
  });

  assert.equal(response.analysis.status, "stale");
  assert.equal(response.summary?.rewardEventCount, 0);
  assert.equal(response.selectedReward, null);
  assert.equal(response.events.pagination.totalRows, 0);
});
