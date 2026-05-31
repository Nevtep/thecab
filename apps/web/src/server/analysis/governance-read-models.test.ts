import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGovernanceEventRows,
  buildGovernanceMetricSnapshot,
  buildGovernanceRewardRows,
  materializeGovernanceEvent,
  materializeGovernanceReward,
  resolveGovernanceRewardPoolAssociation,
} from "@/server/analysis/governance-read-models";

test("materializeGovernanceEvent writes chain-scoped governance event metadata", () => {
  const occurredAt = new Date("2026-05-30T12:00:00.000Z");
  const row = materializeGovernanceEvent({
    id: "ledger-1",
    chainId: 8453,
    walletAddress: "0xABCDEFabcdefABCDEFabcdefABCDEFabcdefabcd",
    txHash: "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    logIndex: 2,
    eventType: "token_receive",
    occurredAt,
    surfaceKind: "governance_bribe_claim",
    metadataJson: {
      source: "fixture",
      epochId: "170",
      poolId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      poolLabel: "USDC / cbBTC",
      tokenMovements: [{ tokenSymbol: "AERO", amount: "0", direction: "none" }],
      evidenceRefs: [{ provider: "aerodrome", kind: "vote" }],
    },
  });

  assert.ok(row);
  assert.equal(row.chainId, 8453);
  assert.equal(row.walletAddress, "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd");
  assert.equal(row.txHash, "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  assert.equal(row.eventType, "bribe_claim");
  assert.equal(row.metadataJson.sourceLedgerEventId, "ledger-1");
  assert.deepEqual(
    (row.metadataJson.governanceClassification as { evidenceBasis: string[] }).evidenceBasis,
    ["surfaceKind:governance_bribe_claim"],
  );
  const selectedDetail = row.metadataJson.selectedDetail as {
    selectionKind: string;
    tokenMovements: Array<Record<string, unknown>>;
    epochContext: { epochId: string } | null;
    poolContext: { poolId: string } | null;
    sourceEvidenceRefs: Array<Record<string, unknown>>;
  };
  assert.equal(selectedDetail.selectionKind, "event");
  assert.equal(selectedDetail.tokenMovements[0]?.tokenSymbol, "AERO");
  assert.equal(selectedDetail.epochContext?.epochId, "170");
  assert.equal(selectedDetail.poolContext?.poolId, "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee");
  assert.equal(selectedDetail.sourceEvidenceRefs.length, 1);
});

test("buildGovernanceEventRows drops non-governance rows", () => {
  const rows = buildGovernanceEventRows([
    {
      chainId: 8453,
      walletAddress: "0x0000000000000000000000000000000000000001",
      txHash: "0x1",
      logIndex: 0,
      eventType: "transfer",
      occurredAt: new Date("2026-05-30T12:00:00.000Z"),
      summary: "Generic transfer",
    },
    {
      chainId: 8453,
      walletAddress: "0x0000000000000000000000000000000000000001",
      txHash: "0x2",
      logIndex: 0,
      eventType: "vote",
      occurredAt: new Date("2026-05-30T12:01:00.000Z"),
      summary: "Gauge vote on Aerodrome voter",
    },
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.eventType, "vote_cast");
});

test("buildGovernanceMetricSnapshot keeps KPI placeholders present for partial data", () => {
  const rows = buildGovernanceEventRows([
    {
      chainId: 8453,
      walletAddress: "0x0000000000000000000000000000000000000001",
      txHash: "0x2",
      logIndex: 0,
      eventType: "vote",
      occurredAt: new Date("2026-05-30T12:01:00.000Z"),
      summary: "Gauge vote on Aerodrome voter",
    },
  ]);
  const snapshot = buildGovernanceMetricSnapshot({
    chainId: 8453,
    walletAddress: "0x0000000000000000000000000000000000000001",
    rows,
  });

  assert.equal(snapshot.summaryJson.totalEvents, 1);
  assert.equal(snapshot.summaryJson.lockedAero, null);
  assert.equal(snapshot.coverageStatus, "partial");
  assert.equal(snapshot.selectedDetailJson?.txHash, "0x2");
});

test("materializeGovernanceReward keeps rewardEventId identity and explicit pool association evidence", () => {
  const row = materializeGovernanceReward({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    chainId: 8453,
    walletAddress: "0xABCDEFabcdefABCDEFabcdefABCDEFabcdefabcd",
    txHash: "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
    logIndex: 4,
    rewardType: "governance_bribe_claim",
    resolutionBasis: "governance_reward",
    resolutionReasonCodes: ["explicitGovernanceOwner"],
    tokenAddress: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
    amountRaw: "1000000000000000000",
    amountUsd: "1.25",
    occurredAt: new Date("2026-05-30T12:00:00.000Z"),
    resolutionStatus: "resolved",
    resolvedPoolId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    metadataJson: {
      sourceSurface: "governance_bribe_claim",
      epochId: "170",
      tokenSymbol: "AERO",
      amountFormatted: "1.0",
      evidenceRefs: [{ provider: "etherscan", kind: "logs" }],
    },
  });

  assert.ok(row);
  assert.equal(row.rewardEventId, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  assert.equal(row.rewardType, "bribe");
  assert.equal(row.poolId, "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee");
  assert.equal(row.coverageStatus, "full");
  assert.equal(row.affectsTotals, true);
  assert.equal((row.contextJson.poolAssociation as { rule: string }).rule, "persisted_explicit_pool_association");
  const selectedDetail = row.evidenceJson.selectedDetail as {
    selectionKind: string;
    tokenMovements: Array<Record<string, unknown>>;
    valueEffect: { valueUsd: string | null };
    epochContext: { epochId: string } | null;
    poolContext: { poolId: string } | null;
    sourceEvidenceRefs: Array<Record<string, unknown>>;
  };
  assert.equal(selectedDetail.selectionKind, "reward");
  assert.equal(selectedDetail.tokenMovements[0]?.tokenSymbol, "AERO");
  assert.equal(selectedDetail.valueEffect.valueUsd, "1.25");
  assert.equal(selectedDetail.epochContext?.epochId, "170");
  assert.equal(selectedDetail.poolContext?.poolId, "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee");
  assert.equal(selectedDetail.sourceEvidenceRefs.length, 1);
});

test("materializeGovernanceReward leaves unassociated governance rewards visible but partial", () => {
  const row = materializeGovernanceReward({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    chainId: 8453,
    walletAddress: "0x0000000000000000000000000000000000000001",
    txHash: "0xcccc",
    logIndex: 0,
    rewardType: "governance_fee_claim",
    resolutionBasis: "governance_reward",
    resolutionReasonCodes: ["explicitGovernanceOwner"],
    tokenAddress: null,
    amountRaw: null,
    amountUsd: "25.00",
    occurredAt: new Date("2026-05-30T12:00:00.000Z"),
    resolutionStatus: "resolved",
    resolvedPoolId: null,
    metadataJson: { sourceSurface: "governance_fee_claim" },
  });

  assert.ok(row);
  assert.equal(row.poolId, null);
  assert.equal(row.coverageStatus, "partial");
  assert.equal(row.affectsTotals, true);
  assert.deepEqual(
    (row.contextJson.poolAssociation as { reasonCodes: string[] }).reasonCodes,
    ["explicitPoolAssociationUnavailable"],
  );
});

test("buildGovernanceRewardRows drops non-governance rewards", () => {
  const rows = buildGovernanceRewardRows([
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      chainId: 8453,
      walletAddress: "0x0000000000000000000000000000000000000001",
      txHash: "0x1",
      logIndex: 0,
      rewardType: "reward_claim",
      resolutionBasis: "manual_deposit",
      resolutionReasonCodes: [],
      tokenAddress: null,
      amountRaw: null,
      amountUsd: null,
      occurredAt: new Date("2026-05-30T12:00:00.000Z"),
      resolutionStatus: "resolved",
      resolvedPoolId: null,
      metadataJson: { sourceSurface: "manual_deposit" },
    },
  ]);

  assert.deepEqual(rows, []);
});

test("resolveGovernanceRewardPoolAssociation requires persisted pool evidence", () => {
  const association = resolveGovernanceRewardPoolAssociation({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    chainId: 8453,
    walletAddress: "0x0000000000000000000000000000000000000001",
    txHash: "0x1",
    logIndex: 0,
    rewardType: "governance_bribe_claim",
    resolutionBasis: "governance_reward",
    resolutionReasonCodes: [],
    tokenAddress: null,
    amountRaw: null,
    amountUsd: "1.00",
    occurredAt: new Date("2026-05-30T12:00:00.000Z"),
    resolutionStatus: "resolved",
    resolvedPoolId: null,
    metadataJson: { sourceSurface: "governance_bribe_claim" },
  });

  assert.equal(association.poolId, null);
  assert.deepEqual(association.reasonCodes, ["explicitPoolAssociationUnavailable"]);
});
