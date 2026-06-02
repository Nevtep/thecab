import assert from "node:assert/strict";
import test from "node:test";

import { emptyMaterializationContext } from "@/server/analysis/engine-v2/materializers/load-materialization-context";
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
  const persisted: unknown[] = [];
  let accountingPayload: Record<string, unknown> | null = null;
  const result = await runEngineV2AccountChronological(payload, {
    loadAccountingInput: async () => ({
      events: [
        ...events,
        {
          id: "gov-managed",
          chainId: 8453,
          walletAddress: payload.walletAddress,
          eventType: "governance_deposit_managed",
          eventFamily: "governance",
          occurredAt: new Date("2026-01-03T00:00:00.000Z"),
          txHash: "0x3",
          sequenceIndex: 2,
          coverageStatus: "full",
          confidence: "high",
          reasonCodes: [],
          metadataJson: {
            votingEscrowAddress: "0x00000000000000000000000000000000000000aa",
            lockTokenId: "113464",
            managedTokenId: "10298",
          },
        },
        {
          id: "gov-claim",
          chainId: 8453,
          walletAddress: payload.walletAddress,
          eventType: "governance_fee_claim",
          eventFamily: "governance",
          occurredAt: new Date("2026-01-04T00:00:00.000Z"),
          txHash: "0x4",
          sequenceIndex: 3,
          coverageStatus: "partial",
          confidence: "medium",
          reasonCodes: ["missing_distributor_pool_link"],
          metadataJson: {
            rewardId: "claim:0",
            rewardType: "governance_fee",
            lockTokenId: "113464",
            amountRaw: "100",
            amountUsd: "5",
            itemIndex: 0,
          },
        },
      ],
      links: [
        { domainEventId: "gov-managed", entityType: "governance_lock", entityId: "lock-113464" },
        { domainEventId: "gov-claim", entityType: "governance_lock", entityId: "lock-113464" },
      ],
    }),
    loadMaterializationContext: async () => emptyMaterializationContext(),
    persistAccounting: async (input) => {
      accountingPayload = input as unknown as Record<string, unknown>;
    },
    persistRows: async ({ rows }) => {
      persisted.push(...rows);
    },
    trigger: async () => undefined,
  });
  const persistedAccounting = accountingPayload as {
    governance?: { locks?: unknown[]; managedLinks?: unknown[] };
    rewards?: unknown[];
  } | null;

  assert.equal(result.eventCount, 4);
  assert.equal(result.cashFlowCount, 2);
  assert.ok(Array.isArray(persistedAccounting?.governance?.locks));
  assert.equal(persistedAccounting?.governance?.managedLinks?.length, 1);
  assert.equal(persistedAccounting?.rewards?.length, 1);
  assert.ok(persisted.length > 0);
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

test("runEngineV2MaterializeReadModels can finalize from already-persisted rows without reloading accounting", async () => {
  const finalizeCalls: Array<Record<string, unknown>> = [];

  const result = await runEngineV2MaterializeReadModels({
    ...payload,
    analysisRunId: "00000000-0000-4000-8000-000000000001",
    rowsAlreadyPersisted: true,
  }, {
    updateRunProgress: async () => ({ } as never),
    loadAccountingInput: async () => {
      throw new Error("should not reload accounting");
    },
    loadMaterializedRowStats: async () => ({
      rowCount: 2,
      bySurface: { activity: 2 },
      coverage: "full",
      coverageReasonsJson: [],
    }),
    finalizeRun: async (input) => {
      finalizeCalls.push(input as unknown as Record<string, unknown>);
      return undefined as never;
    },
  });

  assert.equal(result.rowCount, 2);
  assert.equal(result.bySurface.activity, 2);
  assert.equal(finalizeCalls.length, 1);
});
