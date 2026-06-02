import assert from "node:assert/strict";
import test from "node:test";

import { buildEngineV2DiagnosticsArtifact } from "@/server/analysis/engine-v2/regression/diagnostics";

test("buildEngineV2DiagnosticsArtifact summarizes classifications, confidence, and unresolved selectors", () => {
  const artifact = buildEngineV2DiagnosticsArtifact({
    rows: [
      {
        id: "row-1",
        canonicalTransactionId: "tx-1",
        chainId: 8453,
        walletAddress: "0x0000000000000000000000000000000000000001",
        txHash: "0xaaa",
        occurredAt: new Date("2026-01-02T00:00:00.000Z"),
        blockNumber: "1",
        transactionIndex: 1,
        sequenceIndex: 1,
        fromAddress: null,
        toAddress: null,
        selector: "0x12345678",
        contractLabel: "Gauge",
        contractName: "CLGauge",
        decodedFunction: "getReward",
        decodedArgsJson: [],
        transferCount: 0,
        inboundTransferCount: 0,
        outboundTransferCount: 0,
        approvalCount: 0,
        classification: "protocol_contract_call_unmapped",
        classifierVersion: "v2",
        confidence: "medium",
        reason: "missing selector mapping",
        needsResolution: true,
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      },
      {
        id: "row-2",
        canonicalTransactionId: "tx-2",
        chainId: 8453,
        walletAddress: "0x0000000000000000000000000000000000000001",
        txHash: "0xbbb",
        occurredAt: new Date("2026-01-03T00:00:00.000Z"),
        blockNumber: "2",
        transactionIndex: 2,
        sequenceIndex: 2,
        fromAddress: null,
        toAddress: null,
        selector: "0x12345678",
        contractLabel: "Gauge",
        contractName: "CLGauge",
        decodedFunction: "getReward",
        decodedArgsJson: [],
        transferCount: 0,
        inboundTransferCount: 0,
        outboundTransferCount: 0,
        approvalCount: 0,
        classification: "protocol_contract_call_unmapped",
        classifierVersion: "v2",
        confidence: "low",
        reason: "missing selector mapping",
        needsResolution: true,
        createdAt: new Date("2026-01-03T00:00:00.000Z"),
        updatedAt: new Date("2026-01-03T00:00:00.000Z"),
      },
      {
        id: "row-3",
        canonicalTransactionId: "tx-3",
        chainId: 8453,
        walletAddress: "0x0000000000000000000000000000000000000001",
        txHash: "0xccc",
        occurredAt: new Date("2026-01-04T00:00:00.000Z"),
        blockNumber: "3",
        transactionIndex: 3,
        sequenceIndex: 3,
        fromAddress: null,
        toAddress: null,
        selector: "0xdeadbeef",
        contractLabel: "Voting Escrow",
        contractName: "VotingEscrow",
        decodedFunction: "createLock",
        decodedArgsJson: [],
        transferCount: 1,
        inboundTransferCount: 1,
        outboundTransferCount: 0,
        approvalCount: 0,
        classification: "governance_lock_create",
        classifierVersion: "v2",
        confidence: "high",
        reason: "explicit governance lock create",
        needsResolution: false,
        createdAt: new Date("2026-01-04T00:00:00.000Z"),
        updatedAt: new Date("2026-01-04T00:00:00.000Z"),
      },
    ],
    selectorLimit: 10,
    exampleLimit: 10,
  });

  assert.equal(artifact.summary.transactionCount, 3);
  assert.equal(artifact.summary.needsResolutionCount, 2);
  assert.equal(artifact.summary.byClassification.protocol_contract_call_unmapped, 2);
  assert.equal(artifact.summary.byClassification.governance_lock_create, 1);
  assert.equal(artifact.summary.byConfidence.high, 1);
  assert.equal(artifact.unresolvedSelectors.length, 1);
  assert.equal(artifact.unresolvedSelectors[0]?.selector, "0x12345678");
  assert.equal(artifact.unresolvedSelectors[0]?.txCount, 2);
  assert.deepEqual(artifact.unresolvedSelectors[0]?.decodedFunctions, ["getReward"]);
  assert.equal(artifact.examples[0]?.txHash, "0xbbb");
  assert.equal(artifact.examples[0]?.needsResolution, true);
});