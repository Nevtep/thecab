import { task, tasks } from "@trigger.dev/sdk/v3";
import { eq } from "drizzle-orm";

import { updateAnalysisRunProgress } from "@/server/analysis/analysis-run.repository";
import { ensureAbiForSeed, protocolBootstrapSeedsForChain, protocolKnownAddressRowsForSeeds } from "@/server/analysis/engine-v2/abi-registry";
import { decodeCanonicalTransactionCalls } from "@/server/analysis/engine-v2/classification";
import type { AbiRegistryEntry, Address, MoralisDecodedTransaction } from "@/server/analysis/decoded-history";
import { normalizeAddress } from "@/server/analysis/decoded-history/address";
import { parseMoralisDecodedHistoryPage } from "@/server/analysis/engine-v2/collection";
import { engineV2WalletPayloadSchema } from "@/server/analysis/engine-v2/payloads";
import { getDb } from "@/server/db/client";
import { contractAbis } from "@/server/db/schema";

export type EngineV2DecodeDeps = {
  putKnownAddresses?: (rows: ReturnType<typeof protocolKnownAddressRowsForSeeds>) => Promise<void>;
  ensureAbi?: typeof ensureAbiForSeed;
  loadTransactions?: (input: { chainId: number; walletAddress: string }) => Promise<MoralisDecodedTransaction[]>;
  loadRegistry?: (input: { chainId: number; walletAddress: string }) => Promise<Map<Address, AbiRegistryEntry>>;
  persistDecodedCalls?: (calls: ReturnType<typeof decodeCanonicalTransactionCalls>) => Promise<void>;
  trigger?: (taskId: string, payload: Record<string, unknown>, options: { idempotencyKey: string }) => Promise<unknown>;
  apiKey?: string | null;
};

async function loadTransactionsFromProviderPages(input: {
  collectionRunId?: string | null;
}): Promise<MoralisDecodedTransaction[]> {
  if (!input.collectionRunId) return [];
  const pages = await getDb().query.engineV2ProviderPages.findMany({
    where: (table, { eq }) => eq(table.collectionRunId, input.collectionRunId as string),
    orderBy: (table, { asc }) => [asc(table.pageIndex)],
  });
  return pages.flatMap((page) => parseMoralisDecodedHistoryPage(page.rawJson).transactions);
}

async function loadAbiRegistryFromDb(input: { chainId: number }): Promise<Map<Address, AbiRegistryEntry>> {
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

export async function runEngineV2ProtocolBootstrap(rawPayload: unknown, deps: EngineV2DecodeDeps = {}) {
  const payload = engineV2WalletPayloadSchema.parse(rawPayload);
  if (payload.analysisRunId) {
    await updateAnalysisRunProgress(payload.analysisRunId, {
      status: "running",
      stage: "engine_v2_abi_registry",
      progressPct: 32,
    });
  }
  const rows = protocolKnownAddressRowsForSeeds(payload.chainId);
  if (deps.putKnownAddresses) {
    await deps.putKnownAddresses(rows);
  } else {
    const { createEngineV2AbiRegistryRepository } = await import("@/server/analysis/engine-v2/abi-registry");
    await createEngineV2AbiRegistryRepository(getDb()).putKnownAddresses(rows);
  }
  const triggerTask = deps.trigger ?? ((taskId, taskPayload, options) => tasks.trigger(taskId, taskPayload, options));
  await triggerTask("engine-v2-ensure-abi-registry", payload, {
    idempotencyKey: `engine-v2-ensure-abi-registry:${payload.chainId}:${payload.walletAddress}`,
  });

  return { knownAddressCount: rows.length };
}

export async function runEngineV2EnsureAbiRegistry(rawPayload: unknown, deps: EngineV2DecodeDeps = {}) {
  const payload = engineV2WalletPayloadSchema.parse(rawPayload);
  if (payload.analysisRunId) {
    await updateAnalysisRunProgress(payload.analysisRunId, {
      status: "running",
      stage: "engine_v2_abi_registry",
      progressPct: 38,
    });
  }
  const seeds = protocolBootstrapSeedsForChain(payload.chainId);
  const apiKey = deps.apiKey ?? process.env.ETHERSCAN_API_KEY ?? process.env.BASESCAN_API_KEY ?? null;
  const results = [];
  if (apiKey) {
    const { createEngineV2AbiRegistryRepository } = await import("@/server/analysis/engine-v2/abi-registry");
    const repository = createEngineV2AbiRegistryRepository(getDb());
    for (const seed of seeds) {
      results.push(await (deps.ensureAbi ?? ensureAbiForSeed)({ chainId: payload.chainId, seed, apiKey, repository }));
    }
  }
  const triggerTask = deps.trigger ?? ((taskId, taskPayload, options) => tasks.trigger(taskId, taskPayload, options));
  await triggerTask("engine-v2-decode-canonical-calls", payload, {
    idempotencyKey: `engine-v2-decode-canonical-calls:${payload.chainId}:${payload.walletAddress}`,
  });

  return { abiSeedCount: seeds.length, resolvedCount: results.filter((result) => result.status !== "miss").length };
}

export async function runEngineV2DecodeCanonicalCalls(rawPayload: unknown, deps: EngineV2DecodeDeps = {}) {
  const payload = engineV2WalletPayloadSchema.parse(rawPayload);
  if (payload.analysisRunId) {
    await updateAnalysisRunProgress(payload.analysisRunId, {
      status: "running",
      stage: "engine_v2_decoding",
      progressPct: 46,
    });
  }
  const transactions = await (deps.loadTransactions?.(payload) ?? loadTransactionsFromProviderPages(payload));
  const registry = await (deps.loadRegistry?.(payload) ?? loadAbiRegistryFromDb(payload));
  let decodedCallCount = 0;
  for (const tx of transactions) {
    const calls = decodeCanonicalTransactionCalls({ tx, registry });
    decodedCallCount += calls.length;
    await deps.persistDecodedCalls?.(calls);
  }
  const triggerTask = deps.trigger ?? ((taskId, taskPayload, options) => tasks.trigger(taskId, taskPayload, options));
  await triggerTask("engine-v2-classify-chronological", payload, {
    idempotencyKey: `engine-v2-classify-chronological:${payload.chainId}:${payload.walletAddress}`,
  });

  return { transactionCount: transactions.length, decodedCallCount };
}

export const engineV2ProtocolBootstrapTask = task({
  id: "engine-v2-protocol-bootstrap",
  run: async (payload: unknown) => runEngineV2ProtocolBootstrap(payload),
});

export const engineV2EnsureAbiRegistryTask = task({
  id: "engine-v2-ensure-abi-registry",
  run: async (payload: unknown) => runEngineV2EnsureAbiRegistry(payload),
});

export const engineV2DecodeCanonicalCallsTask = task({
  id: "engine-v2-decode-canonical-calls",
  run: async (payload: unknown) => runEngineV2DecodeCanonicalCalls(payload),
});
