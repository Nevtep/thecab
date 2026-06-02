import { task, tasks } from "@trigger.dev/sdk/v3";
import { and, asc, eq, inArray } from "drizzle-orm";
import { decodeFunctionResult, encodeFunctionData, parseAbi } from "viem";

import { finalizeAnalysisRun, updateAnalysisRunProgress, type AnalysisRunCoverage } from "@/server/analysis/analysis-run.repository";
import { strategyStateSnapshot } from "@/server/analysis/engine-v2/enrichment";
import { materializeDepositReadModels } from "@/server/analysis/deposit-read-models";
import {
  persistAccountingOutputs,
  runChronologicalAccounting,
  toAccountingLotValues,
  toCashFlowValues,
  toResidualInventoryValues,
  type EngineV2AccountingInput,
  type EngineV2DomainEventLike,
  type EngineV2EntityLinkLike,
} from "@/server/analysis/engine-v2/accounting";
import { loadMaterializationContext, materializeAllDataViewRows, persistReadModelRows } from "@/server/analysis/engine-v2/materializers";
import { engineV2MaterializationPayloadSchema, engineV2WalletPayloadSchema } from "@/server/analysis/engine-v2/payloads";
import { materializePoolReadModels } from "@/server/analysis/pool-read-models";
import { alchemyRpc, getCurrentTokenPricesByAddress } from "@/server/providers/alchemy";
import { materializeStrategyReadModels } from "@/server/analysis/strategy-read-models";
import { getDb } from "@/server/db/client";
import {
  engineV2ClassifiedTransactions,
  engineV2DomainEventLinks,
  engineV2DomainEvents,
  engineV2PricePoints,
  engineV2ProtocolStateSnapshots,
  engineV2ReadModelRows,
  engineV2TokenMetadata,
  protocolContracts,
} from "@/server/db/schema";
import { taskInfo, taskWarn, withTaskLogging } from "@/server/trigger/tasks/task-logging";

export type EngineV2MaterializationDeps = {
  loadAccountingInput?: (input: { chainId: number; walletAddress: string }) => Promise<EngineV2AccountingInput>;
  loadMaterializationContext?: typeof loadMaterializationContext;
  loadMaterializedRowStats?: typeof loadMaterializedRowStatsFromDb;
  materializeDeposits?: typeof materializeDepositReadModels;
  materializeStrategies?: typeof materializeStrategyReadModels;
  materializePools?: typeof materializePoolReadModels;
  persistAccounting?: typeof persistAccountingOutputs;
  persistRows?: typeof persistReadModelRows;
  trigger?: (taskId: string, payload: Record<string, unknown>, options: { idempotencyKey: string }) => Promise<unknown>;
  updateRunProgress?: typeof updateAnalysisRunProgress;
  finalizeRun?: typeof finalizeAnalysisRun;
};

type EngineV2PersistedTokenMetadata = {
  tokenAddress: string;
  decimals: number | null;
};

type EngineV2PersistedPricePoint = {
  tokenAddress: string;
  pricedAt: Date | null;
  priceUsd: string | null;
};

const HISTORICAL_PRICE_MATCH_WINDOW_MS = 60 * 60 * 1000;

const MELLOW_WRAPPER_ABI = parseAbi([
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function previewMint(uint256 lpAmount) view returns (uint256 amount0, uint256 amount1)",
  "function pool() view returns (address)",
]);

type CurrentStrategyStateBase = {
  strategyExposureId: string;
  wrapperAddress: string;
  underlyingPoolAddress: string | null;
  currentSharesRaw: string;
  token0Address: string | null;
  token1Address: string | null;
  token0AmountRaw: string | null;
  token1AmountRaw: string | null;
  sourceProvider: string;
  evidenceJson: Record<string, unknown>;
};

type CurrentPriceEntry = {
  priceUsd: number;
  pricedAt: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function movementRecords(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
}

type GaugePoolProtocolRow = {
  address: string;
  metadataJson: unknown;
};

type GaugePoolEventRow = {
  gaugeAddress: string | null;
  poolId: string | null;
  poolAddress: string | null;
};

function normalizeAddress(value: unknown) {
  const address = asString(value);
  return address ? address.toLowerCase() : null;
}

function canonicalPoolId(input: {
  chainId: number;
  poolId?: string | null;
  poolAddress?: string | null;
}) {
  const normalizedPoolId = asString(input.poolId);
  if (normalizedPoolId && /^\d+:0x[a-f0-9]{40}$/i.test(normalizedPoolId)) {
    return normalizedPoolId.toLowerCase();
  }

  const normalizedPoolAddress = normalizeAddress(input.poolAddress);
  return normalizedPoolAddress ? `${input.chainId}:${normalizedPoolAddress}` : null;
}

export function buildGaugePoolIdByGaugeAddress(input: {
  chainId: number;
  rewardClaimGaugeAddresses: string[];
  protocolGaugeRows: GaugePoolProtocolRow[];
  eventGaugeRows: GaugePoolEventRow[];
}) {
  const rewardClaimGaugeSet = new Set(
    input.rewardClaimGaugeAddresses
      .map((address) => normalizeAddress(address))
      .filter((address): address is string => Boolean(address)),
  );

  const gaugePoolIdByGaugeAddress = new Map<string, string>();

  for (const row of input.protocolGaugeRows) {
    const gaugeAddress = normalizeAddress(row.address);
    if (!gaugeAddress) continue;
    if (rewardClaimGaugeSet.size > 0 && !rewardClaimGaugeSet.has(gaugeAddress)) continue;

    const metadata = asRecord(row.metadataJson);
    const poolId = canonicalPoolId({
      chainId: input.chainId,
      poolId: asString(metadata.poolId),
      poolAddress: normalizeAddress(metadata.poolAddress),
    });
    if (!poolId) continue;

    gaugePoolIdByGaugeAddress.set(gaugeAddress, poolId);
  }

  for (const row of input.eventGaugeRows) {
    const gaugeAddress = normalizeAddress(row.gaugeAddress);
    const poolId = canonicalPoolId({
      chainId: input.chainId,
      poolId: row.poolId,
      poolAddress: row.poolAddress,
    });
    if (!gaugeAddress || !poolId) continue;
    if (rewardClaimGaugeSet.size > 0 && !rewardClaimGaugeSet.has(gaugeAddress)) continue;
    if (gaugePoolIdByGaugeAddress.has(gaugeAddress)) continue;

    gaugePoolIdByGaugeAddress.set(gaugeAddress, poolId);
  }

  return gaugePoolIdByGaugeAddress;
}

async function ethCall(input: {
  chainId: number;
  address: string;
  functionName: "token0" | "token1" | "previewMint" | "pool";
  args?: readonly [bigint];
}) {
  const data = input.functionName === "previewMint"
    ? (() => {
      if (!input.args) {
        throw new Error("MELLOW_PREVIEW_MINT_ARGS_REQUIRED");
      }
      return encodeFunctionData({
        abi: MELLOW_WRAPPER_ABI,
        functionName: "previewMint",
        args: input.args,
      });
    })()
    : encodeFunctionData({
      abi: MELLOW_WRAPPER_ABI,
      functionName: input.functionName,
    });

  const result = await alchemyRpc<`0x${string}`>(
    "eth_call",
    [{ to: input.address, data }, "latest"],
    { chainId: input.chainId },
  );

  return decodeFunctionResult({
    abi: MELLOW_WRAPPER_ABI,
    functionName: input.functionName,
    data: result,
  });
}

function dividePow10(rawAmount: string, decimals: number) {
  if (!/^-?\d+$/.test(rawAmount)) return 0;
  const negative = rawAmount.startsWith("-");
  const digits = negative ? rawAmount.slice(1) : rawAmount;
  const padded = digits.padStart(decimals + 1, "0");
  const intPart = padded.slice(0, padded.length - decimals);
  const fracPart = padded.slice(padded.length - decimals);
  const value = Number(`${intPart}.${fracPart}`);
  if (!Number.isFinite(value)) return 0;
  return negative ? -value : value;
}

function toDecimalString(value: number) {
  if (!Number.isFinite(value)) return null;
  const normalized = value.toFixed(18).replace(/\.0+$|(?<=\.[0-9]*?)0+$/u, "").replace(/\.$/, "");
  return normalized.length > 0 ? normalized : "0";
}

function sumDecimalStrings(values: Array<string | null>) {
  const total = values.reduce((sum, value) => sum + (value ? Number(value) : 0), 0);
  return total > 0 ? toDecimalString(total) : null;
}

function buildCurrentPriceMap(priceResult: Awaited<ReturnType<typeof getCurrentTokenPricesByAddress>> | null) {
  const priceMap = new Map<string, CurrentPriceEntry>();
  for (const item of priceResult?.data ?? []) {
    const tokenAddress = normalizeAddress(item.address);
    const usdPrice = item.prices?.find((price) => price.currency === "usd") ?? item.prices?.[0];
    const parsedPrice = usdPrice ? Number(usdPrice.value) : NaN;
    if (!tokenAddress || !Number.isFinite(parsedPrice)) continue;

    priceMap.set(tokenAddress, {
      priceUsd: parsedPrice,
      pricedAt: usdPrice?.lastUpdatedAt ?? null,
    });
  }
  return priceMap;
}

async function loadCurrentStrategyStateBase(input: {
  chainId: number;
  strategyExposureId: string;
  wrapperAddress: string;
  currentSharesRaw: string;
}) {
  try {
    const [token0AddressRaw, token1AddressRaw, previewMintResult, poolAddressRaw] = await Promise.all([
      ethCall({ chainId: input.chainId, address: input.wrapperAddress, functionName: "token0" }),
      ethCall({ chainId: input.chainId, address: input.wrapperAddress, functionName: "token1" }),
      ethCall({ chainId: input.chainId, address: input.wrapperAddress, functionName: "previewMint", args: [BigInt(input.currentSharesRaw)] }),
      ethCall({ chainId: input.chainId, address: input.wrapperAddress, functionName: "pool" }),
    ]);

    const token0Address = normalizeAddress(String(token0AddressRaw));
    const token1Address = normalizeAddress(String(token1AddressRaw));
    const underlyingPoolAddress = normalizeAddress(String(poolAddressRaw));
    const [token0AmountRaw, token1AmountRaw] = previewMintResult as unknown as readonly [bigint, bigint];

    return {
      strategyExposureId: input.strategyExposureId,
      wrapperAddress: input.wrapperAddress,
      underlyingPoolAddress,
      currentSharesRaw: input.currentSharesRaw,
      token0Address,
      token1Address,
      token0AmountRaw: token0AmountRaw.toString(),
      token1AmountRaw: token1AmountRaw.toString(),
      sourceProvider: "alchemy_eth_call",
      evidenceJson: {
        resolutionStatus: "resolved",
      },
    } satisfies CurrentStrategyStateBase;
  } catch (error) {
    return {
      strategyExposureId: input.strategyExposureId,
      wrapperAddress: input.wrapperAddress,
      underlyingPoolAddress: null,
      currentSharesRaw: input.currentSharesRaw,
      token0Address: null,
      token1Address: null,
      token0AmountRaw: null,
      token1AmountRaw: null,
      sourceProvider: "alchemy_eth_call",
      evidenceJson: {
        resolutionStatus: "unresolved",
        error: error instanceof Error ? error.message : String(error),
      },
    } satisfies CurrentStrategyStateBase;
  }
}

async function persistCurrentStrategyStateSnapshots(input: {
  chainId: number;
  accounting: ReturnType<typeof runChronologicalAccounting>;
}) {
  const strategyInputs = input.accounting.strategies
    .map((strategy) => ({
      strategyExposureId: strategy.strategyExposureId,
      wrapperAddress: normalizeAddress(strategy.wrapperAddress),
      currentSharesRaw: strategy.currentSharesRaw,
    }))
    .filter((strategy): strategy is { strategyExposureId: string; wrapperAddress: string; currentSharesRaw: string } => (
      Boolean(strategy.wrapperAddress)
      && /^\d+$/.test(strategy.currentSharesRaw)
    ));

  if (strategyInputs.length === 0) {
    return;
  }

  const db = getDb();
  const states = await Promise.all(strategyInputs.map((strategy) => loadCurrentStrategyStateBase({
    chainId: input.chainId,
    strategyExposureId: strategy.strategyExposureId,
    wrapperAddress: strategy.wrapperAddress,
    currentSharesRaw: strategy.currentSharesRaw,
  })));

  const tokenAddresses = Array.from(new Set(
    states.flatMap((state) => [state.token0Address, state.token1Address]).filter((address): address is string => Boolean(address)),
  ));
  const [tokenMetadataRows, priceResult] = await Promise.all([
    tokenAddresses.length === 0
      ? Promise.resolve([])
      : db.select({
        tokenAddress: engineV2TokenMetadata.tokenAddress,
        decimals: engineV2TokenMetadata.decimals,
      }).from(engineV2TokenMetadata).where(and(
        eq(engineV2TokenMetadata.chainId, input.chainId),
        inArray(engineV2TokenMetadata.tokenAddress, tokenAddresses),
      )),
    tokenAddresses.length === 0
      ? Promise.resolve(null)
      : getCurrentTokenPricesByAddress(input.chainId, tokenAddresses).catch(() => null),
  ]);

  const tokenDecimalsByAddress = new Map(
    tokenMetadataRows.map((row) => [row.tokenAddress.toLowerCase(), row.decimals] as const),
  );
  const priceMap = buildCurrentPriceMap(priceResult);

  await Promise.all(states.map(async (state) => {
    const token0Decimals = state.token0Address ? tokenDecimalsByAddress.get(state.token0Address) ?? null : null;
    const token1Decimals = state.token1Address ? tokenDecimalsByAddress.get(state.token1Address) ?? null : null;
    const token0Price = state.token0Address ? priceMap.get(state.token0Address) ?? null : null;
    const token1Price = state.token1Address ? priceMap.get(state.token1Address) ?? null : null;
    const token0NeedsPrice = Boolean(state.token0AmountRaw && state.token0AmountRaw !== "0");
    const token1NeedsPrice = Boolean(state.token1AmountRaw && state.token1AmountRaw !== "0");
    const missingPriceTokenAddresses = [
      token0NeedsPrice && (token0Decimals === null || !token0Price) ? state.token0Address : null,
      token1NeedsPrice && (token1Decimals === null || !token1Price) ? state.token1Address : null,
    ].filter((address): address is string => Boolean(address));

    const currentEstimatedValueUsd = missingPriceTokenAddresses.length > 0
      ? null
      : toDecimalString(
        (state.token0AmountRaw && token0Decimals !== null && token0Price
          ? dividePow10(state.token0AmountRaw, token0Decimals) * token0Price.priceUsd
          : 0)
        + (state.token1AmountRaw && token1Decimals !== null && token1Price
          ? dividePow10(state.token1AmountRaw, token1Decimals) * token1Price.priceUsd
          : 0),
      );

    const snapshot = strategyStateSnapshot({
      chainId: input.chainId,
      wrapperAddress: state.wrapperAddress,
      strategyExposureId: state.strategyExposureId,
      blockNumber: "0",
      shareTokenAddress: state.wrapperAddress,
      underlyingPoolAddress: state.underlyingPoolAddress,
      currentSharesRaw: state.currentSharesRaw,
      token0Address: state.token0Address,
      token1Address: state.token1Address,
      token0AmountRaw: state.token0AmountRaw,
      token1AmountRaw: state.token1AmountRaw,
      currentEstimatedValueUsd,
      sourceProvider: state.sourceProvider,
      evidenceJson: {
        ...state.evidenceJson,
        valueResolutionStatus: missingPriceTokenAddresses.length === 0 ? "resolved" : "unresolved",
        missingPriceTokenAddresses,
        valueUpdatedAt: token0Price?.pricedAt ?? token1Price?.pricedAt ?? null,
      },
    });

    await db.insert(engineV2ProtocolStateSnapshots).values(snapshot).onConflictDoUpdate({
      target: [
        engineV2ProtocolStateSnapshots.chainId,
        engineV2ProtocolStateSnapshots.protocol,
        engineV2ProtocolStateSnapshots.subjectType,
        engineV2ProtocolStateSnapshots.subjectAddress,
        engineV2ProtocolStateSnapshots.subjectId,
        engineV2ProtocolStateSnapshots.blockNumber,
      ],
      set: {
        observedAt: new Date(),
        sourceProvider: snapshot.sourceProvider,
        stateJson: snapshot.stateJson,
        evidenceJson: snapshot.evidenceJson,
      },
    });
  }));
}

function isRewardLikeEvent(event: Pick<EngineV2DomainEventLike, "eventType" | "eventFamily">) {
  const source = `${event.eventType} ${event.eventFamily}`.toLowerCase();
  return source.includes("reward")
    || source.includes("claim")
    || source.includes("rebase")
    || source.includes("fee")
    || source.includes("bribe");
}

function preferredMovementDirectionsForEvent(event: Pick<EngineV2DomainEventLike, "eventType" | "eventFamily">) {
  const source = `${event.eventType} ${event.eventFamily}`.toLowerCase();
  if (isRewardLikeEvent(event)) return ["in"] as const;
  if (
    source.includes("withdraw")
    || source.includes("unstake")
    || source.includes("redeem")
    || source.includes("decrease")
    || source.includes("close")
    || source.includes("burn")
    || source.includes("cash_in")
  ) {
    return ["in"] as const;
  }
  if (
    source.includes("deposit")
    || source.includes("open")
    || source.includes("create")
    || source.includes("mint")
    || source.includes("increase")
    || source.includes("stake")
    || source.includes("cash_out")
  ) {
    return ["out"] as const;
  }
  return ["in", "out"] as const;
}

function buildPricePointsByToken(rows: EngineV2PersistedPricePoint[]) {
  const byToken = new Map<string, Array<{ pricedAt: Date; priceUsd: number }>>();
  for (const row of rows) {
    const tokenAddress = normalizeAddress(row.tokenAddress);
    const priceUsd = row.priceUsd ? Number(row.priceUsd) : NaN;
    if (!tokenAddress || !(row.pricedAt instanceof Date) || !Number.isFinite(priceUsd)) continue;
    const bucket = byToken.get(tokenAddress) ?? [];
    bucket.push({ pricedAt: row.pricedAt, priceUsd });
    byToken.set(tokenAddress, bucket);
  }
  for (const bucket of byToken.values()) {
    bucket.sort((left, right) => left.pricedAt.getTime() - right.pricedAt.getTime());
  }
  return byToken;
}

function findNearestHistoricalPrice(input: {
  occurredAt: Date;
  rows: Array<{ pricedAt: Date; priceUsd: number }>;
}) {
  let best: { pricedAt: Date; priceUsd: number } | null = null;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const row of input.rows) {
    const delta = Math.abs(row.pricedAt.getTime() - input.occurredAt.getTime());
    if (delta > HISTORICAL_PRICE_MATCH_WINDOW_MS || delta >= bestDelta) continue;
    best = row;
    bestDelta = delta;
  }
  return best;
}

function movementUsdValue(input: {
  movement: Record<string, unknown>;
  occurredAt: Date;
  tokenDecimalsByAddress: Map<string, number | null>;
  pricePointsByToken: Map<string, Array<{ pricedAt: Date; priceUsd: number }>>;
}) {
  const direction = asString(input.movement.direction);
  const assetType = asString(input.movement.assetType);
  if ((direction !== "in" && direction !== "out") || assetType !== "erc20") return null;
  const tokenAddress = normalizeAddress(input.movement.tokenAddress);
  const amountRaw = asString(input.movement.amountRaw);
  const decimals = tokenAddress ? input.tokenDecimalsByAddress.get(tokenAddress) ?? null : null;
  const pricePoint = tokenAddress ? findNearestHistoricalPrice({
    occurredAt: input.occurredAt,
    rows: input.pricePointsByToken.get(tokenAddress) ?? [],
  }) : null;
  if (!tokenAddress || !amountRaw || decimals === null || decimals < 0 || !pricePoint) return null;
  const tokenAmount = dividePow10(amountRaw, decimals);
  if (!Number.isFinite(tokenAmount) || tokenAmount === 0) return null;
  return toDecimalString(Math.abs(tokenAmount * pricePoint.priceUsd));
}

function metadataTokenUsdValue(input: {
  metadata: Record<string, unknown>;
  occurredAt: Date;
  tokenDecimalsByAddress: Map<string, number | null>;
  pricePointsByToken: Map<string, Array<{ pricedAt: Date; priceUsd: number }>>;
}) {
  const tokenAddress = normalizeAddress(input.metadata.tokenAddress);
  const amountRaw = asString(input.metadata.amountRaw);
  const decimals = tokenAddress ? input.tokenDecimalsByAddress.get(tokenAddress) ?? null : null;
  const pricePoint = tokenAddress ? findNearestHistoricalPrice({
    occurredAt: input.occurredAt,
    rows: input.pricePointsByToken.get(tokenAddress) ?? [],
  }) : null;
  if (!tokenAddress || !amountRaw || decimals === null || decimals < 0 || !pricePoint) return null;
  const tokenAmount = dividePow10(amountRaw, decimals);
  if (!Number.isFinite(tokenAmount) || tokenAmount === 0) return null;
  return toDecimalString(Math.abs(tokenAmount * pricePoint.priceUsd));
}

export function hydrateAccountingInputWithPersistedPrices(input: {
  accountingInput: EngineV2AccountingInput;
  tokenMetadataRows: EngineV2PersistedTokenMetadata[];
  pricePointRows: EngineV2PersistedPricePoint[];
}) {
  const tokenDecimalsByAddress = new Map(
    input.tokenMetadataRows.map((row) => [row.tokenAddress.toLowerCase(), row.decimals] as const),
  );
  const pricePointsByToken = buildPricePointsByToken(input.pricePointRows);

  return {
    ...input.accountingInput,
    events: input.accountingInput.events.map((event) => {
      const metadata = asRecord(event.metadataJson);
      const evidence = asRecord(event.evidenceJson);
      const hydratedMovements = movementRecords(evidence.movements).map((movement) => {
        if (asString(movement.valueUsdAtEvent)) return movement;
        const valueUsdAtEvent = movementUsdValue({
          movement,
          occurredAt: event.occurredAt,
          tokenDecimalsByAddress,
          pricePointsByToken,
        });
        return valueUsdAtEvent ? { ...movement, valueUsdAtEvent } : movement;
      });

      const movementValuesByDirection = hydratedMovements.reduce<Record<string, Array<string | null>>>((acc, movement) => {
        const direction = asString(movement.direction);
        if (direction === "in" || direction === "out") {
          acc[direction] ??= [];
          acc[direction].push(asString(movement.valueUsdAtEvent));
        }
        return acc;
      }, {});

      const derivedEventValueUsd = sumDecimalStrings(
        preferredMovementDirectionsForEvent(event)
          .flatMap((direction) => movementValuesByDirection[direction] ?? []),
      );
      const derivedRewardUsd = sumDecimalStrings(movementValuesByDirection.in ?? [])
        ?? metadataTokenUsdValue({
          metadata,
          occurredAt: event.occurredAt,
          tokenDecimalsByAddress,
          pricePointsByToken,
        });

      const nextMetadata = { ...metadata };
      if (!asString(nextMetadata.valueUsd) && derivedEventValueUsd) {
        nextMetadata.valueUsd = derivedEventValueUsd;
      }
      if (!asString(nextMetadata.valueUsdAtEvent) && derivedEventValueUsd) {
        nextMetadata.valueUsdAtEvent = derivedEventValueUsd;
      }
      if (isRewardLikeEvent(event) && !asString(nextMetadata.amountUsd) && derivedRewardUsd) {
        nextMetadata.amountUsd = derivedRewardUsd;
      }
      if (isRewardLikeEvent(event) && !asString(nextMetadata.valueUsd) && derivedRewardUsd) {
        nextMetadata.valueUsd = derivedRewardUsd;
      }
      if (isRewardLikeEvent(event) && !asString(nextMetadata.valueUsdAtEvent) && derivedRewardUsd) {
        nextMetadata.valueUsdAtEvent = derivedRewardUsd;
      }

      return {
        ...event,
        metadataJson: nextMetadata,
        evidenceJson: {
          ...evidence,
          movements: hydratedMovements,
        },
      };
    }),
  } satisfies EngineV2AccountingInput;
}

async function loadAccountingInputFromDb(input: { chainId: number; walletAddress: string }): Promise<EngineV2AccountingInput> {
  const db = getDb();
  const events = await db.select().from(engineV2DomainEvents).where(and(
    eq(engineV2DomainEvents.chainId, input.chainId),
    eq(engineV2DomainEvents.walletAddress, input.walletAddress.toLowerCase()),
  )).orderBy(asc(engineV2DomainEvents.occurredAt), asc(engineV2DomainEvents.sequenceIndex));
  const eventIds = events.map((event) => event.id);
  const links = eventIds.length > 0
    ? await db.select().from(engineV2DomainEventLinks).where(and(
      eq(engineV2DomainEventLinks.chainId, input.chainId),
      inArray(engineV2DomainEventLinks.domainEventId, eventIds),
    ))
    : [];
  const accountingInput: EngineV2AccountingInput = {
    events: events.map((event) => ({
      id: event.id,
      chainId: event.chainId,
      walletAddress: event.walletAddress,
      canonicalTransactionId: event.canonicalTransactionId,
      eventType: event.eventType,
      eventFamily: event.eventFamily,
      occurredAt: event.occurredAt,
      txHash: event.txHash,
      sequenceIndex: event.sequenceIndex,
      coverageStatus: event.coverageStatus,
      confidence: event.confidence,
      reasonCodes: event.reasonCodes,
      valueEffectJson: event.valueEffectJson,
      evidenceJson: event.evidenceJson,
      metadataJson: event.metadataJson,
    })),
    links: links.map((link) => ({
      domainEventId: link.domainEventId,
      entityType: link.entityType,
      entityId: link.entityId,
      linkKind: link.linkKind,
      confidence: link.confidence,
      evidenceJson: link.evidenceJson,
    })),
  };

  const rewardClaimGaugeAddresses = Array.from(new Set(
    accountingInput.events
      .filter((event) => event.eventType === "manual_gauge_reward_claim")
      .map((event) => normalizeAddress(asRecord(event.metadataJson).claimContract))
      .filter((value): value is string => Boolean(value)),
  ));

  let protocolGaugeRows: GaugePoolProtocolRow[] = [];
  if (rewardClaimGaugeAddresses.length > 0) {
    protocolGaugeRows = await db.select({
      address: protocolContracts.address,
      metadataJson: protocolContracts.metadataJson,
    }).from(protocolContracts).where(and(
      eq(protocolContracts.chainId, input.chainId),
      eq(protocolContracts.protocol, "aerodrome"),
      eq(protocolContracts.contractType, "gauge"),
      inArray(protocolContracts.address, rewardClaimGaugeAddresses),
    ));
  }

  const gaugeLifecycleEvents = accountingInput.events.filter((event) => {
    if (!event.eventType.startsWith("manual_gauge_")) return false;
    return Boolean(asString(asRecord(event.metadataJson).poolId));
  });

  const gaugeLifecycleTxHashes = Array.from(new Set(gaugeLifecycleEvents.map((event) => event.txHash)));
  let gaugeAddressByTxHash = new Map<string, string>();
  if (gaugeLifecycleTxHashes.length > 0) {
    const classifiedGaugeRows = await db.select({
      txHash: engineV2ClassifiedTransactions.txHash,
      toAddress: engineV2ClassifiedTransactions.toAddress,
    }).from(engineV2ClassifiedTransactions).where(and(
      eq(engineV2ClassifiedTransactions.chainId, input.chainId),
      eq(engineV2ClassifiedTransactions.walletAddress, input.walletAddress),
      inArray(engineV2ClassifiedTransactions.txHash, gaugeLifecycleTxHashes),
    ));

    gaugeAddressByTxHash = new Map(
      classifiedGaugeRows.flatMap((row) => {
        const gaugeAddress = normalizeAddress(row.toAddress);
        return gaugeAddress ? [[row.txHash, gaugeAddress] as const] : [];
      }),
    );
  }

  const eventGaugeRows = gaugeLifecycleEvents.map((event) => {
    const metadata = asRecord(event.metadataJson);
    return {
      gaugeAddress: normalizeAddress(metadata.toAddress) ?? gaugeAddressByTxHash.get(event.txHash) ?? null,
      poolId: asString(metadata.poolId),
      poolAddress: normalizeAddress(metadata.poolAddress),
    } satisfies GaugePoolEventRow;
  });

  const gaugePoolIdByGaugeAddress = buildGaugePoolIdByGaugeAddress({
    chainId: input.chainId,
    rewardClaimGaugeAddresses,
    protocolGaugeRows,
    eventGaugeRows,
  });

  accountingInput.gaugePoolIdByGaugeAddress = gaugePoolIdByGaugeAddress;

  const tokenAddresses = Array.from(new Set(
    accountingInput.events.flatMap((event) => {
      const metadata = asRecord(event.metadataJson);
      const evidence = asRecord(event.evidenceJson);
      return [
        normalizeAddress(metadata.tokenAddress),
        ...movementRecords(evidence.movements).map((movement) => normalizeAddress(movement.tokenAddress)),
      ].filter((value): value is string => Boolean(value));
    }),
  ));

  if (tokenAddresses.length === 0) {
    return accountingInput;
  }

  const [tokenMetadataRows, pricePointRows] = await Promise.all([
    db.select({
      tokenAddress: engineV2TokenMetadata.tokenAddress,
      decimals: engineV2TokenMetadata.decimals,
    }).from(engineV2TokenMetadata).where(and(
      eq(engineV2TokenMetadata.chainId, input.chainId),
      inArray(engineV2TokenMetadata.tokenAddress, tokenAddresses),
    )),
    db.select({
      tokenAddress: engineV2PricePoints.tokenAddress,
      pricedAt: engineV2PricePoints.pricedAt,
      priceUsd: engineV2PricePoints.priceUsd,
    }).from(engineV2PricePoints).where(and(
      eq(engineV2PricePoints.chainId, input.chainId),
      eq(engineV2PricePoints.resolution, "historical"),
      eq(engineV2PricePoints.status, "resolved"),
      inArray(engineV2PricePoints.tokenAddress, tokenAddresses),
    )),
  ]);

  return hydrateAccountingInputWithPersistedPrices({
    accountingInput,
    tokenMetadataRows,
    pricePointRows,
  });
}

async function loadMaterializedRowStatsFromDb(input: { chainId: number; walletAddress: string }) {
  const rows = await getDb().select({
    surface: engineV2ReadModelRows.surface,
    coverageStatus: engineV2ReadModelRows.coverageStatus,
    evidenceJson: engineV2ReadModelRows.evidenceJson,
  }).from(engineV2ReadModelRows).where(and(
    eq(engineV2ReadModelRows.chainId, input.chainId),
    eq(engineV2ReadModelRows.walletAddress, input.walletAddress.toLowerCase()),
  ));

  return {
    rowCount: rows.length,
    bySurface: rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.surface] = (acc[row.surface] ?? 0) + 1;
      return acc;
    }, {}),
    coverage: rows.some((row) => row.coverageStatus === "partial" || row.coverageStatus === "unresolved") ? "partial" : "full",
    coverageReasonsJson: Array.from(new Set(rows.flatMap((row) => {
      const reasonCodes = row.evidenceJson.reasonCodes;
      return Array.isArray(reasonCodes) ? reasonCodes.filter((item): item is string => typeof item === "string") : [];
    }))),
  };
}

function deriveReadModelWindow(events: EngineV2AccountingInput["events"]) {
  const occurredAtValues = events
    .map((event) => event.occurredAt)
    .filter((value): value is Date => value instanceof Date && Number.isFinite(value.getTime()));

  if (occurredAtValues.length === 0) {
    const todayUtc = new Date().toISOString().slice(0, 10);
    return {
      startDayUtc: todayUtc,
      endDayUtc: todayUtc,
      capturedAt: new Date(),
    };
  }

  const minTime = Math.min(...occurredAtValues.map((value) => value.getTime()));
  const maxTime = Math.max(...occurredAtValues.map((value) => value.getTime()));

  return {
    startDayUtc: new Date(minTime).toISOString().slice(0, 10),
    endDayUtc: new Date(maxTime).toISOString().slice(0, 10),
    capturedAt: new Date(),
  };
}

async function materializeLegacySummaryTables(input: {
  analysisRunId: string | null | undefined;
  chainId: number;
  walletAddress: string;
  accountingInput: EngineV2AccountingInput;
  deps: EngineV2MaterializationDeps;
}) {
  if (!input.analysisRunId) {
    return;
  }

  const window = deriveReadModelWindow(input.accountingInput.events);
  const materializeDeposits = input.deps.materializeDeposits ?? materializeDepositReadModels;
  const materializeStrategies = input.deps.materializeStrategies ?? materializeStrategyReadModels;
  const materializePools = input.deps.materializePools ?? materializePoolReadModels;

  await Promise.all([
    materializeDeposits({
      runId: input.analysisRunId,
      walletAddress: input.walletAddress,
      chainId: input.chainId,
      startDayUtc: window.startDayUtc,
      endDayUtc: window.endDayUtc,
      capturedAt: window.capturedAt,
    }),
    materializeStrategies({
      runId: input.analysisRunId,
      walletAddress: input.walletAddress,
      chainId: input.chainId,
      startDayUtc: window.startDayUtc,
      endDayUtc: window.endDayUtc,
      capturedAt: window.capturedAt,
    }),
    materializePools({
      runId: input.analysisRunId,
      walletAddress: input.walletAddress,
      chainId: input.chainId,
      startDayUtc: window.startDayUtc,
      endDayUtc: window.endDayUtc,
      capturedAt: window.capturedAt,
    }),
  ]);
}

export async function runEngineV2AccountChronological(rawPayload: unknown, deps: EngineV2MaterializationDeps = {}) {
  const payload = engineV2WalletPayloadSchema.parse(rawPayload);
  const updateRun = deps.updateRunProgress ?? updateAnalysisRunProgress;
  if (payload.analysisRunId) {
    await updateRun(payload.analysisRunId, {
      status: "running",
      stage: "engine_v2_accounting",
      progressPct: 86,
    });
  }
  const accountingInput = await (deps.loadAccountingInput?.(payload) ?? loadAccountingInputFromDb(payload));
  taskInfo("engine-v2-account-chronological", "loaded accounting input", {
    chainId: payload.chainId,
    walletAddress: payload.walletAddress,
    eventCount: accountingInput.events.length,
    linkCount: accountingInput.links?.length ?? 0,
  });
  await materializeLegacySummaryTables({
    analysisRunId: payload.analysisRunId,
    chainId: payload.chainId,
    walletAddress: payload.walletAddress,
    accountingInput,
    deps,
  });
  const accounting = runChronologicalAccounting(accountingInput);
  taskInfo("engine-v2-account-chronological", "accounting summary", {
    eventCount: accounting.events.length,
    cashFlowCount: accounting.cashFlows.length,
    residualInventoryCount: accounting.residualInventory.length,
    depositCount: accounting.deposits.length,
    strategyCount: accounting.strategies.length,
    poolCount: accounting.pools.length,
    rewardCount: accounting.rewards.length,
    governanceEventCount: accounting.governance.events.length,
  });
  const accountingPayload = {
    chainId: payload.chainId,
    walletAddress: payload.walletAddress,
    db: deps.persistAccounting ? undefined as never : getDb(),
    lots: accounting.deposits.flatMap((deposit) => deposit.lifecycle.map((event) => toAccountingLotValues({
      event: eventToDomainLike(payload, event, deposit.depositId),
      lotKind: "manual_deposit",
      valueUsdAtEvent: event.valueUsd,
      entityType: "deposit",
      entityId: deposit.depositId,
      coverageStatus: event.coverageStatus,
      reasonCodes: event.reasonCodes,
    }))),
    cashFlows: accounting.cashFlows.map((flow) => toCashFlowValues({
      event: eventToDomainLike(payload, flow, flow.eventId ?? flow.txHash),
      flowKind: flow.flowKind,
      tokenAddress: flow.tokenAddress,
      amountRaw: flow.amountRaw,
      valueUsdAtEvent: flow.valueUsdAtEvent,
      coverageStatus: flow.coverageStatus,
      reasonCodes: flow.reasonCodes,
    })),
    residualInventory: accounting.residualInventory.map((item) => toResidualInventoryValues({
      chainId: payload.chainId,
      walletAddress: payload.walletAddress,
      tokenAddress: item.tokenAddress,
      amountRaw: item.amountRaw,
      coverageStatus: item.coverageStatus,
      reasonCodes: item.reasonCodes,
    })),
    governance: accounting.governance,
    rewards: accounting.rewards,
  };
  if (deps.persistAccounting) {
    await deps.persistAccounting(accountingPayload);
  } else {
    await persistAccountingOutputs(accountingPayload);
  }
  await persistCurrentStrategyStateSnapshots({
    chainId: payload.chainId,
    accounting,
  });
  const materializationContext = await (deps.loadMaterializationContext?.({
    chainId: payload.chainId,
    accounting,
  }) ?? loadMaterializationContext({
    chainId: payload.chainId,
    accounting,
  }));
  const rows = materializeAllDataViewRows(accounting, materializationContext);
  if (deps.persistRows) {
    await deps.persistRows({ db: undefined as never, rows });
  } else {
    await persistReadModelRows({ db: getDb(), rows });
  }
  taskInfo("engine-v2-account-chronological", "persisted read model rows and queueing final materialization step", {
    rowCount: rows.length,
  });
  const triggerTask = deps.trigger ?? ((taskId, taskPayload, options) => tasks.trigger(taskId, taskPayload, options));
  await triggerTask("engine-v2-materialize-read-models", {
    ...payload,
    rowsAlreadyPersisted: true,
  }, {
    idempotencyKey: `engine-v2-materialize:${payload.chainId}:${payload.walletAddress}:${payload.collectionRunId ?? "latest"}`,
  });

  return {
    eventCount: accounting.events.length,
    cashFlowCount: accounting.cashFlows.length,
    residualInventoryCount: accounting.residualInventory.length,
    depositCount: accounting.deposits.length,
    strategyCount: accounting.strategies.length,
    poolCount: accounting.pools.length,
    rewardCount: accounting.rewards.length,
    governanceEventCount: accounting.governance.events.length,
  };
}

export async function runEngineV2MaterializeReadModels(rawPayload: unknown, deps: EngineV2MaterializationDeps = {}) {
  const payload = engineV2MaterializationPayloadSchema.parse(rawPayload);
  const updateRun = deps.updateRunProgress ?? updateAnalysisRunProgress;
  if (payload.analysisRunId) {
    await updateRun(payload.analysisRunId, {
      status: "running",
      stage: "engine_v2_materialization",
      progressPct: 96,
    });
  }
  taskInfo("engine-v2-materialize-read-models", "materializing read models", {
    chainId: payload.chainId,
    walletAddress: payload.walletAddress,
    rowsAlreadyPersisted: payload.rowsAlreadyPersisted,
  });
  const stats = payload.rowsAlreadyPersisted
    ? await (deps.loadMaterializedRowStats?.(payload) ?? loadMaterializedRowStatsFromDb(payload))
    : await (async () => {
      const accountingInput = await (deps.loadAccountingInput?.(payload) ?? loadAccountingInputFromDb(payload));
      await materializeLegacySummaryTables({
        analysisRunId: payload.analysisRunId,
        chainId: payload.chainId,
        walletAddress: payload.walletAddress,
        accountingInput,
        deps,
      });
      const accounting = runChronologicalAccounting(accountingInput);
      await persistCurrentStrategyStateSnapshots({
        chainId: payload.chainId,
        accounting,
      });
      const materializationContext = await (deps.loadMaterializationContext?.({
        chainId: payload.chainId,
        accounting,
      }) ?? loadMaterializationContext({
        chainId: payload.chainId,
        accounting,
      }));
      const rows = materializeAllDataViewRows(accounting, materializationContext);
      if (deps.persistRows) {
        await deps.persistRows({ db: undefined as never, rows });
      } else {
        await persistReadModelRows({ db: getDb(), rows });
      }
      return {
        rowCount: rows.length,
        bySurface: rows.reduce<Record<string, number>>((acc, row) => {
          acc[row.surface] = (acc[row.surface] ?? 0) + 1;
          return acc;
        }, {}),
        coverage: rows.some((row) => row.coverageStatus === "partial" || row.coverageStatus === "unresolved") ? "partial" : "full",
        coverageReasonsJson: Array.from(new Set(rows.flatMap((row) => {
          const reasonCodes = row.evidenceJson.reasonCodes;
          return Array.isArray(reasonCodes) ? reasonCodes.filter((item): item is string => typeof item === "string") : [];
        }))),
      };
    })();
  taskInfo("engine-v2-materialize-read-models", "materialization stats computed", stats);
  if (payload.analysisRunId) {
    const finalizeRun = deps.finalizeRun ?? finalizeAnalysisRun;
    if (stats.coverage !== "full") {
      taskWarn("engine-v2-materialize-read-models", "finalizing analysis run with non-full coverage", {
        analysisRunId: payload.analysisRunId,
        coverage: stats.coverage,
        coverageReasonsJson: stats.coverageReasonsJson,
      });
    }
    await finalizeRun({
      runId: payload.analysisRunId,
      status: "complete",
      coverage: stats.coverage as AnalysisRunCoverage,
      coverageReasonsJson: stats.coverageReasonsJson,
      lastError: null,
    });
  }
  return { rowCount: stats.rowCount, bySurface: stats.bySurface };
}

function eventToDomainLike(
  payload: { chainId: number; walletAddress: string },
  event: {
    eventId?: string | null;
    eventType?: string;
    txHash: string;
    occurredAt: Date;
    coverageStatus?: string;
    reasonCodes?: string[];
  },
  fallbackId: string,
): EngineV2DomainEventLike {
  return {
    id: event.eventId ?? fallbackId,
    chainId: payload.chainId,
    walletAddress: payload.walletAddress,
    eventType: event.eventType ?? "accounting_projection",
    eventFamily: "accounting",
    occurredAt: event.occurredAt,
    txHash: event.txHash,
    sequenceIndex: 0,
    coverageStatus: event.coverageStatus ?? "unknown",
    confidence: "unknown",
    reasonCodes: event.reasonCodes ?? [],
  };
}

export const engineV2AccountChronologicalTask = task({
  id: "engine-v2-account-chronological",
  run: async (payload: unknown) => withTaskLogging(
    "engine-v2-account-chronological",
    payload,
    () => runEngineV2AccountChronological(payload),
  ),
});

export const engineV2MaterializeReadModelsTask = task({
  id: "engine-v2-materialize-read-models",
  run: async (payload: unknown) => withTaskLogging(
    "engine-v2-materialize-read-models",
    payload,
    () => runEngineV2MaterializeReadModels(payload),
  ),
});

export type { EngineV2DomainEventLike, EngineV2EntityLinkLike };
