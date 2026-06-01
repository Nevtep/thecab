import { task } from "@trigger.dev/sdk/v3";
import { and, eq } from "drizzle-orm";

import { updateAnalysisRunProgress } from "@/server/analysis/analysis-run.repository";
import { normalizeAddress } from "@/server/analysis/decoded-history/address";
import { decodeTransactionInput } from "@/server/analysis/decoded-history";
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
import {
  canonicalTransactions,
  contractAbis,
  engineV2ClassificationTraces,
  engineV2DomainEventLinks,
  engineV2DomainEvents,
} from "@/server/db/schema";

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
  const registry = await loadAbiRegistryFromDb({ chainId: input.chainId });

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
      metadataJson: {
        ...extractDomainMetadata({
          chainId: input.chainId,
          tx: item.tx,
          registry,
          eventType: item.classification.eventType,
          eventFamily: item.classification.eventFamily,
          movements,
        }),
        ...(item.classification.metadataJson ?? {}),
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
    const links = event ? linksFromMetadata({
      chainId: input.chainId,
      metadata: classification.metadataJson,
      eventType: classification.eventType,
      evidence: classification.evidence,
    }) : [];
    if (event && links.length > 0) {
      await db.insert(engineV2DomainEventLinks).values(links.map((link) => ({
        domainEventId: event.id,
        chainId: input.chainId,
        entityType: link.entityType,
        entityId: link.entityId,
        linkKind: link.linkKind,
        confidence: link.confidence,
        evidenceJson: link.evidenceJson,
      }))).onConflictDoNothing();
    }
  }
}

function asString(value: unknown) {
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return typeof value === "string" && value.length > 0 ? value : null;
}

function firstMovement(input: {
  movements: Array<Record<string, unknown>>;
  assetType?: string;
  direction?: string;
  movementKind?: string;
  tokenAddress?: string | null;
}) {
  return input.movements.find((movement) => (
    (input.assetType ? movement.assetType === input.assetType : true) &&
    (input.direction ? movement.direction === input.direction : true) &&
    (input.movementKind ? movement.movementKind === input.movementKind : true) &&
    (input.tokenAddress ? asString(movement.tokenAddress)?.toLowerCase() === input.tokenAddress.toLowerCase() : true)
  )) ?? null;
}

function findProtocolPoolAddress(tx: MoralisDecodedTransaction, positionManagerAddress: string | null) {
  const labels = new Set(["Mint", "Burn", "Collect", "Swap"]);
  for (const log of tx.logs ?? []) {
    const address = normalizeAddress(log.address);
    if (!address || address === positionManagerAddress) continue;
    const label = log.decoded_event?.label ?? "";
    const signature = log.decoded_event?.signature ?? "";
    if (labels.has(label) || signature.startsWith("Mint(") || signature.startsWith("Burn(") || signature.startsWith("Collect(")) {
      return address;
    }
  }
  return null;
}

function votingEscrowAddressFromRegistry(registry: Map<Address, AbiRegistryEntry>) {
  for (const [address, entry] of registry.entries()) {
    if (entry.expectedKind === "governance-lock" || entry.source?.contractName === "VotingEscrow") {
      return address;
    }
  }
  return null;
}

function linksFromMetadata(input: {
  chainId: number;
  metadata: Record<string, unknown> | undefined;
  eventType: string;
  evidence: Record<string, unknown>;
}) {
  const metadata = input.metadata ?? {};
  const links: Array<{
    entityType: string;
    entityId: string;
    linkKind: string;
    confidence: "high" | "medium" | "low";
    evidenceJson: Record<string, unknown>;
  }> = [];
  const append = (entityType: string, entityId: string | null, role: string, confidence: "high" | "medium" | "low" = "high") => {
    if (!entityId) return;
    links.push({
      entityType,
      entityId,
      linkKind: role,
      confidence,
      evidenceJson: {
        source: "engine_v2_classification_metadata",
        eventType: input.eventType,
        reason: input.evidence.reason,
      },
    });
  };

  append("deposit", asString(metadata.depositId), "explicit_deposit_identity");
  append("pool", asString(metadata.poolId), "explicit_pool_identity", asString(metadata.poolId) ? "high" : "medium");
  append("strategy_exposure", asString(metadata.strategyExposureId), "explicit_strategy_identity");
  append("strategy", asString(metadata.strategyId), "explicit_strategy_identity");

  const tokenId = asString(metadata.lockTokenId) ?? asString(metadata.tokenId);
  const votingEscrowAddress = asString(metadata.votingEscrowAddress);
  append(
    "governance_lock",
    votingEscrowAddress && tokenId ? `${input.chainId}:${votingEscrowAddress.toLowerCase()}:${tokenId}` : null,
    "explicit_lock_identity",
  );
  append(
    "managed_lock",
    asString(metadata.managedTokenId) ? `${input.chainId}:${asString(metadata.managedTokenId)}` : null,
    "explicit_managed_lock_identity",
    "medium",
  );

  return links;
}

function extractDomainMetadata(input: {
  chainId: number;
  tx: MoralisDecodedTransaction;
  registry: Map<Address, AbiRegistryEntry>;
  eventType: string;
  eventFamily: string;
  movements: Array<Record<string, unknown>>;
}) {
  const metadata: Record<string, unknown> = {};
  const decoded = decodeTransactionInput(input.tx, input.registry);
  const erc721In = firstMovement({ movements: input.movements, assetType: "erc721", direction: "in" });
  const erc721Out = firstMovement({ movements: input.movements, assetType: "erc721", direction: "out" });
  const primaryErc721 = erc721In ?? erc721Out;
  const primaryErc20 = firstMovement({ movements: input.movements, assetType: "erc20" });

  if (input.eventFamily === "deposit" || input.eventType.startsWith("manual_")) {
    const tokenId = asString(primaryErc721?.tokenId);
    const positionManagerAddress = asString(primaryErc721?.tokenAddress) ?? normalizeAddress(input.tx.to_address);
    const poolAddress = findProtocolPoolAddress(input.tx, positionManagerAddress);
    if (tokenId) metadata.tokenId = tokenId;
    if (positionManagerAddress) metadata.positionManagerAddress = positionManagerAddress;
    if (positionManagerAddress && tokenId) metadata.depositId = `${input.chainId}:${positionManagerAddress.toLowerCase()}:${tokenId}`;
    if (poolAddress) {
      metadata.poolAddress = poolAddress;
      metadata.poolId = `${input.chainId}:${poolAddress}`;
      metadata.primaryPoolId = metadata.poolId;
    }
    metadata.sourceSurface = "deposit";
  }

  if (input.eventFamily === "governance" || input.eventType.startsWith("governance_")) {
    const functionName = decoded.functionName;
    const tokenId = asString(decoded.args[0]) ?? asString(primaryErc721?.tokenId);
    const managedTokenId = functionName === "depositManaged" ? asString(decoded.args[1]) : null;
    const votingEscrowAddress = decoded.entry?.expectedKind === "governance-lock"
      ? decoded.entry.address
      : votingEscrowAddressFromRegistry(input.registry);
    if (tokenId) metadata.lockTokenId = tokenId;
    if (tokenId) metadata.tokenId = tokenId;
    if (managedTokenId) metadata.managedTokenId = managedTokenId;
    if (votingEscrowAddress) metadata.votingEscrowAddress = votingEscrowAddress;
    metadata.protocolSurface =
      decoded.entry?.expectedKind === "governance-voter" ? "voter" :
      decoded.entry?.expectedKind === "governance-lock" ? "voting_escrow" :
      decoded.entry?.expectedKind === "governance-rebase" ? "reward_distributor" :
      input.eventType.includes("bribe") ? "briber" :
      input.eventType.includes("fee") ? "fee_distributor" :
      "unknown";
    metadata.governanceEventId = `${input.tx.hash.toLowerCase()}:${input.eventType}`;
    metadata.sourceSurface = "governance";
  }

  if (input.eventFamily === "strategy" || input.eventType.startsWith("strategy_")) {
    const wrapperAddress = normalizeAddress(input.tx.to_address);
    const shareMint = firstMovement({
      movements: input.movements,
      assetType: "erc20",
      direction: "in",
      movementKind: "mint",
      tokenAddress: wrapperAddress,
    }) ?? firstMovement({
      movements: input.movements,
      assetType: "erc20",
      direction: "out",
      movementKind: "burn",
      tokenAddress: wrapperAddress,
    });
    const poolAddress = findProtocolPoolAddress(input.tx, wrapperAddress);
    if (wrapperAddress) metadata.wrapperAddress = wrapperAddress;
    if (wrapperAddress) metadata.strategyExposureId = `${input.chainId}:${wrapperAddress}`;
    if (poolAddress) {
      metadata.poolAddress = poolAddress;
      metadata.poolId = `${input.chainId}:${poolAddress}`;
      metadata.primaryPoolId = metadata.poolId;
    }
    if (shareMint?.amountRaw) {
      metadata.sharesRaw = shareMint.amountRaw;
      metadata.shareDeltaRaw = shareMint.amountRaw;
    }
    metadata.sourceSurface = "strategy";
  }

  if (input.eventType.includes("claim") || input.eventType.includes("reward") || input.eventType.includes("fee") || input.eventType.includes("bribe")) {
    if (primaryErc20?.tokenAddress) metadata.tokenAddress = primaryErc20.tokenAddress;
    if (primaryErc20?.amountRaw) metadata.amountRaw = primaryErc20.amountRaw;
    metadata.rewardId = `${input.tx.hash.toLowerCase()}:${input.eventType}`;
    metadata.rewardType =
      input.eventType.includes("bribe") ? "governance_bribe" :
      input.eventType.includes("fee") ? "governance_fee" :
      input.eventType.includes("rebase") ? "rebase" :
      input.eventType.includes("strategy") ? "strategy_reward" :
      "unknown";
  }

  if (primaryErc20?.tokenAddress) metadata.tokenAddress ??= primaryErc20.tokenAddress;
  return metadata;
}

export async function runEngineV2ClassifyChronological(
  rawPayload: unknown,
  deps: EngineV2ClassificationDeps = {},
) {
  const payload = engineV2WalletPayloadSchema.parse(rawPayload);
  if (!deps.loadTransactions && !payload.collectionRunId) {
    throw new Error("ENGINE_V2_COLLECTION_RUN_ID_REQUIRED");
  }
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
