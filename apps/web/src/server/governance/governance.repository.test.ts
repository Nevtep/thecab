import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  filterGovernanceEvents,
  filterGovernanceRewards,
} from "@/server/governance/governance.repository";
import type {
  GovernanceRepositoryEventRow,
} from "@/server/governance/governance.repository";
import type { GovernanceRequest, GovernanceRewardRow } from "@/server/governance/governance.types";

function request(overrides: Partial<GovernanceRequest> = {}): GovernanceRequest {
  return {
    walletAddress: "0x1111111111111111111111111111111111111111",
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

function reward(overrides: Partial<GovernanceRewardRow> = {}): GovernanceRewardRow {
  return {
    governanceRewardId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    rewardEventId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    governanceEventId: null,
    txHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    claimedAt: "2026-05-30T00:00:00.000Z",
    rewardType: "bribe",
    token: { address: "0x940181a94a35a4569e4529a3cdfb74e38fd98631", symbol: "AERO", iconUrl: null },
    amount: "1",
    valueUsdAtClaim: "1.00",
    epochId: "170",
    pool: { poolId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", label: "USDC / cbBTC" },
    coverageState: "full",
    confidence: "high",
    affectsTotals: true,
    poolAssociation: { status: "explicit", rule: "persisted_explicit_pool_association", reasonCodes: [] },
    doubleCountingNoteKey: null,
    context: { kind: "epoch", label: "Epoch 170" },
    sourceEvidenceRefs: [],
    ...overrides,
  };
}

function event(overrides: Partial<GovernanceRepositoryEventRow> = {}): GovernanceRepositoryEventRow {
  return {
    governanceEventId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    txHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    logIndex: 0,
    eventType: "vote_cast",
    occurredAt: "2026-05-30T00:00:00.000Z",
    protocolSurface: "voter",
    coverageState: "partial",
    confidence: "medium",
    reasonCodes: ["missingVoteWeight"],
    evidenceRefs: [],
    metadata: {},
    ...overrides,
  };
}

test("governance repository stays inside DB-only request-time boundaries", () => {
  const source = readFileSync(resolve(process.cwd(), "src/server/governance/governance.repository.ts"), "utf8");

  assert.match(source, /from "@\/server\/db\/client"/);
  assert.match(source, /from "@\/server\/db\/schema"/);
  assert.doesNotMatch(source, /server\/providers/);
  assert.doesNotMatch(source, /moralis/i);
  assert.doesNotMatch(source, /alchemy/i);
  assert.doesNotMatch(source, /fetch\(/);
  assert.doesNotMatch(source, /http/);
});

test("filterGovernanceRewards composes reward, event, surface, pool, token, coverage, and search filters", () => {
  const bribe = reward();
  const fee = reward({
    governanceRewardId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    rewardType: "fee",
    token: { address: "0x4200000000000000000000000000000000000006", symbol: "WETH", iconUrl: null },
    pool: null,
    coverageState: "partial",
  });

  assert.deepEqual(filterGovernanceRewards([bribe, fee], request({ rewardType: "bribe" })).map((row) => row.governanceRewardId), [bribe.governanceRewardId]);
  assert.deepEqual(filterGovernanceRewards([bribe, fee], request({ eventType: "fee_claim" })).map((row) => row.governanceRewardId), [fee.governanceRewardId]);
  assert.deepEqual(filterGovernanceRewards([bribe, fee], request({ protocolSurface: "briber" })).map((row) => row.governanceRewardId), [bribe.governanceRewardId]);
  assert.deepEqual(filterGovernanceRewards([bribe, fee], request({ poolId: bribe.pool?.poolId ?? "" })).map((row) => row.governanceRewardId), [bribe.governanceRewardId]);
  assert.deepEqual(filterGovernanceRewards([bribe, fee], request({ tokenAddress: "0x4200000000000000000000000000000000000006" })).map((row) => row.governanceRewardId), [fee.governanceRewardId]);
  assert.deepEqual(filterGovernanceRewards([bribe, fee], request({ coverage: "partial" })).map((row) => row.governanceRewardId), [fee.governanceRewardId]);
  assert.deepEqual(filterGovernanceRewards([bribe, fee], request({ search: "cbBTC" })).map((row) => row.governanceRewardId), [bribe.governanceRewardId]);
});

test("filterGovernanceEvents composes event, surface, confidence, coverage, and search filters", () => {
  const vote = event();
  const unsupported = event({
    governanceEventId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    eventType: "unsupported_governance",
    protocolSurface: "unknown",
    coverageState: "unsupported",
    confidence: "low",
    reasonCodes: ["unsupportedGovernanceSurface"],
  });

  assert.deepEqual(filterGovernanceEvents([vote, unsupported], request({ eventType: "vote_cast" })).map((row) => row.governanceEventId), [vote.governanceEventId]);
  assert.deepEqual(filterGovernanceEvents([vote, unsupported], request({ protocolSurface: "unknown" })).map((row) => row.governanceEventId), [unsupported.governanceEventId]);
  assert.deepEqual(filterGovernanceEvents([vote, unsupported], request({ confidence: "low" })).map((row) => row.governanceEventId), [unsupported.governanceEventId]);
  assert.deepEqual(filterGovernanceEvents([vote, unsupported], request({ coverage: "partial" })).map((row) => row.governanceEventId), [vote.governanceEventId]);
  assert.deepEqual(filterGovernanceEvents([vote, unsupported], request({ search: "unsupportedGovernanceSurface" })).map((row) => row.governanceEventId), [unsupported.governanceEventId]);
});

test("governance route stays provider-free and delegates to service", () => {
  const source = readFileSync(resolve(process.cwd(), "src/server/governance/governance.route.ts"), "utf8");

  assert.match(source, /getGovernanceDataView/);
  assert.doesNotMatch(source, /server\/providers/);
  assert.doesNotMatch(source, /moralis/i);
  assert.doesNotMatch(source, /alchemy/i);
  assert.doesNotMatch(source, /fetch\(/);
});
