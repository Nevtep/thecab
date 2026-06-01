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
