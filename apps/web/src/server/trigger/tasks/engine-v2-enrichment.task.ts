import { task, tasks } from "@trigger.dev/sdk/v3";
import { decodeFunctionResult, encodeFunctionData, parseAbi } from "viem";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";

import { updateAnalysisRunProgress } from "@/server/analysis/analysis-run.repository";
import {
  distributorPoolLinkFromGaugeCreated,
  governanceLockFromTransferBackfill,
  persistEnrichmentNeeds,
  planEnrichmentNeedsForClassification,
  persistTokenMetadataBatch,
  poolDefinitionSnapshot,
  toPricePointValues,
  type EngineV2EnrichmentNeedInput,
} from "@/server/analysis/engine-v2/enrichment";
import { engineV2EnrichmentBatchPayloadSchema, engineV2WalletPayloadSchema } from "@/server/analysis/engine-v2/payloads";
import { getHistoricalTokenPricesByAddress, alchemyRpc } from "@/server/providers/alchemy";
import { moralisGet } from "@/server/providers/moralis/client";
import { getDb } from "@/server/db/client";
import {
  canonicalTransactionLogs,
  engineV2DistributorPoolLinks,
  engineV2DomainEvents,
  engineV2EnrichmentNeeds,
  engineV2GovernanceLocks,
  engineV2PricePoints,
  engineV2ProtocolKnownAddresses,
  engineV2ProtocolStateSnapshots,
  engineV2TokenMetadata,
} from "@/server/db/schema";
import { taskError, taskInfo, taskLog, taskWarn, withTaskLogging } from "@/server/trigger/tasks/task-logging";

export type EngineV2EnrichmentDeps = {
  planNeeds?: (input: { chainId: number; walletAddress: string }) => Promise<EngineV2EnrichmentNeedInput[]>;
  persistNeeds?: typeof persistEnrichmentNeeds;
  loadQueuedNeeds?: (input: { chainId: number; walletAddress: string; needTypes?: string[]; limit: number }) => Promise<EngineV2EnrichmentNeedInput[]>;
  resolveNeed?: (need: EngineV2EnrichmentNeedInput) => Promise<"resolved" | "unresolved" | "failed">;
  trigger?: (taskId: string, payload: Record<string, unknown>, options: { idempotencyKey: string }) => Promise<unknown>;
};

type MoralisTokenMetadataRecord = {
  address?: string;
  symbol?: string;
  name?: string;
  decimals?: number | string;
  possible_spam?: boolean;
  possibleSpam?: boolean;
  verified_contract?: boolean;
  verifiedContract?: boolean;
  category?: string;
  rawJson?: Record<string, unknown>;
};

type MoralisNftTransferRecord = Record<string, unknown>;

const AERODROME_POOL_ABI = parseAbi([
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function tickSpacing() view returns (int24)",
]);

const PROTOCOL_GRANT_ADDRESS_KINDS = new Set([
  "protocol-grants",
  "protocol-public-goods",
  "protocol-buyback",
  "protocol-airdrop",
]);

const ACCOUNTING_BLOCKING_NEED_TYPES = new Set([
  "abi",
  "selector",
  "log_decode",
  "historical_price",
  "pool_definition",
  "lock_identity",
  "distributor_pool_link",
  "strategy_state",
  "transaction_decoded_backfill",
]);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asInteger(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value !== "string" || value.length === 0) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function asDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value !== "string" || value.length === 0) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeAddress(value: unknown) {
  const address = asString(value);
  return address ? address.toLowerCase() : null;
}

function movementRecords(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
}

function paramsToRecord(value: unknown) {
  if (Array.isArray(value)) {
    return Object.fromEntries(
      value
        .map((item) => {
          const record = asRecord(item);
          const key = asString(record.name);
          const fieldValue = asString(record.value);
          return key && fieldValue ? [key, fieldValue] : null;
        })
        .filter((entry): entry is [string, string] => Boolean(entry)),
    );
  }

  return Object.fromEntries(
    Object.entries(asRecord(value))
      .map(([key, fieldValue]) => {
        const normalized = asString(fieldValue);
        return normalized ? [key, normalized] : null;
      })
      .filter((entry): entry is [string, string] => Boolean(entry)),
  );
}

function isGaugeCreatedEvent(decodedEventJson: unknown) {
  const record = asRecord(decodedEventJson);
  const name = asString(record.event_name) ?? asString(record.eventName) ?? asString(record.name) ?? asString(record.label);
  const signature = asString(record.signature);
  return name === "GaugeCreated" || signature?.startsWith("GaugeCreated(") === true;
}

function extractTokenAddressFromNeed(need: EngineV2EnrichmentNeedInput) {
  return normalizeAddress(asRecord(need.requestJson).tokenAddress) ?? normalizeAddress(need.targetId.split(":")[0]);
}

export function pickClosestHistoricalPricePoint(
  points: Array<{ value?: string; timestamp?: string }>,
  occurredAt: Date,
) {
  return points
    .map((point) => ({
      point,
      datedAt: asDate(point.timestamp),
    }))
    .filter((candidate): candidate is { point: { value?: string; timestamp?: string }; datedAt: Date } => Boolean(candidate.datedAt))
    .sort((left, right) => Math.abs(left.datedAt.getTime() - occurredAt.getTime()) - Math.abs(right.datedAt.getTime() - occurredAt.getTime()))[0]?.point ?? null;
}

export function knownAddressKindToLockProvenance(addressKind: string | null | undefined) {
  return addressKind && PROTOCOL_GRANT_ADDRESS_KINDS.has(addressKind) ? "protocol_grant" as const : "unknown" as const;
}

function appendNeed(
  needs: Map<string, EngineV2EnrichmentNeedInput>,
  input: EngineV2EnrichmentNeedInput,
) {
  const key = `${input.needType}:${input.targetType}:${input.targetId}:${(input.reasonCodes ?? []).join(",")}`;
  needs.set(key, input);
}

function accountingBlockingNeedTypes(needTypes?: string[]) {
  const effective = needTypes?.filter((needType) => ACCOUNTING_BLOCKING_NEED_TYPES.has(needType))
    ?? [...ACCOUNTING_BLOCKING_NEED_TYPES];
  return effective.length > 0 ? effective : undefined;
}

async function planNeedsFromDomainEvents(input: { chainId: number; walletAddress: string }) {
  const rows = await getDb().select().from(engineV2DomainEvents).where(and(
    eq(engineV2DomainEvents.chainId, input.chainId),
    eq(engineV2DomainEvents.walletAddress, input.walletAddress.toLowerCase()),
  ));
  const needs = new Map<string, EngineV2EnrichmentNeedInput>();
  for (const event of rows) {
    for (const planned of planEnrichmentNeedsForClassification({
      chainId: event.chainId,
      walletAddress: event.walletAddress,
      txHash: event.txHash,
      sourceDomainEventId: event.id,
      classification: {
        eventType: event.eventType,
        eventFamily: event.eventFamily,
        coverageStatus: event.coverageStatus as "full" | "partial" | "unresolved" | "unsupported" | "excluded",
        confidence: event.confidence as "high" | "medium" | "low" | "none",
        reasonCodes: event.reasonCodes,
        evidence: event.evidenceJson,
        metadataJson: event.metadataJson,
      },
    })) {
      appendNeed(needs, planned);
    }

    const metadata = asRecord(event.metadataJson);
    const evidence = asRecord(event.evidenceJson);
    const movements = movementRecords(evidence.movements);
    for (const tokenAddress of new Set([
      asString(metadata.tokenAddress),
      ...movements.map((movement) => asString(movement.tokenAddress)),
    ].filter((value): value is string => Boolean(value)))) {
      appendNeed(needs, {
        chainId: event.chainId,
        walletAddress: event.walletAddress,
        sourceDomainEventId: event.id,
        needType: "token_metadata",
        targetType: "token",
        targetId: tokenAddress.toLowerCase(),
        reasonCodes: ["missing_token_metadata"],
        requestJson: { txHash: event.txHash },
      });
      appendNeed(needs, {
        chainId: event.chainId,
        walletAddress: event.walletAddress,
        sourceDomainEventId: event.id,
        needType: "historical_price",
        targetType: "token",
        targetId: `${tokenAddress.toLowerCase()}:${event.txHash}`,
        reasonCodes: ["missing_historical_price"],
        requestJson: {
          tokenAddress: tokenAddress.toLowerCase(),
          txHash: event.txHash,
          occurredAt: event.occurredAt.toISOString(),
        },
      });
    }

    const poolAddress = asString(metadata.poolAddress);
    if (poolAddress) {
      appendNeed(needs, {
        chainId: event.chainId,
        walletAddress: event.walletAddress,
        sourceDomainEventId: event.id,
        needType: "pool_definition",
        targetType: "pool",
        targetId: poolAddress.toLowerCase(),
        reasonCodes: ["missing_pool_definition"],
        requestJson: { poolAddress: poolAddress.toLowerCase(), txHash: event.txHash },
      });
    }

    const lockTokenId = asString(metadata.lockTokenId) ?? asString(metadata.tokenId);
    if (event.eventFamily === "governance" && lockTokenId) {
      appendNeed(needs, {
        chainId: event.chainId,
        walletAddress: event.walletAddress,
        sourceDomainEventId: event.id,
        needType: "lock_identity",
        targetType: "governance_lock",
        targetId: lockTokenId,
        reasonCodes: ["missing_lock_identity"],
        requestJson: {
          lockTokenId,
          votingEscrowAddress: asString(metadata.votingEscrowAddress),
          txHash: event.txHash,
        },
      });
    }
  }
  return [...needs.values()];
}

async function loadQueuedNeedsFromDb(input: { chainId: number; walletAddress: string; needTypes?: string[]; limit: number }) {
  const filters = [
    eq(engineV2EnrichmentNeeds.chainId, input.chainId),
    eq(engineV2EnrichmentNeeds.status, "queued"),
    or(isNull(engineV2EnrichmentNeeds.walletAddress), eq(engineV2EnrichmentNeeds.walletAddress, input.walletAddress.toLowerCase())),
  ];
  if (input.needTypes && input.needTypes.length > 0) {
    filters.push(inArray(engineV2EnrichmentNeeds.needType, input.needTypes));
  }
  const rows = await getDb().select().from(engineV2EnrichmentNeeds).where(and(...filters)).limit(input.limit);
  return rows.map((row) => ({
    id: row.id,
    chainId: row.chainId,
    walletAddress: row.walletAddress ?? input.walletAddress,
    needType: row.needType,
    priority: row.priority,
    sourceDomainEventId: row.sourceDomainEventId,
    targetType: asString(row.requestJson.targetType) ?? row.needType,
    targetId: asString(row.requestJson.targetId) ?? row.naturalKey,
    reasonCodes: row.reasonCodes,
    requestJson: row.requestJson,
  } as EngineV2EnrichmentNeedInput & { id: string }));
}

async function updateNeedStatus(input: {
  need: EngineV2EnrichmentNeedInput & { id?: string };
  status: "resolved" | "unresolved" | "failed";
  resultJson: Record<string, unknown>;
  lastError?: string | null;
}) {
  if (!input.need.id) return input.status;

  await getDb().update(engineV2EnrichmentNeeds).set({
    status: input.status,
    attemptCount: sql`${engineV2EnrichmentNeeds.attemptCount} + 1`,
    resultJson: input.resultJson,
    lastError: input.lastError ?? null,
    updatedAt: new Date(),
  }).where(eq(engineV2EnrichmentNeeds.id, input.need.id));

  return input.status;
}

async function markNeedUnresolved(need: EngineV2EnrichmentNeedInput & { id?: string }) {
  return updateNeedStatus({
    need,
    status: "unresolved",
    resultJson: {
      status: "unresolved",
      reasonCodes: need.reasonCodes ?? [],
      note: "Resolver could not produce explicit evidence for this need.",
    },
  });
}

async function markNeedResolved(need: EngineV2EnrichmentNeedInput & { id?: string }, resultJson: Record<string, unknown>) {
  return updateNeedStatus({
    need,
    status: "resolved",
    resultJson: {
      status: "resolved",
      ...resultJson,
    },
  });
}

async function markNeedFailed(need: EngineV2EnrichmentNeedInput & { id?: string }, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return updateNeedStatus({
    need,
    status: "failed",
    lastError: message,
    resultJson: {
      status: "failed",
      error: message,
      reasonCodes: need.reasonCodes ?? [],
    },
  });
}

async function resolveTokenMetadataNeed(need: EngineV2EnrichmentNeedInput & { id?: string }) {
  const db = getDb();
  const tokenAddress = extractTokenAddressFromNeed(need);
  if (!tokenAddress) {
    return markNeedUnresolved(need);
  }

  const existing = await db.select().from(engineV2TokenMetadata).where(and(
    eq(engineV2TokenMetadata.chainId, need.chainId),
    eq(engineV2TokenMetadata.tokenAddress, tokenAddress),
  )).limit(1);
  if (existing[0]) {
    return markNeedResolved(need, {
      resolver: "db_token_metadata",
      tokenAddress,
      metadataId: existing[0].id,
    });
  }

  const payload = await moralisGet<MoralisTokenMetadataRecord[] | { result?: MoralisTokenMetadataRecord[] }>(
    "/erc20/metadata",
    need.chainId,
    { addresses: tokenAddress },
  );
  const metadataRows = Array.isArray(payload) ? payload : Array.isArray(payload.result) ? payload.result : [];
  const matched = metadataRows.find((row) => normalizeAddress(row.address) === tokenAddress) ?? metadataRows[0];
  if (!matched) {
    return markNeedUnresolved(need);
  }

  await persistTokenMetadataBatch({
    db,
    chainId: need.chainId,
    metadata: [{
      tokenAddress,
      symbol: matched.symbol ?? null,
      name: matched.name ?? null,
      decimals: asInteger(matched.decimals),
      category: matched.category ?? null,
      verified: matched.verified_contract ?? matched.verifiedContract ?? false,
      possibleSpam: matched.possible_spam ?? matched.possibleSpam ?? false,
      rawJson: matched.rawJson ?? matched as Record<string, unknown>,
    }],
  });

  return markNeedResolved(need, {
    resolver: "moralis_token_metadata",
    tokenAddress,
  });
}

async function resolveHistoricalPriceNeed(need: EngineV2EnrichmentNeedInput & { id?: string }) {
  const db = getDb();
  const request = asRecord(need.requestJson);
  const tokenAddress = extractTokenAddressFromNeed(need);
  const occurredAt = asDate(request.occurredAt);
  if (!tokenAddress || !occurredAt) {
    return markNeedUnresolved(need);
  }

  const existingRows = await db.select().from(engineV2PricePoints).where(and(
    eq(engineV2PricePoints.chainId, need.chainId),
    eq(engineV2PricePoints.tokenAddress, tokenAddress),
    eq(engineV2PricePoints.resolution, "historical"),
  )).orderBy(desc(engineV2PricePoints.pricedAt)).limit(24);
  const existing = existingRows
    .filter((row) => row.pricedAt instanceof Date)
    .sort((left, right) => Math.abs((left.pricedAt?.getTime() ?? 0) - occurredAt.getTime()) - Math.abs((right.pricedAt?.getTime() ?? 0) - occurredAt.getTime()))[0];
  if (existing && existing.pricedAt && Math.abs(existing.pricedAt.getTime() - occurredAt.getTime()) <= 60 * 60 * 1000) {
    return markNeedResolved(need, {
      resolver: "db_historical_price",
      tokenAddress,
      pricePointId: existing.id,
      status: existing.status,
    });
  }

  const response = await getHistoricalTokenPricesByAddress(need.chainId, {
    address: tokenAddress,
    startTime: new Date(occurredAt.getTime() - 60 * 60 * 1000).toISOString(),
    endTime: new Date(occurredAt.getTime() + 60 * 60 * 1000).toISOString(),
    interval: "1h",
  });
  const nearest = pickClosestHistoricalPricePoint(response.data ?? [], occurredAt);
  const pricedAt = asDate(nearest?.timestamp) ?? occurredAt;
  const priceUsd = nearest?.value ?? null;

  await db.insert(engineV2PricePoints).values([
    toPricePointValues({
      chainId: need.chainId,
      tokenAddress,
      pricedAt,
      priceUsd,
      sourceProvider: "alchemy",
      resolution: "historical",
      status: priceUsd ? "resolved" : "unavailable",
      metadataJson: {
        requestOccurredAt: occurredAt.toISOString(),
      },
    }),
  ]).onConflictDoNothing();

  return markNeedResolved(need, {
    resolver: "alchemy_historical_price",
    tokenAddress,
    status: priceUsd ? "resolved" : "unavailable",
    pricedAt: pricedAt.toISOString(),
  });
}

async function resolvePoolDefinitionNeed(need: EngineV2EnrichmentNeedInput & { id?: string }) {
  const db = getDb();
  const poolAddress = normalizeAddress(asRecord(need.requestJson).poolAddress) ?? normalizeAddress(need.targetId);
  if (!poolAddress) {
    return markNeedUnresolved(need);
  }

  const existing = await db.select().from(engineV2ProtocolStateSnapshots).where(and(
    eq(engineV2ProtocolStateSnapshots.chainId, need.chainId),
    eq(engineV2ProtocolStateSnapshots.protocol, "aerodrome"),
    eq(engineV2ProtocolStateSnapshots.subjectType, "pool"),
    eq(engineV2ProtocolStateSnapshots.subjectAddress, poolAddress),
  )).orderBy(desc(engineV2ProtocolStateSnapshots.observedAt)).limit(1);
  if (existing[0]) {
    return markNeedResolved(need, {
      resolver: "db_pool_definition",
      poolAddress,
      snapshotId: existing[0].id,
    });
  }

  const [token0Hex, token1Hex, tickSpacingHex] = await Promise.all([
    alchemyRpc<string>("eth_call", [{ to: poolAddress, data: encodeFunctionData({ abi: AERODROME_POOL_ABI, functionName: "token0" }) }, "latest"], { chainId: need.chainId }),
    alchemyRpc<string>("eth_call", [{ to: poolAddress, data: encodeFunctionData({ abi: AERODROME_POOL_ABI, functionName: "token1" }) }, "latest"], { chainId: need.chainId }),
    alchemyRpc<string>("eth_call", [{ to: poolAddress, data: encodeFunctionData({ abi: AERODROME_POOL_ABI, functionName: "tickSpacing" }) }, "latest"], { chainId: need.chainId }),
  ]);

  const token0 = normalizeAddress(decodeFunctionResult({ abi: AERODROME_POOL_ABI, functionName: "token0", data: token0Hex as `0x${string}` }));
  const token1 = normalizeAddress(decodeFunctionResult({ abi: AERODROME_POOL_ABI, functionName: "token1", data: token1Hex as `0x${string}` }));
  const tickSpacing = Number(decodeFunctionResult({ abi: AERODROME_POOL_ABI, functionName: "tickSpacing", data: tickSpacingHex as `0x${string}` }));
  if (!token0 || !token1 || !Number.isFinite(tickSpacing)) {
    return markNeedUnresolved(need);
  }

  await db.insert(engineV2ProtocolStateSnapshots).values([
    poolDefinitionSnapshot({
      chainId: need.chainId,
      poolAddress,
      token0,
      token1,
      tickSpacing,
      evidenceJson: { resolver: "engine-v2-enrichment" },
    }),
  ]).onConflictDoNothing();

  return markNeedResolved(need, {
    resolver: "alchemy_pool_definition",
    poolAddress,
    token0,
    token1,
    tickSpacing,
  });
}

async function resolveDistributorPoolLinkNeed(need: EngineV2EnrichmentNeedInput & { id?: string }) {
  const db = getDb();
  const distributorAddress = normalizeAddress(asRecord(need.requestJson).distributorAddress) ?? normalizeAddress(need.targetId);
  if (!distributorAddress) {
    return markNeedUnresolved(need);
  }

  const existing = await db.select().from(engineV2DistributorPoolLinks).where(and(
    eq(engineV2DistributorPoolLinks.chainId, need.chainId),
    eq(engineV2DistributorPoolLinks.distributorAddress, distributorAddress),
  )).limit(1);
  if (existing[0]) {
    return markNeedResolved(need, {
      resolver: "db_distributor_pool_link",
      distributorAddress,
      linkId: existing[0].id,
    });
  }

  const txHash = normalizeAddress(asRecord(need.requestJson).txHash) ?? asString(asRecord(need.requestJson).txHash)?.toLowerCase() ?? null;
  if (!txHash) {
    return markNeedUnresolved(need);
  }

  const logs = await db.select().from(canonicalTransactionLogs).where(and(
    eq(canonicalTransactionLogs.chainId, need.chainId),
    eq(canonicalTransactionLogs.txHash, txHash),
  ));
  const matches = logs
    .map((log) => {
      if (!isGaugeCreatedEvent(log.decodedEventJson)) return null;
      const params = paramsToRecord(asRecord(log.decodedEventJson).params ?? asRecord(log.decodedEventJson).args);
      const row = distributorPoolLinkFromGaugeCreated({
        chainId: need.chainId,
        txHash: log.txHash,
        logIndex: log.logIndex,
        params,
      });
      return row?.distributorAddress === distributorAddress ? row : null;
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  if (matches.length === 0) {
    return markNeedUnresolved(need);
  }

  await db.insert(engineV2DistributorPoolLinks).values(matches).onConflictDoNothing();
  return markNeedResolved(need, {
    resolver: "canonical_gauge_created",
    distributorAddress,
    persistedCount: matches.length,
  });
}

async function resolveLockIdentityNeed(need: EngineV2EnrichmentNeedInput & { id?: string }) {
  const db = getDb();
  const request = asRecord(need.requestJson);
  const lockTokenId = asString(request.lockTokenId) ?? asString(need.targetId);
  const votingEscrowAddress = normalizeAddress(request.votingEscrowAddress);
  if (!lockTokenId || !votingEscrowAddress) {
    return markNeedUnresolved(need);
  }

  const existing = await db.select().from(engineV2GovernanceLocks).where(and(
    eq(engineV2GovernanceLocks.chainId, need.chainId),
    eq(engineV2GovernanceLocks.votingEscrowAddress, votingEscrowAddress),
    eq(engineV2GovernanceLocks.lockTokenId, lockTokenId),
  )).limit(1);
  if (existing[0]) {
    return markNeedResolved(need, {
      resolver: "db_governance_lock",
      governanceLockId: existing[0].id,
      lockTokenId,
    });
  }

  const transferPayload = await moralisGet<{ result?: MoralisNftTransferRecord[] }>(
    `/nft/${votingEscrowAddress}/${lockTokenId}/transfers`,
    need.chainId,
    { limit: 100 },
  );
  const walletAddress = need.walletAddress.toLowerCase();
  const transfers = Array.isArray(transferPayload.result) ? transferPayload.result : [];
  const matchingTransfer = transfers
    .map((transfer) => ({
      transfer,
      blockTimestamp: asDate(transfer.block_timestamp),
      toAddress: normalizeAddress(transfer.to_address),
      fromAddress: normalizeAddress(transfer.from_address),
      operator: normalizeAddress(transfer.operator),
      txHash: asString(transfer.transaction_hash)?.toLowerCase() ?? null,
    }))
    .filter((transfer) => transfer.toAddress === walletAddress && transfer.txHash)
    .sort((left, right) => (left.blockTimestamp?.getTime() ?? Number.MAX_SAFE_INTEGER) - (right.blockTimestamp?.getTime() ?? Number.MAX_SAFE_INTEGER))[0];

  if (!matchingTransfer?.txHash) {
    return markNeedUnresolved(need);
  }

  const knownAddresses = [matchingTransfer.fromAddress, matchingTransfer.toAddress, matchingTransfer.operator]
    .filter((address): address is string => Boolean(address));
  const knownAddressRows = knownAddresses.length > 0
    ? await db.select().from(engineV2ProtocolKnownAddresses).where(and(
      eq(engineV2ProtocolKnownAddresses.chainId, need.chainId),
      inArray(engineV2ProtocolKnownAddresses.address, knownAddresses),
    ))
    : [];
  const protocolGrantMatch = knownAddressRows.find((row) => PROTOCOL_GRANT_ADDRESS_KINDS.has(row.addressKind));
  const provenance = knownAddressKindToLockProvenance(protocolGrantMatch?.addressKind);

  await db.insert(engineV2GovernanceLocks).values([
    governanceLockFromTransferBackfill({
      chainId: need.chainId,
      walletAddress,
      votingEscrowAddress,
      tokenId: lockTokenId,
      originTxHash: matchingTransfer.txHash,
      source: "nft_transfer_history",
      provenance,
      evidenceJson: {
        protocolKnownAddressKind: protocolGrantMatch?.addressKind ?? null,
        protocolKnownAddress: protocolGrantMatch?.address ?? null,
        nftTransfer: matchingTransfer.transfer,
      },
    }),
  ]).onConflictDoNothing();

  return markNeedResolved(need, {
    resolver: "moralis_nft_transfer_history",
    lockTokenId,
    originTxHash: matchingTransfer.txHash,
    provenance,
  });
}

export async function resolveEnrichmentNeed(need: EngineV2EnrichmentNeedInput & { id?: string }) {
  try {
    switch (need.needType) {
      case "token_metadata":
        return await resolveTokenMetadataNeed(need);
      case "historical_price":
        return await resolveHistoricalPriceNeed(need);
      case "pool_definition":
        return await resolvePoolDefinitionNeed(need);
      case "distributor_pool_link":
        return await resolveDistributorPoolLinkNeed(need);
      case "lock_identity":
        return await resolveLockIdentityNeed(need);
      default:
        return await markNeedUnresolved(need);
    }
  } catch (error) {
    taskError("engine-v2-run-enrichment-batch", "need resolution failed and will be marked failed", {
      needId: need.id,
      needType: need.needType,
      targetType: need.targetType,
      targetId: need.targetId,
      error: error instanceof Error ? error.message : String(error),
    });
    return markNeedFailed(need, error);
  }
}

export async function runEngineV2PlanEnrichment(rawPayload: unknown, deps: EngineV2EnrichmentDeps = {}) {
  const payload = engineV2WalletPayloadSchema.parse(rawPayload);
  if (payload.analysisRunId) {
    await updateAnalysisRunProgress(payload.analysisRunId, {
      status: "running",
      stage: "engine_v2_enrichment",
      progressPct: 66,
    });
  }
  const needs = await (deps.planNeeds?.(payload) ?? planNeedsFromDomainEvents(payload));
  taskInfo("engine-v2-plan-enrichment", "planned enrichment needs", {
    chainId: payload.chainId,
    walletAddress: payload.walletAddress,
    plannedNeedCount: needs.length,
  });
  const result = await (deps.persistNeeds ?? persistEnrichmentNeeds)({
    db: getDb(),
    needs,
  });
  taskInfo("engine-v2-plan-enrichment", "persisted enrichment needs", {
    result,
  });
  const triggerTask = deps.trigger ?? ((taskId, taskPayload, options) => tasks.trigger(taskId, taskPayload, options));
  taskInfo("engine-v2-plan-enrichment", "queueing first enrichment batch", {
    chainId: payload.chainId,
    walletAddress: payload.walletAddress,
    collectionRunId: payload.collectionRunId ?? null,
  });
  await triggerTask("engine-v2-run-enrichment-batch", payload, {
    idempotencyKey: `engine-v2-run-enrichment:${payload.chainId}:${payload.walletAddress}:${payload.collectionRunId ?? "latest"}`,
  });

  return result;
}

export async function runEngineV2RunEnrichmentBatch(rawPayload: unknown, deps: EngineV2EnrichmentDeps = {}) {
  const payload = engineV2EnrichmentBatchPayloadSchema.parse(rawPayload);
  if (payload.analysisRunId) {
    await updateAnalysisRunProgress(payload.analysisRunId, {
      status: "running",
      stage: "engine_v2_enrichment",
      progressPct: 74,
    });
  }
  const needs = await (deps.loadQueuedNeeds?.({
    chainId: payload.chainId,
    walletAddress: payload.walletAddress,
    needTypes: payload.needTypes,
    limit: payload.limit,
  }) ?? loadQueuedNeedsFromDb({
    chainId: payload.chainId,
    walletAddress: payload.walletAddress,
    needTypes: payload.needTypes,
    limit: payload.limit,
  }));
  const boundedNeeds = needs.slice(0, payload.limit);
  taskInfo("engine-v2-run-enrichment-batch", "loaded queued enrichment needs", {
    chainId: payload.chainId,
    walletAddress: payload.walletAddress,
    requestedLimit: payload.limit,
    requestedNeedTypes: payload.needTypes ?? null,
    queuedNeedCount: needs.length,
    attemptedNeedCount: boundedNeeds.length,
  });
  if (boundedNeeds.length === 0) {
    taskWarn("engine-v2-run-enrichment-batch", "no queued enrichment needs found in this batch", {
      chainId: payload.chainId,
      walletAddress: payload.walletAddress,
      requestedNeedTypes: payload.needTypes ?? null,
    });
  }
  const results = [];
  for (const [index, need] of boundedNeeds.entries()) {
    taskLog("engine-v2-run-enrichment-batch", "resolving enrichment need", {
      index: index + 1,
      total: boundedNeeds.length,
      needId: need.id,
      needType: need.needType,
      targetType: need.targetType,
      targetId: need.targetId,
      reasonCodes: need.reasonCodes ?? [],
    });
    const result = await (deps.resolveNeed?.(need) ?? resolveEnrichmentNeed(need));
    results.push(result);
    taskLog("engine-v2-run-enrichment-batch", "enrichment need resolved", {
      index: index + 1,
      total: boundedNeeds.length,
      needId: need.id,
      needType: need.needType,
      targetId: need.targetId,
      result,
    });
  }

  const triggerTask = deps.trigger ?? ((taskId, taskPayload, options) => tasks.trigger(taskId, taskPayload, options));
  const remainingBlockingNeedTypes = accountingBlockingNeedTypes(payload.needTypes);
  const remainingBlockingNeeds = remainingBlockingNeedTypes
    ? await (deps.loadQueuedNeeds?.({
      chainId: payload.chainId,
      walletAddress: payload.walletAddress,
      needTypes: remainingBlockingNeedTypes,
      limit: 1,
    }) ?? loadQueuedNeedsFromDb({
      chainId: payload.chainId,
      walletAddress: payload.walletAddress,
      needTypes: remainingBlockingNeedTypes,
      limit: 1,
    }))
    : [];
  const batchSummary = {
    attemptedCount: boundedNeeds.length,
    resolvedCount: results.filter((result) => result === "resolved").length,
    unresolvedCount: results.filter((result) => result === "unresolved").length,
    failedCount: results.filter((result) => result === "failed").length,
    remainingBlockingNeedCount: remainingBlockingNeeds.length,
  };
  taskInfo("engine-v2-run-enrichment-batch", "batch resolution summary", batchSummary);

  if (remainingBlockingNeeds.length > 0) {
    const nextNeedKey = remainingBlockingNeeds[0]?.id ?? `${remainingBlockingNeeds[0]?.needType ?? "queued"}:${remainingBlockingNeeds[0]?.targetId ?? "unknown"}`;
    taskWarn("engine-v2-run-enrichment-batch", "blocking enrichment needs remain; queueing another batch", {
      nextNeedKey,
      remainingBlockingNeedType: remainingBlockingNeeds[0]?.needType ?? null,
      remainingBlockingTargetId: remainingBlockingNeeds[0]?.targetId ?? null,
      requestedNeedTypes: payload.needTypes ?? null,
    });
    await triggerTask("engine-v2-run-enrichment-batch", payload, {
      idempotencyKey: `engine-v2-run-enrichment:${payload.chainId}:${payload.walletAddress}:${payload.collectionRunId ?? "latest"}:${nextNeedKey}`,
    });
  } else {
    taskInfo("engine-v2-run-enrichment-batch", "no blocking enrichment needs remain; queueing accounting", {
      chainId: payload.chainId,
      walletAddress: payload.walletAddress,
      collectionRunId: payload.collectionRunId ?? null,
    });
    await triggerTask("engine-v2-account-chronological", payload, {
      idempotencyKey: `engine-v2-account:${payload.chainId}:${payload.walletAddress}:${payload.collectionRunId ?? "latest"}`,
    });
  }

  return {
    attemptedCount: batchSummary.attemptedCount,
    resolvedCount: batchSummary.resolvedCount,
    unresolvedCount: batchSummary.unresolvedCount,
    failedCount: batchSummary.failedCount,
  };
}

export const engineV2PlanEnrichmentTask = task({
  id: "engine-v2-plan-enrichment",
  run: async (payload: unknown) => withTaskLogging(
    "engine-v2-plan-enrichment",
    payload,
    () => runEngineV2PlanEnrichment(payload),
  ),
});

export const engineV2RunEnrichmentBatchTask = task({
  id: "engine-v2-run-enrichment-batch",
  run: async (payload: unknown) => withTaskLogging(
    "engine-v2-run-enrichment-batch",
    payload,
    () => runEngineV2RunEnrichmentBatch(payload),
  ),
});
