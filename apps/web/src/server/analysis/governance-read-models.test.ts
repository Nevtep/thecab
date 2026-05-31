import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGovernanceEventRows,
  buildGovernanceMetricSnapshot,
  materializeGovernanceEvent,
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
    metadataJson: { source: "fixture" },
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
