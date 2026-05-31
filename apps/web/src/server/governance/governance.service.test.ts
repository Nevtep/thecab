import assert from "node:assert/strict";
import test from "node:test";

import {
  buildEmptyGovernanceSummary,
  buildLockedGovernanceResponse,
  buildReadyGovernanceResponse,
  createGovernanceActiveChips,
} from "@/server/governance/governance.service";
import type {
  GovernanceAnalysisState,
  GovernanceLockPanel,
  GovernanceRequest,
  GovernanceRewardRow,
} from "@/server/governance/governance.types";

const walletAddress = "0x1111111111111111111111111111111111111111";
const rewardId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

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

const readyAnalysis: GovernanceAnalysisState = {
  status: "ready",
  runId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  completedAt: "2026-05-30T00:00:00.000Z",
  isStale: false,
};

const lockPanel: GovernanceLockPanel = {
  lockExposureId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  lockId: "170",
  status: "active",
  createdAt: "2026-05-01T00:00:00.000Z",
  expiresAt: "2027-05-01T00:00:00.000Z",
  lockedAeroAmount: "2203.245",
  lockedAeroValueUsd: "48264.31",
  veAeroExposure: "1845.771",
  coverageState: "full",
  confidence: "high",
  reasonCodes: [],
  lifecycle: [],
};

function reward(overrides: Partial<GovernanceRewardRow> = {}): GovernanceRewardRow {
  return {
    governanceRewardId: rewardId,
    rewardEventId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    claimedAt: "2026-05-26T22:37:00.000Z",
    rewardType: "bribe",
    token: {
      address: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
      symbol: "AERO",
      iconUrl: null,
    },
    amount: "1250",
    valueUsdAtClaim: "1250.00",
    epochId: "170",
    pool: {
      poolId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      label: "USDC / cbBTC",
    },
    coverageState: "full",
    confidence: "high",
    context: {
      kind: "epoch",
      label: "Epoch 170",
    },
    ...overrides,
  };
}

test("buildEmptyGovernanceSummary keeps mandatory KPI slots present", () => {
  const summary = buildEmptyGovernanceSummary();

  assert.equal(summary.lockedAero.coverageState, "unavailable");
  assert.equal(summary.veAeroExposure.coverageState, "unavailable");
  assert.equal(summary.lockExpiry.remainingDays, null);
  assert.equal(summary.governanceRewardsClaimedUsd.value, null);
  assert.equal(summary.estimatedGovernanceReturn.reasonCodes[0], "explicitReturnUnavailable");
});

test("createGovernanceActiveChips reports active product filters", () => {
  const chips = createGovernanceActiveChips(request({
    eventType: "vote_cast",
    rewardType: "bribe",
    protocolSurface: "voter",
    coverage: "partial",
    confidence: "low",
  }));

  assert.deepEqual(chips.map((chip) => chip.id), ["eventType", "rewardType", "protocolSurface", "coverage", "confidence"]);
});

test("buildLockedGovernanceResponse preserves filters without fabricating data", () => {
  const response = buildLockedGovernanceResponse(request({ rewardType: "bribe" }), {
    status: "queued",
    runId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    completedAt: null,
    isStale: false,
  });

  assert.equal(response.screenKind, "locked");
  assert.equal(response.summary.lockedAero.value, null);
  assert.equal(response.rewards.pagination.totalRows, 0);
  assert.deepEqual(response.filters.activeChips.map((chip) => chip.id), ["rewardType"]);
});

test("buildReadyGovernanceResponse assembles first-screen surfaces from repository data", () => {
  const response = buildReadyGovernanceResponse({
    request: request({ selectedKind: "reward", selectedGovernanceId: rewardId }),
    analysis: readyAnalysis,
    repository: {
      allRewardRows: [reward(), reward({ governanceRewardId: "ffffffff-ffff-4fff-8fff-ffffffffffff", rewardType: "fee", valueUsdAtClaim: "250.00" })],
      rewardRows: [reward()],
      totalRewardRows: 2,
      lockPanel,
      epochs: [{
        epochId: "170",
        epochLabel: "Epoch 170",
        epochStartAt: "2026-05-20T00:00:00.000Z",
        epochEndAt: "2026-05-27T00:00:00.000Z",
        votedPools: [{ poolId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", label: "USDC / cbBTC", weightPercent: "100" }],
        voteMode: "manual",
        resetState: "not_reset",
        rewardState: "claimed",
        feesUsd: "250.00",
        bribesUsd: "1250.00",
        rebasesUsd: null,
        coverageState: "full",
        confidence: "high",
      }],
      events: [],
      metricSnapshot: null,
      availableFilters: { rewardTypes: ["bribe", "fee"], tokens: [], epochs: [], protocolSurfaces: [] },
    },
  });

  assert.equal(response.screenKind, "ready");
  assert.equal(response.summary.lockedAero.value, "2203.245");
  assert.equal(response.summary.governanceRewardsClaimedUsd.valueUsd, "1500.00");
  assert.equal(response.epochTimeline.epochs.length, 1);
  assert.equal(response.rewardBreakdown.segments.length, 2);
  assert.equal(response.selectedDetail.selectionKind, "reward");
  assert.equal(response.rewards.pagination.totalPages, 1);
});
