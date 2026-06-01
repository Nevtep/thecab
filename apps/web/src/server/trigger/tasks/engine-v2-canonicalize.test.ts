import assert from "node:assert/strict";
import test from "node:test";

import { runEngineV2CanonicalizeHistory } from "@/server/trigger/tasks/engine-v2-canonicalize.task";

const walletAddress = "0x0000000000000000000000000000000000000001";
const collectionRunId = "00000000-0000-4000-8000-000000000001";

test("runEngineV2CanonicalizeHistory dedupes duplicate tx hashes across provider pages before persistence", async () => {
  const upsertedHashes: string[] = [];
  const evidenceHashes: string[] = [];
  const movementHashes: string[] = [];
  const callHashes: string[] = [];
  const triggered: Array<{ taskId: string; payload: Record<string, unknown>; options: { idempotencyKey: string } }> = [];

  const result = await runEngineV2CanonicalizeHistory({
    chainId: 8453,
    walletAddress,
    collectionRunId,
  }, {
    db: {} as never,
    loadProviderPages: async () => [
      {
        rawJson: {
          result: [
            { hash: "0xbbb", block_timestamp: "2026-05-28T01:00:00.000Z", transaction_index: 2 },
            { hash: "0xaaa", block_timestamp: "2026-05-28T00:00:00.000Z", transaction_index: 1 },
          ],
        },
      },
      {
        rawJson: {
          result: [
            { hash: "0xaaa", block_timestamp: "2026-05-28T00:00:00.000Z", transaction_index: 1 },
          ],
        },
      },
    ],
    upsertCanonicalTransaction: async ({ transaction }) => {
      upsertedHashes.push(transaction.hash);
      return { id: `canonical:${transaction.hash}` } as { id: string };
    },
    persistCanonicalEvidence: async ({ transaction }) => {
      evidenceHashes.push(transaction.hash);
    },
    persistCanonicalMovements: async ({ transaction }) => {
      movementHashes.push(transaction.hash);
    },
    persistRootCanonicalCall: async ({ transaction }) => {
      callHashes.push(transaction.hash);
    },
    trigger: async (taskId, payload, options) => {
      triggered.push({ taskId, payload, options });
    },
  });

  assert.deepEqual(result, { canonicalized: 2 });
  assert.deepEqual(upsertedHashes, ["0xaaa", "0xbbb"]);
  assert.deepEqual(evidenceHashes, ["0xaaa", "0xbbb"]);
  assert.deepEqual(movementHashes, ["0xaaa", "0xbbb"]);
  assert.deepEqual(callHashes, ["0xaaa", "0xbbb"]);
  assert.equal(triggered[0]?.taskId, "engine-v2-protocol-bootstrap");
  assert.equal(
    triggered[0]?.options.idempotencyKey,
    `engine-v2-protocol-bootstrap:8453:${walletAddress}:${collectionRunId}`,
  );
});