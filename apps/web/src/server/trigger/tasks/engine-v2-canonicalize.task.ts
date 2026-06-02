import { task, tasks } from "@trigger.dev/sdk/v3";

import { updateAnalysisRunProgress } from "@/server/analysis/analysis-run.repository";
import {
  dedupeDecodedTransactions,
  parseMoralisDecodedHistoryPage,
  sortDecodedTransactionsChronologically,
} from "@/server/analysis/engine-v2/collection";
import {
  persistCanonicalEvidence,
  persistCanonicalMovements,
  persistRootCanonicalCall,
  upsertCanonicalTransaction,
} from "@/server/analysis/engine-v2/canonicalization";
import { engineV2CollectionPagePayloadSchema } from "@/server/analysis/engine-v2/payloads";
import { getDb } from "@/server/db/client";
import { taskInfo, taskLog, taskWarn, withTaskLogging } from "@/server/trigger/tasks/task-logging";

type EngineV2Db = ReturnType<typeof getDb>;

type ProviderPageRow = {
  rawJson: unknown;
};

export type EngineV2CanonicalizeTaskDeps = {
  db?: EngineV2Db;
  loadProviderPages?: (input: { db: EngineV2Db; collectionRunId: string }) => Promise<ProviderPageRow[]>;
  upsertCanonicalTransaction?: typeof upsertCanonicalTransaction;
  persistCanonicalEvidence?: typeof persistCanonicalEvidence;
  persistCanonicalMovements?: typeof persistCanonicalMovements;
  persistRootCanonicalCall?: typeof persistRootCanonicalCall;
  updateRunProgress?: typeof updateAnalysisRunProgress;
  trigger?: (
    taskId: string,
    payload: Record<string, unknown>,
    options: { idempotencyKey: string },
  ) => Promise<unknown>;
};

async function defaultLoadProviderPages(input: { db: EngineV2Db; collectionRunId: string }) {
  return input.db.query.engineV2ProviderPages.findMany({
    where: (table, { eq }) => eq(table.collectionRunId, input.collectionRunId),
    orderBy: (table, { asc }) => [asc(table.pageIndex)],
  });
}

export async function runEngineV2CanonicalizeHistory(
  rawPayload: unknown,
  deps: EngineV2CanonicalizeTaskDeps = {},
) {
  const payload = engineV2CollectionPagePayloadSchema.parse(rawPayload);
  if (!payload.collectionRunId) {
    throw new Error("ENGINE_V2_COLLECTION_RUN_ID_REQUIRED");
  }
  const updateRun = deps.updateRunProgress ?? updateAnalysisRunProgress;
  if (payload.analysisRunId) {
    await updateRun(payload.analysisRunId, {
      status: "running",
      stage: "engine_v2_canonicalization",
      progressPct: 24,
    });
  }

  const db = deps.db ?? getDb();
  const loadProviderPages = deps.loadProviderPages ?? defaultLoadProviderPages;
  const upsertCanonical = deps.upsertCanonicalTransaction ?? upsertCanonicalTransaction;
  const persistEvidence = deps.persistCanonicalEvidence ?? persistCanonicalEvidence;
  const persistMovements = deps.persistCanonicalMovements ?? persistCanonicalMovements;
  const persistCall = deps.persistRootCanonicalCall ?? persistRootCanonicalCall;
  const triggerTask = deps.trigger ?? ((taskId, taskPayload, options) => tasks.trigger(taskId, taskPayload, options));

  const pages = await loadProviderPages({ db, collectionRunId: payload.collectionRunId });
  const normalizedTransactions = sortDecodedTransactionsChronologically(
    dedupeDecodedTransactions(
      pages.flatMap((page) => parseMoralisDecodedHistoryPage(page.rawJson).transactions),
    ),
  );
  taskInfo("engine-v2-canonicalize-history", "loaded provider pages for canonicalization", {
    collectionRunId: payload.collectionRunId,
    pageCount: pages.length,
    normalizedTransactionCount: normalizedTransactions.length,
  });
  if (normalizedTransactions.length === 0) {
    taskWarn("engine-v2-canonicalize-history", "no normalized transactions were produced for canonicalization", {
      collectionRunId: payload.collectionRunId,
    });
  }

  let canonicalized = 0;
  for (const transaction of normalizedTransactions) {
    const canonical = await upsertCanonical({
      db,
      chainId: payload.chainId,
      walletAddress: payload.walletAddress,
      transaction,
      sourceEndpoint: `/${payload.walletAddress}/verbose`,
      collectionRunId: payload.collectionRunId,
    });
    await persistEvidence({
      db,
      canonicalTransactionId: canonical.id,
      chainId: payload.chainId,
      transaction,
    });
    await persistMovements({
      db,
      canonicalTransactionId: canonical.id,
      chainId: payload.chainId,
      walletAddress: payload.walletAddress,
      transaction,
    });
    await persistCall({
      db,
      canonicalTransactionId: canonical.id,
      chainId: payload.chainId,
      transaction,
    });
    canonicalized += 1;
    if (canonicalized === 1 || canonicalized % 100 === 0 || canonicalized === normalizedTransactions.length) {
      taskLog("engine-v2-canonicalize-history", "canonicalization progress", {
        canonicalized,
        total: normalizedTransactions.length,
        txHash: transaction.hash,
      });
    }
  }

  taskInfo("engine-v2-canonicalize-history", "queueing protocol bootstrap", {
    collectionRunId: payload.collectionRunId,
    canonicalized,
  });
  await triggerTask("engine-v2-protocol-bootstrap", {
    ...payload,
    chainId: payload.chainId,
    walletAddress: payload.walletAddress,
  }, {
    idempotencyKey: `engine-v2-protocol-bootstrap:${payload.chainId}:${payload.walletAddress}:${payload.collectionRunId}`,
  });

  return { canonicalized };
}

export const engineV2CanonicalizeHistoryTask = task({
  id: "engine-v2-canonicalize-history",
  run: async (rawPayload: unknown) => withTaskLogging(
    "engine-v2-canonicalize-history",
    rawPayload,
    () => runEngineV2CanonicalizeHistory(rawPayload),
  ),
});
