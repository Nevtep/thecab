import assert from "node:assert/strict";
import test from "node:test";

import {
  runEngineV2CollectDecodedHistoryPage,
  runEngineV2FinalizeCollection,
  runEngineV2StartCollection,
  type EngineV2CollectionTaskDeps,
} from "@/server/trigger/tasks/engine-v2-collection.task";

const walletAddress = "0x0000000000000000000000000000000000000001";
const collectionRunId = "00000000-0000-4000-8000-000000000001";

function createDeps(overrides: Partial<EngineV2CollectionTaskDeps> = {}) {
  const triggered: Array<{
    taskId: string;
    payload: Record<string, unknown>;
    options: { idempotencyKey: string };
  }> = [];
  const upsertedPages: Array<Record<string, unknown>> = [];
  const completedRuns: Array<Record<string, unknown>> = [];

  const deps: EngineV2CollectionTaskDeps = {
    db: {} as NonNullable<EngineV2CollectionTaskDeps["db"]>,
    createCollectionRun: async () => ({ id: collectionRunId }),
    findLatestCanonicalBoundary: async () => null,
    fetchMoralisDecodedHistoryPage: async () => ({
      cursor: null,
      result: [{ hash: "0xaaa" }],
    }),
    upsertProviderPage: async (input) => {
      upsertedPages.push(input);
    },
    markCollectionRunComplete: async (input) => {
      completedRuns.push(input);
    },
    loadProviderPages: async () => [],
    trigger: async (taskId, payload, options) => {
      triggered.push({ taskId, payload, options });
    },
    ...overrides,
  };

  return {
    deps,
    triggered,
    upsertedPages,
    completedRuns,
  };
}

test("runEngineV2StartCollection queues the first decoded history page", async () => {
  const { triggered } = createDeps();

  const result = await runEngineV2StartCollection({
    chainId: 8453,
    walletAddress,
  }, {
    trigger: async (taskId, payload, options) => {
      triggered.push({ taskId, payload, options });
    },
  });

  assert.deepEqual(result, { queued: true });
  assert.equal(triggered[0]?.taskId, "engine-v2-collect-decoded-history-page");
  assert.equal(triggered[0]?.payload.pageIndex, 0);
  assert.equal(triggered[0]?.payload.cursor, null);
  assert.equal(triggered[0]?.payload.fromBlock, null);
  assert.equal(triggered[0]?.options.idempotencyKey, `engine-v2-collection:8453:${walletAddress}:fresh:start`);
});

test("runEngineV2StartCollection carries latest canonical block into incremental collection", async () => {
  const { triggered } = createDeps();

  const result = await runEngineV2StartCollection({
    chainId: 8453,
    walletAddress,
    mode: "incremental",
  }, {
    db: {} as NonNullable<EngineV2CollectionTaskDeps["db"]>,
    findLatestCanonicalBoundary: async () => ({
      blockNumber: "46571258",
      txHash: "0xabc",
      transactionIndex: 130,
    }),
    trigger: async (taskId, payload, options) => {
      triggered.push({ taskId, payload, options });
    },
  });

  assert.deepEqual(result, { queued: true });
  assert.equal(triggered[0]?.taskId, "engine-v2-collect-decoded-history-page");
  assert.equal(triggered[0]?.payload.fromBlock, "46571258");
  assert.equal(
    triggered[0]?.options.idempotencyKey,
    `engine-v2-collection:8453:${walletAddress}:incremental:from-block-46571258`,
  );
});

test("runEngineV2StartCollection skips recollection for explicit reanalysis", async () => {
  const { triggered } = createDeps();

  const result = await runEngineV2StartCollection({
    chainId: 8453,
    walletAddress,
    mode: "reanalysis",
    collectionRunId,
  }, {
    trigger: async (taskId, payload, options) => {
      triggered.push({ taskId, payload, options });
    },
  });

  assert.deepEqual(result, { queued: true });
  assert.equal(triggered[0]?.taskId, "engine-v2-canonicalize-history");
  assert.equal(triggered[0]?.payload.collectionRunId, collectionRunId);
  assert.equal(triggered[0]?.payload.pageIndex, 0);
  assert.equal(
    triggered[0]?.options.idempotencyKey,
    `engine-v2-reanalysis:8453:${walletAddress}:${collectionRunId}`,
  );
});

test("runEngineV2StartCollection requires a collection run id for reanalysis", async () => {
  await assert.rejects(
    () => runEngineV2StartCollection({
      chainId: 8453,
      walletAddress,
      mode: "reanalysis",
    }),
    /ENGINE_V2_REANALYSIS_COLLECTION_RUN_ID_REQUIRED/,
  );
});

test("runEngineV2CollectDecodedHistoryPage persists a page and queues the next cursor once", async () => {
  const { deps, triggered, upsertedPages } = createDeps({
    fetchMoralisDecodedHistoryPage: async () => ({
      cursor: "cursor-2",
      result: [{ hash: "0xaaa" }, { hash: "0xbbb" }],
    }),
  });

  const result = await runEngineV2CollectDecodedHistoryPage({
    chainId: 8453,
    walletAddress,
    pageIndex: 0,
  }, deps);

  assert.equal(result.collectionRunId, collectionRunId);
  assert.equal(result.providerRowCount, 2);
  assert.equal(upsertedPages.length, 1);
  assert.equal(upsertedPages[0]?.cursorOut, "cursor-2");
  assert.deepEqual(upsertedPages[0]?.requestHash, upsertedPages[0]?.requestHash);
  assert.equal(triggered.length, 1);
  assert.equal(triggered[0]?.taskId, "engine-v2-collect-decoded-history-page");
  assert.equal(triggered[0]?.payload.collectionRunId, collectionRunId);
  assert.equal(triggered[0]?.payload.cursor, "cursor-2");
  assert.equal(triggered[0]?.payload.pageIndex, 1);
  assert.equal(triggered[0]?.options.idempotencyKey, `engine-v2-collection:8453:${walletAddress}:cursor-2`);
});

test("runEngineV2CollectDecodedHistoryPage queues finalization when no cursor remains", async () => {
  const { deps, triggered } = createDeps();

  await runEngineV2CollectDecodedHistoryPage({
    chainId: 8453,
    walletAddress,
    collectionRunId,
    pageIndex: 4,
    cursor: "last-cursor",
  }, deps);

  assert.equal(triggered.length, 1);
  assert.equal(triggered[0]?.taskId, "engine-v2-finalize-collection");
  assert.equal(triggered[0]?.payload.collectionRunId, collectionRunId);
  assert.equal(
    triggered[0]?.options.idempotencyKey,
    `engine-v2-finalize-collection:8453:${walletAddress}:${collectionRunId}`,
  );
});

test("runEngineV2CollectDecodedHistoryPage persists incremental query metadata on first page", async () => {
  const { deps, upsertedPages } = createDeps();
  const createdRuns: Array<Record<string, unknown>> = [];

  await runEngineV2CollectDecodedHistoryPage({
    chainId: 8453,
    walletAddress,
    mode: "incremental",
    fromBlock: "46571258",
    pageIndex: 0,
  }, {
    ...deps,
    createCollectionRun: async (input) => {
      createdRuns.push(input.sourceQueryJson ?? {});
      return { id: collectionRunId };
    },
  });

  assert.deepEqual(createdRuns[0], {
    mode: "incremental",
    order: "ASC",
    include: "internal_transactions",
    from_block: "46571258",
  });
  assert.equal(upsertedPages[0]?.cursorIn, null);
});

test("runEngineV2FinalizeCollection records provider versus distinct tx counts and queues canonicalization", async () => {
  const { deps, triggered, completedRuns } = createDeps({
    loadProviderPages: async () => [
      {
        cursorOut: "cursor-2",
        rawJson: { result: [{ hash: "0xaaa" }, { hash: "0xaaa" }] },
      },
      {
        cursorOut: null,
        rawJson: { result: [{ hash: "0xbbb" }] },
      },
    ],
  });

  const result = await runEngineV2FinalizeCollection({
    chainId: 8453,
    walletAddress,
    collectionRunId,
    pageIndex: 1,
  }, deps);

  assert.deepEqual(result, {
    providerRowCount: 3,
    distinctTxCount: 2,
    duplicateTxCount: 1,
  });
  assert.equal(completedRuns[0]?.providerRowCount, 3);
  assert.equal(completedRuns[0]?.distinctTxCount, 2);
  assert.equal(completedRuns[0]?.duplicateTxCount, 1);
  assert.equal(completedRuns[0]?.lastCursor, null);
  assert.equal(triggered[0]?.taskId, "engine-v2-canonicalize-history");
  assert.equal(
    triggered[0]?.options.idempotencyKey,
    `engine-v2-canonicalize:8453:${walletAddress}:${collectionRunId}`,
  );
});

