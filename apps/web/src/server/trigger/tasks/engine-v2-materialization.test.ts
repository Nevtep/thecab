import assert from "node:assert/strict";
import test from "node:test";

import { runEngineV2AccountChronological, runEngineV2MaterializeReadModels } from "./engine-v2-materialization.task";

const payload = {
  chainId: 8453,
  walletAddress: "0x0000000000000000000000000000000000000001",
  mode: "fixture",
};

const events = [
  {
    id: "newer",
    chainId: 8453,
    walletAddress: payload.walletAddress,
    eventType: "cash_in",
    eventFamily: "cashflow",
    occurredAt: new Date("2026-01-02T00:00:00.000Z"),
    txHash: "0x2",
    sequenceIndex: 1,
    coverageStatus: "full",
    confidence: "high",
    reasonCodes: [],
    evidenceJson: { movements: [{ direction: "in", tokenAddress: "0x00000000000000000000000000000000000000aa", amountRaw: "1" }] },
  },
  {
    id: "older",
    chainId: 8453,
    walletAddress: payload.walletAddress,
    eventType: "cash_in",
    eventFamily: "cashflow",
    occurredAt: new Date("2026-01-01T00:00:00.000Z"),
    txHash: "0x1",
    sequenceIndex: 0,
    coverageStatus: "full",
    confidence: "high",
    reasonCodes: [],
    evidenceJson: { movements: [{ direction: "in", tokenAddress: "0x00000000000000000000000000000000000000aa", amountRaw: "1" }] },
  },
];

test("runEngineV2AccountChronological accounts loaded events in chronological order", async () => {
  const result = await runEngineV2AccountChronological(payload, {
    loadAccountingInput: async () => ({ events }),
    persistAccounting: async () => undefined,
    trigger: async () => undefined,
  });

  assert.equal(result.eventCount, 2);
  assert.equal(result.cashFlowCount, 2);
});

test("runEngineV2MaterializeReadModels persists rows and reports surface counts", async () => {
  const persisted: unknown[] = [];
  const result = await runEngineV2MaterializeReadModels(payload, {
    loadAccountingInput: async () => ({ events }),
    persistRows: async ({ rows }) => {
      persisted.push(...rows);
    },
    finalizeRun: async () => undefined as never,
  });

  assert.equal(result.bySurface.activity, 2);
  assert.equal(persisted.length, result.rowCount);
});
