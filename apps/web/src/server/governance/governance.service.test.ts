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
  GovernanceEpochSummary,
  GovernanceLockPanel,
  GovernanceRequest,
  GovernanceRewardRow,
} from "@/server/governance/governance.types";
import type {
  GovernanceRepositoryEventRow,
  GovernanceRepositoryResult,
} from "@/server/governance/governance.repository";

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

const epoch170: GovernanceEpochSummary = {
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
};

function reward(overrides: Partial<GovernanceRewardRow> = {}): GovernanceRewardRow {
  return {
    governanceRewardId: rewardId,
    rewardEventId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    governanceEventId: null,
    txHash: "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
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
    affectsTotals: true,
    poolAssociation: {
      status: "explicit",
      rule: "persisted_explicit_pool_association",
      reasonCodes: ["explicitPoolAssociationPersisted"],
    },
    doubleCountingNoteKey: "governance:notes.explicitPoolContributionNoDoubleCount",
    context: {
      kind: "epoch",
      label: "Epoch 170",
    },
    sourceEvidenceRefs: [{ provider: "aerodrome", entity: "bribe-claim", id: "170" }],
    ...overrides,
  };
}

function event(overrides: Partial<GovernanceRepositoryEventRow> = {}): GovernanceRepositoryEventRow {
  return {
    governanceEventId: "11111111-1111-4111-8111-111111111111",
    txHash: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    logIndex: 1,
    eventType: "vote_cast",
    occurredAt: "2026-05-26T20:00:00.000Z",
    protocolSurface: "voter",
    coverageState: "partial",
    confidence: "medium",
    reasonCodes: ["missingVoteWeight"],
    evidenceRefs: [{ provider: "etherscan", kind: "logs" }],
    metadata: {
      epochId: "170",
      poolId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      poolLabel: "USDC / cbBTC",
      tokenMovements: [{ tokenSymbol: "AERO", amount: "0", direction: "none" }],
      valueUsd: "0.00",
      governanceClassification: {
        evidenceBasis: ["decodedVoterCall"],
        reasonCodes: ["missingVoteWeight"],
      },
      sourceEvidenceRefs: [{ provider: "moralis", kind: "tx" }],
    },
    ...overrides,
  };
}

function repository(overrides: Partial<GovernanceRepositoryResult> = {}): GovernanceRepositoryResult {
  const primaryReward = reward();
  return {
    allRewardRows: [primaryReward],
    rewardRows: [primaryReward],
    totalRewardRows: 1,
    lockPanel,
    epochs: [epoch170],
    events: [],
    selectedDetailTarget: { kind: "reward", reward: primaryReward },
    metricSnapshot: null,
    availableFilters: { rewardTypes: ["bribe"], tokens: [], epochs: [], protocolSurfaces: [] },
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
    repository: repository({
      allRewardRows: [reward(), reward({ governanceRewardId: "ffffffff-ffff-4fff-8fff-ffffffffffff", rewardType: "fee", valueUsdAtClaim: "250.00" })],
      rewardRows: [reward()],
      totalRewardRows: 2,
      availableFilters: { rewardTypes: ["bribe", "fee"], tokens: [], epochs: [], protocolSurfaces: [] },
    }),
  });

  assert.equal(response.screenKind, "ready");
  assert.equal(response.summary.lockedAero.value, "2203.245");
  assert.equal(response.summary.governanceRewardsClaimedUsd.valueUsd, "1500.00");
  assert.equal(response.epochTimeline.epochs.length, 1);
  assert.equal(response.rewardBreakdown.segments.length, 2);
  assert.equal(response.selectedDetail.selectionKind, "reward");
  assert.equal(response.rewards.pagination.totalPages, 1);
});

test("buildReadyGovernanceResponse reconciles rewardEventId selection and unassociated reward totals", () => {
  const rewardEventId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  const unassociated = reward({
    governanceRewardId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    rewardEventId,
    pool: null,
    coverageState: "partial",
    poolAssociation: {
      status: "unassociated",
      rule: "explicit_pool_evidence_required",
      reasonCodes: ["explicitPoolAssociationUnavailable"],
    },
    doubleCountingNoteKey: "governance:notes.unassociatedRewardNoPoolContribution",
    valueUsdAtClaim: "25.00",
  });
  const response = buildReadyGovernanceResponse({
    request: request({ selectedKind: "reward", selectedGovernanceId: rewardEventId }),
    analysis: readyAnalysis,
    repository: repository({
      allRewardRows: [unassociated],
      rewardRows: [unassociated],
      totalRewardRows: 1,
      epochs: [],
      events: [],
      selectedDetailTarget: { kind: "reward", reward: unassociated },
      availableFilters: { rewardTypes: ["bribe"], tokens: [], epochs: [], protocolSurfaces: [] },
    }),
  });

  assert.equal(response.summary.governanceRewardsClaimedUsd.valueUsd, "25.00");
  assert.equal(response.selectedDetail.selectionId, unassociated.governanceRewardId);
  assert.equal(response.selectedDetail.poolContext, null);
  assert.equal(response.selectedDetail.coverageNotes.affectsTotals, true);
  assert.ok(response.selectedDetail.coverageNotes.reasonCodes.includes("explicitPoolAssociationUnavailable"));
  assert.ok(response.selectedDetail.linkedContexts.some((link) => link.kind === "reward" && link.entityId === rewardEventId));
});

test("buildReadyGovernanceResponse exposes selected reward detail evidence and linked contexts", () => {
  const selected = reward({
    governanceEventId: "11111111-1111-4111-8111-111111111111",
    sourceEvidenceRefs: [
      { provider: "etherscan", kind: "logs", id: "claim" },
      { provider: "etherscan", kind: "logs", id: "claim" },
    ],
  });
  const response = buildReadyGovernanceResponse({
    request: request({ selectedKind: "reward", selectedGovernanceId: selected.governanceRewardId }),
    analysis: readyAnalysis,
    repository: repository({
      allRewardRows: [selected],
      rewardRows: [selected],
      selectedDetailTarget: { kind: "reward", reward: selected },
    }),
  });

  assert.equal(response.selectedDetail.selectionKind, "reward");
  assert.equal(response.selectedDetail.transaction.txHash, selected.txHash);
  assert.deepEqual(response.selectedDetail.tokenMovements[0], {
    tokenSymbol: "AERO",
    tokenAddress: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
    amount: "1250",
    amountUsd: "1250.00",
    direction: "in",
  });
  assert.equal(response.selectedDetail.valueEffect.valueUsd, "1250.00");
  assert.equal((response.selectedDetail.epochContext as { epochId: string }).epochId, "170");
  assert.equal((response.selectedDetail.poolContext as { poolId: string }).poolId, "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee");
  assert.ok(response.selectedDetail.classificationEvidence.basis.includes("rewardEventIdentity"));
  assert.ok(response.selectedDetail.linkedContexts.some((link) => link.kind === "activity" && link.route.includes("governanceEventId=11111111-1111-4111-8111-111111111111")));
  assert.equal(response.selectedDetail.sourceEvidenceRefs.length, 2);
});

test("buildReadyGovernanceResponse keeps partial and unsupported governance events inspectable", () => {
  const unsupported = event({
    eventType: "unsupported_governance",
    protocolSurface: "unknown",
    coverageState: "unsupported",
    confidence: "low",
    reasonCodes: ["unsupportedGovernanceSurface"],
    metadata: {
      governanceClassification: {
        evidenceBasis: ["governanceKeyword"],
        reasonCodes: ["unsupportedGovernanceSurface"],
      },
      sourceEvidenceRefs: [{ provider: "basescan", kind: "tx" }],
    },
  });
  const response = buildReadyGovernanceResponse({
    request: request({ selectedKind: "event", selectedGovernanceId: unsupported.governanceEventId }),
    analysis: readyAnalysis,
    repository: repository({
      allRewardRows: [],
      rewardRows: [],
      totalRewardRows: 0,
      events: [unsupported],
      selectedDetailTarget: { kind: "event", event: unsupported },
    }),
  });

  assert.equal(response.selectedDetail.selectionKind, "event");
  assert.equal(response.selectedDetail.coverageNotes.coverageState, "unsupported");
  assert.equal(response.selectedDetail.coverageNotes.affectsTotals, false);
  assert.deepEqual(response.selectedDetail.classificationEvidence.missingEvidenceReasonCodes, ["unsupportedGovernanceSurface"]);
  assert.ok(response.selectedDetail.linkedContexts.some((link) => link.kind === "activity"));
  assert.ok(response.selectedDetail.sourceEvidenceRefs.some((source) => source.provider === "basescan" && source.kind === "tx"));
});

test("buildReadyGovernanceResponse can select compact epoch details separately from lock and event details", () => {
  const response = buildReadyGovernanceResponse({
    request: request({ selectedKind: "epoch", selectedGovernanceId: "170" }),
    analysis: readyAnalysis,
    repository: repository({
      selectedDetailTarget: { kind: "epoch", epoch: epoch170 },
    }),
  });

  assert.equal(response.selectedDetail.selectionKind, "epoch");
  assert.equal(response.selectedDetail.protocolSurface, "voter");
  assert.equal(response.selectedDetail.valueEffect.valueUsd, "1500.00");
  assert.equal((response.selectedDetail.epochContext as { rewardState: string }).rewardState, "claimed");
  assert.ok(response.selectedDetail.linkedContexts.some((link) => link.kind === "pool" && link.entityId === "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"));
});
