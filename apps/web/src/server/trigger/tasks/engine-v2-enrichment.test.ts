import assert from "node:assert/strict";
import test from "node:test";

import { runEngineV2RunEnrichmentBatch } from "./engine-v2-enrichment.task";

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
