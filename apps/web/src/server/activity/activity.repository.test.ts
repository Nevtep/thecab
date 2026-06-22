import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateAvailableActivityFilters,
  mapActivityLedgerRow,
  matchesActivityRequest,
  normalizeEngineV2ActivityRow,
  sortActivityRows,
} from "@/server/activity/activity.repository";
import type { ActivityEventRow, ActivityRequest } from "@/server/activity/activity.types";

const walletAddress = "0x1111111111111111111111111111111111111111";

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

function activity(overrides: Partial<ActivityEventRow> = {}): ActivityEventRow {
  return {
    activityId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    chainId: 8453,
    walletAddress,
    occurredAt: "2026-05-16T14:32:18.000Z",
    txHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    externalTxUrl: "https://basescan.org/tx/0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    action: "claim",
    actionLabelKey: "activity:actions.claim",
    surface: "rewards",
    surfaceLabelKey: "activity:surfaces.rewards",
    coverage: "full",
    confidence: "high",
    confidenceScore: 5,
    valueUsd: "100.00",
    primaryTokenAddress: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
    primaryTokenSymbol: "AERO",
    summary: "Claim AERO",
    reasonCodes: [],
    movements: [],
    linkedEntities: [],
    metadata: {},
    ...overrides,
  };
}

test("mapActivityLedgerRow preserves explicit metadata links and spam exclusion", () => {
  const row = mapActivityLedgerRow({
    activityId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    chainId: 8453,
    walletAddress,
    txHash: "0xca23a1618b416be4f082ae26e59dd9bfcea5e028f00a2cd9f1b8dd95fbff77ea",
    logIndex: 0,
    eventType: "airdrop",
    occurredAt: new Date("2026-05-16T14:32:18.000Z"),
    classification: "spam_airdrop",
    confidence: "low",
    metadataJson: {
      economicExclusionReason: "airdrop_spam",
      poolId: "33333333-3333-4333-8333-333333333333",
      poolLabel: "WETH / cbBTC-100",
    },
  }, []);

  assert.equal(row.action, "airdrop");
  assert.equal(row.coverage, "excluded");
  assert.equal(row.confidence, "none");
  assert.ok(row.reasonCodes.includes("airdrop_spam"));
  assert.equal(row.linkedEntities[0]?.kind, "pool");
  assert.equal(row.linkedEntities[0]?.entityId, "33333333-3333-4333-8333-333333333333");
  assert.equal(row.linkedEntities[0]?.href, "/pools/33333333-3333-4333-8333-333333333333?chainId=8453");
});

test("mapActivityLedgerRow links governance entities and governance filters match explicit evidence", () => {
  const governanceEventId = "77777777-7777-4777-8777-777777777777";
  const row = mapActivityLedgerRow({
    activityId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    chainId: 8453,
    walletAddress,
    txHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    logIndex: 0,
    eventType: "governance_vote",
    occurredAt: new Date("2026-05-16T14:32:18.000Z"),
    classification: "governance_vote",
    confidence: "high",
    metadataJson: {
      governanceEventId,
      governanceLabel: "Epoch 170 vote",
      sourceSurface: "governance",
      coverageStatus: "full",
    },
  }, []);

  const governanceEntity = row.linkedEntities.find((entity) => entity.kind === "governance");
  assert.equal(governanceEntity?.entityId, governanceEventId);
  assert.equal(
    governanceEntity?.href,
    `/governance?chainId=8453&kind=event&selected=${governanceEventId}&governanceEventId=${governanceEventId}`,
  );
  assert.equal(matchesActivityRequest(row, request({ governanceEventId })), true);
  assert.equal(matchesActivityRequest(row, request({ governanceEventId: "88888888-8888-4888-8888-888888888888" })), false);
});

test("matchesActivityRequest and sortActivityRows compose filters without mutating rows", () => {
  const poolId = "33333333-3333-4333-8333-333333333333";
  const full = activity({
    activityId: "a",
    valueUsd: "100.00",
    coverage: "full",
    confidence: "high",
    confidenceScore: 5,
    linkedEntities: [{ kind: "pool", entityId: poolId, label: "WETH / cbBTC-100", href: `/pools/${poolId}?chainId=8453`, reasonCode: "explicitPoolEvidence" }],
  });
  const excluded = activity({ activityId: "b", valueUsd: "20.00", coverage: "excluded", action: "airdrop", confidence: "none", confidenceScore: 0 });
  assert.equal(matchesActivityRequest(excluded, request({ coverage: "excluded" })), true);
  assert.equal(matchesActivityRequest(full, request({ coverage: "excluded" })), false);
  assert.equal(matchesActivityRequest(full, request({ poolId })), true);
  assert.equal(matchesActivityRequest(excluded, request({ poolId })), false);

  const sorted = sortActivityRows([full, excluded], request({ sort: { key: "valueUsd", direction: "asc" } }));
  assert.deepEqual(sorted.map((row) => row.activityId), ["b", "a"]);
});

test("calculateAvailableActivityFilters derives distinct options", () => {
  const filters = calculateAvailableActivityFilters([
    activity({ action: "claim", surface: "rewards" }),
    activity({ action: "deposit", surface: "deposits", primaryTokenSymbol: "USDC" }),
  ]);

  assert.deepEqual(filters.actions, ["claim", "deposit"]);
  assert.deepEqual(filters.surfaces, ["deposits", "rewards"]);
  assert.equal(filters.tokens.length, 1);
});

test("normalizeEngineV2ActivityRow keeps deterministic Engine V2 taxonomy out of ambiguous", () => {
  const approval = normalizeEngineV2ActivityRow({
    activityId: "approval-1",
    chainId: 8453,
    walletAddress,
    txHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    action: "approval_position_manager",
    surface: "approval",
    coverage: "full",
    confidence: "high",
    occurredAt: "2026-03-05T15:05:00.000Z",
  } as Record<string, unknown>);
  const failed = normalizeEngineV2ActivityRow({
    activityId: "failed-1",
    chainId: 8453,
    walletAddress,
    txHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    action: "failed_transaction",
    surface: "activity",
    coverage: "full",
    confidence: "high",
    occurredAt: "2026-03-05T15:02:00.000Z",
  } as Record<string, unknown>);
  const mint = normalizeEngineV2ActivityRow({
    activityId: "mint-1",
    chainId: 8453,
    walletAddress,
    txHash: "0x77a9a087a8eb7ac5136a7da2353eeb35971b5ac8b0afbeb607b5c38c1ee8f9c5",
    action: "manual_position_created",
    surface: "deposit",
    coverage: "partial",
    confidence: "high",
    occurredAt: "2026-03-05T14:45:00.000Z",
    selectedDetail: {
      summary: "Mint CL position",
      tokenMovements: [
        { direction: "out", tokenAddress: "0x4200000000000000000000000000000000000006", tokenSymbol: "WETH", amountRaw: "9288602382803244000", amountUsd: "28039.31" },
      ],
    },
  } as Record<string, unknown>);

  assert.equal(approval.action, "approval");
  assert.equal(failed.action, "failed");
  assert.equal(mint.action, "position_created");
  assert.doesNotMatch(mint.summary, /^ambiguous:/);
});
