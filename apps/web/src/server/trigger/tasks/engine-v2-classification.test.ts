import assert from "node:assert/strict";
import test from "node:test";

import { runEngineV2DecodeCanonicalCalls } from "./engine-v2-decode.task";
import { runEngineV2ClassifyChronological } from "./engine-v2-classification.task";

const walletAddress = "0x0000000000000000000000000000000000000001";

test("runEngineV2ClassifyChronological classifies oldest transaction first", async () => {
  const persisted: string[] = [];
  const result = await runEngineV2ClassifyChronological({
    chainId: 8453,
    walletAddress,
  }, {
    loadTransactions: async () => [
      {
        hash: "0xnew",
        from_address: "0x0000000000000000000000000000000000000002",
        to_address: walletAddress,
        receipt_status: "1",
        value: "2",
        block_timestamp: "2026-01-02T00:00:00.000Z",
        transaction_index: "0",
        logs: [],
      },
      {
        hash: "0xold",
        from_address: "0x0000000000000000000000000000000000000002",
        to_address: walletAddress,
        receipt_status: "1",
        value: "1",
        block_timestamp: "2026-01-01T00:00:00.000Z",
        transaction_index: "0",
        logs: [],
      },
    ],
    loadRegistry: async () => new Map(),
    persistClassifications: async (items) => {
      persisted.push(...items.map((item) => item.tx.hash));
    },
    trigger: async () => undefined,
  });

  assert.deepEqual(persisted, ["0xold", "0xnew"]);
  assert.deepEqual(result.eventTypes, ["cash_in_native", "cash_in_native"]);
});

test("runEngineV2DecodeCanonicalCalls decodes then queues chronological classification", async () => {
  const triggered: string[] = [];
  const result = await runEngineV2DecodeCanonicalCalls({
    chainId: 8453,
    walletAddress,
  }, {
    loadTransactions: async () => [{ hash: "0x1", to_address: walletAddress, input: "0x" }],
    loadRegistry: async () => new Map(),
    persistDecodedCalls: async () => undefined,
    trigger: async (taskId) => {
      triggered.push(taskId);
    },
  });

  assert.equal(result.transactionCount, 1);
  assert.equal(triggered[0], "engine-v2-classify-chronological");
});

test("Engine V2 decode and classification require a collection run id when reading provider pages", async () => {
  await assert.rejects(
    () => runEngineV2DecodeCanonicalCalls({ chainId: 8453, walletAddress }),
    /ENGINE_V2_COLLECTION_RUN_ID_REQUIRED/,
  );
  await assert.rejects(
    () => runEngineV2ClassifyChronological({ chainId: 8453, walletAddress }),
    /ENGINE_V2_COLLECTION_RUN_ID_REQUIRED/,
  );
});
