import { task, tasks } from "@trigger.dev/sdk/v3";

import {
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

export const engineV2CanonicalizeHistoryTask = task({
  id: "engine-v2-canonicalize-history",
  run: async (rawPayload: unknown) => {
    const payload = engineV2CollectionPagePayloadSchema.parse(rawPayload);
    if (!payload.collectionRunId) {
      throw new Error("ENGINE_V2_COLLECTION_RUN_ID_REQUIRED");
    }

    const db = getDb();
    const pages = await db.query.engineV2ProviderPages.findMany({
      where: (table, { eq }) => eq(table.collectionRunId, payload.collectionRunId as string),
      orderBy: (table, { asc }) => [asc(table.pageIndex)],
    });

    let canonicalized = 0;
    for (const transaction of sortDecodedTransactionsChronologically(
      pages.flatMap((page) => parseMoralisDecodedHistoryPage(page.rawJson).transactions),
    )) {
      const canonical = await upsertCanonicalTransaction({
        db,
        chainId: payload.chainId,
        walletAddress: payload.walletAddress,
        transaction,
        sourceEndpoint: `/${payload.walletAddress}/verbose`,
        collectionRunId: payload.collectionRunId,
      });
      await persistCanonicalEvidence({
        db,
        canonicalTransactionId: canonical.id,
        chainId: payload.chainId,
        transaction,
      });
      await persistCanonicalMovements({
        db,
        canonicalTransactionId: canonical.id,
        chainId: payload.chainId,
        walletAddress: payload.walletAddress,
        transaction,
      });
      await persistRootCanonicalCall({
        db,
        canonicalTransactionId: canonical.id,
        chainId: payload.chainId,
        transaction,
      });
      canonicalized += 1;
    }

    await tasks.trigger("engine-v2-protocol-bootstrap", {
      chainId: payload.chainId,
      walletAddress: payload.walletAddress,
      mode: payload.mode,
    }, {
      idempotencyKey: `engine-v2-protocol-bootstrap:${payload.chainId}:${payload.walletAddress}:${payload.collectionRunId}`,
    });

    return { canonicalized };
  },
});
