import { task, tasks } from "@trigger.dev/sdk/v3";

import { updateAnalysisRunProgress } from "@/server/analysis/analysis-run.repository";
import {
  createCollectionRun,
  fetchMoralisDecodedHistoryPage,
  findLatestCanonicalTransactionBoundary,
  hashMoralisDecodedHistoryRequest,
  markCollectionRunComplete,
  parseMoralisDecodedHistoryPage,
  upsertProviderPage,
} from "@/server/analysis/engine-v2/collection";
import { summarizeCanonicalTransactions } from "@/server/analysis/engine-v2/canonicalization";
import { engineV2CollectionPagePayloadSchema, engineV2WalletPayloadSchema } from "@/server/analysis/engine-v2/payloads";
import { getDb } from "@/server/db/client";

type EngineV2Db = ReturnType<typeof getDb>;

type ProviderPageRow = {
  rawJson: unknown;
  cursorOut: string | null;
};

type TriggerFn = (
  taskId: string,
  payload: Record<string, unknown>,
  options: { idempotencyKey: string },
) => Promise<unknown>;

export type EngineV2CollectionTaskDeps = {
  db?: EngineV2Db;
  createCollectionRun?: (input: Parameters<typeof createCollectionRun>[0]) => Promise<{ id: string }>;
  findLatestCanonicalBoundary?: (
    input: Parameters<typeof findLatestCanonicalTransactionBoundary>[0]
  ) => Promise<Awaited<ReturnType<typeof findLatestCanonicalTransactionBoundary>>>;
  fetchMoralisDecodedHistoryPage?: typeof fetchMoralisDecodedHistoryPage;
  upsertProviderPage?: (input: Parameters<typeof upsertProviderPage>[0]) => Promise<unknown>;
  markCollectionRunComplete?: (input: Parameters<typeof markCollectionRunComplete>[0]) => Promise<unknown>;
  loadProviderPages?: (input: { db: EngineV2Db; collectionRunId: string }) => Promise<ProviderPageRow[]>;
  trigger?: TriggerFn;
  updateRunProgress?: typeof updateAnalysisRunProgress;
};

async function defaultLoadProviderPages({
  db,
  collectionRunId,
}: {
  db: EngineV2Db;
  collectionRunId: string;
}) {
  return db.query.engineV2ProviderPages.findMany({
    where: (table, { eq }) => eq(table.collectionRunId, collectionRunId),
    orderBy: (table, { asc }) => [asc(table.pageIndex)],
  });
}

export async function runEngineV2CollectDecodedHistoryPage(
  rawPayload: unknown,
  deps: EngineV2CollectionTaskDeps = {},
) {
  const payload = engineV2CollectionPagePayloadSchema.parse(rawPayload);
  const db = deps.db ?? getDb();
  const createRun = deps.createCollectionRun ?? createCollectionRun;
  const fetchPage = deps.fetchMoralisDecodedHistoryPage ?? fetchMoralisDecodedHistoryPage;
  const upsertPage = deps.upsertProviderPage ?? upsertProviderPage;
  const updateRun = deps.updateRunProgress ?? updateAnalysisRunProgress;
  const triggerTask = deps.trigger ?? ((taskId, taskPayload, options) => tasks.trigger(taskId, taskPayload, options));
  const sourceEndpoint = `/${payload.walletAddress}/verbose`;
  if (payload.analysisRunId) {
    await updateRun(payload.analysisRunId, {
      status: "running",
      stage: "engine_v2_collection",
      progressPct: Math.min(14, 6 + payload.pageIndex),
    });
  }
  const collectionRun = payload.collectionRunId
    ? { id: payload.collectionRunId }
    : await createRun({
      db,
      analysisRunId: payload.analysisRunId,
      chainId: payload.chainId,
      walletAddress: payload.walletAddress,
      sourceEndpoint,
      sourceQueryJson: {
        mode: payload.mode,
        order: "ASC",
        include: "internal_transactions",
        ...(payload.fromBlock ? { from_block: payload.fromBlock } : {}),
      },
    });

  const response = await fetchPage(payload);
  const parsed = parseMoralisDecodedHistoryPage(response);
  const requestHash = hashMoralisDecodedHistoryRequest(payload);
  await upsertPage({
    db,
    collectionRunId: collectionRun.id,
    chainId: payload.chainId,
    walletAddress: payload.walletAddress,
    sourceProvider: "moralis",
    sourceEndpoint,
    requestHash,
    cursorIn: payload.cursor ?? null,
    cursorOut: parsed.cursor ?? null,
    pageIndex: payload.pageIndex,
    rawJson: response,
  });

  if (parsed.cursor) {
    await triggerTask("engine-v2-collect-decoded-history-page", {
      ...payload,
      collectionRunId: collectionRun.id,
      cursor: parsed.cursor,
      pageIndex: payload.pageIndex + 1,
    }, {
      idempotencyKey: `engine-v2-collection:${payload.chainId}:${payload.walletAddress}:${parsed.cursor}`,
    });
  } else {
    await triggerTask("engine-v2-finalize-collection", {
      ...payload,
      collectionRunId: collectionRun.id,
    }, {
      idempotencyKey: `engine-v2-finalize-collection:${payload.chainId}:${payload.walletAddress}:${collectionRun.id}`,
    });
  }

  return {
    collectionRunId: collectionRun.id,
    pageIndex: payload.pageIndex,
    providerRowCount: parsed.providerRowCount,
    nextCursor: parsed.cursor,
  };
}

export const engineV2CollectDecodedHistoryPageTask = task({
  id: "engine-v2-collect-decoded-history-page",
  run: async (payload: unknown) => runEngineV2CollectDecodedHistoryPage(payload),
});

export async function runEngineV2FinalizeCollection(
  rawPayload: unknown,
  deps: EngineV2CollectionTaskDeps = {},
) {
  const payload = engineV2CollectionPagePayloadSchema.parse(rawPayload);
  if (!payload.collectionRunId) {
    throw new Error("ENGINE_V2_COLLECTION_RUN_ID_REQUIRED");
  }

  const db = deps.db ?? getDb();
  const loadProviderPages = deps.loadProviderPages ?? defaultLoadProviderPages;
  const markComplete = deps.markCollectionRunComplete ?? markCollectionRunComplete;
  const updateRun = deps.updateRunProgress ?? updateAnalysisRunProgress;
  const triggerTask = deps.trigger ?? ((taskId, taskPayload, options) => tasks.trigger(taskId, taskPayload, options));
  const pages = await loadProviderPages({ db, collectionRunId: payload.collectionRunId });
  const transactions = pages.flatMap((page) => parseMoralisDecodedHistoryPage(page.rawJson).transactions);
  const summary = summarizeCanonicalTransactions(transactions);
  await markComplete({
    db,
    collectionRunId: payload.collectionRunId,
    ...summary,
    lastCursor: pages.at(-1)?.cursorOut ?? null,
  });
  if (payload.analysisRunId) {
    await updateRun(payload.analysisRunId, {
      status: "running",
      stage: "engine_v2_canonicalization",
      progressPct: 18,
    });
  }
  await triggerTask("engine-v2-canonicalize-history", {
    ...payload,
    collectionRunId: payload.collectionRunId,
  }, {
    idempotencyKey: `engine-v2-canonicalize:${payload.chainId}:${payload.walletAddress}:${payload.collectionRunId}`,
  });

  return summary;
}

export const engineV2FinalizeCollectionTask = task({
  id: "engine-v2-finalize-collection",
  run: async (payload: unknown) => runEngineV2FinalizeCollection(payload),
});

export async function runEngineV2StartCollection(
  rawPayload: unknown,
  deps: Pick<EngineV2CollectionTaskDeps, "db" | "findLatestCanonicalBoundary" | "trigger"> = {},
) {
  const payload = engineV2WalletPayloadSchema.parse(rawPayload);
  const triggerTask = deps.trigger ?? ((taskId, taskPayload, options) => tasks.trigger(taskId, taskPayload, options));

  if (payload.mode === "reanalysis") {
    if (!payload.collectionRunId) {
      throw new Error("ENGINE_V2_REANALYSIS_COLLECTION_RUN_ID_REQUIRED");
    }
    await triggerTask("engine-v2-canonicalize-history", {
      ...payload,
      pageIndex: 0,
      cursor: null,
    }, {
      idempotencyKey: `engine-v2-reanalysis:${payload.chainId}:${payload.walletAddress}:${payload.collectionRunId}`,
    });

    return { queued: true };
  }

  const db = deps.db ?? getDb();
  const loadLatestBoundary = deps.findLatestCanonicalBoundary ?? findLatestCanonicalTransactionBoundary;
  const latestBoundary = payload.mode === "incremental"
    ? await loadLatestBoundary({
      db,
      chainId: payload.chainId,
      walletAddress: payload.walletAddress,
    })
    : null;
  const fromBlock = latestBoundary?.blockNumber ?? null;

  await triggerTask("engine-v2-collect-decoded-history-page", {
    ...payload,
    pageIndex: 0,
    cursor: null,
    fromBlock,
  }, {
    idempotencyKey: payload.mode === "incremental" && fromBlock
      ? `engine-v2-collection:${payload.chainId}:${payload.walletAddress}:incremental:from-block-${fromBlock}`
      : `engine-v2-collection:${payload.chainId}:${payload.walletAddress}:${payload.mode}:start`,
  });

  return { queued: true };
}

export const engineV2StartCollectionTask = task({
  id: "engine-v2-start-collection",
  run: async (payload: unknown) => runEngineV2StartCollection(payload),
});
