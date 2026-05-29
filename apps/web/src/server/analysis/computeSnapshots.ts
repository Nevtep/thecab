import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";

import {
  ASSET_TRUST_CLASSIFIER_VERSION,
  type AssetTrustClassifierInput,
} from "@/server/asset-trust/assetTrust.types";
import { classifyWalletAssetTrust } from "@/server/asset-trust/classifyWalletAssetTrust";
import { resolveKnownProtocolAssetMatch } from "@/server/asset-trust/knownProtocolAssets";
import { getDb } from "@/server/db/client";
import {
  assetMovements,
  deposits,
  ledgerEvents,
  performanceSnapshots,
  poolMetricsSnapshots,
  portfolioSnapshots,
  pricePoints,
  protocolContracts,
  strategies,
  strategyExposures,
} from "@/server/db/schema";
import {
  readOverviewRealizedRewardEvents,
  readOverviewUnresolvedRewardCoverage,
} from "@/server/overview/overview.repository";
import { buildHistoricalComponentValueLookup } from "@/server/valuation/historicalValueLookup";

export type WalletTokenSnapshot = {
  tokenAddress: string;
  balanceRaw: string;
  decimals: number | null;
  symbol: string | null;
  name: string | null;
  nativeToken: boolean;
  possibleSpam: boolean;
  verifiedContract?: boolean;
  usdPrice: number | null;
  usdValue: number | null;
};

const BASE_WETH_ADDRESS = "0x4200000000000000000000000000000000000006";
const BASE_CBBTC_ADDRESS = "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf";
const BASE_AERO_ADDRESS = "0x940181a94a35a4569e4529a3cdfb74e38fd98631";
const BASE_USDC_ADDRESS = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const BASE_EURC_ADDRESS = "0x60a3e35cc302bfa44cb288bc5a4f316fdb1adb42";
const DUST_VALUE_THRESHOLD_USD = 1;
const SNAPSHOT_INSERT_CHUNK_SIZE = 250;

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

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
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

function chunkRows<T>(rows: T[], chunkSize: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < rows.length; index += chunkSize) {
    chunks.push(rows.slice(index, index + chunkSize));
  }

  return chunks;
}

function* iterateUtcDays(startDayUtc: string, endDayUtc: string) {
  const current = new Date(`${startDayUtc}T00:00:00.000Z`);
  const end = new Date(`${endDayUtc}T00:00:00.000Z`);

  while (current.getTime() <= end.getTime()) {
    yield current.toISOString().slice(0, 10);
    current.setUTCDate(current.getUTCDate() + 1);
  }
}

function dayUtcFromDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function pricePointLookupKey(tokenAddress: string, dayUtc: string) {
  return `${tokenAddress.toLowerCase()}:${dayUtc}`;
}

export function hydrateHistoricalPriceLookup(input: {
  priceRows: Array<{
    tokenAddress: string;
    pricedAt: Date;
    priceUsd: number | string | null;
  }>;
  target?: Map<string, number>;
}) {
  const target = input.target ?? new Map<string, number>();

  for (const row of input.priceRows) {
    const priceUsd = asNumber(row.priceUsd);
    if (priceUsd === null) continue;

    const key = pricePointLookupKey(row.tokenAddress, dayUtcFromDate(row.pricedAt));
    if (!target.has(key)) {
      target.set(key, priceUsd);
    }
  }

  return target;
}

export function resolveHistoricalUsdBackfill(input: {
  chainId: number;
  occurredAt: Date;
  tokenAddress: string | null;
  symbol: string | null;
  amountRaw: string;
  directAmountUsd: number | null;
  priceByTokenDay: Map<string, number>;
}) {
  if (input.directAmountUsd !== null) {
    return {
      usdValue: input.directAmountUsd,
      priceSource: "event" as const,
      reasonCodes: [] as string[],
    };
  }

  const decimals = resolveKnownTokenDecimals({
    chainId: input.chainId,
    tokenAddress: input.tokenAddress,
    symbol: input.symbol,
    decimals: null,
  });

  if (decimals === null || !input.tokenAddress) {
    return {
      usdValue: null,
      priceSource: "unavailable" as const,
      reasonCodes: ["priceUnavailable"],
    };
  }

  const priceUsd = input.priceByTokenDay.get(pricePointLookupKey(input.tokenAddress, dayUtcFromDate(input.occurredAt)));
  if (priceUsd === undefined) {
    return {
      usdValue: null,
      priceSource: "unavailable" as const,
      reasonCodes: ["priceUnavailable"],
    };
  }

  return {
    usdValue: (Number(input.amountRaw) / 10 ** decimals) * priceUsd,
    priceSource: "pricePointFallback" as const,
    reasonCodes: ["priceFallbackDca"],
  };
}

function endOfDayUtc(dayUtc: string): Date {
  const d = new Date(`${dayUtc}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

export function summarizeRewardCoverageByDay(input: {
  dayRows: string[];
  unresolvedRows: Array<{
    occurredAt: Date;
    resolutionReasonCodes: string[];
  }>;
}) {
  const daySet = new Set(input.dayRows);
  const coverageStatusByDay = new Map<string, "full" | "partial">();
  const reasonCodesByDay = new Map<string, string[]>();
  const unresolvedCountByDay = new Map<string, number>();

  for (const dayUtc of input.dayRows) {
    coverageStatusByDay.set(dayUtc, "full");
    reasonCodesByDay.set(dayUtc, []);
    unresolvedCountByDay.set(dayUtc, 0);
  }

  for (const row of input.unresolvedRows) {
    const dayUtc = dayUtcFromDate(row.occurredAt);
    if (!daySet.has(dayUtc)) {
      continue;
    }

    coverageStatusByDay.set(dayUtc, "partial");
    unresolvedCountByDay.set(dayUtc, (unresolvedCountByDay.get(dayUtc) ?? 0) + 1);
    const existingReasonCodes = reasonCodesByDay.get(dayUtc) ?? [];
    reasonCodesByDay.set(dayUtc, Array.from(new Set([...existingReasonCodes, ...(row.resolutionReasonCodes ?? [])])));
  }

  return {
    coverageStatusByDay,
    reasonCodesByDay,
    unresolvedCountByDay,
  };
}

function dividePow10(rawAmount: string, decimals: number): number {
  if (!/^-?\d+$/.test(rawAmount)) {
    return 0;
  }
  const negative = rawAmount.startsWith("-");
  const digits = negative ? rawAmount.slice(1) : rawAmount;
  const padded = digits.padStart(decimals + 1, "0");
  const intPart = padded.slice(0, padded.length - decimals);
  const fracPart = padded.slice(padded.length - decimals);
  const combined = `${intPart}.${fracPart}`;
  const value = Number(combined);
  if (!Number.isFinite(value)) {
    return 0;
  }
  return negative ? -value : value;
}

function fitsAnnualizedReturnPctColumn(value: number) {
  return Number.isFinite(value) && Math.abs(value) < 1_000_000;
}

function hasHistoricalTokenMetadata(symbol: string | null, name: string | null, decimals: number | null) {
  return Boolean(symbol && name && decimals !== null);
}

function buildHistoricalIdleTrustInput(input: {
  walletAddress: string;
  chainId: number;
  protocolContracts: Array<{
    chainId: number;
    address: string;
    protocol: string;
    contractType: string;
    metadataJson?: Record<string, unknown> | null;
  }>;
  tokenAddress: string;
  symbol: string | null;
  name: string | null;
  decimals: number | null;
  balanceRaw: string;
  balanceFormatted: number;
  valueUsd: number | null;
  possibleSpam: boolean | null;
  verifiedContract: boolean | null;
  isNativeAsset: boolean;
}) {
  const knownProtocolMatch = resolveKnownProtocolAssetMatch(
    input.chainId,
    input.tokenAddress,
    input.protocolContracts,
  );

  return {
    walletAddress: input.walletAddress,
    chainId: input.chainId,
    tokenAddress: input.tokenAddress,
    symbol: input.symbol,
    name: input.name,
    balanceRaw: input.balanceRaw,
    balanceFormatted: String(input.balanceFormatted),
    valueUsd: input.valueUsd,
    hasReliableAlchemyPrice: input.valueUsd !== null,
    moralisPossibleSpam: input.possibleSpam,
    moralisVerifiedContract: input.verifiedContract,
    hasLogo: true,
    hasMetadata: hasHistoricalTokenMetadata(input.symbol, input.name, input.decimals),
    isKnownProtocolAsset: knownProtocolMatch !== null,
    isNativeAsset: input.isNativeAsset,
    isDustValue: input.valueUsd !== null ? input.valueUsd < DUST_VALUE_THRESHOLD_USD : input.balanceFormatted === 0,
    classifierVersion: ASSET_TRUST_CLASSIFIER_VERSION,
  } satisfies AssetTrustClassifierInput;
}

export function shouldIncludeHistoricalIdleToken(input: {
  trustInput: AssetTrustClassifierInput;
  knownProtocolReasonCode?: "knownAerodromeToken" | "knownProtocolContract" | null;
}) {
  const trustClassification = classifyWalletAssetTrust(input.trustInput, {
    knownProtocolReasonCode: input.knownProtocolReasonCode ?? null,
  });

  return !input.trustInput.isDustValue
    && input.trustInput.hasReliableAlchemyPrice
    && !trustClassification.isHiddenByDefault;
}

type ReconstructedDayMetric = {
  idleValueUsd: number;
  idleTokens: Array<{
    tokenAddress: string;
    symbol: string | null;
    balanceFormatted: number;
    valueUsd: number;
  }>;
  cashInUsd: number;
  cashOutUsd: number;
  cumulativeCashInUsd: number;
  cumulativeCashOutUsd: number;
  netCapitalInUsd: number;
};

type DailyPriceSeriesByToken = Map<string, Map<string, number>>;

function resolveTokenPriceForDay(input: {
  tokenAddress: string;
  dayUtc: string;
  priceSeriesByToken: DailyPriceSeriesByToken;
  latestPriceByToken: Map<string, number>;
}) {
  return input.priceSeriesByToken.get(input.tokenAddress)?.get(input.dayUtc) ??
    input.latestPriceByToken.get(input.tokenAddress) ??
    null;
}

function buildDailyPriceSeriesByToken(input: {
  dayRows: string[];
  priceRows: Array<{
    tokenAddress: string;
    priceUsd: string;
    pricedAt: Date;
  }>;
  capturedAt: Date;
}) {
  const latestPriceByToken = new Map<string, number>();
  const priceSeriesByToken: DailyPriceSeriesByToken = new Map();
  const priceRowsByToken = new Map<string, Array<{ priceUsd: number; pricedAt: Date }>>();

  for (const row of input.priceRows) {
    const tokenAddress = row.tokenAddress.toLowerCase();
    const priceUsd = asNumber(row.priceUsd);
    if (priceUsd === null) {
      continue;
    }

    latestPriceByToken.set(tokenAddress, priceUsd);
    const bucket = priceRowsByToken.get(tokenAddress) ?? [];
    bucket.push({ priceUsd, pricedAt: row.pricedAt });
    priceRowsByToken.set(tokenAddress, bucket);
  }

  for (const [tokenAddress, rows] of priceRowsByToken.entries()) {
    const daySeries = new Map<string, number>();
    let lastSeenPrice: number | null = null;
    let cursor = 0;

    for (const dayUtc of input.dayRows) {
      const boundary = dayUtc === input.dayRows[input.dayRows.length - 1]
        ? input.capturedAt
        : endOfDayUtc(dayUtc);

      while (cursor < rows.length && rows[cursor].pricedAt.getTime() <= boundary.getTime()) {
        lastSeenPrice = rows[cursor].priceUsd;
        cursor += 1;
      }

      if (lastSeenPrice !== null) {
        daySeries.set(dayUtc, lastSeenPrice);
      }
    }

    priceSeriesByToken.set(tokenAddress, daySeries);
  }

  return {
    latestPriceByToken,
    priceSeriesByToken,
  };
}

export async function computeSnapshots(input: {
  walletAddress: string;
  chainId: number;
  startDayUtc: string;
  endDayUtc: string;
  capturedAt: Date;
  poolTotals: Array<{ poolId: string; valueUsd: number }>;
  walletTokens?: WalletTokenSnapshot[];
}) {
  const db = getDb();
  const walletAddress = input.walletAddress.toLowerCase();
  const walletTokens = (input.walletTokens ?? []).filter((token) => !token.possibleSpam);

  const [depositRows, exposureRows, protocolAddressRows] = await Promise.all([
    db
      .select({ id: deposits.id, poolId: deposits.poolId, metadataJson: deposits.metadataJson, coverageStatus: deposits.coverageStatus })
      .from(deposits)
      .where(and(eq(deposits.walletAddress, walletAddress), eq(deposits.chainId, input.chainId))),
    db
      .select({
        id: strategyExposures.id,
        strategyId: strategyExposures.strategyId,
        primaryPoolId: strategies.primaryPoolId,
        underlying0AmountRaw: strategyExposures.underlying0AmountRaw,
        underlying1AmountRaw: strategyExposures.underlying1AmountRaw,
        metadataJson: strategyExposures.metadataJson,
        coverageStatus: strategyExposures.coverageStatus,
      })
      .from(strategyExposures)
      .innerJoin(strategies, eq(strategyExposures.strategyId, strategies.id))
      .where(and(eq(strategyExposures.walletAddress, walletAddress), eq(strategyExposures.chainId, input.chainId))),
    db
      .select({
        chainId: protocolContracts.chainId,
        address: protocolContracts.address,
        protocol: protocolContracts.protocol,
        contractType: protocolContracts.contractType,
        metadataJson: protocolContracts.metadataJson,
      })
      .from(protocolContracts)
      .where(eq(protocolContracts.chainId, input.chainId)),
  ]);

  const poolIds = Array.from(
    new Set([
      ...depositRows.map((row) => row.poolId).filter((value): value is string => Boolean(value)),
      ...exposureRows.map((row) => row.primaryPoolId).filter((value): value is string => Boolean(value)),
      ...input.poolTotals.map((poolTotal) => poolTotal.poolId),
    ]),
  );

  const depositValueUsd = depositRows.reduce((sum, row) => sum + (asNumber(row.metadataJson.valueUsd) ?? 0), 0);
  const strategyValueUsd = exposureRows.reduce((sum, row) => sum + (asNumber(row.metadataJson.valueUsd) ?? 0), 0);
  const deployedValueUsd = depositValueUsd + strategyValueUsd;

  const protocolAddressSet = new Set(protocolAddressRows.map((row) => row.address.toLowerCase()));

  // Identify tokens that represent deployed positions (wrapper share tokens, LP tokens).
  const excludedIdleTokenAddresses = new Set<string>();
  for (const exposure of exposureRows) {
    const wrapper = asString(exposure.metadataJson?.wrapperAddress)?.toLowerCase();
    const strategyToken = asString(exposure.metadataJson?.strategyTokenAddress)?.toLowerCase();
    if (wrapper) excludedIdleTokenAddresses.add(wrapper);
    if (strategyToken) excludedIdleTokenAddresses.add(strategyToken);
  }
  for (const deposit of depositRows) {
    const lp = asString(deposit.metadataJson?.lpTokenAddress)?.toLowerCase();
    const positionToken = asString(deposit.metadataJson?.positionTokenAddress)?.toLowerCase();
    if (lp) excludedIdleTokenAddresses.add(lp);
    if (positionToken) excludedIdleTokenAddresses.add(positionToken);
  }

  const idleTokenList = walletTokens.filter((token) => {
    const addr = token.tokenAddress.toLowerCase();
    if (excludedIdleTokenAddresses.has(addr)) return false;
    if (token.decimals === null || token.decimals === undefined || token.decimals < 0) return false;
    return true;
  });

  // Load latest price per idle token from price_points.
  const idleTokenAddresses = idleTokenList.map((token) => token.tokenAddress.toLowerCase());

  // Build map of current balance per idle token (in token-units, not raw).
  const currentBalanceByToken = new Map<string, number>();
  const tokenMeta = new Map<string, {
    symbol: string | null;
    name: string | null;
    decimals: number;
    possibleSpam: boolean | null;
    verifiedContract: boolean | null;
    nativeToken: boolean;
  }>();
  for (const token of idleTokenList) {
    const addr = token.tokenAddress.toLowerCase();
    const decimals = token.decimals ?? 18;
    tokenMeta.set(addr, {
      symbol: token.symbol,
      name: token.name,
      decimals,
      possibleSpam: token.possibleSpam,
      verifiedContract: token.verifiedContract ?? null,
      nativeToken: token.nativeToken,
    });
    currentBalanceByToken.set(addr, dividePow10(token.balanceRaw, decimals));
  }

  // Load asset_movements joined with ledger_events occurred_at within range.
  const startBoundary = new Date(`${input.startDayUtc}T00:00:00.000Z`);
  const endBoundary = endOfDayUtc(input.endDayUtc);
  const movementRows = await db
    .select({
      tokenAddress: assetMovements.tokenAddress,
      directionIn: assetMovements.directionIn,
      amountRaw: assetMovements.amountRaw,
      amountUsd: assetMovements.amountUsd,
      metadataJson: assetMovements.metadataJson,
      occurredAt: ledgerEvents.occurredAt,
      txHash: ledgerEvents.txHash,
    })
    .from(assetMovements)
    .innerJoin(ledgerEvents, eq(assetMovements.ledgerEventId, ledgerEvents.id))
    .where(
      and(
        eq(assetMovements.walletAddress, walletAddress),
        eq(assetMovements.chainId, input.chainId),
        gte(ledgerEvents.occurredAt, startBoundary),
        lte(ledgerEvents.occurredAt, endBoundary),
      ),
    );

  for (const row of movementRows) {
    const tokenAddress = row.tokenAddress.toLowerCase();
    if (tokenMeta.has(tokenAddress)) {
      continue;
    }

    const metadataJson = (row.metadataJson ?? {}) as Record<string, unknown>;
    const symbol = asString(metadataJson.symbol);
    const name = asString(metadataJson.name);
    const decimals = resolveKnownTokenDecimals({
      chainId: input.chainId,
      tokenAddress,
      symbol,
      decimals: metadataJson.decimals,
    });

    if (decimals === null || decimals < 0) {
      continue;
    }

    tokenMeta.set(tokenAddress, {
      symbol,
      name,
      decimals,
      possibleSpam: typeof metadataJson.possibleSpam === "boolean" ? metadataJson.possibleSpam : null,
      verifiedContract: typeof metadataJson.verifiedContract === "boolean" ? metadataJson.verifiedContract : null,
      nativeToken: tokenAddress === BASE_WETH_ADDRESS,
    });
    currentBalanceByToken.set(tokenAddress, currentBalanceByToken.get(tokenAddress) ?? 0);
  }

  const dayRows = Array.from(iterateUtcDays(input.startDayUtc, input.endDayUtc));
  const deployedComponents = [
    ...depositRows.flatMap((row) => {
      const primaryTokenAddress = resolveKnownTokenAddress({
        chainId: input.chainId,
        tokenAddress: null,
        symbol: row.metadataJson.primaryTokenSymbol,
      });
      const secondaryTokenAddress = resolveKnownTokenAddress({
        chainId: input.chainId,
        tokenAddress: null,
        symbol: row.metadataJson.secondaryTokenSymbol,
      });

      return [
        primaryTokenAddress
          ? {
              tokenAddress: primaryTokenAddress,
              amount: asNumber(row.metadataJson.primaryTokenAmount),
            }
          : null,
        secondaryTokenAddress
          ? {
              tokenAddress: secondaryTokenAddress,
              amount: asNumber(row.metadataJson.secondaryTokenAmount),
            }
          : null,
      ].filter((component): component is { tokenAddress: string; amount: number | null } => Boolean(component));
    }),
    ...exposureRows.flatMap((row) => {
      const token0Address = resolveKnownTokenAddress({
        chainId: input.chainId,
        tokenAddress: row.metadataJson.token0Address,
        symbol: row.metadataJson.primaryTokenSymbol,
      });
      const token1Address = resolveKnownTokenAddress({
        chainId: input.chainId,
        tokenAddress: row.metadataJson.token1Address,
        symbol: row.metadataJson.secondaryTokenSymbol,
      });
      const token0Decimals = resolveKnownTokenDecimals({
        chainId: input.chainId,
        tokenAddress: token0Address,
        symbol: row.metadataJson.primaryTokenSymbol,
        decimals: row.metadataJson.token0Decimals,
      });
      const token1Decimals = resolveKnownTokenDecimals({
        chainId: input.chainId,
        tokenAddress: token1Address,
        symbol: row.metadataJson.secondaryTokenSymbol,
        decimals: row.metadataJson.token1Decimals,
      });

      return [
        token0Address
          ? {
              tokenAddress: token0Address,
              amount:
                typeof row.underlying0AmountRaw === "string" && token0Decimals !== null
                  ? dividePow10(row.underlying0AmountRaw, token0Decimals)
                  : asNumber(row.metadataJson.primaryTokenAmount),
            }
          : null,
        token1Address
          ? {
              tokenAddress: token1Address,
              amount:
                typeof row.underlying1AmountRaw === "string" && token1Decimals !== null
                  ? dividePow10(row.underlying1AmountRaw, token1Decimals)
                  : asNumber(row.metadataJson.secondaryTokenAmount),
            }
          : null,
      ].filter((component): component is { tokenAddress: string; amount: number | null } => Boolean(component));
    }),
  ];
  const relevantTokenAddresses = new Set<string>([
    ...idleTokenAddresses,
    ...Array.from(tokenMeta.keys()),
    ...deployedComponents.map((component) => component.tokenAddress),
  ]);

  const priceRows = relevantTokenAddresses.size === 0
    ? []
    : await db
      .select({
        tokenAddress: pricePoints.tokenAddress,
        priceUsd: pricePoints.priceUsd,
        pricedAt: pricePoints.pricedAt,
      })
      .from(pricePoints)
      .where(
        and(
          eq(pricePoints.chainId, input.chainId),
          inArray(pricePoints.tokenAddress, Array.from(relevantTokenAddresses)),
          lte(pricePoints.pricedAt, input.capturedAt),
        ),
      )
      .orderBy(asc(pricePoints.tokenAddress), asc(pricePoints.pricedAt));

  const { latestPriceByToken, priceSeriesByToken } = buildDailyPriceSeriesByToken({
    dayRows,
    priceRows,
    capturedAt: input.capturedAt,
  });

  // Fallback to usdPrice from Moralis snapshot if no price_points entry.
  for (const token of idleTokenList) {
    const addr = token.tokenAddress.toLowerCase();
    if (latestPriceByToken.has(addr)) continue;
    if (token.usdPrice && token.usdPrice > 0) {
      latestPriceByToken.set(addr, token.usdPrice);
    }
  }

  const rewardValueByDay = new Map<string, number>();
  const rewardStartAt = new Date(`${input.startDayUtc}T00:00:00.000Z`);
  const [realizedRewardRows, unresolvedRewardRows] = await Promise.all([
    readOverviewRealizedRewardEvents({
      walletAddress,
      chainId: input.chainId,
      startAt: rewardStartAt,
      endAt: input.capturedAt,
    }),
    readOverviewUnresolvedRewardCoverage({
      walletAddress,
      chainId: input.chainId,
      startAt: rewardStartAt,
      endAt: input.capturedAt,
    }),
  ]);
  for (const row of realizedRewardRows) {
    const dayUtc = row.occurredAt.toISOString().slice(0, 10);
    rewardValueByDay.set(dayUtc, (rewardValueByDay.get(dayUtc) ?? 0) + (asNumber(row.amountUsd) ?? 0));
  }
  const rewardCoverageByDay = summarizeRewardCoverageByDay({
    dayRows,
    unresolvedRows: unresolvedRewardRows,
  });
  const historicalDeployedValues = buildHistoricalComponentValueLookup({
    bucketKeys: dayRows,
    seriesByToken: priceSeriesByToken,
    components: deployedComponents.map((component) => ({
      token0Address: component.tokenAddress,
      token1Address: component.tokenAddress,
      token0Amount: component.amount,
      token1Amount: null,
    })),
  });
  const deployedValueByDay = new Map<string, number>();
  for (const dayUtc of dayRows) {
    deployedValueByDay.set(
      dayUtc,
      dayUtc === input.endDayUtc
        ? deployedValueUsd
        : (historicalDeployedValues.valueByBucket.get(dayUtc) ?? deployedValueUsd),
    );
  }

  // Reverse-walk idle balances: balance(d) = balance(d+1) - net_inflow_during(d+1).
  const netInflowByDayToken = new Map<string, Map<string, number>>();
  for (const row of movementRows) {
    const token = row.tokenAddress.toLowerCase();
    const dayUtc = dayUtcFromDate(row.occurredAt);
    const meta = tokenMeta.get(token);
    if (!meta) continue;
    const tokenAmount = dividePow10(row.amountRaw, meta.decimals);
    const signed = row.directionIn ? tokenAmount : -tokenAmount;
    if (!netInflowByDayToken.has(dayUtc)) {
      netInflowByDayToken.set(dayUtc, new Map());
    }
    const map = netInflowByDayToken.get(dayUtc)!;
    map.set(token, (map.get(token) ?? 0) + signed);
  }

  const balancesPerDay = new Map<string, Map<string, number>>();
  const workingBalances = new Map<string, number>(currentBalanceByToken);
  for (let index = dayRows.length - 1; index >= 0; index -= 1) {
    const dayUtc = dayRows[index];
    balancesPerDay.set(dayUtc, new Map(workingBalances));
    const dayDelta = netInflowByDayToken.get(dayUtc);
    if (dayDelta) {
      for (const [token, delta] of dayDelta.entries()) {
        const prev = workingBalances.get(token) ?? 0;
        const next = prev - delta;
        workingBalances.set(token, Math.abs(next) < 1e-12 ? 0 : next);
      }
    }
  }

  // Cash flow per day: count only movements whose counterparty is NOT a known protocol contract.
  const cashFlowPerDay = new Map<string, { cashInUsd: number; cashOutUsd: number }>();
  for (const row of movementRows) {
    const token = row.tokenAddress.toLowerCase();
    const meta = tokenMeta.get(token);
    if (!meta) continue;
    const metadata = (row.metadataJson ?? {}) as Record<string, unknown>;
    const fromAddress = asString(metadata.fromAddress)?.toLowerCase() ?? null;
    const toAddress = asString(metadata.toAddress)?.toLowerCase() ?? null;
    const counterparty = row.directionIn ? fromAddress : toAddress;
    if (!counterparty) continue;
    if (counterparty === walletAddress) continue;
    if (protocolAddressSet.has(counterparty)) continue;
    const dayUtc = dayUtcFromDate(row.occurredAt);
    const tokenAmount = dividePow10(row.amountRaw, meta.decimals);
    const price = resolveTokenPriceForDay({
      tokenAddress: token,
      dayUtc,
      priceSeriesByToken,
      latestPriceByToken,
    }) ?? 0;
    const valueUsd = asNumber(row.amountUsd) ?? tokenAmount * price;
    const bucket = cashFlowPerDay.get(dayUtc) ?? { cashInUsd: 0, cashOutUsd: 0 };
    if (row.directionIn) {
      bucket.cashInUsd += valueUsd;
    } else {
      bucket.cashOutUsd += valueUsd;
    }
    cashFlowPerDay.set(dayUtc, bucket);
  }

  const metricsByDay = new Map<string, ReconstructedDayMetric>();
  let cumulativeCashIn = 0;
  let cumulativeCashOut = 0;
  for (const dayUtc of dayRows) {
    const dayBalances = balancesPerDay.get(dayUtc) ?? new Map<string, number>();
    let idleValueUsd = 0;
    const idleTokensForDay: ReconstructedDayMetric["idleTokens"] = [];
    for (const [token, balance] of dayBalances.entries()) {
      if (balance <= 0) continue;
      const meta = tokenMeta.get(token);
      if (!meta) continue;
      const price = resolveTokenPriceForDay({
        tokenAddress: token,
        dayUtc,
        priceSeriesByToken,
        latestPriceByToken,
      }) ?? 0;
      const valueUsd = balance * price;
      const knownProtocolMatch = resolveKnownProtocolAssetMatch(input.chainId, token, protocolAddressRows);
      const trustInput = buildHistoricalIdleTrustInput({
        walletAddress,
        chainId: input.chainId,
        protocolContracts: protocolAddressRows,
        tokenAddress: token,
        symbol: meta.symbol,
        name: meta.name,
        decimals: meta.decimals,
        balanceRaw: String(Math.round(balance * 10 ** meta.decimals)),
        balanceFormatted: balance,
        valueUsd: price > 0 ? valueUsd : null,
        possibleSpam: meta.possibleSpam,
        verifiedContract: meta.verifiedContract,
        isNativeAsset: meta.nativeToken,
      });

      if (!shouldIncludeHistoricalIdleToken({
        trustInput,
        knownProtocolReasonCode: knownProtocolMatch?.reasonCode ?? null,
      })) {
        continue;
      }

      idleValueUsd += valueUsd;
      idleTokensForDay.push({
        tokenAddress: token,
        symbol: meta.symbol,
        balanceFormatted: balance,
        valueUsd,
      });
    }
    const flow = cashFlowPerDay.get(dayUtc) ?? { cashInUsd: 0, cashOutUsd: 0 };
    cumulativeCashIn += flow.cashInUsd;
    cumulativeCashOut += flow.cashOutUsd;
    metricsByDay.set(dayUtc, {
      idleValueUsd,
      idleTokens: idleTokensForDay,
      cashInUsd: flow.cashInUsd,
      cashOutUsd: flow.cashOutUsd,
      cumulativeCashInUsd: cumulativeCashIn,
      cumulativeCashOutUsd: cumulativeCashOut,
      netCapitalInUsd: cumulativeCashIn - cumulativeCashOut,
    });
  }

  let firstFundedDayUtc: string | null = null;
  for (const dayUtc of dayRows) {
    const metric = metricsByDay.get(dayUtc)!;
    if (metric.cumulativeCashInUsd > 0) {
      firstFundedDayUtc = dayUtc;
      break;
    }
  }

  function computePnlAndAnnualized(dayUtc: string, totalValueUsd: number) {
    const metric = metricsByDay.get(dayUtc)!;
    const netCapital = metric.netCapitalInUsd;
    const pnlUsd = totalValueUsd - netCapital;
    let annualizedReturnPct: number | null = null;
    if (firstFundedDayUtc && metric.cumulativeCashInUsd > 0) {
      const start = new Date(`${firstFundedDayUtc}T00:00:00.000Z`).getTime();
      const end = new Date(`${dayUtc}T00:00:00.000Z`).getTime();
      const days = Math.max(1, Math.round((end - start) / (24 * 60 * 60 * 1000)));
      if (days >= 14 && netCapital > 0) {
        const totalReturn = (totalValueUsd + metric.cumulativeCashOutUsd) / metric.cumulativeCashInUsd;
        if (totalReturn > 0) {
          const annualized = Math.pow(totalReturn, 365 / days) - 1;
          const annualizedReturnPctValue = annualized * 100;
          if (fitsAnnualizedReturnPctColumn(annualizedReturnPctValue)) {
            annualizedReturnPct = annualizedReturnPctValue;
          }
        }
      }
    }
    return { pnlUsd, annualizedReturnPct };
  }

  const performanceRows = dayRows.flatMap((dayUtc) => {
    const metric = metricsByDay.get(dayUtc)!;
    const dayDeployedValueUsd = deployedValueByDay.get(dayUtc) ?? deployedValueUsd;
    const dayRewardValueUsd = rewardValueByDay.get(dayUtc) ?? 0;
    const totalValueUsd = dayDeployedValueUsd + metric.idleValueUsd;
    const rewardCoverageStatus = rewardCoverageByDay.coverageStatusByDay.get(dayUtc) ?? "full";
    const rewardCoverageReasonCodes = rewardCoverageByDay.reasonCodesByDay.get(dayUtc) ?? [];
    const unresolvedRewardCount = rewardCoverageByDay.unresolvedCountByDay.get(dayUtc) ?? 0;
    const { pnlUsd, annualizedReturnPct } = computePnlAndAnnualized(dayUtc, totalValueUsd);

    return [
      {
        chainId: input.chainId,
        walletAddress,
        scope: "portfolio",
        scopeRefId: null,
        capturedAt: new Date(`${dayUtc}T00:00:00.000Z`),
        dayUtc,
        resolution: "daily",
        coverageStatus: rewardCoverageStatus === "partial"
          ? "partial"
          : totalValueUsd > 0
            ? "full"
            : "unknown",
        valueUsd: String(totalValueUsd),
        pnlUsd: String(pnlUsd),
        annualizedReturnPct: annualizedReturnPct !== null ? String(annualizedReturnPct) : null,
        metadataJson: {
          depositValueUsd: dayDeployedValueUsd > 0 && deployedValueUsd > 0
            ? depositValueUsd * (dayDeployedValueUsd / deployedValueUsd)
            : depositValueUsd,
          strategyValueUsd: dayDeployedValueUsd > 0 && deployedValueUsd > 0
            ? strategyValueUsd * (dayDeployedValueUsd / deployedValueUsd)
            : strategyValueUsd,
          idleValueUsd: metric.idleValueUsd,
          rewardValueUsd: dayRewardValueUsd,
          cashInUsd: metric.cashInUsd,
          cashOutUsd: metric.cashOutUsd,
          cumulativeCashInUsd: metric.cumulativeCashInUsd,
          cumulativeCashOutUsd: metric.cumulativeCashOutUsd,
          netCapitalInUsd: metric.netCapitalInUsd,
          rewardCoverageReasonCodes,
          unresolvedRewardCount,
          snapshotKind: "analysis_engine_daily",
        },
      },
      {
        chainId: input.chainId,
        walletAddress,
        scope: "rewards",
        scopeRefId: null,
        capturedAt: new Date(`${dayUtc}T00:00:00.000Z`),
        dayUtc,
        resolution: "daily",
        coverageStatus: rewardCoverageStatus,
        valueUsd: String(dayRewardValueUsd),
        metadataJson: {
          rewardCoverageReasonCodes,
          unresolvedRewardCount,
          snapshotKind: "analysis_engine_daily",
        },
      },
      {
        chainId: input.chainId,
        walletAddress,
        scope: "idle",
        scopeRefId: null,
        capturedAt: new Date(`${dayUtc}T00:00:00.000Z`),
        dayUtc,
        resolution: "daily",
        coverageStatus: idleTokenList.length > 0 ? "full" : "unknown",
        valueUsd: String(metric.idleValueUsd),
        metadataJson: {
          snapshotKind: "analysis_engine_daily",
          tokens: metric.idleTokens,
        },
      },
      {
        chainId: input.chainId,
        walletAddress,
        scope: "capital_flow",
        scopeRefId: null,
        capturedAt: new Date(`${dayUtc}T00:00:00.000Z`),
        dayUtc,
        resolution: "daily",
        coverageStatus: "full",
        valueUsd: String(metric.netCapitalInUsd),
        metadataJson: {
          snapshotKind: "analysis_engine_daily",
          cashInUsd: metric.cashInUsd,
          cashOutUsd: metric.cashOutUsd,
          cumulativeCashInUsd: metric.cumulativeCashInUsd,
          cumulativeCashOutUsd: metric.cumulativeCashOutUsd,
        },
      },
      ...depositRows.map((row) => ({
        chainId: input.chainId,
        walletAddress,
        scope: "deposit",
        scopeRefId: row.id,
        capturedAt: new Date(`${dayUtc}T00:00:00.000Z`),
        dayUtc,
        resolution: "daily",
        coverageStatus: row.coverageStatus,
        valueUsd: String(asNumber(row.metadataJson.valueUsd) ?? 0),
        metadataJson: {
          ...row.metadataJson,
          snapshotKind: "analysis_engine_daily",
        },
      })),
      ...exposureRows.map((row) => ({
        chainId: input.chainId,
        walletAddress,
        scope: "strategy",
        scopeRefId: row.strategyId,
        capturedAt: new Date(`${dayUtc}T00:00:00.000Z`),
        dayUtc,
        resolution: "daily",
        coverageStatus: row.coverageStatus,
        valueUsd: String(asNumber(row.metadataJson.valueUsd) ?? 0),
        metadataJson: {
          ...row.metadataJson,
          snapshotKind: "analysis_engine_daily",
        },
      })),
    ];
  });

  await db
    .delete(performanceSnapshots)
    .where(
      and(
        eq(performanceSnapshots.chainId, input.chainId),
        eq(performanceSnapshots.walletAddress, walletAddress),
        eq(performanceSnapshots.resolution, "daily"),
        gte(performanceSnapshots.dayUtc, input.startDayUtc),
        lte(performanceSnapshots.dayUtc, input.endDayUtc),
      ),
    );

  if (performanceRows.length > 0) {
    for (const chunk of chunkRows(performanceRows, SNAPSHOT_INSERT_CHUNK_SIZE)) {
      await db.insert(performanceSnapshots).values(chunk);
    }
  }

  for (const dayUtc of dayRows) {
    const capturedAt = dayUtc === input.endDayUtc ? input.capturedAt : new Date(`${dayUtc}T00:00:00.000Z`);
    const metric = metricsByDay.get(dayUtc)!;
    const dayDeployedValueUsd = deployedValueByDay.get(dayUtc) ?? deployedValueUsd;
    const totalValueUsd = dayDeployedValueUsd + metric.idleValueUsd;
    const rewardCoverageReasonCodes = rewardCoverageByDay.reasonCodesByDay.get(dayUtc) ?? [];
    const unresolvedRewardCount = rewardCoverageByDay.unresolvedCountByDay.get(dayUtc) ?? 0;

    await db
      .insert(portfolioSnapshots)
      .values({
        chainId: input.chainId,
        walletAddress,
        capturedAt,
        totalValueUsd: String(totalValueUsd),
        deployedValueUsd: String(dayDeployedValueUsd),
        idleValueUsd: String(metric.idleValueUsd),
        metadataJson: {
          snapshotKind: "analysis_engine_daily",
          dayUtc,
          rewardValueUsd: rewardValueByDay.get(dayUtc) ?? 0,
          idleTokens: metric.idleTokens,
          cashInUsd: metric.cashInUsd,
          cashOutUsd: metric.cashOutUsd,
          cumulativeCashInUsd: metric.cumulativeCashInUsd,
          cumulativeCashOutUsd: metric.cumulativeCashOutUsd,
          netCapitalInUsd: metric.netCapitalInUsd,
          rewardCoverageReasonCodes,
          unresolvedRewardCount,
        },
      })
      .onConflictDoUpdate({
        target: [portfolioSnapshots.chainId, portfolioSnapshots.walletAddress, portfolioSnapshots.capturedAt],
        set: {
          totalValueUsd: String(totalValueUsd),
          deployedValueUsd: String(dayDeployedValueUsd),
          idleValueUsd: String(metric.idleValueUsd),
          metadataJson: {
            snapshotKind: "analysis_engine_daily",
            dayUtc,
            rewardValueUsd: rewardValueByDay.get(dayUtc) ?? 0,
            idleTokens: metric.idleTokens,
            cashInUsd: metric.cashInUsd,
            cashOutUsd: metric.cashOutUsd,
            cumulativeCashInUsd: metric.cumulativeCashInUsd,
            cumulativeCashOutUsd: metric.cumulativeCashOutUsd,
            netCapitalInUsd: metric.netCapitalInUsd,
            rewardCoverageReasonCodes,
            unresolvedRewardCount,
          },
        },
      });
  }

  if (poolIds.length > 0) {
    await db
      .delete(poolMetricsSnapshots)
      .where(
        and(
          eq(poolMetricsSnapshots.chainId, input.chainId),
          inArray(poolMetricsSnapshots.poolId, poolIds),
          gte(poolMetricsSnapshots.dayUtc, input.startDayUtc),
          lte(poolMetricsSnapshots.dayUtc, input.endDayUtc),
          sql`${poolMetricsSnapshots.metadataJson}->>'source' = 'analysis_engine_daily'`,
        ),
      );
  }

  const finalMetric = metricsByDay.get(input.endDayUtc);
  return {
    startDayUtc: input.startDayUtc,
    endDayUtc: input.endDayUtc,
    dayCount: dayRows.length,
    totalValueUsd: deployedValueUsd + (finalMetric?.idleValueUsd ?? 0),
    deployedValueUsd,
    idleValueUsd: finalMetric?.idleValueUsd ?? 0,
    cumulativeCashInUsd: finalMetric?.cumulativeCashInUsd ?? 0,
    cumulativeCashOutUsd: finalMetric?.cumulativeCashOutUsd ?? 0,
    netCapitalInUsd: finalMetric?.netCapitalInUsd ?? 0,
    rewardDayCount: rewardValueByDay.size,
    poolCount: poolIds.length,
  };
}
