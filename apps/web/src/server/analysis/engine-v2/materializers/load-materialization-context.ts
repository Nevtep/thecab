import { and, desc, eq, inArray } from "drizzle-orm";

import type { EngineV2AccountingOutput } from "@/server/analysis/engine-v2/accounting";
import { getDb } from "@/server/db/client";
import { engineV2GovernanceLocks, engineV2ProtocolStateSnapshots, engineV2TokenMetadata } from "@/server/db/schema";

export type EngineV2MaterializationTokenMetadata = {
  tokenAddress: string;
  symbol: string | null;
  decimals: number | null;
};

export type EngineV2MaterializationPoolState = {
  poolId: string;
  poolAddress: string;
  token0Address: string | null;
  token1Address: string | null;
  tickSpacing: number | null;
  feeTierBps: number | null;
};

export type EngineV2MaterializationStrategyState = {
  strategyExposureId: string | null;
  wrapperAddress: string;
  underlyingPoolAddress: string | null;
  currentSharesRaw: string | null;
  currentEstimatedValueUsd: number | null;
};

export type EngineV2MaterializationGovernanceLock = {
  lockKey: string;
  lockTokenId: string;
  votingEscrowAddress: string | null;
  originTxHash: string | null;
  originKind: string;
  status: string;
  coverageStatus: string;
  confidence: string;
  reasonCodes: string[];
  metadataJson: Record<string, unknown>;
};

export type EngineV2MaterializationContext = {
  poolStateByPoolId: Map<string, EngineV2MaterializationPoolState>;
  tokenMetadataByAddress: Map<string, EngineV2MaterializationTokenMetadata>;
  governanceLockByLockKey: Map<string, EngineV2MaterializationGovernanceLock>;
  governanceLockByTokenId: Map<string, EngineV2MaterializationGovernanceLock>;
  strategyStateByExposureId: Map<string, EngineV2MaterializationStrategyState>;
  strategyStateByWrapperAddress: Map<string, EngineV2MaterializationStrategyState>;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asInteger(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : null;
  }
  return null;
}

function asNullableFiniteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function movementRecords(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
}

function poolAddressFromPoolId(poolId: string | null | undefined) {
  if (!poolId) return null;
  const poolAddress = poolId.split(":").at(-1) ?? null;
  return poolAddress?.toLowerCase() ?? null;
}

export function emptyMaterializationContext(): EngineV2MaterializationContext {
  return {
    poolStateByPoolId: new Map(),
    tokenMetadataByAddress: new Map(),
    governanceLockByLockKey: new Map(),
    governanceLockByTokenId: new Map(),
    strategyStateByExposureId: new Map(),
    strategyStateByWrapperAddress: new Map(),
  };
}

export function collectMaterializationPoolIds(accounting: EngineV2AccountingOutput) {
  return Array.from(new Set([
    ...accounting.deposits.map((deposit) => deposit.poolId),
    ...accounting.strategies.map((strategy) => strategy.poolId),
    ...accounting.pools.map((pool) => pool.poolId),
    ...accounting.rewards.map((reward) => reward.poolId),
  ].filter((poolId): poolId is string => typeof poolId === "string" && poolId.length > 0)));
}

export async function loadMaterializationContext(input: {
  chainId: number;
  accounting: EngineV2AccountingOutput;
}): Promise<EngineV2MaterializationContext> {
  const context = emptyMaterializationContext();
  const db = getDb();
  const poolIds = collectMaterializationPoolIds(input.accounting);
  const poolAddresses = poolIds
    .map((poolId) => poolAddressFromPoolId(poolId))
    .filter((poolAddress): poolAddress is string => Boolean(poolAddress));
  const strategyWrapperAddresses = Array.from(new Set(
    input.accounting.strategies
      .map((strategy) => asString(strategy.wrapperAddress)?.toLowerCase() ?? null)
      .filter((wrapperAddress): wrapperAddress is string => Boolean(wrapperAddress)),
  ));
  const governanceTokenIds = Array.from(new Set([
    ...input.accounting.governance.locks.map((lock) => lock.tokenId),
    ...input.accounting.governance.events.map((event) => event.tokenId).filter((tokenId): tokenId is string => typeof tokenId === "string" && tokenId.length > 0),
    ...input.accounting.rewards.map((reward) => reward.lockTokenId).filter((tokenId): tokenId is string => typeof tokenId === "string" && tokenId.length > 0),
  ]));

  const snapshotRows = poolAddresses.length === 0
    ? []
    : await db
      .select()
      .from(engineV2ProtocolStateSnapshots)
      .where(and(
        eq(engineV2ProtocolStateSnapshots.chainId, input.chainId),
        eq(engineV2ProtocolStateSnapshots.protocol, "aerodrome"),
        eq(engineV2ProtocolStateSnapshots.subjectType, "pool"),
        inArray(engineV2ProtocolStateSnapshots.subjectAddress, poolAddresses),
      ))
      .orderBy(desc(engineV2ProtocolStateSnapshots.observedAt));

  const latestSnapshotByAddress = new Map<string, typeof snapshotRows[number]>();
  for (const snapshot of snapshotRows) {
    const key = snapshot.subjectAddress.toLowerCase();
    if (!latestSnapshotByAddress.has(key)) {
      latestSnapshotByAddress.set(key, snapshot);
    }
  }

  const strategySnapshotRows = strategyWrapperAddresses.length === 0
    ? []
    : await db
      .select()
      .from(engineV2ProtocolStateSnapshots)
      .where(and(
        eq(engineV2ProtocolStateSnapshots.chainId, input.chainId),
        eq(engineV2ProtocolStateSnapshots.protocol, "mellow"),
        eq(engineV2ProtocolStateSnapshots.subjectType, "strategy"),
        inArray(engineV2ProtocolStateSnapshots.subjectAddress, strategyWrapperAddresses),
      ))
      .orderBy(desc(engineV2ProtocolStateSnapshots.observedAt));

  const latestStrategySnapshotByAddress = new Map<string, typeof strategySnapshotRows[number]>();
  for (const snapshot of strategySnapshotRows) {
    const key = snapshot.subjectAddress.toLowerCase();
    if (!latestStrategySnapshotByAddress.has(key)) {
      latestStrategySnapshotByAddress.set(key, snapshot);
    }
  }

  const tokenAddresses = new Set<string>();
  for (const poolId of poolIds) {
    const poolAddress = poolAddressFromPoolId(poolId);
    if (!poolAddress) continue;
    const snapshot = latestSnapshotByAddress.get(poolAddress);
    const state = asRecord(snapshot?.stateJson);
    const token0Address = asString(state.token0)?.toLowerCase() ?? null;
    const token1Address = asString(state.token1)?.toLowerCase() ?? null;
    if (token0Address) tokenAddresses.add(token0Address);
    if (token1Address) tokenAddresses.add(token1Address);
    context.poolStateByPoolId.set(poolId, {
      poolId,
      poolAddress,
      token0Address,
      token1Address,
      tickSpacing: asInteger(state.tickSpacing),
      feeTierBps: asInteger(state.feeTier),
    });
  }

  for (const snapshot of latestStrategySnapshotByAddress.values()) {
    const state = asRecord(snapshot.stateJson);
    const token0Address = asString(state.token0Address)?.toLowerCase() ?? null;
    const token1Address = asString(state.token1Address)?.toLowerCase() ?? null;
    if (token0Address) tokenAddresses.add(token0Address);
    if (token1Address) tokenAddresses.add(token1Address);

    const materializedStrategyState = {
      strategyExposureId: snapshot.subjectId ?? null,
      wrapperAddress: snapshot.subjectAddress.toLowerCase(),
      underlyingPoolAddress: asString(state.underlyingPoolAddress)?.toLowerCase() ?? null,
      currentSharesRaw: asString(state.currentSharesRaw),
      currentEstimatedValueUsd: asNullableFiniteNumber(state.currentEstimatedValueUsd),
    } satisfies EngineV2MaterializationStrategyState;

    context.strategyStateByWrapperAddress.set(materializedStrategyState.wrapperAddress, materializedStrategyState);
    if (materializedStrategyState.strategyExposureId) {
      context.strategyStateByExposureId.set(materializedStrategyState.strategyExposureId, materializedStrategyState);
    }
  }

  for (const event of input.accounting.events) {
    for (const movement of movementRecords(asRecord(event.evidenceJson).movements)) {
      const tokenAddress = asString(movement.tokenAddress)?.toLowerCase();
      if (tokenAddress) tokenAddresses.add(tokenAddress);
    }
  }

  for (const strategy of input.accounting.strategies) {
    const wrapperAddress = asString(strategy.wrapperAddress)?.toLowerCase();
    if (wrapperAddress) tokenAddresses.add(wrapperAddress);
  }

  for (const reward of input.accounting.rewards) {
    const tokenAddress = asString(reward.tokenAddress)?.toLowerCase();
    if (tokenAddress) tokenAddresses.add(tokenAddress);
  }

  const tokenMetadataRows = tokenAddresses.size === 0
    ? []
    : await db
      .select()
      .from(engineV2TokenMetadata)
      .where(and(
        eq(engineV2TokenMetadata.chainId, input.chainId),
        inArray(engineV2TokenMetadata.tokenAddress, Array.from(tokenAddresses)),
      ));

  for (const metadata of tokenMetadataRows) {
    context.tokenMetadataByAddress.set(metadata.tokenAddress.toLowerCase(), {
      tokenAddress: metadata.tokenAddress.toLowerCase(),
      symbol: metadata.symbol ?? null,
      decimals: metadata.decimals ?? null,
    });
  }

  const walletAddress = input.accounting.events[0]?.walletAddress?.toLowerCase() ?? null;
  const governanceLockRows = walletAddress && governanceTokenIds.length > 0
    ? await db
      .select()
      .from(engineV2GovernanceLocks)
      .where(and(
        eq(engineV2GovernanceLocks.chainId, input.chainId),
        eq(engineV2GovernanceLocks.walletAddress, walletAddress),
        inArray(engineV2GovernanceLocks.lockTokenId, governanceTokenIds),
      ))
    : [];

  for (const lock of governanceLockRows) {
    const metadataJson = asRecord(lock.metadataJson);
    const materializedLock = {
      lockKey: asString(metadataJson.lockKey) ?? `${lock.chainId}:${lock.votingEscrowAddress}:${lock.lockTokenId}`,
      lockTokenId: lock.lockTokenId,
      votingEscrowAddress: lock.votingEscrowAddress,
      originTxHash: lock.originTxHash,
      originKind: lock.originKind,
      status: lock.status,
      coverageStatus: lock.coverageStatus,
      confidence: lock.confidence,
      reasonCodes: lock.reasonCodes,
      metadataJson,
    } satisfies EngineV2MaterializationGovernanceLock;
    context.governanceLockByLockKey.set(materializedLock.lockKey, materializedLock);
    context.governanceLockByTokenId.set(materializedLock.lockTokenId, materializedLock);
  }

  return context;
}