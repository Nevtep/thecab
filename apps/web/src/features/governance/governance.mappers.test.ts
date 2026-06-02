import assert from "node:assert/strict";
import test from "node:test";

import { mapGovernanceResponseToViewModel } from "@/features/governance/governance.mappers";
import type { GovernanceResponse } from "@/server/governance/governance.types";

const response: GovernanceResponse = {
  screenKind: "ready",
  walletAddress: "0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD",
  chainId: 8453,
  analysis: {
    status: "ready",
    runId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    completedAt: "2026-05-30T00:00:00.000Z",
    isStale: false,
  },
  filters: {
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
    activeChips: [],
  },
  summary: {
    lockedAero: { value: "1000", valueUsd: "1000.00", coverageState: "full", confidence: "high", reasonCodes: ["ok", "ok"] },
    veAeroExposure: { value: "900", valueUsd: null, coverageState: "full", confidence: "high", reasonCodes: [] },
    lockExpiry: { expiresAt: "2027-05-01T00:00:00.000Z", remainingDays: 300, coverageState: "full", confidence: "high", reasonCodes: [] },
    governanceRewardsClaimedUsd: { value: "15.00", valueUsd: "15.00", coverageState: "partial", confidence: "medium", reasonCodes: [] },
    estimatedGovernanceReturn: { value: null, valueUsd: null, coverageState: "unavailable", confidence: "none", reasonCodes: ["explicitReturnUnavailable"] },
    overallCoverage: { coverageState: "partial", confidence: "medium", reasonCodes: ["partial", "partial"] },
  },
  locks: {
    rows: [
      {
        lockExposureId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        lockId: "170",
        lockKind: "direct",
        status: "active",
        createdAt: "2026-05-02T00:00:00.000Z",
        expiresAt: "2027-05-02T00:00:00.000Z",
        managedTokenId: null,
        lockedAeroAmount: "1000",
        lockedAeroValueUsd: "1000.00",
        veAeroExposure: "900",
        coverageState: "full",
        confidence: "high",
        reasonCodes: ["ok", "ok"],
        lifecycle: [
          {
            eventId: "late",
            eventType: "lock_extended",
            occurredAt: "2026-05-03T00:00:00.000Z",
            amountDelta: null,
            durationDeltaDays: 30,
            coverageState: "full",
            confidence: "high",
          },
          {
            eventId: "early",
            eventType: "lock_created",
            occurredAt: "2026-05-01T00:00:00.000Z",
            amountDelta: "1000",
            durationDeltaDays: null,
            coverageState: "full",
            confidence: "high",
          },
        ],
      },
    ],
    primaryLockId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  },
  lockPanel: {
    lockExposureId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    lockId: "170",
    lockKind: "direct",
    status: "active",
    createdAt: "2026-05-02T00:00:00.000Z",
    expiresAt: "2027-05-02T00:00:00.000Z",
    managedTokenId: null,
    lockedAeroAmount: "1000",
    lockedAeroValueUsd: "1000.00",
    veAeroExposure: "900",
    coverageState: "full",
    confidence: "high",
    reasonCodes: ["ok", "ok"],
    lifecycle: [
      {
        eventId: "late",
        eventType: "lock_extended",
        occurredAt: "2026-05-03T00:00:00.000Z",
        amountDelta: null,
        durationDeltaDays: 30,
        coverageState: "full",
        confidence: "high",
      },
      {
        eventId: "early",
        eventType: "lock_created",
        occurredAt: "2026-05-01T00:00:00.000Z",
        amountDelta: "1000",
        durationDeltaDays: null,
        coverageState: "full",
        confidence: "high",
      },
    ],
  },
  epochTimeline: {
    epochs: [
      {
        epochId: "171",
        epochLabel: "Epoch 171",
        epochStartAt: "2026-05-27T00:00:00.000Z",
        epochEndAt: null,
        votedPools: [],
        voteMode: "manual",
        resetState: "unknown",
        rewardState: "pending",
        feesUsd: null,
        bribesUsd: null,
        rebasesUsd: null,
        coverageState: "partial",
        confidence: "medium",
      },
      {
        epochId: "170",
        epochLabel: "Epoch 170",
        epochStartAt: "2026-05-20T00:00:00.000Z",
        epochEndAt: null,
        votedPools: [],
        voteMode: "manual",
        resetState: "not_reset",
        rewardState: "claimed",
        feesUsd: null,
        bribesUsd: null,
        rebasesUsd: null,
        coverageState: "full",
        confidence: "high",
      },
    ],
  },
  rewardBreakdown: {
    totalValueUsd: "1250.00",
    coverageState: "full",
    segments: [
      { rewardType: "fee", valueUsd: "250.00", percent: "20.00", coverageState: "full" },
      { rewardType: "bribe", valueUsd: "1000.00", percent: "80.00", coverageState: "full" },
    ],
  },
  rewards: {
    rows: [
      {
        governanceRewardId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        rewardEventId: null,
        governanceEventId: null,
        txHash: null,
        claimedAt: "2026-05-20T00:00:00.000Z",
        rewardType: "fee",
        token: { address: null, symbol: "USDC", iconUrl: null },
        amount: "250",
        valueUsdAtClaim: "250.00",
        epochId: "170",
        pool: null,
        coverageState: "full",
        confidence: "high",
        affectsTotals: true,
        poolAssociation: { status: "unassociated", rule: "explicit_pool_evidence_required", reasonCodes: [] },
        doubleCountingNoteKey: null,
        context: { kind: "epoch", label: "Epoch 170" },
        sourceEvidenceRefs: [],
      },
      {
        governanceRewardId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        rewardEventId: null,
        governanceEventId: null,
        txHash: null,
        claimedAt: "2026-05-26T00:00:00.000Z",
        rewardType: "bribe",
        token: { address: null, symbol: "AERO", iconUrl: null },
        amount: "1000",
        valueUsdAtClaim: "1000.00",
        epochId: "170",
        pool: null,
        coverageState: "full",
        confidence: "high",
        affectsTotals: true,
        poolAssociation: { status: "unassociated", rule: "explicit_pool_evidence_required", reasonCodes: [] },
        doubleCountingNoteKey: null,
        context: { kind: "epoch", label: "Epoch 170" },
        sourceEvidenceRefs: [],
      },
    ],
    pagination: { page: 1, pageSize: 10, totalRows: 2, totalPages: 1 },
  },
  selectedDetail: {
    selectionKind: "reward",
    selectionId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    actionSummary: { labelKey: "governance:rewards.bribe", contextLabel: "Epoch 170" },
    transaction: { txHash: null, occurredAt: null, externalTxUrl: null },
    protocolSurface: "unknown",
    tokenMovements: [],
    valueEffect: { valueUsd: "1000.00", coverageState: "full" },
    epochContext: null,
    poolContext: null,
    classificationEvidence: { basis: ["persisted", "persisted"], reasonCodes: [], missingEvidenceReasonCodes: [] },
    linkedContexts: [
      { kind: "activity", entityId: "event-1", route: "/activity?governanceEventId=event-1" },
      { kind: "activity", entityId: "event-1", route: "/activity?governanceEventId=event-1" },
    ],
    coverageNotes: { coverageState: "full", confidence: "high", affectsTotals: true, reasonCodes: [] },
    sourceEvidenceRefs: [
      { provider: "etherscan", kind: "logs" },
      { kind: "logs", provider: "etherscan" },
    ],
  },
  availableFilters: {},
};

test("mapGovernanceResponseToViewModel normalizes identity, reason codes, and ordering", () => {
  const viewModel = mapGovernanceResponseToViewModel(response);

  assert.equal(viewModel.walletAddress, response.walletAddress.toLowerCase());
  assert.deepEqual(viewModel.summary.lockedAero.reasonCodes, ["ok"]);
  assert.deepEqual(viewModel.summary.overallCoverage.reasonCodes, ["partial"]);
  assert.equal(viewModel.locks.rows.length, 1);
  assert.equal(viewModel.locks.rows[0]?.lockKind, "direct");
  assert.equal(viewModel.lockPanel?.lifecycle[0]?.eventId, "early");
  assert.deepEqual(viewModel.epochTimeline.epochs.map((epoch) => epoch.epochId), ["170", "171"]);
  assert.deepEqual(viewModel.rewardBreakdown.segments.map((segment) => segment.rewardType), ["bribe", "fee"]);
  assert.deepEqual(viewModel.rewards.rows.map((row) => row.rewardType), ["bribe", "fee"]);
  assert.deepEqual(viewModel.rewards.rows.map((row) => row.poolAssociation.status), ["unassociated", "unassociated"]);
  assert.deepEqual(viewModel.selectedDetail.classificationEvidence.basis, ["persisted"]);
  assert.equal(viewModel.selectedDetail.linkedContexts.length, 1);
  assert.equal(viewModel.selectedDetail.sourceEvidenceRefs.length, 1);
});

test("mapGovernanceResponseToViewModel preserves no-results and selected-unavailable state", () => {
  const noResults = mapGovernanceResponseToViewModel({
    ...response,
    screenKind: "empty",
    filters: {
      ...response.filters,
      search: "missing",
      activeChips: [{ id: "search", labelKey: "governance:filters.searchPlaceholder", value: "missing", removeTarget: "search" }],
    },
    rewards: {
      rows: [],
      pagination: { page: 1, pageSize: 10, totalRows: 0, totalPages: 0 },
    },
    selectedDetail: {
      ...response.selectedDetail,
      selectionKind: "empty",
      selectionId: null,
    },
  });

  assert.equal(noResults.screenKind, "empty");
  assert.equal(noResults.rewards.rows.length, 0);
  assert.equal(noResults.filters.activeChips[0]?.id, "search");
  assert.equal(noResults.selectedDetail.selectionKind, "empty");
});
