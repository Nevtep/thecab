import assert from "node:assert/strict";
import test from "node:test";

import {
  knownAddressKindToLockProvenance,
  pickClosestHistoricalPricePoint,
  runEngineV2RunEnrichmentBatch,
} from "./engine-v2-enrichment.task";

const walletAddress = "0x0000000000000000000000000000000000000001";

test("runEngineV2RunEnrichmentBatch respects bounded batches and unresolved outcomes", async () => {
  const result = await runEngineV2RunEnrichmentBatch({
    chainId: 8453,
    walletAddress,
    limit: 1,
  }, {
    loadQueuedNeeds: async () => [
      {
        chainId: 8453,
        walletAddress,
        needType: "historical_price",
        targetType: "transaction",
        targetId: "0x1",
      },
      {
        chainId: 8453,
        walletAddress,
        needType: "abi",
        targetType: "contract",
        targetId: "0x2",
      },
    ],
    resolveNeed: async () => "unresolved",
    trigger: async () => undefined,
  });

  assert.deepEqual(result, {
    attemptedCount: 1,
    resolvedCount: 0,
    unresolvedCount: 1,
    failedCount: 0,
  });
});

test("runEngineV2RunEnrichmentBatch requeues enrichment while blocking needs remain", async () => {
  const triggered: string[] = [];
  let loadCount = 0;

  const result = await runEngineV2RunEnrichmentBatch({
    chainId: 8453,
    walletAddress,
    limit: 1,
  }, {
    loadQueuedNeeds: async ({ needTypes }) => {
      loadCount += 1;
      if (loadCount === 1) {
        return [
          {
            id: "need-1",
            chainId: 8453,
            walletAddress,
            needType: "historical_price",
            targetType: "token",
            targetId: "0x1",
          },
          {
            id: "need-2",
            chainId: 8453,
            walletAddress,
            needType: "pool_definition",
            targetType: "pool",
            targetId: "0x2",
          },
        ];
      }

      assert.deepEqual(needTypes, [
        "abi",
        "selector",
        "log_decode",
        "historical_price",
        "pool_definition",
        "lock_identity",
        "distributor_pool_link",
        "strategy_state",
        "transaction_decoded_backfill",
      ]);
      return [{
        id: "need-2",
        chainId: 8453,
        walletAddress,
        needType: "pool_definition",
        targetType: "pool",
        targetId: "0x2",
      }];
    },
    resolveNeed: async () => "resolved",
    trigger: async (taskId) => {
      triggered.push(taskId);
    },
  });

  assert.deepEqual(result, {
    attemptedCount: 1,
    resolvedCount: 1,
    unresolvedCount: 0,
    failedCount: 0,
  });
  assert.deepEqual(triggered, ["engine-v2-run-enrichment-batch"]);
});

test("runEngineV2RunEnrichmentBatch triggers accounting once only non-blocking needs remain", async () => {
  const triggered: string[] = [];
  let loadCount = 0;

  const result = await runEngineV2RunEnrichmentBatch({
    chainId: 8453,
    walletAddress,
    limit: 1,
  }, {
    loadQueuedNeeds: async () => {
      loadCount += 1;
      if (loadCount === 1) {
        return [
          {
            id: "need-1",
            chainId: 8453,
            walletAddress,
            needType: "historical_price",
            targetType: "token",
            targetId: "0x1",
          },
          {
            id: "need-2",
            chainId: 8453,
            walletAddress,
            needType: "token_metadata",
            targetType: "token",
            targetId: "0x2",
          },
        ];
      }

      return [];
    },
    resolveNeed: async () => "resolved",
    trigger: async (taskId) => {
      triggered.push(taskId);
    },
  });

  assert.deepEqual(result, {
    attemptedCount: 1,
    resolvedCount: 1,
    unresolvedCount: 0,
    failedCount: 0,
  });
  assert.deepEqual(triggered, ["engine-v2-account-chronological"]);
});

test("pickClosestHistoricalPricePoint chooses the nearest provider point", () => {
  const point = pickClosestHistoricalPricePoint([
    { value: "0.9", timestamp: "2026-01-01T00:00:00.000Z" },
    { value: "1.1", timestamp: "2026-01-01T02:00:00.000Z" },
  ], new Date("2026-01-01T01:20:00.000Z"));

  assert.equal(point?.value, "1.1");
});

test("knownAddressKindToLockProvenance promotes protocol-grants style addresses", () => {
  assert.equal(knownAddressKindToLockProvenance("protocol-grants"), "protocol_grant");
  assert.equal(knownAddressKindToLockProvenance("governance-voter"), "unknown");
});
