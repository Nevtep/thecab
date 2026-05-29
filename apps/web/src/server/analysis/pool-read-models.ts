import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";

import { getHistoricalTokenPricesByAddress } from "@/server/providers/alchemy";
import { getDb } from "@/server/db/client";
import {
  assetMovements,
  analysisRuns,
  attributionStates,
  deposits,
  inferredActions,
  ledgerEvents,
  poolHistorySnapshots,
  pools,
  poolTimelineEvents,
  poolWalletSummaries,
  pricePoints,
  rewardEvents,
  strategies,
  strategyExposures,
} from "@/server/db/schema";

type MaterializePoolReadModelsInput = {
  runId: string;
  walletAddress: string;
  chainId: number;
  startDayUtc: string;
  endDayUtc: string;
  capturedAt: Date;
};

const READ_MODEL_INSERT_CHUNK_SIZE = 250;

type PoolAccumulator = {
  poolId: string;
  poolAddress: string;
  label: string;
  tokenSymbols: string[];
  feeTierLabel: string | null;
  manualValueUsd: number;
  strategyValueUsd: number;
  residualValueUsd: number;
  totalRewardsUsd: number;
  totalFeesUsd: number;
  coverageStatus: "full" | "share_level" | "partial" | "unknown";
  strategyLabels: string[];
  firstParticipatedAt: Date | null;
  lastParticipatedAt: Date | null;
  hasManual: boolean;
  hasStrategy: boolean;
  hasResidual: boolean;
  isInRange: boolean | null;
  strategyDebugReferences: Array<{
    strategyId: string;
    exposureId: string;
    externalStrategyPositionReference: string | null;
    externalStrategyPositionReferenceStatus: "resolved" | "unresolved" | null;
  }>;
  timeline: Array<{
    eventKey: string;
    eventType: string;
    occurredAt: Date;
    confidence: string;
    coverageStatus: string;
    attributedValueUsd: number | null;
    sourceLedgerEventId: string | null;
    relatedDepositId: string | null;
    relatedStrategyId: string | null;
    metadataJson: Record<string, unknown>;
  }>;
  rewardValueByDay: Map<string, number>;
};

type LifecycleLedgerRow = {
  id: string;
  txHash: string;
  classification: string | null;
  occurredAt: Date;
  confidence: string;
  metadataJson: Record<string, unknown>;
};

type PoolDepositTimelineCandidate = {
  depositId: string;
  poolId: string;
  occurredAt: Date;
  txHash: string | null;
  sourceLedgerEventId: string | null;
  coverageStatus: string;
  attributedValueUsd: number | null;
  relatedDepositId: string;
  tokenId: string | null;
  status: string;
  metadataJson: Record<string, unknown>;
};

type PoolResidualTimelineCandidate = {
  poolId: string;
  sourceLedgerEventId: string | null;
  occurredAt: Date;
  confidence: string;
  coverageStatus: string;
  attributedValueUsd: number | null;
  classification: string | null;
  metadataJson: Record<string, unknown>;
};

type PoolCapitalFlowEvent = {
  poolId: string;
  occurredAt: Date;
  dayUtc: string;
  segment: "manual" | "strategy";
  direction: "in" | "out";
  amountUsd: number;
  metadataJson: Record<string, unknown>;
};

type PoolTokenDeltaEvent = {
  poolId: string;
  occurredAt: Date;
  dayUtc: string;
  segment: "manual" | "strategy";
  direction: "in" | "out";
  tokenAddress: string;
  amount: number;
  sourceLedgerEventId: string;
  metadataJson: Record<string, unknown>;
};

type SyntheticGaugeClaimCandidate = {
  ledgerEventId: string;
  txHash: string;
  occurredAt: Date;
  poolId: string;
  gaugeAddress: string;
  methodLabel: string;
  metadataJson: Record<string, unknown>;
};

type SyntheticGaugeClaimReward = {
  eventKey: string;
  poolId: string;
  txHash: string;
  occurredAt: Date;
  amountUsd: number;
  tokenAddress: string | null;
  amountRaw: string | null;
  sourceLedgerEventId: string;
  gaugeAddress: string;
  methodLabel: string;
  metadataJson: Record<string, unknown>;
};

type PoolTokenBalanceEvent = {
  occurredAt: Date;
  dayUtc: string;
  segment: "manual" | "strategy";
  direction: "in" | "out";
  sourceLedgerEventId: string;
  deltas: Array<{
    tokenAddress: string;
    amount: number;
  }>;
};

type MaterializedTimelineEvent = PoolAccumulator["timeline"][number];

const BASE_WETH_ADDRESS = "0x4200000000000000000000000000000000000006";
const BASE_CBBTC_ADDRESS = "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf";
const BASE_AERO_ADDRESS = "0x940181a94a35a4569e4529a3cdfb74e38fd98631";
const BASE_USDC_ADDRESS = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const BASE_EURC_ADDRESS = "0x60a3e35cc302bfa44cb288bc5a4f316fdb1adb42";

const KNOWN_BASE_TOKEN_METADATA: Record<string, { address: string; decimals: number }> = {
  weth: { address: BASE_WETH_ADDRESS, decimals: 18 },
  eth: { address: BASE_WETH_ADDRESS, decimals: 18 },
  usdc: { address: BASE_USDC_ADDRESS, decimals: 6 },
  cbbtc: { address: BASE_CBBTC_ADDRESS, decimals: 8 },
  aero: { address: BASE_AERO_ADDRESS, decimals: 18 },
  eurc: { address: BASE_EURC_ADDRESS, decimals: 6 },
};

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function asInteger(value: unknown) {
  const parsed = asNumber(value);
  return parsed !== null ? Math.trunc(parsed) : null;
}

function normalizeTokenSymbol(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim().toLowerCase() : null;
}

function normalizeTokenAddress(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value.toLowerCase() : null;
}

function resolveKnownTokenAddress(input: {
  chainId: number;
  tokenAddress: unknown;
  symbol: unknown;
}) {
  const normalizedAddress = normalizeTokenAddress(input.tokenAddress);
  if (normalizedAddress) {
    return normalizedAddress;
  }

  if (input.chainId !== 8453) {
    return null;
  }

  const normalizedSymbol = normalizeTokenSymbol(input.symbol);
  return normalizedSymbol ? (KNOWN_BASE_TOKEN_METADATA[normalizedSymbol]?.address ?? null) : null;
}

function resolveTokenSymbolByAddress(input: { chainId: number; tokenAddress: unknown }) {
  if (input.chainId !== 8453) {
    return null;
  }
  const normalizedAddress = normalizeTokenAddress(input.tokenAddress);
  if (!normalizedAddress) {
    return null;
  }
  for (const [symbol, metadata] of Object.entries(KNOWN_BASE_TOKEN_METADATA)) {
    if (metadata.address === normalizedAddress) {
      return symbol.toUpperCase();
    }
  }
  return null;
}

function deriveTokenSymbolsFromPool(input: {
  chainId: number;
  token0Address: unknown;
  token1Address: unknown;
}) {
  const result: string[] = [];
  const primary = resolveTokenSymbolByAddress({ chainId: input.chainId, tokenAddress: input.token0Address });
  const secondary = resolveTokenSymbolByAddress({ chainId: input.chainId, tokenAddress: input.token1Address });
  if (primary) result.push(primary);
  if (secondary) result.push(secondary);
  return result;
}

function resolveKnownTokenDecimals(input: {
  chainId: number;
  tokenAddress: unknown;
  symbol: unknown;
  decimals: unknown;
}) {
  const explicitDecimals = asInteger(input.decimals);
  if (explicitDecimals !== null && explicitDecimals >= 0) {
    return explicitDecimals;
  }

  const normalizedAddress = resolveKnownTokenAddress(input);
  if (normalizedAddress) {
    const metadata = Object.values(KNOWN_BASE_TOKEN_METADATA).find((entry) => entry.address === normalizedAddress);
    if (metadata) {
      return metadata.decimals;
    }
  }

  if (input.chainId !== 8453) {
    return null;
  }

  const normalizedSymbol = normalizeTokenSymbol(input.symbol);
  return normalizedSymbol ? (KNOWN_BASE_TOKEN_METADATA[normalizedSymbol]?.decimals ?? null) : null;
}

function dayUtcFromDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function* iterateUtcDays(startDayUtc: string, endDayUtc: string) {
  const current = new Date(`${startDayUtc}T00:00:00.000Z`);
  const end = new Date(`${endDayUtc}T00:00:00.000Z`);

  while (current.getTime() <= end.getTime()) {
    yield current.toISOString().slice(0, 10);
    current.setUTCDate(current.getUTCDate() + 1);
  }
}

function combineCoverageStatus(statuses: string[]) {
  if (statuses.includes("partial")) {
    return "partial" as const;
  }

  if (statuses.includes("share_level")) {
    return "share_level" as const;
  }

  if (statuses.includes("full")) {
    return "full" as const;
  }

  return "unknown" as const;
}

function combineConfidence(confidences: string[]) {
  if (confidences.includes("low")) {
    return "low";
  }

  if (confidences.includes("medium")) {
    return "medium";
  }

  if (confidences.includes("high")) {
    return "high";
  }

  return "medium";
}

function mergeDateBounds(current: Date | null, candidate: Date | null, mode: "min" | "max") {
  if (!candidate) {
    return current;
  }

  if (!current) {
    return candidate;
  }

  return mode === "min"
    ? current.getTime() <= candidate.getTime() ? current : candidate
    : current.getTime() >= candidate.getTime() ? current : candidate;
}

function pushUnique(target: string[], value: string | null) {
  if (!value || target.includes(value)) {
    return;
  }

  target.push(value);
}

function pushUniqueStrategyDebugReference(
  target: PoolAccumulator["strategyDebugReferences"],
  value: PoolAccumulator["strategyDebugReferences"][number],
) {
  if (target.some((entry) => entry.exposureId === value.exposureId)) {
    return;
  }

  target.push(value);
}

function pushUniqueCaseInsensitive(target: string[], value: string | null) {
  if (!value) {
    return;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return;
  }

  const normalized = trimmed.toLowerCase();
  if (target.some((candidate) => candidate.trim().toLowerCase() === normalized)) {
    return;
  }

  target.push(trimmed);
}

function normalizePoolTokenSymbols(tokenSymbols: string[]) {
  const normalized: string[] = [];

  for (const tokenSymbol of tokenSymbols) {
    pushUniqueCaseInsensitive(normalized, tokenSymbol);

    if (normalized.length === 2) {
      break;
    }
  }

  return normalized;
}

function mergeBooleanState(current: boolean | null, candidate: unknown) {
  if (candidate === true) {
    return true;
  }

  if (candidate === false) {
    return current === true ? true : false;
  }

  return current;
}

function getOrCreatePoolAccumulator(input: {
  map: Map<string, PoolAccumulator>;
  poolId: string;
  poolAddress: string;
  label: string;
  tokenSymbols: string[];
  feeTierLabel: string | null;
}) {
  const existing = input.map.get(input.poolId);
  if (existing) {
    for (const tokenSymbol of input.tokenSymbols) {
      pushUniqueCaseInsensitive(existing.tokenSymbols, tokenSymbol);

      if (existing.tokenSymbols.length === 2) {
        break;
      }
    }

    if (!existing.feeTierLabel && input.feeTierLabel) {
      existing.feeTierLabel = input.feeTierLabel;
    }

    return existing;
  }

  const created: PoolAccumulator = {
    poolId: input.poolId,
    poolAddress: input.poolAddress,
    label: input.label,
    tokenSymbols: normalizePoolTokenSymbols(input.tokenSymbols),
    feeTierLabel: input.feeTierLabel,
    manualValueUsd: 0,
    strategyValueUsd: 0,
    residualValueUsd: 0,
    totalRewardsUsd: 0,
    totalFeesUsd: 0,
    coverageStatus: "unknown",
    strategyLabels: [],
    firstParticipatedAt: null,
    lastParticipatedAt: null,
    hasManual: false,
    hasStrategy: false,
    hasResidual: false,
    isInRange: null,
    strategyDebugReferences: [],
    timeline: [],
    rewardValueByDay: new Map(),
  };

  input.map.set(input.poolId, created);
  return created;
}

function inferExposureMix(pool: PoolAccumulator) {
  if (pool.hasManual && pool.hasStrategy) {
    return "mixed";
  }

  if (pool.hasManual) {
    return "manual";
  }

  if (pool.hasStrategy) {
    return "automated";
  }

  if (pool.hasResidual) {
    return "residual_only";
  }

  return "unknown";
}

function inferStatus(pool: PoolAccumulator) {
  const currentValue = pool.manualValueUsd + pool.strategyValueUsd + pool.residualValueUsd;

  if (currentValue > 0) {
    return "active";
  }

  if (pool.lastParticipatedAt) {
    return "closed";
  }

  return "unknown";
}

function buildDayPriceSeries(input: {
  days: string[];
  priceRows: Array<{ tokenAddress: string; priceUsd: string; pricedAt: Date }>;
  capturedAt: Date;
}) {
  const latestPriceByToken = new Map<string, number>();
  const earliestPriceDayByToken = new Map<string, string>();
  const rowsByToken = new Map<string, Array<{ pricedAt: Date; priceUsd: number }>>();

  for (const row of input.priceRows) {
    const priceUsd = asNumber(row.priceUsd);
    if (priceUsd === null) {
      continue;
    }

    const tokenAddress = row.tokenAddress.toLowerCase();
    latestPriceByToken.set(tokenAddress, priceUsd);
    const bucket = rowsByToken.get(tokenAddress) ?? [];
    bucket.push({ pricedAt: row.pricedAt, priceUsd });
    rowsByToken.set(tokenAddress, bucket);
  }

  const priceByTokenAndDay = new Map<string, Map<string, number>>();
  for (const [tokenAddress, rows] of rowsByToken.entries()) {
    const daySeries = new Map<string, number>();
    let latestKnownPrice: number | null = null;
    let rowIndex = 0;

    if (rows.length > 0) {
      earliestPriceDayByToken.set(tokenAddress, dayUtcFromDate(rows[0].pricedAt));
    }

    for (const day of input.days) {
      const boundary = day === input.days[input.days.length - 1]
        ? input.capturedAt
        : new Date(`${day}T23:59:59.999Z`);

      while (rowIndex < rows.length && rows[rowIndex].pricedAt.getTime() <= boundary.getTime()) {
        latestKnownPrice = rows[rowIndex].priceUsd;
        rowIndex += 1;
      }

      if (latestKnownPrice !== null) {
        daySeries.set(day, latestKnownPrice);
      }
    }

    priceByTokenAndDay.set(tokenAddress, daySeries);
  }

  return {
    latestPriceByToken,
    earliestPriceDayByToken,
    priceByTokenAndDay,
  };
}

async function hydrateHistoricalPoolPrices(input: {
  chainId: number;
  tokenAddresses: string[];
  startDayUtc: string;
  capturedAt: Date;
}) {
  if (input.tokenAddresses.length === 0) {
    return;
  }

  const db = getDb();
  const startTime = new Date(`${input.startDayUtc}T00:00:00.000Z`).toISOString();
  const endTime = input.capturedAt.toISOString();

  for (const tokenAddress of input.tokenAddresses) {
    const historicalPrices = await getHistoricalTokenPricesByAddress(input.chainId, {
      address: tokenAddress,
      startTime,
      endTime,
      interval: "1d",
    }).catch(() => null);

    for (const pricePoint of historicalPrices?.data ?? []) {
      const priceUsd = Number(pricePoint.value);
      if (!Number.isFinite(priceUsd)) {
        continue;
      }

      await db.insert(pricePoints).values({
        chainId: input.chainId,
        tokenAddress,
        pricedAt: new Date(pricePoint.timestamp),
        source: "alchemy",
        resolution: "daily",
        confidence: "high",
        priceUsd: String(priceUsd),
        metadataJson: {
          provider: "alchemy",
          range: "pool_materialization",
        },
      }).onConflictDoUpdate({
        target: [
          pricePoints.chainId,
          pricePoints.tokenAddress,
          pricePoints.pricedAt,
          pricePoints.source,
          pricePoints.resolution,
        ],
        set: {
          confidence: "high",
          priceUsd: String(priceUsd),
          metadataJson: {
            provider: "alchemy",
            range: "pool_materialization",
          },
        },
      });
    }
  }
}

function resolveTokenPrice(input: {
  tokenAddress: string;
  dayUtc: string;
  latestPriceByToken: Map<string, number>;
  earliestPriceDayByToken: Map<string, string>;
  priceByTokenAndDay: Map<string, Map<string, number>>;
}) {
  const dayPrice = input.priceByTokenAndDay.get(input.tokenAddress)?.get(input.dayUtc);
  if (typeof dayPrice === "number") {
    return dayPrice;
  }

  const earliestPriceDayUtc = input.earliestPriceDayByToken.get(input.tokenAddress);
  if (earliestPriceDayUtc && input.dayUtc < earliestPriceDayUtc) {
    return 0;
  }

  return input.latestPriceByToken.get(input.tokenAddress) ?? 0;
}

function parseTokenAmount(rawAmount: string, decimals: number | null) {
  if (decimals === null || !/^\d+$/.test(rawAmount)) {
    return 0;
  }

  const digits = rawAmount.padStart(decimals + 1, "0");
  const integerPart = digits.slice(0, digits.length - decimals);
  const fractionalPart = digits.slice(digits.length - decimals);
  const parsed = Number(`${integerPart}.${fractionalPart}`);
  return Number.isFinite(parsed) ? parsed : 0;
}

function chunkRows<T>(rows: T[], chunkSize: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < rows.length; index += chunkSize) {
    chunks.push(rows.slice(index, index + chunkSize));
  }

  return chunks;
}

function resolveRewardValueUsd(input: {
  chainId: number;
  rewardAmountUsd: unknown;
  rewardAmountRaw: unknown;
  rewardTokenAddress: string | null;
  rewardMetadata: Record<string, unknown>;
  dayUtc: string;
  latestPriceByToken: Map<string, number>;
  earliestPriceDayByToken: Map<string, string>;
  priceByTokenAndDay: Map<string, Map<string, number>>;
}) {
  const persistedAmountUsd = asNumber(input.rewardAmountUsd);
  if (persistedAmountUsd !== null && persistedAmountUsd > 0) {
    return persistedAmountUsd;
  }

  if (!input.rewardTokenAddress || typeof input.rewardAmountRaw !== "string") {
    return persistedAmountUsd ?? 0;
  }

  const decimals = resolveKnownTokenDecimals({
    chainId: input.chainId,
    tokenAddress: input.rewardTokenAddress,
    symbol: input.rewardMetadata.tokenSymbol,
    decimals: input.rewardMetadata.tokenDecimals,
  });
  const amount = parseTokenAmount(input.rewardAmountRaw, decimals);
  if (amount <= 0) {
    return persistedAmountUsd ?? 0;
  }

  const priceUsd = resolveTokenPrice({
    tokenAddress: input.rewardTokenAddress,
    dayUtc: input.dayUtc,
    latestPriceByToken: input.latestPriceByToken,
    earliestPriceDayByToken: input.earliestPriceDayByToken,
    priceByTokenAndDay: input.priceByTokenAndDay,
  });

  return priceUsd > 0 ? amount * priceUsd : (persistedAmountUsd ?? 0);
}

export function buildSyntheticGaugeClaimCandidates(input: {
  lifecycleRows: Array<Pick<LifecycleLedgerRow, "id" | "txHash" | "classification" | "occurredAt" | "metadataJson">>;
  rewardTxHashSet: Set<string>;
  protocolContractPoolIdByAddress: Map<string, string>;
}) {
  const syntheticRewardClassifications = new Set(["claim", "unstake"]);
  const syntheticRewardMethodLabels = new Set(["getreward", "getrewards", "claim", "collect", "withdraw"]);

  return input.lifecycleRows.flatMap((row): SyntheticGaugeClaimCandidate[] => {
    const classification = row.classification ?? null;
    if (!row.id || !classification || !syntheticRewardClassifications.has(classification)) {
      return [];
    }

    const txHash = row.txHash.toLowerCase();
    if (input.rewardTxHashSet.has(txHash)) {
      return [];
    }

    const metadata = row.metadataJson ?? {};
    const gaugeAddress = normalizeTokenAddress(asString(metadata.toAddress));
    const methodLabel = asString(metadata.methodLabel)?.toLowerCase() ?? null;
    if (!gaugeAddress || !methodLabel || !syntheticRewardMethodLabels.has(methodLabel)) {
      return [];
    }

    const poolId = input.protocolContractPoolIdByAddress.get(gaugeAddress)
      ?? null;
    if (!poolId) {
      return [];
    }

    return [{
      ledgerEventId: row.id,
      txHash,
      occurredAt: row.occurredAt,
      poolId,
      gaugeAddress,
      methodLabel,
      metadataJson: metadata,
    }];
  });
}

export function buildSyntheticGaugeClaimEventKey(input: Pick<SyntheticGaugeClaimCandidate, "txHash" | "ledgerEventId">) {
  return `reward:${input.txHash}:${input.ledgerEventId}`;
}

function summarizeSyntheticGaugeClaimMovements(input: Array<{
  tokenAddress: string;
  amountRaw: string;
  directionIn: boolean;
}>) {
  const incomingMovements = input.filter((movement) => movement.directionIn);
  const tokenAddresses = Array.from(new Set(incomingMovements.map((movement) => movement.tokenAddress)));
  if (tokenAddresses.length !== 1) {
    return {
      tokenAddress: null,
      amountRaw: null,
    };
  }

  const [tokenAddress] = tokenAddresses;
  const amountRaw = incomingMovements
    .filter((movement) => movement.tokenAddress === tokenAddress)
    .reduce((total, movement) => total + BigInt(movement.amountRaw), 0n)
    .toString();

  return {
    tokenAddress,
    amountRaw,
  };
}

export function buildSyntheticGaugeClaimRewards(input: {
  chainId: number;
  candidates: SyntheticGaugeClaimCandidate[];
  movementsByLedgerEventId: Map<string, Array<{
    ledgerEventId: string | null;
    tokenAddress: string;
    amountRaw: string;
    directionIn: boolean;
    amountUsd: string | null;
    metadataJson: Record<string, unknown>;
  }>>;
  latestPriceByToken: Map<string, number>;
  earliestPriceDayByToken: Map<string, string>;
  priceByTokenAndDay: Map<string, Map<string, number>>;
}) {
  return input.candidates.flatMap((candidate): SyntheticGaugeClaimReward[] => {
    const movements = input.movementsByLedgerEventId.get(candidate.ledgerEventId) ?? [];
    if (movements.length === 0) {
      return [];
    }

    const dayUtc = dayUtcFromDate(candidate.occurredAt);
    let signedUsdTotal = 0;

    for (const movement of movements) {
      const tokenAddress = normalizeTokenAddress(movement.tokenAddress);
      if (!tokenAddress) {
        continue;
      }

      const amountUsd = resolveRewardValueUsd({
        chainId: input.chainId,
        rewardAmountUsd: movement.amountUsd,
        rewardAmountRaw: movement.amountRaw,
        rewardTokenAddress: tokenAddress,
        rewardMetadata: movement.metadataJson,
        dayUtc,
        latestPriceByToken: input.latestPriceByToken,
        earliestPriceDayByToken: input.earliestPriceDayByToken,
        priceByTokenAndDay: input.priceByTokenAndDay,
      });
      signedUsdTotal += movement.directionIn ? amountUsd : -amountUsd;
    }

    if (signedUsdTotal <= 0) {
      return [];
    }

    const summary = summarizeSyntheticGaugeClaimMovements(movements);

    return [{
      eventKey: buildSyntheticGaugeClaimEventKey(candidate),
      poolId: candidate.poolId,
      txHash: candidate.txHash,
      occurredAt: candidate.occurredAt,
      amountUsd: signedUsdTotal,
      tokenAddress: summary.tokenAddress,
      amountRaw: summary.amountRaw,
      sourceLedgerEventId: candidate.ledgerEventId,
      gaugeAddress: candidate.gaugeAddress,
      methodLabel: candidate.methodLabel,
      metadataJson: candidate.metadataJson,
    }];
  });
}

export function resolvePoolRewardTargetPoolId(input: {
  resolvedPoolId?: string | null;
  relatedId: string | null;
  depositToPoolId: Map<string, string>;
  strategyToPoolId: Map<string, string>;
}) {
  if (input.resolvedPoolId) {
    return input.resolvedPoolId;
  }

  if (!input.relatedId) {
    return null;
  }

  return input.depositToPoolId.get(input.relatedId)
    ?? input.strategyToPoolId.get(input.relatedId)
    ?? null;
}

function computeTrackedTokenBalanceValueUsd(input: {
  balances: Map<string, number>;
  dayUtc: string;
  latestPriceByToken: Map<string, number>;
  earliestPriceDayByToken: Map<string, string>;
  priceByTokenAndDay: Map<string, Map<string, number>>;
}) {
  let totalValueUsd = 0;

  for (const [tokenAddress, amount] of input.balances.entries()) {
    if (amount <= 0) {
      continue;
    }

    const price = resolveTokenPrice({
      tokenAddress,
      dayUtc: input.dayUtc,
      latestPriceByToken: input.latestPriceByToken,
      earliestPriceDayByToken: input.earliestPriceDayByToken,
      priceByTokenAndDay: input.priceByTokenAndDay,
    });
    totalValueUsd += amount * price;
  }

  return totalValueUsd;
}

function applyUsdValuedWithdrawalToBalances(input: {
  balances: Map<string, number>;
  withdrawalValueUsd: number;
  dayUtc: string;
  latestPriceByToken: Map<string, number>;
  earliestPriceDayByToken: Map<string, string>;
  priceByTokenAndDay: Map<string, Map<string, number>>;
}) {
  if (input.withdrawalValueUsd <= 0 || input.balances.size === 0) {
    return;
  }

  const currentTrackedValueUsd = computeTrackedTokenBalanceValueUsd({
    balances: input.balances,
    dayUtc: input.dayUtc,
    latestPriceByToken: input.latestPriceByToken,
    earliestPriceDayByToken: input.earliestPriceDayByToken,
    priceByTokenAndDay: input.priceByTokenAndDay,
  });

  if (currentTrackedValueUsd <= 0 || input.withdrawalValueUsd >= currentTrackedValueUsd) {
    input.balances.clear();
    return;
  }

  const retentionRatio = Math.max(0, (currentTrackedValueUsd - input.withdrawalValueUsd) / currentTrackedValueUsd);

  for (const [tokenAddress, amount] of input.balances.entries()) {
    const nextAmount = amount * retentionRatio;
    if (nextAmount <= 1e-12) {
      input.balances.delete(tokenAddress);
      continue;
    }

    input.balances.set(tokenAddress, nextAmount);
  }
}

function applyTrailingSegmentValueAnchor(input: {
  rows: Array<{
    dayUtc: string;
    totalValueUsd: string;
    deployedValueUsd: string;
    residualValueUsd: string;
    manualValueUsd: string;
    strategyValueUsd: string;
  }>;
  startDayUtc: string | null;
  currentSegmentValueUsd: number;
  segment: "manual" | "strategy";
}) {
  if (!input.startDayUtc || input.rows.length === 0 || input.currentSegmentValueUsd < 0) {
    return;
  }

  const valueKey = input.segment === "manual" ? "manualValueUsd" : "strategyValueUsd";
  const latestRow = input.rows[input.rows.length - 1];
  const latestSegmentValueUsd = asNumber(latestRow[valueKey]) ?? 0;

  if (latestSegmentValueUsd <= 0) {
    return;
  }

  const anchorRatio = input.currentSegmentValueUsd / latestSegmentValueUsd;
  if (!Number.isFinite(anchorRatio)) {
    return;
  }

  for (const row of input.rows) {
    if (row.dayUtc < input.startDayUtc) {
      continue;
    }

    const manualValueUsd = valueKey === "manualValueUsd"
      ? (asNumber(row.manualValueUsd) ?? 0) * anchorRatio
      : asNumber(row.manualValueUsd) ?? 0;
    const strategyValueUsd = valueKey === "strategyValueUsd"
      ? (asNumber(row.strategyValueUsd) ?? 0) * anchorRatio
      : asNumber(row.strategyValueUsd) ?? 0;
    const residualValueUsd = asNumber(row.residualValueUsd) ?? 0;
    const deployedValueUsd = manualValueUsd + strategyValueUsd;

    row.manualValueUsd = String(manualValueUsd);
    row.strategyValueUsd = String(strategyValueUsd);
    row.deployedValueUsd = String(deployedValueUsd);
    row.totalValueUsd = String(deployedValueUsd + residualValueUsd);
  }
}

function sumLifecycleMovementUsd(input: {
  ledgerEventId: string | null;
  directionIn: boolean;
  movementTotalsByLedgerEventId: Map<string, { incomingUsd: number; outgoingUsd: number }>;
}) {
  if (!input.ledgerEventId) {
    return 0;
  }

  const totals = input.movementTotalsByLedgerEventId.get(input.ledgerEventId);
  if (!totals) {
    return 0;
  }

  return input.directionIn ? totals.incomingUsd : totals.outgoingUsd;
}

function applyCapitalFlowCounters(input: {
  capitalEnteredUsd: number;
  capitalWithdrawnUsd: number;
  event: PoolCapitalFlowEvent;
}) {
  if (input.event.direction === "in") {
    return {
      capitalEnteredUsd: input.capitalEnteredUsd + input.event.amountUsd,
      capitalWithdrawnUsd: input.capitalWithdrawnUsd,
    };
  }

  return {
    capitalEnteredUsd: input.capitalEnteredUsd,
    capitalWithdrawnUsd: input.capitalWithdrawnUsd + input.event.amountUsd,
  };
}

function computeAnnualizedRewardReturnPct(input: {
  firstParticipatedAt: Date | null;
  lastParticipatedAt: Date | null;
  coveredEndDayUtc: string;
  status: string;
  capitalEnteredUsd: number;
  totalRewardsUsd: number;
}) {
  if (!input.firstParticipatedAt || input.capitalEnteredUsd <= 0) {
    return null;
  }

  const coveredEndAt = new Date(`${input.coveredEndDayUtc}T23:59:59.999Z`);
  const effectiveEndAt = input.status === "active"
    ? coveredEndAt
    : input.lastParticipatedAt && input.lastParticipatedAt.getTime() < coveredEndAt.getTime()
      ? input.lastParticipatedAt
      : coveredEndAt;
  const elapsedMs = Math.max(effectiveEndAt.getTime() - input.firstParticipatedAt.getTime(), 24 * 60 * 60 * 1000);
  const investedDays = elapsedMs / (24 * 60 * 60 * 1000);
  const totalReturnPct = (input.totalRewardsUsd / input.capitalEnteredUsd) * 100;

  return totalReturnPct * (365 / investedDays);
}

function resolveEffectiveHistoryStartDay(input: {
  defaultStartDayUtc: string;
  firstParticipatedAt: Date | null;
  days: string[];
}) {
  if (!input.firstParticipatedAt) {
    return input.defaultStartDayUtc;
  }

  const participatedDayUtc = dayUtcFromDate(input.firstParticipatedAt);
  return input.days.includes(participatedDayUtc)
    ? participatedDayUtc
    : input.defaultStartDayUtc;
}

function uniqueLifecycleRows(rows: LifecycleLedgerRow[]) {
  const seen = new Set<string>();
  const uniqueRows: LifecycleLedgerRow[] = [];

  for (const row of rows.sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime())) {
    if (seen.has(row.txHash)) {
      continue;
    }

    seen.add(row.txHash);
    uniqueRows.push(row);
  }

  return uniqueRows;
}

export function mapInferredActionToPoolTimelineEventType(actionType: string | null) {
  return actionType === "rebalance_same_pool"
    ? "rebalance"
    : actionType === "redeploy_same_pool" || actionType === "redeploy_cross_pool"
      ? "redeploy"
      : "deposit";
}

export function collectCanonicalLifecycleRows(input: {
  lifecycleRows: LifecycleLedgerRow[];
  inferredAction:
    | {
        classificationBasis: string | null;
        consumingLedgerEventIdsJson: string[];
        sourceLedgerEventId: string | null;
      }
    | null;
}) {
  if (!input.inferredAction || input.inferredAction.classificationBasis !== "residual_flow") {
    return [];
  }

  const relatedLedgerEventIds = new Set<string>(input.inferredAction.consumingLedgerEventIdsJson.filter(Boolean));
  if (input.inferredAction.sourceLedgerEventId) {
    relatedLedgerEventIds.add(input.inferredAction.sourceLedgerEventId);
  }

  return uniqueLifecycleRows(input.lifecycleRows.filter((row) => relatedLedgerEventIds.has(row.id)));
}

export function buildGroupedLifecycleEvent(input: {
  deposit: PoolDepositTimelineCandidate;
  lifecycleRows: LifecycleLedgerRow[];
  inferredAction:
    | {
        actionType: string;
        primaryPoolId: string | null;
        classificationBasis: string | null;
        consumingLedgerEventIdsJson: string[];
        sourceLedgerEventId: string | null;
      }
    | null;
}): MaterializedTimelineEvent {
  const groupedRows = uniqueLifecycleRows(input.lifecycleRows);
  const groupedClassifications = groupedRows
    .map((row) => row.classification)
    .filter((value): value is string => Boolean(value));

  const inferredActionType = input.inferredAction?.actionType ?? null;
  const eventType = mapInferredActionToPoolTimelineEventType(inferredActionType);

  return {
    eventKey: `group:${input.deposit.poolId}:${input.deposit.depositId}`,
    eventType,
    occurredAt: groupedRows[0]?.occurredAt ?? input.deposit.occurredAt,
    confidence: combineConfidence(groupedRows.map((row) => row.confidence)),
    coverageStatus: combineCoverageStatus([
      input.deposit.coverageStatus,
      ...groupedRows.map(() => input.deposit.coverageStatus),
    ]),
    attributedValueUsd: input.deposit.attributedValueUsd,
    sourceLedgerEventId: input.deposit.sourceLedgerEventId,
    relatedDepositId: input.deposit.relatedDepositId,
    relatedStrategyId: null,
    metadataJson: {
      ...input.deposit.metadataJson,
      grouped: true,
      groupedClassifications,
      inferredActionType,
      txHashes: groupedRows.map((row) => row.txHash),
      ledgerEventIds: groupedRows.map((row) => row.id),
      sequence: groupedRows.map((row) => ({
        classification: row.classification,
        occurredAt: row.occurredAt.toISOString(),
        txHash: row.txHash,
        summary: asString(row.metadataJson.summary),
      })),
    },
  };
}

function buildDepositLifecycleEvent(input: {
  deposit: PoolDepositTimelineCandidate;
}): MaterializedTimelineEvent {
  return {
    eventKey: `deposit:${input.deposit.depositId}`,
    eventType: input.deposit.status === "closed" ? "close" : "deposit",
    occurredAt: input.deposit.occurredAt,
    confidence: input.deposit.sourceLedgerEventId ? "high" : "medium",
    coverageStatus: combineCoverageStatus([input.deposit.coverageStatus]),
    attributedValueUsd: input.deposit.attributedValueUsd,
    sourceLedgerEventId: input.deposit.sourceLedgerEventId,
    relatedDepositId: input.deposit.relatedDepositId,
    relatedStrategyId: null,
    metadataJson: input.deposit.metadataJson,
  };
}

function buildResidualTimelineEvents(candidates: PoolResidualTimelineCandidate[]) {
  const groups = new Map<string, PoolResidualTimelineCandidate[]>();

  for (const candidate of candidates) {
    const key = candidate.sourceLedgerEventId ?? `residual:${candidate.poolId}:${candidate.occurredAt.toISOString()}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(candidate);
    groups.set(key, bucket);
  }

  return Array.from(groups.entries()).map(([groupKey, groupCandidates]) => {
    const sorted = groupCandidates.sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime());
    const first = sorted[0];
    const attributedValueUsd = sorted.reduce((sum, candidate) => sum + (candidate.attributedValueUsd ?? 0), 0);
    const coverageStatus = combineCoverageStatus(sorted.map((candidate) => candidate.coverageStatus));
    const confidence = combineConfidence(sorted.map((candidate) => candidate.confidence));
    const hasPartialAttribution = coverageStatus === "partial";

    return {
      poolId: first.poolId,
      event: {
        eventKey: first.sourceLedgerEventId ? `residual:${groupKey}` : groupKey,
        eventType: hasPartialAttribution ? "partial_swap_attribution" : "withdraw",
        occurredAt: first.occurredAt,
        confidence,
        coverageStatus,
        attributedValueUsd: attributedValueUsd > 0 ? attributedValueUsd : null,
        sourceLedgerEventId: first.sourceLedgerEventId,
        relatedDepositId: null,
        relatedStrategyId: null,
        metadataJson: {
          tokenSymbols: Array.from(new Set(sorted.map((candidate) => asString(candidate.metadataJson.tokenSymbol)).filter((value): value is string => Boolean(value)))),
          tokenAddresses: Array.from(new Set(sorted.map((candidate) => asString(candidate.metadataJson.tokenAddress)).filter((value): value is string => Boolean(value)))),
          sourceTxHashes: Array.from(new Set(sorted.map((candidate) => asString(candidate.metadataJson.sourceTxHash)).filter((value): value is string => Boolean(value)))),
          groupedAttributionIds: sorted.map((candidate) => asString(candidate.metadataJson.attributionId)).filter((value): value is string => Boolean(value)),
          resolutionStatuses: Array.from(new Set(sorted.map((candidate) => asString(candidate.metadataJson.resolutionStatus)).filter((value): value is string => Boolean(value)))),
        },
      } satisfies MaterializedTimelineEvent,
    };
  });
}

export async function materializePoolReadModels(input: MaterializePoolReadModelsInput) {
  const db = getDb();
  const walletAddress = input.walletAddress.toLowerCase();
  const days = Array.from(iterateUtcDays(input.startDayUtc, input.endDayUtc));
  const startBoundary = new Date(`${input.startDayUtc}T00:00:00.000Z`);
  const endBoundary = new Date(`${input.endDayUtc}T23:59:59.999Z`);

  const [
    poolRows,
    depositRows,
    strategyRows,
    rewardRows,
    attributionRows,
    lifecycleLedgerRows,
    lifecycleMovementRows,
    inferredActionRows,
  ] = await Promise.all([
    db.select({
      id: pools.id,
      poolAddress: pools.poolAddress,
      label: pools.label,
      token0Address: pools.token0Address,
      token1Address: pools.token1Address,
      metadataJson: pools.metadataJson,
    }).from(pools),
    db.select({
      id: deposits.id,
      poolId: deposits.poolId,
      mintTxHash: deposits.mintTxHash,
      tokenId: deposits.tokenId,
      status: deposits.status,
      coverageStatus: deposits.coverageStatus,
      createdAt: deposits.createdAt,
      updatedAt: deposits.updatedAt,
      metadataJson: deposits.metadataJson,
    }).from(deposits).where(and(eq(deposits.walletAddress, walletAddress), eq(deposits.chainId, input.chainId))),
    db.select({
      exposureId: strategyExposures.id,
      strategyId: strategyExposures.strategyId,
      coverageStatus: strategyExposures.coverageStatus,
      createdAt: strategyExposures.createdAt,
      updatedAt: strategyExposures.updatedAt,
      wrapperAddress: strategyExposures.wrapperAddress,
      underlying0AmountRaw: strategyExposures.underlying0AmountRaw,
      underlying1AmountRaw: strategyExposures.underlying1AmountRaw,
      exposureMetadataJson: strategyExposures.metadataJson,
      strategyLabel: strategies.label,
      primaryPoolId: strategies.primaryPoolId,
      strategyMetadataJson: strategies.metadataJson,
    })
      .from(strategyExposures)
      .innerJoin(strategies, eq(strategyExposures.strategyId, strategies.id))
      .where(and(eq(strategyExposures.walletAddress, walletAddress), eq(strategyExposures.chainId, input.chainId))),
    db.select({
      id: rewardEvents.id,
      depositOrStrategyId: rewardEvents.depositOrStrategyId,
      resolvedPoolId: rewardEvents.resolvedPoolId,
      tokenAddress: rewardEvents.tokenAddress,
      amountRaw: rewardEvents.amountRaw,
      amountUsd: rewardEvents.amountUsd,
      occurredAt: rewardEvents.occurredAt,
      rewardType: rewardEvents.rewardType,
      txHash: rewardEvents.txHash,
      logIndex: rewardEvents.logIndex,
      metadataJson: rewardEvents.metadataJson,
    }).from(rewardEvents).where(and(eq(rewardEvents.walletAddress, walletAddress), eq(rewardEvents.chainId, input.chainId), eq(rewardEvents.isAccrualSnapshot, false), gte(rewardEvents.occurredAt, startBoundary), lte(rewardEvents.occurredAt, endBoundary))),
    db.select({
      id: attributionStates.id,
      poolId: attributionStates.poolId,
      tokenAddress: attributionStates.tokenAddress,
      residualAmountRaw: attributionStates.residualAmountRaw,
      resolutionStatus: attributionStates.resolutionStatus,
      sourceLedgerEventId: attributionStates.sourceLedgerEventId,
      createdAt: attributionStates.createdAt,
      updatedAt: attributionStates.updatedAt,
      metadataJson: attributionStates.metadataJson,
      ledgerClassification: ledgerEvents.classification,
      ledgerOccurredAt: ledgerEvents.occurredAt,
      ledgerTxHash: ledgerEvents.txHash,
      ledgerEventType: ledgerEvents.eventType,
      ledgerConfidence: ledgerEvents.confidence,
    })
      .from(attributionStates)
      .leftJoin(ledgerEvents, eq(attributionStates.sourceLedgerEventId, ledgerEvents.id))
      .where(and(eq(attributionStates.walletAddress, walletAddress), eq(attributionStates.chainId, input.chainId))),
    db.select({
      id: ledgerEvents.id,
      txHash: ledgerEvents.txHash,
      classification: ledgerEvents.classification,
      occurredAt: ledgerEvents.occurredAt,
      confidence: ledgerEvents.confidence,
      metadataJson: ledgerEvents.metadataJson,
    })
      .from(ledgerEvents)
      .where(
        and(
          eq(ledgerEvents.walletAddress, walletAddress),
          eq(ledgerEvents.chainId, input.chainId),
          gte(ledgerEvents.occurredAt, startBoundary),
          lte(ledgerEvents.occurredAt, endBoundary),
          inArray(ledgerEvents.classification, ["manual_deposit", "manual_withdrawal", "strategy_deposit", "strategy_withdraw", "stake", "unstake", "swap", "claim"]),
        ),
      )
      .orderBy(asc(ledgerEvents.occurredAt)),
    db.select({
      ledgerEventId: assetMovements.ledgerEventId,
      tokenAddress: assetMovements.tokenAddress,
      amountRaw: assetMovements.amountRaw,
      directionIn: assetMovements.directionIn,
      amountUsd: assetMovements.amountUsd,
      metadataJson: assetMovements.metadataJson,
    })
      .from(assetMovements)
      .innerJoin(ledgerEvents, eq(assetMovements.ledgerEventId, ledgerEvents.id))
      .where(
        and(
          eq(assetMovements.walletAddress, walletAddress),
          eq(assetMovements.chainId, input.chainId),
          gte(ledgerEvents.occurredAt, startBoundary),
          lte(ledgerEvents.occurredAt, endBoundary),
          inArray(ledgerEvents.classification, [
            "manual_deposit",
            "manual_withdrawal",
            "strategy_deposit",
            "strategy_withdraw",
            "stake",
            "unstake",
            "swap",
            "claim",
          ]),
        ),
      ),
    db.select({
      actionType: inferredActions.actionType,
      primaryPoolId: inferredActions.primaryPoolId,
      sourceLedgerEventId: inferredActions.sourceLedgerEventId,
      consumingLedgerEventIdsJson: inferredActions.consumingLedgerEventIdsJson,
      occurredAt: inferredActions.occurredAt,
      metadataJson: inferredActions.metadataJson,
    })
      .from(inferredActions)
      .where(
        and(
          eq(inferredActions.walletAddress, walletAddress),
          eq(inferredActions.chainId, input.chainId),
          gte(inferredActions.occurredAt, startBoundary),
          lte(inferredActions.occurredAt, endBoundary),
        ),
      ),
  ]);

  // Build a canonical lookup keyed by deposit source ledger event id. The
  // engine's canonical inference (canonicalInference.ts) is the single source
  // of truth for whether a deposit is a fresh capital event, a same-pool
  // rebalance, or a redeploy from a sibling pool. The lifecycle grouping
  // below consults this map instead of the legacy `hasSwap` heuristic.
  const inferredActionByDepositLedgerEventId = new Map<string, {
    actionType: string;
    primaryPoolId: string | null;
    classificationBasis: string | null;
    consumingLedgerEventIdsJson: string[];
    sourceLedgerEventId: string | null;
  }>();
  for (const action of inferredActionRows) {
    if (!action.sourceLedgerEventId) continue;
    inferredActionByDepositLedgerEventId.set(action.sourceLedgerEventId, {
      actionType: action.actionType,
      primaryPoolId: action.primaryPoolId,
      classificationBasis:
        typeof action.metadataJson.classificationBasis === "string"
          ? action.metadataJson.classificationBasis
          : null,
      consumingLedgerEventIdsJson: action.consumingLedgerEventIdsJson,
      sourceLedgerEventId: action.sourceLedgerEventId,
    });
  }

  const poolsById = new Map(poolRows.map((row) => [row.id, row]));
  const poolIdByAddress = new Map(poolRows.map((row) => [row.poolAddress.toLowerCase(), row.id] as const));
  const poolIdByGaugeAddress = new Map(
    poolRows.flatMap((row) => {
      const gaugeAddress = normalizeTokenAddress((row.metadataJson ?? {}).gaugeAddress);
      return gaugeAddress ? [[gaugeAddress, row.id] as const] : [];
    }),
  );
  const depositToPoolId = new Map<string, string>();
  const strategyToPoolId = new Map<string, string>();
  const accumulators = new Map<string, PoolAccumulator>();
  const tokenComponentBuckets = new Map<string, Array<{ tokenAddress: string; amount: number; segment: "manual" | "strategy" | "residual" }>>();
  const poolUnderlyingTokenAddresses = new Map(
    poolRows.map((row) => [
      row.id,
      new Set(
        [
          normalizeTokenAddress(row.token0Address),
          normalizeTokenAddress(row.token1Address),
          normalizeTokenAddress((row.metadataJson ?? {}).token0Address),
          normalizeTokenAddress((row.metadataJson ?? {}).token1Address),
        ].filter((value): value is string => Boolean(value)),
      ),
    ] as const),
  );
  const relevantTokenAddresses = new Set<string>();
  const lifecycleLedgerByTxHash = new Map(
    lifecycleLedgerRows.map((row) => [row.txHash.toLowerCase(), {
      id: row.id,
      txHash: row.txHash.toLowerCase(),
      classification: row.classification,
      occurredAt: row.occurredAt,
      confidence: row.confidence,
      metadataJson: row.metadataJson ?? {},
    } satisfies LifecycleLedgerRow]),
  );
  const normalizedLifecycleRows = Array.from(lifecycleLedgerByTxHash.values()).sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime());
  const depositTimelineCandidates: PoolDepositTimelineCandidate[] = [];
  const residualTimelineCandidates: PoolResidualTimelineCandidate[] = [];
  const capitalFlowEvents: PoolCapitalFlowEvent[] = [];
  const tokenDeltaEvents: PoolTokenDeltaEvent[] = [];
  const movementTotalsByLedgerEventId = new Map<string, { incomingUsd: number; outgoingUsd: number }>();
  const movementCounterpartyAddressesByLedgerEventId = new Map<string, Set<string>>();
  const lifecycleMovementsByLedgerEventId = new Map<string, Array<{
    ledgerEventId: string | null;
    tokenAddress: string;
    amountRaw: string;
    directionIn: boolean;
    amountUsd: string | null;
    metadataJson: Record<string, unknown>;
  }>>();

  for (const row of lifecycleMovementRows) {
    if (!row.ledgerEventId) {
      continue;
    }

    const totals = movementTotalsByLedgerEventId.get(row.ledgerEventId) ?? { incomingUsd: 0, outgoingUsd: 0 };
    const amountUsd = asNumber(row.amountUsd) ?? 0;
    if (row.directionIn) {
      totals.incomingUsd += amountUsd;
    } else {
      totals.outgoingUsd += amountUsd;
    }
    movementTotalsByLedgerEventId.set(row.ledgerEventId, totals);

    const metadata = (row.metadataJson ?? {}) as Record<string, unknown>;
    const fromAddress = asString(metadata.fromAddress)?.toLowerCase() ?? null;
    const toAddress = asString(metadata.toAddress)?.toLowerCase() ?? null;
    const counterpartyAddresses = movementCounterpartyAddressesByLedgerEventId.get(row.ledgerEventId) ?? new Set<string>();
    if (fromAddress && fromAddress !== walletAddress) {
      counterpartyAddresses.add(fromAddress);
    }
    if (toAddress && toAddress !== walletAddress) {
      counterpartyAddresses.add(toAddress);
    }
    movementCounterpartyAddressesByLedgerEventId.set(row.ledgerEventId, counterpartyAddresses);

    const tokenAddress = row.tokenAddress.toLowerCase();
    const amountRaw = typeof row.amountRaw === "string" ? row.amountRaw : String(row.amountRaw);
    const movementBucket = lifecycleMovementsByLedgerEventId.get(row.ledgerEventId) ?? [];
    movementBucket.push({
      ledgerEventId: row.ledgerEventId,
      tokenAddress,
      amountRaw,
      directionIn: row.directionIn,
      amountUsd: typeof row.amountUsd === "string" ? row.amountUsd : row.amountUsd === null ? null : String(row.amountUsd),
      metadataJson: (row.metadataJson ?? {}) as Record<string, unknown>,
    });
    lifecycleMovementsByLedgerEventId.set(row.ledgerEventId, movementBucket);
  }

  for (const deposit of depositRows) {
    if (!deposit.poolId) {
      continue;
    }

    const pool = poolsById.get(deposit.poolId);
    if (!pool) {
      continue;
    }

    const metadata = deposit.metadataJson ?? {};
    const accumulator = getOrCreatePoolAccumulator({
      map: accumulators,
      poolId: deposit.poolId,
      poolAddress: pool.poolAddress,
      label: pool.label,
      tokenSymbols: [asString(metadata.primaryTokenSymbol), asString(metadata.secondaryTokenSymbol)].filter((value): value is string => Boolean(value)),
      feeTierLabel: asString((pool.metadataJson ?? {}).feeTierLabel) ?? asString((metadata.metadata as Record<string, unknown> | undefined)?.feeTierLabel),
    });

    const valueUsd = asNumber(metadata.valueUsd) ?? 0;
    accumulator.manualValueUsd += valueUsd;
    accumulator.hasManual = true;
    accumulator.isInRange = mergeBooleanState(accumulator.isInRange, (metadata.metadata as Record<string, unknown> | undefined)?.isInRange);
    accumulator.coverageStatus = combineCoverageStatus([accumulator.coverageStatus, deposit.coverageStatus]);
    const depositLedgerEvent = typeof deposit.mintTxHash === "string"
      ? lifecycleLedgerByTxHash.get(deposit.mintTxHash.toLowerCase()) ?? null
      : null;
    const depositOccurredAt = depositLedgerEvent?.occurredAt ?? deposit.createdAt;
    accumulator.firstParticipatedAt = mergeDateBounds(accumulator.firstParticipatedAt, depositOccurredAt, "min");
    accumulator.lastParticipatedAt = mergeDateBounds(accumulator.lastParticipatedAt, deposit.updatedAt, "max");
    depositToPoolId.set(deposit.id, deposit.poolId);

    const token0Address = resolveKnownTokenAddress({
      chainId: input.chainId,
      tokenAddress: (metadata.metadata as Record<string, unknown> | undefined)?.token0Address,
      symbol: metadata.primaryTokenSymbol,
    });
    const token1Address = resolveKnownTokenAddress({
      chainId: input.chainId,
      tokenAddress: (metadata.metadata as Record<string, unknown> | undefined)?.token1Address,
      symbol: metadata.secondaryTokenSymbol,
    });
    const primaryTokenAmount = asNumber(metadata.primaryTokenAmount) ?? 0;
    const secondaryTokenAmount = asNumber(metadata.secondaryTokenAmount) ?? 0;

    const tokenBucket = tokenComponentBuckets.get(deposit.poolId) ?? [];
    if (token0Address && primaryTokenAmount > 0) {
      tokenBucket.push({ tokenAddress: token0Address, amount: primaryTokenAmount, segment: "manual" });
      relevantTokenAddresses.add(token0Address);
    }
    if (token1Address && secondaryTokenAmount > 0) {
      tokenBucket.push({ tokenAddress: token1Address, amount: secondaryTokenAmount, segment: "manual" });
      relevantTokenAddresses.add(token1Address);
    }
    tokenComponentBuckets.set(deposit.poolId, tokenBucket);

    const capitalInUsd = depositLedgerEvent
      ? sumLifecycleMovementUsd({
        ledgerEventId: depositLedgerEvent.id,
        directionIn: false,
        movementTotalsByLedgerEventId,
      })
      : 0;

    depositTimelineCandidates.push({
      depositId: deposit.id,
      poolId: deposit.poolId,
      occurredAt: depositOccurredAt,
      txHash: typeof deposit.mintTxHash === "string" ? deposit.mintTxHash.toLowerCase() : null,
      sourceLedgerEventId: depositLedgerEvent?.id ?? null,
      coverageStatus: deposit.coverageStatus,
      attributedValueUsd: capitalInUsd || valueUsd || null,
      relatedDepositId: deposit.id,
      tokenId: deposit.tokenId,
      status: deposit.status,
      metadataJson: {
        label: asString(metadata.label),
        poolLabel: asString(metadata.poolLabel),
        poolAddress: pool.poolAddress,
        tokenId: deposit.tokenId,
        mintTxHash: typeof deposit.mintTxHash === "string" ? deposit.mintTxHash.toLowerCase() : null,
        primaryTokenAmount: primaryTokenAmount || null,
        secondaryTokenAmount: secondaryTokenAmount || null,
      },
    });

  }

  for (const strategy of strategyRows) {
    if (!strategy.primaryPoolId) {
      continue;
    }

    const pool = poolsById.get(strategy.primaryPoolId);
    if (!pool) {
      continue;
    }

    const metadata = strategy.exposureMetadataJson ?? {};
    const strategyMetadata = strategy.strategyMetadataJson ?? {};
    const accumulator = getOrCreatePoolAccumulator({
      map: accumulators,
      poolId: strategy.primaryPoolId,
      poolAddress: pool.poolAddress,
      label: pool.label,
      tokenSymbols: deriveTokenSymbolsFromPool({
        chainId: input.chainId,
        token0Address: pool.token0Address,
        token1Address: pool.token1Address,
      }),
      feeTierLabel: asString((pool.metadataJson ?? {}).feeTierLabel),
    });

    const valueUsd = asNumber(metadata.valueUsd) ?? asNumber(strategyMetadata.valueUsd) ?? 0;
    accumulator.strategyValueUsd += valueUsd;
    accumulator.hasStrategy = true;
    accumulator.isInRange = mergeBooleanState(accumulator.isInRange, (metadata.metadata as Record<string, unknown> | undefined)?.isInRange);
    accumulator.coverageStatus = combineCoverageStatus([accumulator.coverageStatus, strategy.coverageStatus]);
    accumulator.firstParticipatedAt = mergeDateBounds(accumulator.firstParticipatedAt, strategy.createdAt, "min");
    accumulator.lastParticipatedAt = mergeDateBounds(accumulator.lastParticipatedAt, strategy.updatedAt, "max");
    pushUnique(accumulator.strategyLabels, strategy.strategyLabel);
    pushUniqueStrategyDebugReference(accumulator.strategyDebugReferences, {
      strategyId: strategy.strategyId,
      exposureId: strategy.exposureId,
      externalStrategyPositionReference:
        typeof metadata.externalDepositReference === "string" ? metadata.externalDepositReference : null,
      externalStrategyPositionReferenceStatus:
        metadata.externalDepositReferenceStatus === "resolved" || metadata.externalDepositReferenceStatus === "unresolved"
          ? metadata.externalDepositReferenceStatus
          : null,
    });
    strategyToPoolId.set(strategy.strategyId, strategy.primaryPoolId);

    const token0Address = resolveKnownTokenAddress({
      chainId: input.chainId,
      tokenAddress: metadata.token0Address,
      symbol: metadata.primaryTokenSymbol,
    });
    const token1Address = resolveKnownTokenAddress({
      chainId: input.chainId,
      tokenAddress: metadata.token1Address,
      symbol: metadata.secondaryTokenSymbol,
    });
    const token0Decimals = resolveKnownTokenDecimals({
      chainId: input.chainId,
      tokenAddress: token0Address,
      symbol: metadata.primaryTokenSymbol,
      decimals: (metadata.metadata as Record<string, unknown> | undefined)?.token0Decimals,
    });
    const token1Decimals = resolveKnownTokenDecimals({
      chainId: input.chainId,
      tokenAddress: token1Address,
      symbol: metadata.secondaryTokenSymbol,
      decimals: (metadata.metadata as Record<string, unknown> | undefined)?.token1Decimals,
    });
    const token0Amount = typeof strategy.underlying0AmountRaw === "string"
      ? parseTokenAmount(strategy.underlying0AmountRaw, token0Decimals)
      : 0;
    const token1Amount = typeof strategy.underlying1AmountRaw === "string"
      ? parseTokenAmount(strategy.underlying1AmountRaw, token1Decimals)
      : 0;

    const tokenBucket = tokenComponentBuckets.get(strategy.primaryPoolId) ?? [];
    if (token0Address && token0Amount > 0) {
      tokenBucket.push({ tokenAddress: token0Address, amount: token0Amount, segment: "strategy" });
      relevantTokenAddresses.add(token0Address);
    }
    if (token1Address && token1Amount > 0) {
      tokenBucket.push({ tokenAddress: token1Address, amount: token1Amount, segment: "strategy" });
      relevantTokenAddresses.add(token1Address);
    }
    tokenComponentBuckets.set(strategy.primaryPoolId, tokenBucket);

  }

  const strategyPoolIdByWrapperAddress = new Map(
    strategyRows
      .filter((row): row is typeof row & { primaryPoolId: string; wrapperAddress: string } => Boolean(row.primaryPoolId && row.wrapperAddress))
      .map((row) => [row.wrapperAddress.toLowerCase(), row.primaryPoolId] as const),
  );

  const coveredRewardTxHashSet = new Set(
    rewardRows.flatMap((row) => {
      const poolId = resolvePoolRewardTargetPoolId({
        resolvedPoolId: row.resolvedPoolId,
        relatedId: row.depositOrStrategyId,
        depositToPoolId,
        strategyToPoolId,
      });

      return poolId ? [row.txHash.toLowerCase()] : [];
    }),
  );

  const syntheticGaugeClaimCandidates = poolIdByGaugeAddress.size > 0
    ? buildSyntheticGaugeClaimCandidates({
      lifecycleRows: normalizedLifecycleRows,
      rewardTxHashSet: coveredRewardTxHashSet,
      protocolContractPoolIdByAddress: poolIdByGaugeAddress,
    })
    : [];

  for (const candidate of syntheticGaugeClaimCandidates) {
    for (const movement of lifecycleMovementsByLedgerEventId.get(candidate.ledgerEventId) ?? []) {
      const tokenAddress = normalizeTokenAddress(movement.tokenAddress);
      if (tokenAddress) {
        relevantTokenAddresses.add(tokenAddress);
      }
    }
  }

  for (const lifecycleRow of lifecycleLedgerRows) {
    if (!lifecycleRow.id || !lifecycleRow.classification) {
      continue;
    }

    if (lifecycleRow.classification !== "manual_deposit" && lifecycleRow.classification !== "manual_withdrawal") {
      continue;
    }

    const counterpartyAddresses = movementCounterpartyAddressesByLedgerEventId.get(lifecycleRow.id) ?? new Set<string>();
    const matchingPoolId = Array.from(counterpartyAddresses)
      .map((address) => poolIdByAddress.get(address) ?? null)
      .find((value): value is string => Boolean(value));

    if (!matchingPoolId) {
      continue;
    }

    const pool = poolsById.get(matchingPoolId);
    if (!pool) {
      continue;
    }

    const accumulator = getOrCreatePoolAccumulator({
      map: accumulators,
      poolId: matchingPoolId,
      poolAddress: pool.poolAddress,
      label: pool.label,
      tokenSymbols: deriveTokenSymbolsFromPool({
        chainId: input.chainId,
        token0Address: pool.token0Address,
        token1Address: pool.token1Address,
      }),
      feeTierLabel: asString((pool.metadataJson ?? {}).feeTierLabel),
    });
    accumulator.hasManual = true;
    accumulator.firstParticipatedAt = mergeDateBounds(accumulator.firstParticipatedAt, lifecycleRow.occurredAt, "min");
    accumulator.lastParticipatedAt = mergeDateBounds(accumulator.lastParticipatedAt, lifecycleRow.occurredAt, "max");

    const direction = lifecycleRow.classification === "manual_deposit" ? "in" : "out";
    const underlyingTokenAddresses = poolUnderlyingTokenAddresses.get(matchingPoolId) ?? new Set<string>();
    for (const movement of lifecycleMovementsByLedgerEventId.get(lifecycleRow.id) ?? []) {
      const tokenAddress = movement.tokenAddress.toLowerCase();
      if (!underlyingTokenAddresses.has(tokenAddress)) {
        continue;
      }

      if ((direction === "in" && movement.directionIn) || (direction === "out" && !movement.directionIn)) {
        continue;
      }

      const decimals = resolveKnownTokenDecimals({
        chainId: input.chainId,
        tokenAddress,
        symbol: movement.metadataJson.symbol,
        decimals: movement.metadataJson.decimals,
      });
      const amount = parseTokenAmount(movement.amountRaw, decimals);
      if (amount <= 0) {
        continue;
      }

      relevantTokenAddresses.add(tokenAddress);
      tokenDeltaEvents.push({
        poolId: matchingPoolId,
        occurredAt: lifecycleRow.occurredAt,
        dayUtc: dayUtcFromDate(lifecycleRow.occurredAt),
        segment: "manual",
        direction,
        tokenAddress,
        amount,
        sourceLedgerEventId: lifecycleRow.id,
        metadataJson: {
          source: "manual_lifecycle",
          classification: lifecycleRow.classification,
          ledgerEventId: lifecycleRow.id,
          txHash: lifecycleRow.txHash,
        },
      });
    }
  }

  for (const lifecycleRow of lifecycleLedgerRows) {
    if (!lifecycleRow.id || !lifecycleRow.classification) {
      continue;
    }

    if (
      lifecycleRow.classification !== "strategy_deposit"
      && lifecycleRow.classification !== "strategy_withdraw"
      && lifecycleRow.classification !== "stake"
      && lifecycleRow.classification !== "unstake"
    ) {
      continue;
    }

    const counterpartyAddresses = movementCounterpartyAddressesByLedgerEventId.get(lifecycleRow.id) ?? new Set<string>();
    const matchingPoolId = Array.from(counterpartyAddresses)
      .map((address) => strategyPoolIdByWrapperAddress.get(address) ?? poolIdByAddress.get(address) ?? null)
      .find((value): value is string => Boolean(value));

    if (!matchingPoolId) {
      continue;
    }

    const pool = poolsById.get(matchingPoolId);
    if (!pool) {
      continue;
    }

    const accumulator = getOrCreatePoolAccumulator({
      map: accumulators,
      poolId: matchingPoolId,
      poolAddress: pool.poolAddress,
      label: pool.label,
      tokenSymbols: deriveTokenSymbolsFromPool({
        chainId: input.chainId,
        token0Address: pool.token0Address,
        token1Address: pool.token1Address,
      }),
      feeTierLabel: asString((pool.metadataJson ?? {}).feeTierLabel),
    });
    accumulator.hasStrategy = true;
    accumulator.firstParticipatedAt = mergeDateBounds(accumulator.firstParticipatedAt, lifecycleRow.occurredAt, "min");
    accumulator.lastParticipatedAt = mergeDateBounds(accumulator.lastParticipatedAt, lifecycleRow.occurredAt, "max");

    const underlyingTokenAddresses = poolUnderlyingTokenAddresses.get(matchingPoolId) ?? new Set<string>();
    for (const movement of lifecycleMovementsByLedgerEventId.get(lifecycleRow.id) ?? []) {
      const tokenAddress = movement.tokenAddress.toLowerCase();
      if (!underlyingTokenAddresses.has(tokenAddress)) {
        continue;
      }

      const direction = movement.directionIn ? "out" : "in";

      const decimals = resolveKnownTokenDecimals({
        chainId: input.chainId,
        tokenAddress,
        symbol: movement.metadataJson.symbol,
        decimals: movement.metadataJson.decimals,
      });
      const amount = parseTokenAmount(movement.amountRaw, decimals);
      if (amount <= 0) {
        continue;
      }

      relevantTokenAddresses.add(tokenAddress);
      tokenDeltaEvents.push({
        poolId: matchingPoolId,
        occurredAt: lifecycleRow.occurredAt,
        dayUtc: dayUtcFromDate(lifecycleRow.occurredAt),
        segment: "strategy",
        direction,
        tokenAddress,
        amount,
        sourceLedgerEventId: lifecycleRow.id,
        metadataJson: {
          source: "strategy_lifecycle",
          classification: lifecycleRow.classification,
          ledgerEventId: lifecycleRow.id,
          txHash: lifecycleRow.txHash,
        },
      });
    }
  }

  for (const attribution of attributionRows) {
    const tokenAddress = attribution.tokenAddress ? attribution.tokenAddress.toLowerCase() : null;
    if (tokenAddress) {
      relevantTokenAddresses.add(tokenAddress);
    }
  }

  for (const reward of rewardRows) {
    const tokenAddress = normalizeTokenAddress(reward.tokenAddress);
    if (tokenAddress) {
      relevantTokenAddresses.add(tokenAddress);
    }
  }

  if (relevantTokenAddresses.size > 0) {
    await hydrateHistoricalPoolPrices({
      chainId: input.chainId,
      tokenAddresses: Array.from(relevantTokenAddresses),
      startDayUtc: input.startDayUtc,
      capturedAt: input.capturedAt,
    });

    const priceRows = await db.select({
      tokenAddress: pricePoints.tokenAddress,
      priceUsd: pricePoints.priceUsd,
      pricedAt: pricePoints.pricedAt,
    }).from(pricePoints).where(and(eq(pricePoints.chainId, input.chainId), inArray(pricePoints.tokenAddress, Array.from(relevantTokenAddresses)), lte(pricePoints.pricedAt, input.capturedAt))).orderBy(asc(pricePoints.tokenAddress), asc(pricePoints.pricedAt));

    const { latestPriceByToken, earliestPriceDayByToken, priceByTokenAndDay } = buildDayPriceSeries({
      days,
      priceRows,
      capturedAt: input.capturedAt,
    });

    const syntheticGaugeClaimRewards = buildSyntheticGaugeClaimRewards({
      chainId: input.chainId,
      candidates: syntheticGaugeClaimCandidates,
      movementsByLedgerEventId: lifecycleMovementsByLedgerEventId,
      latestPriceByToken,
      earliestPriceDayByToken,
      priceByTokenAndDay,
    });

    const tokenDeltaEventsByPoolId = new Map<string, PoolTokenDeltaEvent[]>();
    for (const tokenDeltaEvent of tokenDeltaEvents) {
      const bucket = tokenDeltaEventsByPoolId.get(tokenDeltaEvent.poolId) ?? [];
      bucket.push(tokenDeltaEvent);
      tokenDeltaEventsByPoolId.set(tokenDeltaEvent.poolId, bucket);

      const price = resolveTokenPrice({
        tokenAddress: tokenDeltaEvent.tokenAddress,
        dayUtc: tokenDeltaEvent.dayUtc,
        latestPriceByToken,
        earliestPriceDayByToken,
        priceByTokenAndDay,
      });
      const amountUsd = tokenDeltaEvent.amount * price;
      if (amountUsd <= 0) {
        continue;
      }

      capitalFlowEvents.push({
        poolId: tokenDeltaEvent.poolId,
        occurredAt: tokenDeltaEvent.occurredAt,
        dayUtc: tokenDeltaEvent.dayUtc,
        segment: tokenDeltaEvent.segment,
        direction: tokenDeltaEvent.direction,
        amountUsd,
        metadataJson: tokenDeltaEvent.metadataJson,
      });
    }

    for (const attribution of attributionRows) {
      if (!attribution.poolId) {
        continue;
      }

      const pool = poolsById.get(attribution.poolId);
      if (!pool) {
        continue;
      }

      const accumulator = getOrCreatePoolAccumulator({
        map: accumulators,
        poolId: attribution.poolId,
        poolAddress: pool.poolAddress,
        label: pool.label,
        tokenSymbols: [],
        feeTierLabel: asString((pool.metadataJson ?? {}).feeTierLabel),
      });
      const metadata = attribution.metadataJson ?? {};
      const decimals = asNumber((metadata.tokenDecimals as unknown)) ?? asNumber((metadata.decimals as unknown)) ?? 18;
      const tokenAddress = attribution.tokenAddress.toLowerCase();
      const residualAmount = typeof attribution.residualAmountRaw === "string"
        ? parseTokenAmount(attribution.residualAmountRaw, decimals)
        : 0;
      const latestPrice = resolveTokenPrice({
        tokenAddress,
        dayUtc: input.endDayUtc,
        latestPriceByToken,
        earliestPriceDayByToken,
        priceByTokenAndDay,
      });
      const residualValueUsd = residualAmount * latestPrice;

      accumulator.residualValueUsd += residualValueUsd;
      accumulator.hasResidual = residualValueUsd > 0 || residualAmount > 0;
      accumulator.coverageStatus = combineCoverageStatus([accumulator.coverageStatus, attribution.resolutionStatus === "still_waiting" ? "partial" : "full"]);
      accumulator.firstParticipatedAt = mergeDateBounds(accumulator.firstParticipatedAt, attribution.ledgerOccurredAt ?? attribution.createdAt, "min");
      accumulator.lastParticipatedAt = mergeDateBounds(accumulator.lastParticipatedAt, attribution.updatedAt, "max");

      const tokenBucket = tokenComponentBuckets.get(attribution.poolId) ?? [];
      if (residualAmount > 0) {
        tokenBucket.push({ tokenAddress, amount: residualAmount, segment: "residual" });
        relevantTokenAddresses.add(tokenAddress);
      }
      tokenComponentBuckets.set(attribution.poolId, tokenBucket);

      residualTimelineCandidates.push({
        poolId: attribution.poolId,
        sourceLedgerEventId: attribution.sourceLedgerEventId,
        occurredAt: attribution.ledgerOccurredAt ?? attribution.createdAt,
        confidence: attribution.ledgerConfidence ?? "medium",
        coverageStatus: attribution.resolutionStatus === "still_waiting" ? "partial" : "full",
        attributedValueUsd: residualValueUsd || null,
        classification: typeof attribution.ledgerClassification === "string" ? attribution.ledgerClassification : null,
        metadataJson: {
          attributionId: attribution.id,
          tokenAddress,
          tokenSymbol: asString(metadata.tokenSymbol),
          resolutionStatus: attribution.resolutionStatus,
          sourceTxHash: attribution.ledgerTxHash,
          sourceEventType: attribution.ledgerEventType,
        },
      });

      const residualClassification = typeof attribution.ledgerClassification === "string"
        ? attribution.ledgerClassification
        : null;
      const withdrawalAmountUsd = residualClassification === "manual_withdrawal" || residualClassification === "strategy_withdraw" || residualClassification === "unstake"
        ? sumLifecycleMovementUsd({
          ledgerEventId: attribution.sourceLedgerEventId,
          directionIn: true,
          movementTotalsByLedgerEventId,
        })
        : 0;

      if (withdrawalAmountUsd > 0 && !attribution.sourceLedgerEventId) {
        const occurredAt = attribution.ledgerOccurredAt ?? attribution.createdAt;
        capitalFlowEvents.push({
          poolId: attribution.poolId,
          occurredAt,
          dayUtc: dayUtcFromDate(occurredAt),
          segment: residualClassification === "strategy_withdraw" || residualClassification === "unstake" ? "strategy" : "manual",
          direction: "out",
          amountUsd: withdrawalAmountUsd,
          metadataJson: {
            source: "withdrawal",
            attributionId: attribution.id,
            classification: residualClassification,
            ledgerEventId: attribution.sourceLedgerEventId,
          },
        });
      }
    }

    for (const reward of rewardRows) {
      const relatedId = reward.depositOrStrategyId;
      const rewardMetadata = reward.metadataJson ?? {};
      const rewardTokenAddress = normalizeTokenAddress(reward.tokenAddress);
      const poolId = resolvePoolRewardTargetPoolId({
        resolvedPoolId: reward.resolvedPoolId,
        relatedId,
        depositToPoolId,
        strategyToPoolId,
      });
      if (!poolId) {
        continue;
      }

      const pool = poolsById.get(poolId);
      if (!pool) {
        continue;
      }

      const accumulator = getOrCreatePoolAccumulator({
        map: accumulators,
        poolId,
        poolAddress: pool.poolAddress,
        label: pool.label,
        tokenSymbols: [],
        feeTierLabel: asString((pool.metadataJson ?? {}).feeTierLabel),
      });
      const dayUtc = dayUtcFromDate(reward.occurredAt);
      const amountUsd = resolveRewardValueUsd({
        chainId: input.chainId,
        rewardAmountUsd: reward.amountUsd,
        rewardAmountRaw: reward.amountRaw,
        rewardTokenAddress,
        rewardMetadata,
        dayUtc,
        latestPriceByToken,
        earliestPriceDayByToken,
        priceByTokenAndDay,
      });

      if (reward.rewardType === "fee_claim") {
        accumulator.totalFeesUsd += amountUsd;
      } else {
        accumulator.totalRewardsUsd += amountUsd;
        accumulator.rewardValueByDay.set(dayUtc, (accumulator.rewardValueByDay.get(dayUtc) ?? 0) + amountUsd);
      }
      accumulator.lastParticipatedAt = mergeDateBounds(accumulator.lastParticipatedAt, reward.occurredAt, "max");
      const relatedStrategyId = relatedId && strategyToPoolId.get(relatedId) ? relatedId : null;
      const relatedDepositId = relatedId && depositToPoolId.get(relatedId) ? relatedId : null;
      accumulator.timeline.push({
        eventKey: `reward:${reward.txHash}:${reward.logIndex}:${reward.rewardType}`,
        eventType: reward.rewardType === "fee_claim"
          ? "collect_fees"
          : relatedStrategyId || rewardMetadata.targetType === "strategy" ? "strategy_claim" : "claim",
        occurredAt: reward.occurredAt,
        confidence: "high",
        coverageStatus: accumulator.coverageStatus,
        attributedValueUsd: amountUsd || null,
        sourceLedgerEventId: null,
        relatedDepositId,
        relatedStrategyId,
        metadataJson: {
          rewardType: reward.rewardType,
          txHash: reward.txHash,
          ...(reward.metadataJson ?? {}),
        },
      });
    }

    for (const reward of syntheticGaugeClaimRewards) {
      const pool = poolsById.get(reward.poolId);
      if (!pool) {
        continue;
      }

      const accumulator = getOrCreatePoolAccumulator({
        map: accumulators,
        poolId: reward.poolId,
        poolAddress: pool.poolAddress,
        label: pool.label,
        tokenSymbols: [],
        feeTierLabel: asString((pool.metadataJson ?? {}).feeTierLabel),
      });
      const dayUtc = dayUtcFromDate(reward.occurredAt);

      accumulator.totalRewardsUsd += reward.amountUsd;
      accumulator.rewardValueByDay.set(dayUtc, (accumulator.rewardValueByDay.get(dayUtc) ?? 0) + reward.amountUsd);
      accumulator.lastParticipatedAt = mergeDateBounds(accumulator.lastParticipatedAt, reward.occurredAt, "max");
      accumulator.timeline.push({
        eventKey: reward.eventKey,
        eventType: "claim",
        occurredAt: reward.occurredAt,
        confidence: "medium",
        coverageStatus: accumulator.coverageStatus,
        attributedValueUsd: reward.amountUsd,
        sourceLedgerEventId: reward.sourceLedgerEventId,
        relatedDepositId: null,
        relatedStrategyId: null,
        metadataJson: {
          source: "claim_ledger_fallback",
          txHash: reward.txHash,
          gaugeAddress: reward.gaugeAddress,
          methodLabel: reward.methodLabel,
          tokenAddress: reward.tokenAddress,
          amountRaw: reward.amountRaw,
          ...reward.metadataJson,
        },
      });
    }

    for (const depositCandidate of depositTimelineCandidates.sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime())) {
      const accumulator = accumulators.get(depositCandidate.poolId);
      if (!accumulator) {
        continue;
      }

      const inferredActionForDeposit = depositCandidate.sourceLedgerEventId
        ? inferredActionByDepositLedgerEventId.get(depositCandidate.sourceLedgerEventId) ?? null
        : null;
      const relatedLifecycleRows = collectCanonicalLifecycleRows({
        lifecycleRows: normalizedLifecycleRows,
        inferredAction: inferredActionForDeposit,
      });
      const shouldGroupLifecycle = Boolean(
        inferredActionForDeposit
        && inferredActionForDeposit.classificationBasis === "residual_flow"
        && inferredActionForDeposit.actionType !== "new_capital_deposit"
        && relatedLifecycleRows.length > 0,
      );

      accumulator.timeline.push(
        shouldGroupLifecycle
          ? buildGroupedLifecycleEvent({
            deposit: depositCandidate,
            lifecycleRows: relatedLifecycleRows,
            inferredAction: inferredActionForDeposit,
          })
          : buildDepositLifecycleEvent({ deposit: depositCandidate }),
      );
    }

    for (const residualGroup of buildResidualTimelineEvents(residualTimelineCandidates)) {
      const accumulator = accumulators.get(residualGroup.poolId);
      if (!accumulator) {
        continue;
      }

      accumulator.timeline.push(residualGroup.event);
    }

    const summaryRows = [];
    const historyRows = [];
    const timelineRows = [];

    for (const accumulator of accumulators.values()) {
      const components = tokenComponentBuckets.get(accumulator.poolId) ?? [];
      const effectiveStartDayUtc = resolveEffectiveHistoryStartDay({
        defaultStartDayUtc: input.startDayUtc,
        firstParticipatedAt: accumulator.firstParticipatedAt,
        days,
      });
      const poolDays = days;
      const participatesFromDayUtc = effectiveStartDayUtc;
      const poolCapitalFlows = capitalFlowEvents
        .filter((event) => event.poolId === accumulator.poolId)
        .sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime());
      const capitalFlowByDay = new Map<string, { capitalInUsd: number; capitalOutUsd: number }>();
      const segmentCapitalFlowByDay = new Map<string, {
        manualInUsd: number;
        manualOutUsd: number;
        strategyInUsd: number;
        strategyOutUsd: number;
      }>();
      let capitalEnteredUsd = 0;
      let capitalWithdrawnUsd = 0;
      let pendingPreParticipationRewardsUsd = 0;

      for (const flowEvent of poolCapitalFlows) {
        const dayBucket = capitalFlowByDay.get(flowEvent.dayUtc) ?? { capitalInUsd: 0, capitalOutUsd: 0 };
        if (flowEvent.direction === "in") {
          dayBucket.capitalInUsd += flowEvent.amountUsd;
        } else {
          dayBucket.capitalOutUsd += flowEvent.amountUsd;
        }
        capitalFlowByDay.set(flowEvent.dayUtc, dayBucket);

        const segmentDayBucket = segmentCapitalFlowByDay.get(flowEvent.dayUtc) ?? {
          manualInUsd: 0,
          manualOutUsd: 0,
          strategyInUsd: 0,
          strategyOutUsd: 0,
        };
        if (flowEvent.segment === "manual") {
          if (flowEvent.direction === "in") {
            segmentDayBucket.manualInUsd += flowEvent.amountUsd;
          } else {
            segmentDayBucket.manualOutUsd += flowEvent.amountUsd;
          }
        } else {
          if (flowEvent.direction === "in") {
            segmentDayBucket.strategyInUsd += flowEvent.amountUsd;
          } else {
            segmentDayBucket.strategyOutUsd += flowEvent.amountUsd;
          }
        }
        segmentCapitalFlowByDay.set(flowEvent.dayUtc, segmentDayBucket);

        const nextCounters = applyCapitalFlowCounters({
          capitalEnteredUsd,
          capitalWithdrawnUsd,
          event: flowEvent,
        });
        capitalEnteredUsd = nextCounters.capitalEnteredUsd;
        capitalWithdrawnUsd = nextCounters.capitalWithdrawnUsd;
      }

      let runningRewardsUsd = 0;
      const poolTokenDeltaEvents = (tokenDeltaEventsByPoolId.get(accumulator.poolId) ?? [])
        .sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime());
      const lastManualBalanceEventDayUtc = poolTokenDeltaEvents
        .filter((event) => event.segment === "manual")
        .at(-1)?.dayUtc ?? null;
      const lastStrategyBalanceEventDayUtc = poolTokenDeltaEvents
        .filter((event) => event.segment === "strategy")
        .at(-1)?.dayUtc ?? null;
      const tokenBalanceEventsByDay = new Map<string, PoolTokenBalanceEvent[]>();
      for (const tokenDeltaEvent of poolTokenDeltaEvents) {
        const dayBucket = tokenBalanceEventsByDay.get(tokenDeltaEvent.dayUtc) ?? [];
        const lastEvent = dayBucket[dayBucket.length - 1] ?? null;

        if (
          lastEvent
          && lastEvent.sourceLedgerEventId === tokenDeltaEvent.sourceLedgerEventId
          && lastEvent.segment === tokenDeltaEvent.segment
          && lastEvent.direction === tokenDeltaEvent.direction
        ) {
          lastEvent.deltas.push({
            tokenAddress: tokenDeltaEvent.tokenAddress,
            amount: tokenDeltaEvent.amount,
          });
        } else {
          dayBucket.push({
            occurredAt: tokenDeltaEvent.occurredAt,
            dayUtc: tokenDeltaEvent.dayUtc,
            segment: tokenDeltaEvent.segment,
            direction: tokenDeltaEvent.direction,
            sourceLedgerEventId: tokenDeltaEvent.sourceLedgerEventId,
            deltas: [{
              tokenAddress: tokenDeltaEvent.tokenAddress,
              amount: tokenDeltaEvent.amount,
            }],
          });
        }

        tokenBalanceEventsByDay.set(tokenDeltaEvent.dayUtc, dayBucket);
      }
      const runningManualTokenBalances = new Map<string, number>();
      const runningStrategyTokenBalances = new Map<string, number>();
      const poolHistoryRows: Array<{
        chainId: number;
        walletAddress: string;
        poolId: string;
        dayUtc: string;
        latestRunId: string;
        coverageStatus: string;
        totalValueUsd: string;
        deployedValueUsd: string;
        residualValueUsd: string;
        manualValueUsd: string;
        strategyValueUsd: string;
        rewardValueUsd: string;
        cumulativeRewardsUsd: string;
        capitalInUsd: string;
        capitalOutUsd: string;
        metadataJson: Record<string, unknown>;
      }> = [];

      for (const dayUtc of poolDays) {
        let manualValueUsd = 0;
        let strategyValueUsd = 0;
        let residualValueUsd = 0;
        const hasParticipation = dayUtc >= participatesFromDayUtc;

        for (const tokenBalanceEvent of tokenBalanceEventsByDay.get(dayUtc) ?? []) {
          const balances = tokenBalanceEvent.segment === "manual" ? runningManualTokenBalances : runningStrategyTokenBalances;

          if (tokenBalanceEvent.direction === "in") {
            for (const delta of tokenBalanceEvent.deltas) {
              const currentBalance = balances.get(delta.tokenAddress) ?? 0;
              balances.set(delta.tokenAddress, currentBalance + delta.amount);
            }
            continue;
          }

          const withdrawalValueUsd = tokenBalanceEvent.deltas.reduce((sum, delta) => {
            const price = resolveTokenPrice({
              tokenAddress: delta.tokenAddress,
              dayUtc,
              latestPriceByToken,
              earliestPriceDayByToken,
              priceByTokenAndDay,
            });

            return sum + (delta.amount * price);
          }, 0);

          applyUsdValuedWithdrawalToBalances({
            balances,
            withdrawalValueUsd,
            dayUtc,
            latestPriceByToken,
            earliestPriceDayByToken,
            priceByTokenAndDay,
          });
        }

        if (hasParticipation) {
          for (const [tokenAddress, amount] of runningManualTokenBalances.entries()) {
            const price = resolveTokenPrice({
              tokenAddress,
              dayUtc,
              latestPriceByToken,
              earliestPriceDayByToken,
              priceByTokenAndDay,
            });
            manualValueUsd += amount * price;
          }

          for (const [tokenAddress, amount] of runningStrategyTokenBalances.entries()) {
            const price = resolveTokenPrice({
              tokenAddress,
              dayUtc,
              latestPriceByToken,
              earliestPriceDayByToken,
              priceByTokenAndDay,
            });
            strategyValueUsd += amount * price;
          }

          for (const component of components) {
            if (component.segment !== "residual") {
              continue;
            }

            const price = resolveTokenPrice({
              tokenAddress: component.tokenAddress,
              dayUtc,
              latestPriceByToken,
              earliestPriceDayByToken,
              priceByTokenAndDay,
            });
            residualValueUsd += component.amount * price;
          }
        }

        const totalValueUsd = manualValueUsd + strategyValueUsd + residualValueUsd;
        const capitalFlow = capitalFlowByDay.get(dayUtc) ?? { capitalInUsd: 0, capitalOutUsd: 0 };
        const rawRewardValueUsd = accumulator.rewardValueByDay.get(dayUtc) ?? 0;
        const rewardValueUsd = dayUtc < participatesFromDayUtc
          ? 0
          : rawRewardValueUsd + pendingPreParticipationRewardsUsd;

        if (dayUtc < participatesFromDayUtc) {
          pendingPreParticipationRewardsUsd += rawRewardValueUsd;
        } else {
          pendingPreParticipationRewardsUsd = 0;
          runningRewardsUsd += rewardValueUsd;
        }

        poolHistoryRows.push({
          chainId: input.chainId,
          walletAddress,
          poolId: accumulator.poolId,
          dayUtc,
          latestRunId: input.runId,
          coverageStatus: accumulator.coverageStatus,
          totalValueUsd: String(totalValueUsd),
          deployedValueUsd: String(manualValueUsd + strategyValueUsd),
          residualValueUsd: String(residualValueUsd),
          manualValueUsd: String(manualValueUsd),
          strategyValueUsd: String(strategyValueUsd),
          rewardValueUsd: String(rewardValueUsd),
          cumulativeRewardsUsd: String(runningRewardsUsd),
          capitalInUsd: String(capitalFlow.capitalInUsd),
          capitalOutUsd: String(capitalFlow.capitalOutUsd),
          metadataJson: {
            label: accumulator.label,
            tokenSymbols: accumulator.tokenSymbols,
            strategyLabels: accumulator.strategyLabels,
            chartEstimationMode: "historical_token_balances_priced_daily",
            chartCoverageWarning: "Pool history is valued from historical token balances and daily token prices; strategy internal rebalances may still be approximated.",
          },
        });
      }

      applyTrailingSegmentValueAnchor({
        rows: poolHistoryRows,
        startDayUtc: lastManualBalanceEventDayUtc,
        currentSegmentValueUsd: accumulator.manualValueUsd,
        segment: "manual",
      });
      applyTrailingSegmentValueAnchor({
        rows: poolHistoryRows,
        startDayUtc: lastStrategyBalanceEventDayUtc,
        currentSegmentValueUsd: accumulator.strategyValueUsd,
        segment: "strategy",
      });

      historyRows.push(...poolHistoryRows);

      const currentAttributedValueUsd = accumulator.manualValueUsd + accumulator.strategyValueUsd + accumulator.residualValueUsd;
      const status = inferStatus(accumulator);
      const exposureMix = inferExposureMix(accumulator);
      const annualizedReturnPct = computeAnnualizedRewardReturnPct({
        firstParticipatedAt: accumulator.firstParticipatedAt,
        lastParticipatedAt: accumulator.lastParticipatedAt,
        coveredEndDayUtc: input.endDayUtc,
        status,
        capitalEnteredUsd,
        totalRewardsUsd: accumulator.totalRewardsUsd,
      });
      summaryRows.push({
        chainId: input.chainId,
        walletAddress,
        poolId: accumulator.poolId,
        latestRunId: input.runId,
        coveredStartDayUtc: input.startDayUtc,
        coveredEndDayUtc: input.endDayUtc,
        firstParticipatedAt: accumulator.firstParticipatedAt,
        lastParticipatedAt: accumulator.lastParticipatedAt,
        status,
        exposureMix,
        coverageStatus: accumulator.coverageStatus,
        currentAttributedValueUsd: String(currentAttributedValueUsd),
        currentDeployedValueUsd: String(accumulator.manualValueUsd + accumulator.strategyValueUsd),
        currentResidualValueUsd: String(accumulator.residualValueUsd),
        currentManualValueUsd: String(accumulator.manualValueUsd),
        currentStrategyValueUsd: String(accumulator.strategyValueUsd),
        capitalEnteredUsd: String(capitalEnteredUsd),
        capitalWithdrawnUsd: String(capitalWithdrawnUsd),
        realizedPnlUsd: null,
        unrealizedPnlUsd: null,
        totalRewardsUsd: String(accumulator.totalRewardsUsd),
        totalFeesUsd: String(accumulator.totalFeesUsd),
        annualizedReturnPct: annualizedReturnPct === null ? null : String(annualizedReturnPct),
        metadataJson: {
          label: accumulator.label,
          poolAddress: accumulator.poolAddress,
          tokenSymbols: accumulator.tokenSymbols,
          feeTierLabel: accumulator.feeTierLabel,
          strategyLabels: accumulator.strategyLabels,
          strategyDebugReferences: accumulator.strategyDebugReferences,
          isInRange: accumulator.isInRange,
          metricsEstimated: true,
          coverageReasonCodes: accumulator.coverageStatus === "full" ? [] : ["positionMetadataIncomplete"],
        },
      });

      for (const event of accumulator.timeline.sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime())) {
        timelineRows.push({
          chainId: input.chainId,
          walletAddress,
          poolId: accumulator.poolId,
          latestRunId: input.runId,
          eventKey: event.eventKey,
          eventType: event.eventType,
          occurredAt: event.occurredAt,
          sourceLedgerEventId: event.sourceLedgerEventId,
          relatedDepositId: event.relatedDepositId,
          relatedStrategyId: event.relatedStrategyId,
          confidence: event.confidence,
          coverageStatus: event.coverageStatus,
          attributedValueUsd: event.attributedValueUsd !== null ? String(event.attributedValueUsd) : null,
          metadataJson: event.metadataJson,
        });
      }
    }

    await db.delete(poolTimelineEvents).where(and(eq(poolTimelineEvents.chainId, input.chainId), eq(poolTimelineEvents.walletAddress, walletAddress)));
    await db.delete(poolHistorySnapshots).where(and(eq(poolHistorySnapshots.chainId, input.chainId), eq(poolHistorySnapshots.walletAddress, walletAddress)));
    await db.delete(poolWalletSummaries).where(and(eq(poolWalletSummaries.chainId, input.chainId), eq(poolWalletSummaries.walletAddress, walletAddress)));

    if (summaryRows.length > 0) {
      for (const chunk of chunkRows(summaryRows, READ_MODEL_INSERT_CHUNK_SIZE)) {
        await db.insert(poolWalletSummaries).values(chunk);
      }
    }

    if (historyRows.length > 0) {
      for (const chunk of chunkRows(historyRows, READ_MODEL_INSERT_CHUNK_SIZE)) {
        await db.insert(poolHistorySnapshots).values(chunk);
      }
    }

    if (timelineRows.length > 0) {
      for (const chunk of chunkRows(timelineRows, READ_MODEL_INSERT_CHUNK_SIZE)) {
        await db.insert(poolTimelineEvents).values(chunk);
      }
    }

    await db.update(analysisRuns).set({
      metadataJson: {
        poolReadModels: {
          summaryCount: summaryRows.length,
          historyCount: historyRows.length,
          timelineCount: timelineRows.length,
          materializedAt: input.capturedAt.toISOString(),
        },
      },
    }).where(eq(analysisRuns.id, input.runId));

    return {
      summaryCount: summaryRows.length,
      historyCount: historyRows.length,
      timelineCount: timelineRows.length,
    };
  }

  await db.delete(poolTimelineEvents).where(and(eq(poolTimelineEvents.chainId, input.chainId), eq(poolTimelineEvents.walletAddress, walletAddress)));
  await db.delete(poolHistorySnapshots).where(and(eq(poolHistorySnapshots.chainId, input.chainId), eq(poolHistorySnapshots.walletAddress, walletAddress)));
  await db.delete(poolWalletSummaries).where(and(eq(poolWalletSummaries.chainId, input.chainId), eq(poolWalletSummaries.walletAddress, walletAddress)));

  return {
    summaryCount: 0,
    historyCount: 0,
    timelineCount: 0,
  };
}
