import { assertSupportedChain } from "@/server/chains";
import { getLatestAnalysisRun } from "@/server/analysis/analysis-run.repository";
import {
  getCurrentTokenPricesByAddress,
  getHistoricalTokenPricesByAddress,
} from "@/server/providers/alchemy";
import { getWalletHistory, getWalletTokens } from "@/server/providers/moralis";
import {
  insertOverviewCoverageReport,
  insertOverviewPortfolioSnapshot,
  insertOverviewRawProviderRecord,
  readOverviewFreshness,
  upsertOverviewFreshness,
  upsertOverviewPricePoint,
} from "@/server/overview/overview.repository";
import type {
  OverviewChartPoint,
  OverviewRange,
  OverviewRequest,
  OverviewResponse,
} from "@/server/overview/overview.types";

export const DEFAULT_OVERVIEW_RANGE: OverviewRange = "7d";

const OVERVIEW_BUCKET_CONFIG: Record<OverviewRange, { granularity: "hour" | "day"; bucketCount: number }> = {
  "24h": { granularity: "hour", bucketCount: 24 },
  "7d": { granularity: "day", bucketCount: 7 },
  "30d": { granularity: "day", bucketCount: 30 },
};

const NATIVE_ETH_SENTINEL = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
const BASE_WETH_ADDRESS = "0x4200000000000000000000000000000000000006";
const BASE_CBBTC_ADDRESS = "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf";
const BASE_AERO_ADDRESS = "0x940181a94a35a4569e4529a3cdfb74e38fd98631";
const BASE_USDBC_ADDRESS = "0xd9aaec86b65d86f6a7b5a1b0c42ffa531710b6ca";
const BASE_USDC_ADDRESS = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const HISTORICAL_PRICE_BATCH_SIZE = 8;

export function normalizeOverviewRange(range?: string | null): OverviewRange {
  if (range === "24h" || range === "30d") {
    return range;
  }

  return DEFAULT_OVERVIEW_RANGE;
}

export function getRecentOverviewBucketConfig(range: OverviewRange) {
  return OVERVIEW_BUCKET_CONFIG[range];
}

export function createEmptyRecentOverviewResponse(input: OverviewRequest): OverviewResponse {
  const chain = assertSupportedChain(input.chainId);

  return {
    walletAddress: input.walletAddress.toLowerCase(),
    chainId: input.chainId,
    mode: "recent_view",
    selectedRange: input.range,
    analysis: {
      status: "not_analyzed",
      runId: null,
      stage: "idle",
      progressPct: 0,
      lastSuccessfulRunAt: null,
      lastUpdatedAt: null,
      lastError: null,
    },
    coverage: {
      status: "recent",
      confidence: "medium",
      reasonCodes: ["analysisPending"],
      details: null,
    },
    summary: {
      source: "recent_provider_data",
      coverageStatus: "recent",
      coverageReasonCodes: ["analysisPending"],
      walletAddress: input.walletAddress.toLowerCase(),
      chainId: input.chainId,
      chainLabel: chain.name,
      lastRefreshedAt: null,
      modeLabelKey: "overview.mode.recentView",
    },
    metrics: {
      source: "recent_provider_data",
      coverageStatus: "partial",
      coverageReasonCodes: ["analysisPending"],
      netPortfolioValueUsd: null,
      deployedValueUsd: null,
      idleValueUsd: null,
      changeOverSelectedPeriodPct: null,
      estimatedRealizedRewardsUsd: null,
      manualDepositsValueUsd: null,
      automatedStrategiesValueUsd: null,
      residualAttributedValueUsd: null,
      governanceValueUsd: null,
    },
    chart: {
      source: "recent_provider_data",
      coverageStatus: "recent",
      coverageReasonCodes: ["analysisPending"],
      range: input.range,
      hasRewardMarkers: false,
      points: [],
    },
    distribution: {
      source: "partial_fallback",
      coverageStatus: "partial",
      coverageReasonCodes: ["analysisPending"],
      slices: [],
    },
    assets: {
      source: "recent_provider_data",
      coverageStatus: "partial",
      coverageReasonCodes: ["analysisPending"],
      rows: [],
    },
    activity: {
      source: "recent_provider_data",
      coverageStatus: "recent",
      coverageReasonCodes: ["analysisPending"],
      items: [],
    },
  };
}

type MoralisHistoryRecord = Record<string, unknown>;
function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function asBoolean(value: unknown) {
  return value === true;
}

function formatBalance(balanceRaw: string | null, decimals: number | null) {
  if (!balanceRaw || !/^\d+$/.test(balanceRaw)) {
    return "0";
  }

  const safeDecimals = Math.max(0, decimals ?? 0);
  const raw = BigInt(balanceRaw);
  const divisor = BigInt(10) ** BigInt(safeDecimals);
  const whole = raw / divisor;
  const fraction = raw % divisor;

  if (safeDecimals === 0) {
    return whole.toString();
  }

  const fractionText = fraction.toString().padStart(safeDecimals, "0").replace(/0+$/, "");
  if (!fractionText) {
    return whole.toString();
  }

  return `${whole.toString()}.${fractionText.slice(0, 6)}`;
}

function buildChartPoints(
  bucketTimestamps: string[],
  seriesByToken: Map<string, Map<string, number>>,
  tokenBalances: Array<{ tokenAddress: string; balance: number }>,
) {
  let hasPartialHistory = false;

  const points: OverviewChartPoint[] = bucketTimestamps.map((bucketTimestamp) => {
    let totalValueUsd = 0;
    let hasAnyValue = false;

    for (const tokenBalance of tokenBalances) {
      const priceByBucket = seriesByToken.get(tokenBalance.tokenAddress);
      const historicalPriceUsd = priceByBucket?.get(bucketTimestamp);

      if (historicalPriceUsd === undefined) {
        hasPartialHistory = true;
        continue;
      }

      totalValueUsd += tokenBalance.balance * historicalPriceUsd;
      hasAnyValue = true;
    }

    return {
      capturedAt: bucketTimestamp,
      totalValueUsd: hasAnyValue ? totalValueUsd : null,
      deployedValueUsd: null,
      idleValueUsd: hasAnyValue ? totalValueUsd : null,
      rewardValueUsd: null,
    };
  });

  return {
    points,
    hasPartialHistory,
  };
}

function sanitizeProviderError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith("MORALIS_REQUEST_FAILED") || message.startsWith("ALCHEMY_")) {
    return new Error("PROVIDER_REQUEST_FAILED");
  }

  return error instanceof Error ? error : new Error("OVERVIEW_FAILED");
}

function isStale(lastSuccessfulRunAt: Date | null) {
  if (!lastSuccessfulRunAt) {
    return false;
  }

  return Date.now() - lastSuccessfulRunAt.getTime() > 7 * 24 * 60 * 60 * 1000;
}

function floorDateToGranularity(date: Date, granularity: "hour" | "day") {
  const alignedDate = new Date(date);

  alignedDate.setUTCMinutes(0, 0, 0);
  if (granularity === "day") {
    alignedDate.setUTCHours(0, 0, 0, 0);
  }

  return alignedDate;
}

function buildBucketTimestamps(range: OverviewRange, referenceDate: Date) {
  const config = getRecentOverviewBucketConfig(range);
  const alignedEndDate = floorDateToGranularity(referenceDate, config.granularity);
  const bucketMs = config.granularity === "hour" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

  return Array.from({ length: config.bucketCount }, (_, index) => {
    const offset = config.bucketCount - index - 1;
    return new Date(alignedEndDate.getTime() - offset * bucketMs).toISOString();
  });
}

function toBucketTimestamp(timestamp: string, granularity: "hour" | "day") {
  return floorDateToGranularity(new Date(timestamp), granularity).toISOString();
}

function calculatePercentChange(currentValue: number | null, previousValue: number | null) {
  if (currentValue === null || previousValue === null || previousValue === 0) {
    return null;
  }

  return (currentValue - previousValue) / previousValue;
}

function normalizeTokenMetadata(value: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function resolveAlchemyPricingAddress(
  chainId: number,
  tokenAddress: string | null,
  symbol: string | null,
  options?: {
    name?: string | null;
    nativeToken?: boolean;
    verifiedContract?: boolean;
  },
) {
  const normalizedAddress = tokenAddress?.toLowerCase() ?? null;
  const normalizedSymbol = normalizeTokenMetadata(symbol);
  const normalizedName = normalizeTokenMetadata(options?.name ?? null);
  const nativeToken = options?.nativeToken === true;
  const trustedToken = nativeToken || options?.verifiedContract === true;

  if (chainId === 8453) {
    if (
      nativeToken ||
      normalizedAddress === NATIVE_ETH_SENTINEL ||
      normalizedAddress === BASE_WETH_ADDRESS ||
      (trustedToken && (
        normalizedSymbol === "weth" ||
        (normalizedSymbol === "eth" && normalizedName === "ether") ||
        normalizedName === "wrapped ether"
      ))
    ) {
      return BASE_WETH_ADDRESS;
    }

    if (normalizedAddress === BASE_USDBC_ADDRESS) {
      return BASE_USDC_ADDRESS;
    }

    if (
      normalizedAddress === BASE_CBBTC_ADDRESS ||
      (trustedToken && (
        normalizedSymbol === "cbbtc" ||
        normalizedName === "coinbase wrapped btc" ||
        normalizedName === "coinbase wrapped bitcoin"
      ))
    ) {
      return BASE_CBBTC_ADDRESS;
    }

    if (
      normalizedAddress === BASE_AERO_ADDRESS ||
      (trustedToken && (
        normalizedSymbol === "aero" ||
        normalizedName === "aerodrome" ||
        normalizedName === "aerodrome finance"
      ))
    ) {
      return BASE_AERO_ADDRESS;
    }
  }

  return normalizedAddress;
}

function isPriorityPricingAsset(pricingAddress: string | null) {
  return pricingAddress === BASE_WETH_ADDRESS ||
    pricingAddress === BASE_USDC_ADDRESS ||
    pricingAddress === BASE_CBBTC_ADDRESS ||
    pricingAddress === BASE_AERO_ADDRESS;
}

function getHistoricalBaselinePrice(
  priceSeries: Map<string, number> | undefined,
  fallbackBucketTimestamp: string | null,
) {
  if (!priceSeries || !fallbackBucketTimestamp) {
    return null;
  }

  return priceSeries.get(fallbackBucketTimestamp) ?? null;
}

export async function getRecentOverview(input: OverviewRequest): Promise<OverviewResponse> {
  const response = createEmptyRecentOverviewResponse(input);
  const [tokensResult, historyResult, latestRun, freshness] = await Promise.all([
    getWalletTokens(input.walletAddress, input.chainId).then(
      (value) => ({ status: "fulfilled" as const, value }),
      (error) => ({ status: "rejected" as const, reason: sanitizeProviderError(error) }),
    ),
    getWalletHistory(input.walletAddress, input.chainId, 10).then(
      (value) => ({ status: "fulfilled" as const, value }),
      (error) => ({ status: "rejected" as const, reason: sanitizeProviderError(error) }),
    ),
    getLatestAnalysisRun(input.walletAddress, input.chainId),
    readOverviewFreshness(input),
  ]);

  if (tokensResult.status === "rejected" && historyResult.status === "rejected") {
    throw new Error("PROVIDER_REQUEST_FAILED");
  }

  const now = new Date();
  const priorAnalyzedAt = freshness?.lastAnalyzedAt ?? latestRun?.completedAt ?? null;
  const analysisStatus = latestRun?.status === "queued" || latestRun?.status === "running"
    ? latestRun.status
    : latestRun?.status === "failed"
      ? "failed"
      : isStale(priorAnalyzedAt)
        ? "stale"
        : priorAnalyzedAt
          ? "ready"
          : "not_analyzed";

  response.analysis = {
    status: analysisStatus,
    runId: latestRun?.id ?? freshness?.lastSuccessfulRunId ?? null,
    stage:
      latestRun?.stage ??
      (analysisStatus === "ready" || analysisStatus === "stale" ? "completed" : "idle"),
    progressPct:
      latestRun?.progressPct ?? (analysisStatus === "ready" || analysisStatus === "stale" ? 100 : 0),
    lastSuccessfulRunAt: priorAnalyzedAt ? priorAnalyzedAt.toISOString() : null,
    lastUpdatedAt: latestRun?.updatedAt ? latestRun.updatedAt.toISOString() : null,
    lastError: latestRun?.lastError ?? null,
  };

  const tokens = tokensResult.status === "fulfilled" ? (tokensResult.value.result ?? []) : [];
  const history = historyResult.status === "fulfilled" ? (historyResult.value.result ?? []) : [];

  const tokenPricingContexts = tokens.map((token) => {
    const tokenAddress = asString(token.token_address)?.toLowerCase() ?? null;
    const symbol = asString(token.symbol) ?? "UNKNOWN";
    const name = asString(token.name);
    const pricingAddress = resolveAlchemyPricingAddress(input.chainId, tokenAddress, symbol, {
      name,
      nativeToken: asBoolean(token.native_token),
      verifiedContract: asBoolean(token.verified_contract),
    });

    return {
      token,
      tokenAddress,
      symbol,
      name,
      pricingAddress,
      moralisPriceUsd: asNumber(token.usd_price),
      moralisValueUsd: asNumber(token.usd_value),
      isPriorityPricingAsset: isPriorityPricingAsset(pricingAddress),
    };
  });

  if (tokensResult.status === "fulfilled") {
    await insertOverviewRawProviderRecord({
      walletAddress: input.walletAddress,
      chainId: input.chainId,
      provider: "moralis",
      endpoint: "/wallets/:walletAddress/tokens",
      requestJson: { walletAddress: input.walletAddress, chainId: input.chainId },
      responseJson: { resultCount: tokens.length },
    });
  }

  if (historyResult.status === "fulfilled") {
    await insertOverviewRawProviderRecord({
      walletAddress: input.walletAddress,
      chainId: input.chainId,
      provider: "moralis",
      endpoint: "/wallets/:walletAddress/history",
      requestJson: { walletAddress: input.walletAddress, chainId: input.chainId, limit: 10 },
      responseJson: { resultCount: history.length },
    });
  }

  const uniqueTokenAddresses = Array.from(
    new Map(
      [...tokenPricingContexts]
        .sort((left, right) => {
          if (left.isPriorityPricingAsset !== right.isPriorityPricingAsset) {
            return Number(right.isPriorityPricingAsset) - Number(left.isPriorityPricingAsset);
          }

          return (right.moralisValueUsd ?? -1) - (left.moralisValueUsd ?? -1);
        })
        .filter((context) => Boolean(context.pricingAddress))
        .map((context) => [context.pricingAddress as string, context]),
    ).keys(),
  );

  const priceLookup = new Map<string, { priceUsd: number; pricedAt: string | null; confidence: "high" | "medium" }>();
  const historicalPriceLookup = new Map<string, Map<string, number>>();
  const latestHistoricalPriceLookup = new Map<string, { priceUsd: number; pricedAt: string | null }>();
  let priceFetchFailed = false;
  let historicalPriceFetchFailed = false;

  if (uniqueTokenAddresses.length > 0) {
    try {
      const prices = await getCurrentTokenPricesByAddress(input.chainId, uniqueTokenAddresses);
      await insertOverviewRawProviderRecord({
        walletAddress: input.walletAddress,
        chainId: input.chainId,
        provider: "alchemy",
        endpoint: "/prices/v1/tokens/by-address",
        requestJson: { chainId: input.chainId, addresses: uniqueTokenAddresses },
        responseJson: { resultCount: prices.data?.length ?? 0 },
      });

      for (const item of prices.data ?? []) {
        const address = item.address.toLowerCase();
        const usdPrice = item.prices?.find((price) => price.currency === "usd") ?? item.prices?.[0];
        const priceUsd = usdPrice ? Number(usdPrice.value) : NaN;
        if (!Number.isFinite(priceUsd)) {
          continue;
        }

        priceLookup.set(address, {
          priceUsd,
          pricedAt: usdPrice?.lastUpdatedAt ?? null,
          confidence: "high",
        });

        await upsertOverviewPricePoint({
          walletAddress: input.walletAddress,
          chainId: input.chainId,
          tokenAddress: address,
          pricedAt: usdPrice?.lastUpdatedAt ? new Date(usdPrice.lastUpdatedAt) : now,
          priceUsd: String(priceUsd),
          metadataJson: { provider: "alchemy" },
        });
      }
    } catch {
      priceFetchFailed = true;
    }
  }

  const bucketConfig = getRecentOverviewBucketConfig(input.range);
  const bucketTimestamps = buildBucketTimestamps(input.range, now);

  if (uniqueTokenAddresses.length > 0) {
    const historicalPriceResults: PromiseSettledResult<void>[] = [];

    for (let batchStart = 0; batchStart < uniqueTokenAddresses.length; batchStart += HISTORICAL_PRICE_BATCH_SIZE) {
      const batchAddresses = uniqueTokenAddresses.slice(batchStart, batchStart + HISTORICAL_PRICE_BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batchAddresses.map(async (address) => {
        const historicalPrices = await getHistoricalTokenPricesByAddress(input.chainId, {
          address,
          startTime: bucketTimestamps[0] ?? now.toISOString(),
          endTime: bucketTimestamps[bucketTimestamps.length - 1] ?? now.toISOString(),
          interval: bucketConfig.granularity === "hour" ? "1h" : "1d",
        });

        await insertOverviewRawProviderRecord({
          walletAddress: input.walletAddress,
          chainId: input.chainId,
          provider: "alchemy",
          endpoint: "/prices/v1/tokens/historical",
          requestJson: {
            chainId: input.chainId,
            address,
            startTime: bucketTimestamps[0] ?? now.toISOString(),
            endTime: bucketTimestamps[bucketTimestamps.length - 1] ?? now.toISOString(),
            interval: bucketConfig.granularity === "hour" ? "1h" : "1d",
          },
          responseJson: { resultCount: historicalPrices.data?.length ?? 0 },
        });

        const priceSeriesByBucket = new Map<string, number>();
        let latestHistoricalPoint: { priceUsd: number; pricedAt: string | null } | null = null;

        for (const pricePoint of historicalPrices.data ?? []) {
          const priceUsd = Number(pricePoint.value);
          if (!Number.isFinite(priceUsd)) {
            continue;
          }

          if (
            !latestHistoricalPoint ||
            new Date(pricePoint.timestamp).getTime() > new Date(latestHistoricalPoint.pricedAt ?? 0).getTime()
          ) {
            latestHistoricalPoint = {
              priceUsd,
              pricedAt: pricePoint.timestamp,
            };
          }

          const bucketTimestamp = toBucketTimestamp(pricePoint.timestamp, bucketConfig.granularity);
          priceSeriesByBucket.set(bucketTimestamp, priceUsd);

          await upsertOverviewPricePoint({
            walletAddress: input.walletAddress,
            chainId: input.chainId,
            tokenAddress: address,
            pricedAt: new Date(pricePoint.timestamp),
            priceUsd: String(priceUsd),
            resolution: bucketConfig.granularity === "hour" ? "1h" : "1d",
            metadataJson: {
              provider: "alchemy",
              range: input.range,
            },
          });
        }

        historicalPriceLookup.set(address, priceSeriesByBucket);

        if (latestHistoricalPoint) {
          latestHistoricalPriceLookup.set(address, latestHistoricalPoint);
        }
        }),
      );

      historicalPriceResults.push(...batchResults);
    }

    historicalPriceFetchFailed = historicalPriceResults.some((result) => result.status === "rejected");
  }

  const assetRows = tokenPricingContexts.map((context) => {
    const decimals = asNumber(context.token.decimals);
    const balanceRaw = asString(context.token.balance);
    const balance = asString(context.token.balance_formatted) ?? formatBalance(balanceRaw, decimals);
    const pricingAddress = context.pricingAddress;
    const priceEntry = pricingAddress ? priceLookup.get(pricingAddress) : null;
    const historicalFallbackPriceEntry = pricingAddress ? latestHistoricalPriceLookup.get(pricingAddress) : null;
    const historicalSeries = pricingAddress ? historicalPriceLookup.get(pricingAddress) : undefined;
    const resolvedPriceEntry =
      priceEntry ??
      (historicalFallbackPriceEntry
        ? {
            priceUsd: historicalFallbackPriceEntry.priceUsd,
            pricedAt: historicalFallbackPriceEntry.pricedAt,
            confidence: "medium" as const,
          }
        : context.moralisPriceUsd !== null
          ? {
              priceUsd: context.moralisPriceUsd,
              pricedAt: null,
              confidence: "low" as const,
            }
        : null);
    const priceUsd = resolvedPriceEntry?.priceUsd ?? null;
    const valueUsd =
      resolvedPriceEntry?.confidence === "low" && context.moralisValueUsd !== null
        ? context.moralisValueUsd
        : priceUsd !== null
          ? Number.parseFloat(balance) * priceUsd
          : null;
    const movement24hBaseline = getHistoricalBaselinePrice(
      historicalSeries,
      bucketTimestamps[Math.max(0, bucketTimestamps.length - 2)] ?? null,
    );
    const movement7dBaseline = getHistoricalBaselinePrice(historicalSeries, bucketTimestamps[0] ?? null);

    return {
      tokenAddress: context.tokenAddress,
      symbol: context.symbol,
      balance,
      priceUsd,
      valueUsd,
      movement24hPct: calculatePercentChange(priceUsd, movement24hBaseline),
      movement7dPct:
        input.range === "24h" ? null : calculatePercentChange(priceUsd, movement7dBaseline),
      classification: "idle" as const,
      priceConfidence: resolvedPriceEntry?.confidence ?? null,
    };
  });

  const chartSeries = buildChartPoints(
    bucketTimestamps,
    historicalPriceLookup,
    assetRows
      .filter(
        (row) => Number.isFinite(Number.parseFloat(row.balance)),
      )
      .map((row) => ({
        tokenAddress: resolveAlchemyPricingAddress(input.chainId, row.tokenAddress, row.symbol) ?? "",
        balance: Number.parseFloat(row.balance),
      }))
      .filter((row) => row.tokenAddress.length > 0),
  );

  const firstChartValue = chartSeries.points.find((point) => point.totalValueUsd !== null)?.totalValueUsd ?? null;
  const lastChartValue = [...chartSeries.points]
    .reverse()
    .find((point) => point.totalValueUsd !== null)?.totalValueUsd ?? null;

  const totalValueUsd = assetRows.reduce<number | null>((sum, row) => {
    if (row.valueUsd === null) {
      return sum;
    }

    return (sum ?? 0) + row.valueUsd;
  }, 0);

  const providerPartial =
    tokensResult.status === "rejected" ||
    historyResult.status === "rejected" ||
    priceFetchFailed ||
    historicalPriceFetchFailed;
  const missingPrices = assetRows.some((row) => row.priceUsd === null);
  const chartPartial = chartSeries.hasPartialHistory || chartSeries.points.some((point) => point.totalValueUsd === null);
  const coverageReasonCodes = [
    "analysisPending",
    ...(providerPartial ? ["providerPartial"] : []),
    ...(missingPrices ? ["missingPrices"] : []),
    ...(chartPartial ? ["missingPrices"] : []),
    ...(history.length === 0 ? ["noRecentActivity"] : []),
  ];
  const uniqueCoverageReasonCodes = Array.from(new Set(coverageReasonCodes));
  const coverageStatus = providerPartial || missingPrices ? "partial" : "recent";

  response.coverage = {
    status: coverageStatus,
    confidence: coverageStatus === "partial" ? "medium" : "high",
    reasonCodes: uniqueCoverageReasonCodes,
    details: null,
  };

  response.summary = {
    ...response.summary,
    coverageStatus,
    coverageReasonCodes: uniqueCoverageReasonCodes,
    lastRefreshedAt: now.toISOString(),
  };

  response.metrics = {
    ...response.metrics,
    coverageStatus,
    coverageReasonCodes: uniqueCoverageReasonCodes,
    netPortfolioValueUsd: totalValueUsd,
    deployedValueUsd: null,
    idleValueUsd: totalValueUsd,
    changeOverSelectedPeriodPct: calculatePercentChange(lastChartValue, firstChartValue),
  };

  response.chart = {
    ...response.chart,
    source: chartPartial ? "partial_fallback" : "recent_provider_data",
    coverageStatus: chartPartial ? "partial" : coverageStatus,
    coverageReasonCodes: chartPartial ? uniqueCoverageReasonCodes : uniqueCoverageReasonCodes,
    points: chartSeries.points,
  };

  response.distribution = {
    ...response.distribution,
    coverageStatus,
    coverageReasonCodes: uniqueCoverageReasonCodes,
    slices:
      totalValueUsd && totalValueUsd > 0
        ? [
            {
              dimension: "idle",
              label: "Idle assets",
              valueUsd: totalValueUsd,
              coverageStatus,
            },
          ]
        : [],
  };

  response.assets = {
    ...response.assets,
    coverageStatus,
    coverageReasonCodes: uniqueCoverageReasonCodes,
    rows: assetRows,
  };

  response.activity = {
    ...response.activity,
    coverageStatus: historyResult.status === "fulfilled" ? "recent" : "partial",
    coverageReasonCodes:
      historyResult.status === "fulfilled" ? ["analysisPending"] : ["providerPartial", "analysisPending"],
    items: history.slice(0, 10).map((item: MoralisHistoryRecord, index) => ({
      id:
        asString(item.transaction_hash) ??
        asString(item.hash) ??
        `${input.walletAddress.toLowerCase()}-${index}`,
      occurredAt:
        asString(item.block_timestamp) ??
        asString(item.block_time) ??
        asString(item.created_at) ??
        now.toISOString(),
      eventType: asString(item.category) ?? "unclassified",
      labelKey: "overview.activity.unclassified",
      txHash: asString(item.transaction_hash) ?? asString(item.hash),
      confidence: "low",
      isUnclassified: true,
    })),
  };

  await insertOverviewCoverageReport({
    walletAddress: input.walletAddress,
    chainId: input.chainId,
    scope: "overview",
    status: coverageStatus,
    confidence: response.coverage.confidence ?? "medium",
    metadataJson: {
      reasonCodes: uniqueCoverageReasonCodes,
      range: input.range,
    },
  });

  if (totalValueUsd !== null) {
    await insertOverviewPortfolioSnapshot({
      walletAddress: input.walletAddress,
      chainId: input.chainId,
      capturedAt: now,
      totalValueUsd: String(totalValueUsd),
      deployedValueUsd: null,
      idleValueUsd: totalValueUsd !== null ? String(totalValueUsd) : null,
      metadataJson: {
        range: input.range,
        source: "recent_provider_data",
      },
    });
  }

  await upsertOverviewFreshness({
    walletAddress: input.walletAddress,
    chainId: input.chainId,
    lastAnalyzedAt: freshness?.lastAnalyzedAt ?? null,
    lastSuccessfulRunId: freshness?.lastSuccessfulRunId ?? null,
    metadataJson: {
      ...(freshness?.metadataJson ?? {}),
      lastOverviewRefreshedAt: now.toISOString(),
      lastOverviewRange: input.range,
    },
  });

  return response;
}