import assert from "node:assert/strict";
import test from "node:test";

import {
  getConfidenceLabelKey,
  getCoverageLabelKey,
  mapRewardsResponseToViewModel,
} from "@/features/rewards/rewards.mappers";
import type { RewardEventRow, RewardsResponse, SelectedReward } from "@/features/rewards/rewards.types";

function buildResponse(overrides: Partial<RewardsResponse> = {}): RewardsResponse {
  return {
    walletAddress: "0x0000000000000000000000000000000000000001",
    chainId: 8453,
    analysis: {
      status: "ready",
      runId: "run",
      completedAt: "2026-05-30T00:00:00.000Z",
      coveredRange: { start: null, end: null },
      isStale: false,
    },
    filters: {
      search: "",
      datePreset: "all",
      dateStart: null,
      dateEnd: null,
      dateRange: { start: null, end: null },
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
      activeChips: [],
    },
    summary: null,
    kpis: [],
    overTime: { grouping: "daily", coveragePercent: "0.0", coverageState: "full", coverageReasonCodes: [], buckets: [] },
    distributions: {
      source: { totalUsd: "0.00", coverageState: "full", items: [] },
      pool: { totalUsd: "0.00", coverageState: "full", items: [] },
      token: { totalUsd: "0.00", coverageState: "full", items: [] },
    },
    events: { rows: [], pagination: { page: 1, pageSize: 25, totalRows: 0, totalPages: 0 } },
    selectedReward: null,
    availableFilters: { sources: ["all"], tokens: [], pools: [], rewardTypes: [], coverageStates: ["full"] },
    ...overrides,
  };
}

test("mapRewardsResponseToViewModel distinguishes locked, empty, and ready screens", () => {
  assert.equal(mapRewardsResponseToViewModel(buildResponse({ analysis: { ...buildResponse().analysis, status: "locked" } })).screenKind, "locked");
  assert.equal(mapRewardsResponseToViewModel(buildResponse({ summary: { totalClaimedRewardsUsd: "0.00", rewardEventCount: 0, estimatedRewardReturnPct: null, estimatedRewardReturnCoverage: "unavailable", resolvedRewardsUsd: "0.00", resolvedRewardsSharePct: "0.0", unresolvedExcludedUsd: "0.00", unresolvedExcludedSharePct: "0.0", coverageState: "full", coveragePercent: "100.0", coverageReasonCodes: [] } })).screenKind, "empty");
  assert.equal(mapRewardsResponseToViewModel(buildResponse({
    filters: {
      ...buildResponse().filters,
      source: "governance",
      activeChips: [{ id: "source", labelKey: "rewards:filters.source", value: "governance", removeTarget: "source" }],
    },
    summary: { totalClaimedRewardsUsd: "0.00", rewardEventCount: 0, estimatedRewardReturnPct: null, estimatedRewardReturnCoverage: "unavailable", resolvedRewardsUsd: "0.00", resolvedRewardsSharePct: "0.0", unresolvedExcludedUsd: "0.00", unresolvedExcludedSharePct: "0.0", coverageState: "full", coveragePercent: "100.0", coverageReasonCodes: [] },
  })).screenKind, "ready");
});

test("mapRewardsResponseToViewModel keeps KPI, chart, distribution, and table state intact", () => {
  const row: RewardEventRow = {
    rewardEventId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    occurredAt: "2026-05-16T14:32:18.000Z",
    token: { address: "0x940181a94a35a4569e4529a3cdfb74e38fd98631", symbol: "AERO", iconUrl: null },
    tokenAmount: "1250.0000",
    usdValueAtClaim: "1245.18",
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
  };
  const selectedReward: SelectedReward = {
    rewardEventId: row.rewardEventId,
    summary: {
      tokenAddress: row.token.address,
      tokenIconUrl: row.token.iconUrl,
      tokenSymbol: "AERO",
      rewardTypeLabelKey: "rewards:rewardTypes.reward_claim",
      tokenAmount: "1250.0000",
      usdValueAtClaim: "1245.18",
      ownerStatus: "manual_deposit",
      coverageState: "full",
      confidence: "high",
    },
    ownershipTrace: {
      ownerStatus: "manual_deposit",
      linkedEntityLabel: "Dep-1111...1111",
      linkedEntityRoute: "/deposits/11111111-1111-4111-8111-111111111111",
      sourceSurface: "manual_deposit_gauge_claim",
      evidenceKey: "rewards:evidence.resolvedOwner",
    },
    poolContribution: {
      status: "contributes",
      linkedPoolLabel: "WETH / USDC-100",
      linkedPoolRoute: "/pools/33333333-3333-4333-8333-333333333333",
      countingRuleKey: "rewards:countingRules.owner_resolved_pool",
      noteKey: "rewards:notes.noDoubleCount",
    },
    claimDetails: {
      txHash: row.txHash,
      claimTime: row.occurredAt,
      rewardType: "reward_claim",
      sourceContract: null,
      externalTxUrl: row.externalTxUrl,
    },
    coverageNotes: {
      coverageState: "full",
      includedInAggregates: true,
      reasonCodes: [],
    },
    unresolvedExcludedActivity: [],
  };
  const vm = mapRewardsResponseToViewModel(buildResponse({
    summary: {
      totalClaimedRewardsUsd: "1245.18",
      rewardEventCount: 1,
      estimatedRewardReturnPct: "8.42",
      estimatedRewardReturnCoverage: "estimated",
      resolvedRewardsUsd: "1245.18",
      resolvedRewardsSharePct: "100.0",
      unresolvedExcludedUsd: "0.00",
      unresolvedExcludedSharePct: "0.0",
      coverageState: "full",
      coveragePercent: "100.0",
      coverageReasonCodes: [],
    },
    kpis: [{ id: "estimatedRewardReturn", labelKey: "rewards:kpis.estimatedRewardReturn", value: "8.42", valueKind: "percent", context: { labelKey: "rewards:kpis.estimated" }, coverageState: "estimated" }],
    overTime: {
      grouping: "daily",
      coveragePercent: "100.0",
      coverageState: "full",
      coverageReasonCodes: [],
      buckets: [{
        bucketStart: "2026-05-16",
        bucketEnd: null,
        claimedValueUsd: "1245.18",
        resolvedValueUsd: "1245.18",
        unresolvedExcludedValueUsd: "0.00",
        cumulativeClaimedValueUsd: "1245.18",
        estimatedRewardReturnPct: "8.42",
        rewardEventCount: 1,
        claimMarkers: [{ rewardEventId: row.rewardEventId, tokenSymbol: "AERO" }],
        coverageState: "full",
        coverageReasonCodes: [],
      }],
    },
    distributions: {
      source: { totalUsd: "1245.18", coverageState: "full", items: [{ id: "manual_deposit", label: "Manual Deposit", labelKey: "rewards:sources.manualDeposit", valueUsd: "1245.18", sharePct: "100.0", count: 1, coverageState: "full", filterTarget: { source: "deposits" } }] },
      pool: { totalUsd: "1245.18", coverageState: "full", items: [] },
      token: { totalUsd: "1245.18", coverageState: "full", items: [] },
    },
    events: { rows: [row], pagination: { page: 1, pageSize: 25, totalRows: 1, totalPages: 1 } },
    selectedReward,
  }));

  assert.equal(vm.screenKind, "ready");
  assert.equal(vm.kpis[0]?.coverageState, "estimated");
  assert.equal(vm.overTime.buckets[0]?.estimatedRewardReturnPct, "8.42");
  assert.equal(vm.distributions.source.items[0]?.filterTarget.source, "deposits");
  assert.equal(vm.events.rows[0]?.owner.status, "manual_deposit");
  assert.equal(vm.selectedReward?.coverageNotes.includedInAggregates, true);
});

test("badge label helpers generate stable i18n keys", () => {
  assert.equal(getCoverageLabelKey("partial"), "coverage:level.partial");
  assert.equal(getConfidenceLabelKey("high"), "rewards:confidence.high");
});
