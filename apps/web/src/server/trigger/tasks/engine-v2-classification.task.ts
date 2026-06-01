import { task } from "@trigger.dev/sdk/v3";
import { and, eq } from "drizzle-orm";

import { updateAnalysisRunProgress } from "@/server/analysis/analysis-run.repository";
import { normalizeAddress } from "@/server/analysis/decoded-history/address";
import { parseMoralisDecodedHistoryPage } from "@/server/analysis/engine-v2/collection";
import { extractCanonicalMovements } from "@/server/analysis/engine-v2/canonicalization";
import {
  classifyTransactionsChronologically,
  toClassificationTraceValues,
  toDomainEventValues,
} from "@/server/analysis/engine-v2/classification";
import type { AbiRegistryEntry, Address, MoralisDecodedTransaction } from "@/server/analysis/decoded-history";
import { engineV2WalletPayloadSchema } from "@/server/analysis/engine-v2/payloads";
import { getDb } from "@/server/db/client";
import { canonicalTransactions, contractAbis, engineV2ClassificationTraces, engineV2DomainEvents } from "@/server/db/schema";

export type EngineV2ClassificationDeps = {
  loadTransactions?: (input: { chainId: number; walletAddress: string }) => Promise<MoralisDecodedTransaction[]>;
  loadRegistry?: (input: { chainId: number; walletAddress: string }) => Promise<Map<Address, AbiRegistryEntry>>;
  persistClassifications?: (items: ReturnType<typeof classifyTransactionsChronologically>) => Promise<void>;
  trigger?: (taskId: string, payload: Record<string, unknown>, options: { idempotencyKey: string }) => Promise<unknown>;
};

async function loadTransactionsFromProviderPages(input: { collectionRunId?: string | null }) {
  if (!input.collectionRunId) return [];
  const pages = await getDb().query.engineV2ProviderPages.findMany({
    where: (table, { eq }) => eq(table.collectionRunId, input.collectionRunId as string),
    orderBy: (table, { asc }) => [asc(table.pageIndex)],
  });
  return pages.flatMap((page) => parseMoralisDecodedHistoryPage(page.rawJson).transactions);
}

async function loadAbiRegistryFromDb(input: { chainId: number }) {
  const rows = await getDb().select().from(contractAbis).where(eq(contractAbis.chainId, input.chainId));
  const registry = new Map<Address, AbiRegistryEntry>();
  for (const row of rows) {
    const address = normalizeAddress(row.address);
    if (!address || !Array.isArray(row.abiJson) || row.abiJson.length === 0) continue;
    registry.set(address, {
      chainId: row.chainId,
      address,
      label: row.contractName ?? row.address,
      protocol: row.protocol ?? "observed",
      expectedKind: row.contractKind as AbiRegistryEntry["expectedKind"],
      fetchedAt: row.fetchedAt.toISOString(),
      sources: {
        basescanApi: row.sourceUrl ?? "",
        basescanCode: row.sourceReference ?? `https://basescan.org/address/${address}#code`,
      },
      source: {
        contractName: row.contractName,
        compilerVersion: null,
        optimizationUsed: null,
        runs: null,
        constructorArguments: null,
        evmVersion: null,
        library: null,
        licenseType: null,
        proxy: row.isProxy,
        implementation: row.implementationAddress,
        swarmSource: null,
      },
      abi: row.abiJson,
      warnings: [],
    });
  }
  return registry;
}

async function persistClassificationsToDb(input: {
  chainId: number;
  walletAddress: string;
  items: ReturnType<typeof classifyTransactionsChronologically>;
}) {
  const db = getDb();
  const canonicalRows = await db.select({
    id: canonicalTransactions.id,
    txHash: canonicalTransactions.txHash,
  }).from(canonicalTransactions).where(and(
    eq(canonicalTransactions.chainId, input.chainId),
    eq(canonicalTransactions.walletAddress, input.walletAddress.toLowerCase()),
  ));
  const canonicalIdByHash = new Map(canonicalRows.map((row) => [row.txHash, row.id] as const));

  for (const item of input.items) {
    const txHash = item.tx.hash.toLowerCase();
    const canonicalTransactionId = canonicalIdByHash.get(txHash) ?? null;
    const movements = extractCanonicalMovements({
      walletAddress: input.walletAddress,
      transaction: item.tx,
    }).map((movement) => ({
      direction: movement.direction,
      tokenAddress: movement.tokenAddress ?? null,
      tokenId: movement.tokenId ?? null,
      amountRaw: movement.amountRaw ?? null,
      valueUsdAtEvent: movement.valueUsdAtEvent ?? null,
      movementKind: movement.movementKind,
      assetType: movement.assetType,
    }));
    const classification = {
      ...item.classification,
      evidence: {
        ...item.classification.evidence,
        movements,
      },
    };
    const values = toDomainEventValues({
      chainId: input.chainId,
      walletAddress: input.walletAddress,
      canonicalTransactionId,
      txHash,
      occurredAt: item.tx.block_timestamp ? new Date(item.tx.block_timestamp) : new Date(0),
      sequenceIndex: item.sequenceIndex,
      classification,
    });
    const [event] = await db.insert(engineV2DomainEvents).values(values).onConflictDoUpdate({
      target: [
        engineV2DomainEvents.chainId,
        engineV2DomainEvents.walletAddress,
        engineV2DomainEvents.txHash,
        engineV2DomainEvents.sequenceIndex,
      ],
      set: {
        eventType: values.eventType,
        eventFamily: values.eventFamily,
        coverageStatus: values.coverageStatus,
        confidence: values.confidence,
        reasonCodes: values.reasonCodes,
        evidenceJson: values.evidenceJson,
        metadataJson: values.metadataJson,
      },
    }).returning();
    if (canonicalTransactionId) {
      await db.insert(engineV2ClassificationTraces).values(toClassificationTraceValues({
        canonicalTransactionId,
        chainId: input.chainId,
        txHash,
        classification,
      })).onConflictDoNothing();
    }
    void event;
  }
}

export async function runEngineV2ClassifyChronological(
  rawPayload: unknown,
  deps: EngineV2ClassificationDeps = {},
) {
  const payload = engineV2WalletPayloadSchema.parse(rawPayload);
  if (payload.analysisRunId) {
    await updateAnalysisRunProgress(payload.analysisRunId, {
      status: "running",
      stage: "engine_v2_classification",
      progressPct: 56,
    });
  }
  const transactions = await (deps.loadTransactions?.(payload) ?? loadTransactionsFromProviderPages(payload));
  const registry = await (deps.loadRegistry?.(payload) ?? loadAbiRegistryFromDb(payload));
  const classified = classifyTransactionsChronologically({
    transactions,
    walletAddress: payload.walletAddress as Address,
    registry,
  });
  if (deps.persistClassifications) {
    await deps.persistClassifications(classified);
  } else {
    await persistClassificationsToDb({
      chainId: payload.chainId,
      walletAddress: payload.walletAddress,
      items: classified,
    });
  }
  const triggerTask = deps.trigger ?? (async (taskId, taskPayload, options) => {
    const { tasks } = await import("@trigger.dev/sdk/v3");
    await tasks.trigger(taskId, taskPayload, options);
  });
  await triggerTask("engine-v2-plan-enrichment", payload, {
    idempotencyKey: `engine-v2-plan-enrichment:${payload.chainId}:${payload.walletAddress}:${payload.collectionRunId ?? "latest"}`,
  });

  return {
    classifiedCount: classified.length,
    eventTypes: classified.map((item) => item.classification.eventType),
  };
}

export const engineV2ClassifyChronologicalTask = task({
  id: "engine-v2-classify-chronological",
  run: async (payload: unknown) => runEngineV2ClassifyChronological(payload),
});
