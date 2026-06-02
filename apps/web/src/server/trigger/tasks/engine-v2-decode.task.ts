import { task, tasks } from "@trigger.dev/sdk/v3";
import { and, eq, sql } from "drizzle-orm";

import { updateAnalysisRunProgress } from "@/server/analysis/analysis-run.repository";
import {
  ensureAbiForSeed,
  protocolBootstrapSeedsForChain,
  protocolKnownAddressRowsForSeeds,
} from "@/server/analysis/engine-v2/abi-registry";
import { decodeCanonicalTransactionCalls } from "@/server/analysis/engine-v2/classification";
import { approvalLogs, transferLogs } from "@/server/analysis/decoded-history";
import type { AbiRegistryEntry, Address, ContractSeed, MoralisDecodedTransaction } from "@/server/analysis/decoded-history";
import { ERC20_APPROVAL_TOPIC, ERC20_TRANSFER_TOPIC } from "@/server/analysis/decoded-history/constants";
import { normalizeAddress } from "@/server/analysis/decoded-history/address";
import { parseMoralisDecodedHistoryPage } from "@/server/analysis/engine-v2/collection";
import { engineV2WalletPayloadSchema } from "@/server/analysis/engine-v2/payloads";
import { getDb } from "@/server/db/client";
import { canonicalCalls, canonicalTransactions, contractAbis } from "@/server/db/schema";
import { taskInfo, taskLog, taskWarn, withTaskLogging } from "@/server/trigger/tasks/task-logging";

type AbiRegistryRepositoryLike = {
  getContractAbi(input: { chainId: number; address: string }): Promise<AbiRegistryEntry | null>;
  putFetchedAbi(input: {
    chainId: number;
    seed: ContractSeed;
    source: Record<string, unknown>;
    sourceUrl: string;
    sourceProvider?: string;
  }): Promise<AbiRegistryEntry | null>;
};

export type EngineV2DecodeDeps = {
  putKnownAddresses?: (rows: ReturnType<typeof protocolKnownAddressRowsForSeeds>) => Promise<void>;
  ensureAbi?: typeof ensureAbiForSeed;
  abiRegistryRepository?: AbiRegistryRepositoryLike;
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

function jsonSafe(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonSafe(item)]));
  }
  return value;
}

function callDepth(callPath: string) {
  return callPath.split(".").length;
}

function parentCallPath(callPath: string) {
  const segments = callPath.split(".");
  if (segments.length <= 1) return null;
  return segments.slice(0, -1).join(".");
}

async function persistDecodedCallsForTransaction(input: {
  chainId: number;
  txHash: string;
  calls: ReturnType<typeof decodeCanonicalTransactionCalls>;
}) {
  if (input.calls.length === 0) return { decodedCallCount: 0 };
  const db = getDb();
  const txHash = input.txHash.toLowerCase();
  const [transaction] = await db
    .select({ id: canonicalTransactions.id })
    .from(canonicalTransactions)
    .where(and(eq(canonicalTransactions.chainId, input.chainId), eq(canonicalTransactions.txHash, txHash)))
    .limit(1);
  if (!transaction) return { decodedCallCount: 0 };

  const abiRows = await db
    .select({ id: contractAbis.id, address: contractAbis.address })
    .from(contractAbis)
    .where(eq(contractAbis.chainId, input.chainId));
  const abiIdByAddress = new Map(abiRows.map((row) => [row.address.toLowerCase(), row.id] as const));
  const persistedByPath = new Map<string, string>();

  for (const call of [...input.calls].sort((left, right) => callDepth(left.callPath) - callDepth(right.callPath))) {
    const parentPath = parentCallPath(call.callPath);
    const [row] = await db.insert(canonicalCalls).values({
      canonicalTransactionId: transaction.id,
      parentCallId: parentPath ? persistedByPath.get(parentPath) ?? null : null,
      chainId: input.chainId,
      txHash,
      callPath: call.callPath,
      targetAddress: call.targetAddress || null,
      selector: call.selector || null,
      functionName: call.functionName,
      decodedArgsJson: { args: jsonSafe(call.args) },
      rawCallData: call.rawCallData,
      abiId: call.entry?.address ? abiIdByAddress.get(call.entry.address.toLowerCase()) ?? null : null,
      decodeStatus: call.decodeStatus,
      decodeConfidence: call.decodeConfidence,
    }).onConflictDoUpdate({
      target: [canonicalCalls.chainId, canonicalCalls.txHash, canonicalCalls.callPath],
      set: {
        parentCallId: parentPath ? persistedByPath.get(parentPath) ?? null : null,
        targetAddress: sql`excluded.target_address`,
        selector: sql`excluded.selector`,
        functionName: sql`excluded.function_name`,
        decodedArgsJson: sql`excluded.decoded_args_json`,
        rawCallData: sql`excluded.raw_call_data`,
        abiId: sql`excluded.abi_id`,
        decodeStatus: sql`excluded.decode_status`,
        decodeConfidence: sql`excluded.decode_confidence`,
      },
    }).returning({ id: canonicalCalls.id });
    if (row?.id) persistedByPath.set(call.callPath, row.id);
  }

  return { decodedCallCount: input.calls.length };
}

function observedContractSeeds(input: {
  chainId: number;
  transactions: MoralisDecodedTransaction[];
  registry: Map<Address, AbiRegistryEntry>;
}) {
  if (input.chainId !== 8453) return [] satisfies ContractSeed[];
  const seeds = new Map<Address, ContractSeed>();

  const append = (address: string | null | undefined, sourceHint: string) => {
    const normalized = normalizeAddress(address);
    if (!normalized || input.registry.has(normalized) || seeds.has(normalized)) return;
    seeds.set(normalized, {
      protocol: "observed",
      label: `Observed ${normalized.slice(0, 6)}...${normalized.slice(-4)}`,
      address: normalized,
      expectedKind: "observed-contract",
      sourceHint,
    });
  };

  const logSourceHint = (log: NonNullable<MoralisDecodedTransaction["logs"]>[number]) => {
    const signature = typeof log.decoded_event?.signature === "string" ? log.decoded_event.signature : null;
    if (signature) return `Observed log emitter ${signature}`;
    const label = typeof log.decoded_event?.label === "string" ? log.decoded_event.label : null;
    if (label) return `Observed log emitter ${label}`;
    const topic0 = typeof log.topic0 === "string" ? log.topic0.toLowerCase() : null;
    return topic0 ? `Observed log emitter topic0 ${topic0}` : "Observed log emitter";
  };

  const isTransferOrApprovalLog = (log: NonNullable<MoralisDecodedTransaction["logs"]>[number]) => {
    const signature = typeof log.decoded_event?.signature === "string" ? log.decoded_event.signature : null;
    if (signature === "Transfer(address,address,uint256)" || signature === "Approval(address,address,uint256)") {
      return true;
    }
    const topic0 = typeof log.topic0 === "string" ? log.topic0.toLowerCase() : null;
    return topic0 === ERC20_TRANSFER_TOPIC || topic0 === ERC20_APPROVAL_TOPIC;
  };

  for (const tx of input.transactions) {
    if (tx.input && tx.input !== "0x") {
      const selector = tx.input.slice(0, 10).toLowerCase();
      if (selector !== "0xa9059cbb" && selector !== "0x095ea7b3") {
        append(tx.to_address, `Observed transaction target selector ${selector}`);
      }
    }
    for (const log of tx.logs ?? []) {
      if (isTransferOrApprovalLog(log)) continue;
      append(log.address, logSourceHint(log));
    }
    for (const transfer of transferLogs(tx)) {
      append(transfer.token, "Observed transfer token contract");
    }
    for (const approval of approvalLogs(tx)) {
      append(approval.spender, "Observed approval spender");
    }
  }

  return [...seeds.values()];
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
  taskInfo("engine-v2-protocol-bootstrap", "persisting protocol known addresses", {
    chainId: payload.chainId,
    walletAddress: payload.walletAddress,
    knownAddressCount: rows.length,
  });
  if (deps.putKnownAddresses) {
    await deps.putKnownAddresses(rows);
  } else {
    const { createEngineV2AbiRegistryRepository } = await import("@/server/analysis/engine-v2/abi-registry");
    await createEngineV2AbiRegistryRepository(getDb()).putKnownAddresses(rows);
  }
  const triggerTask = deps.trigger ?? ((taskId, taskPayload, options) => tasks.trigger(taskId, taskPayload, options));
  taskInfo("engine-v2-protocol-bootstrap", "queueing ABI registry ensure step", {
    chainId: payload.chainId,
    walletAddress: payload.walletAddress,
  });
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
  const baseSeeds = protocolBootstrapSeedsForChain(payload.chainId);
  const apiKey = deps.apiKey ?? process.env.ETHERSCAN_API_KEY ?? process.env.BASESCAN_API_KEY ?? null;
  const results = [];
  taskInfo("engine-v2-ensure-abi-registry", "ensuring ABI registry", {
    chainId: payload.chainId,
    walletAddress: payload.walletAddress,
    baseSeedCount: baseSeeds.length,
    hasApiKey: Boolean(apiKey),
  });
  if (apiKey) {
    const { createEngineV2AbiRegistryRepository } = await import("@/server/analysis/engine-v2/abi-registry");
    const registryRepository = deps.abiRegistryRepository ?? createEngineV2AbiRegistryRepository(getDb());
    for (const seed of baseSeeds) {
      results.push(await (deps.ensureAbi ?? ensureAbiForSeed)({ chainId: payload.chainId, seed, apiKey, repository: registryRepository }));
    }
    const transactions = await (deps.loadTransactions?.(payload) ?? loadTransactionsFromProviderPages(payload));
    const registry = await (deps.loadRegistry?.(payload) ?? loadAbiRegistryFromDb(payload));
    const observedSeeds = observedContractSeeds({
      chainId: payload.chainId,
      transactions,
      registry,
    });
    taskInfo("engine-v2-ensure-abi-registry", "discovered observed ABI seeds", {
      transactionCount: transactions.length,
      existingRegistrySize: registry.size,
      observedSeedCount: observedSeeds.length,
    });
    for (const seed of observedSeeds) {
      results.push(await (deps.ensureAbi ?? ensureAbiForSeed)({ chainId: payload.chainId, seed, apiKey, repository: registryRepository }));
    }
  } else {
    taskWarn("engine-v2-ensure-abi-registry", "no explorer API key available; skipping external ABI fetch", {
      chainId: payload.chainId,
      walletAddress: payload.walletAddress,
    });
  }
  taskInfo("engine-v2-ensure-abi-registry", "ABI ensure summary", {
    baseSeedCount: baseSeeds.length,
    observedSeedCount: Math.max(results.length - baseSeeds.length, 0),
    resolvedCount: results.filter((result) => result.status !== "miss").length,
    missCount: results.filter((result) => result.status === "miss").length,
  });
  const triggerTask = deps.trigger ?? ((taskId, taskPayload, options) => tasks.trigger(taskId, taskPayload, options));
  taskInfo("engine-v2-ensure-abi-registry", "queueing canonical call decoding", {
    chainId: payload.chainId,
    walletAddress: payload.walletAddress,
  });
  await triggerTask("engine-v2-decode-canonical-calls", payload, {
    idempotencyKey: `engine-v2-decode-canonical-calls:${payload.chainId}:${payload.walletAddress}`,
  });

  return { abiSeedCount: baseSeeds.length, observedSeedCount: Math.max(results.length - baseSeeds.length, 0), resolvedCount: results.filter((result) => result.status !== "miss").length };
}

export async function runEngineV2DecodeCanonicalCalls(rawPayload: unknown, deps: EngineV2DecodeDeps = {}) {
  const payload = engineV2WalletPayloadSchema.parse(rawPayload);
  if (!deps.loadTransactions && !payload.collectionRunId) {
    throw new Error("ENGINE_V2_COLLECTION_RUN_ID_REQUIRED");
  }
  if (payload.analysisRunId) {
    await updateAnalysisRunProgress(payload.analysisRunId, {
      status: "running",
      stage: "engine_v2_decoding",
      progressPct: 46,
    });
  }
  const transactions = await (deps.loadTransactions?.(payload) ?? loadTransactionsFromProviderPages(payload));
  const registry = await (deps.loadRegistry?.(payload) ?? loadAbiRegistryFromDb(payload));
  taskInfo("engine-v2-decode-canonical-calls", "decoding canonical calls", {
    chainId: payload.chainId,
    walletAddress: payload.walletAddress,
    transactionCount: transactions.length,
    registrySize: registry.size,
  });
  let decodedCallCount = 0;
  for (const [index, tx] of transactions.entries()) {
    const calls = decodeCanonicalTransactionCalls({ tx, registry });
    decodedCallCount += calls.length;
    if (deps.persistDecodedCalls) {
      await deps.persistDecodedCalls(calls);
    } else {
      await persistDecodedCallsForTransaction({
        chainId: payload.chainId,
        txHash: tx.hash,
        calls,
      });
    }
    if (index === 0 || (index + 1) % 100 === 0 || index + 1 === transactions.length) {
      taskLog("engine-v2-decode-canonical-calls", "decode progress", {
        processedTransactions: index + 1,
        totalTransactions: transactions.length,
        txHash: tx.hash,
        cumulativeDecodedCallCount: decodedCallCount,
      });
    }
  }
  const triggerTask = deps.trigger ?? ((taskId, taskPayload, options) => tasks.trigger(taskId, taskPayload, options));
  taskInfo("engine-v2-decode-canonical-calls", "queueing chronological classification", {
    chainId: payload.chainId,
    walletAddress: payload.walletAddress,
    decodedCallCount,
  });
  await triggerTask("engine-v2-classify-chronological", payload, {
    idempotencyKey: `engine-v2-classify-chronological:${payload.chainId}:${payload.walletAddress}`,
  });

  return { transactionCount: transactions.length, decodedCallCount };
}

export const engineV2ProtocolBootstrapTask = task({
  id: "engine-v2-protocol-bootstrap",
  run: async (payload: unknown) => withTaskLogging(
    "engine-v2-protocol-bootstrap",
    payload,
    () => runEngineV2ProtocolBootstrap(payload),
  ),
});

export const engineV2EnsureAbiRegistryTask = task({
  id: "engine-v2-ensure-abi-registry",
  run: async (payload: unknown) => withTaskLogging(
    "engine-v2-ensure-abi-registry",
    payload,
    () => runEngineV2EnsureAbiRegistry(payload),
  ),
});

export const engineV2DecodeCanonicalCallsTask = task({
  id: "engine-v2-decode-canonical-calls",
  run: async (payload: unknown) => withTaskLogging(
    "engine-v2-decode-canonical-calls",
    payload,
    () => runEngineV2DecodeCanonicalCalls(payload),
  ),
});
