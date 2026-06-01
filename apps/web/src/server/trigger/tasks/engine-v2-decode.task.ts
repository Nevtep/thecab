import { task, tasks } from "@trigger.dev/sdk/v3";

import { ensureAbiForSeed, protocolBootstrapSeedsForChain, protocolKnownAddressRowsForSeeds } from "@/server/analysis/engine-v2/abi-registry";
import { decodeCanonicalTransactionCalls } from "@/server/analysis/engine-v2/classification";
import type { AbiRegistryEntry, Address, MoralisDecodedTransaction } from "@/server/analysis/decoded-history";
import { engineV2WalletPayloadSchema } from "@/server/analysis/engine-v2/payloads";
import { getDb } from "@/server/db/client";

export type EngineV2DecodeDeps = {
  putKnownAddresses?: (rows: ReturnType<typeof protocolKnownAddressRowsForSeeds>) => Promise<void>;
  ensureAbi?: typeof ensureAbiForSeed;
  loadTransactions?: (input: { chainId: number; walletAddress: string }) => Promise<MoralisDecodedTransaction[]>;
  loadRegistry?: (input: { chainId: number; walletAddress: string }) => Promise<Map<Address, AbiRegistryEntry>>;
  persistDecodedCalls?: (calls: ReturnType<typeof decodeCanonicalTransactionCalls>) => Promise<void>;
  trigger?: (taskId: string, payload: Record<string, unknown>, options: { idempotencyKey: string }) => Promise<unknown>;
  apiKey?: string | null;
};

export async function runEngineV2ProtocolBootstrap(rawPayload: unknown, deps: EngineV2DecodeDeps = {}) {
  const payload = engineV2WalletPayloadSchema.parse(rawPayload);
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
  const transactions = await (deps.loadTransactions?.(payload) ?? Promise.resolve([]));
  const registry = await (deps.loadRegistry?.(payload) ?? Promise.resolve(new Map<Address, AbiRegistryEntry>()));
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
