import { randomUUID } from "node:crypto";

import { getAlchemyNetwork } from "@/server/chains";
import { getRedisClient } from "@/server/cache/redis";
import { getEnv } from "@/server/env";
import {
  insertProviderCachedResponse,
  readProviderCachedResponse,
} from "@/server/providers/provider-cache.repository";
import { withProviderRetry } from "@/server/providers/providerErrors";

const PRICES_API_BASE = "https://api.g.alchemy.com/prices/v1";
const CURRENT_PRICE_MEMORY_TTL_MS = 60 * 1000;
const CURRENT_PRICE_TOKEN_NOT_FOUND_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CURRENT_PRICE_ADDRESSES_PER_REQUEST = 25;
const HISTORICAL_PRICE_MEMORY_TTL_MS = 10 * 60 * 1000;
const HISTORICAL_PRICE_TOKEN_NOT_FOUND_TTL_MS = 24 * 60 * 60 * 1000;
const ALCHEMY_HOURLY_REQUEST_LIMIT = 260;
const ALCHEMY_PROVIDER_INFLIGHT_TTL_SECONDS = 20;
const ALCHEMY_PROVIDER_WAIT_TIMEOUT_MS = 20 * 1000;
const ALCHEMY_PROVIDER_WAIT_INTERVAL_MS = 250;

type TokenAddressInput = {
  network: string;
  address: string;
};

type AlchemyPriceByAddressItem = {
  network?: string;
  address: string;
  prices?: Array<{ value: string; currency: string; lastUpdatedAt: string }>;
  error?: { message?: string };
};

type AlchemyPriceByAddressResult = {
  data?: AlchemyPriceByAddressItem[];
};

type AlchemyHistoricalPricePoint = {
  value: string;
  timestamp: string;
};

export type AlchemyHistoricalPriceResult = {
  network: string;
  address: string;
  currency: string;
  data?: AlchemyHistoricalPricePoint[];
};

type TimedCacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const currentPriceResponseCache = new Map<string, TimedCacheEntry<AlchemyPriceByAddressResult>>();
const historicalPriceResponseCache = new Map<string, TimedCacheEntry<AlchemyHistoricalPriceResult>>();
const currentPriceInFlight = new Map<string, Promise<AlchemyPriceByAddressResult>>();
const historicalPriceInFlight = new Map<string, Promise<AlchemyHistoricalPriceResult>>();

let alchemyBudgetWindowStartedAt = Date.now();
let alchemyBudgetUsedInWindow = 0;

function readCachedValue<T>(cache: Map<string, TimedCacheEntry<T>>, key: string) {
  const entry = cache.get(key);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }

  return entry.value;
}

function writeCachedValue<T>(cache: Map<string, TimedCacheEntry<T>>, key: string, value: T, ttlMs: number) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

function waitForDuration(durationMs: number) {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

async function waitForDistributedCachedResponse<T>(input: {
  provider: string;
  endpoint: string;
  chainId: number;
  cacheKey: string;
  maxAgeMs: number;
}) {
  const waitStartedAt = Date.now();
  while (Date.now() - waitStartedAt < ALCHEMY_PROVIDER_WAIT_TIMEOUT_MS) {
    const cachedResponse = await readProviderCachedResponse<T>({
      provider: input.provider,
      endpoint: input.endpoint,
      chainId: input.chainId,
      walletAddress: null,
      cacheKey: input.cacheKey,
      maxAgeMs: input.maxAgeMs,
    });

    if (cachedResponse !== null) {
      return cachedResponse;
    }

    await waitForDuration(ALCHEMY_PROVIDER_WAIT_INTERVAL_MS);
  }

  return null;
}

function consumeAlchemyBudget() {
  const now = Date.now();
  if (now - alchemyBudgetWindowStartedAt >= 60 * 60 * 1000) {
    alchemyBudgetWindowStartedAt = now;
    alchemyBudgetUsedInWindow = 0;
  }

  if (alchemyBudgetUsedInWindow >= ALCHEMY_HOURLY_REQUEST_LIMIT) {
    throw new Error(`ALCHEMY_RATE_GUARD_EXCEEDED:${ALCHEMY_HOURLY_REQUEST_LIMIT}:hourly`);
  }

  alchemyBudgetUsedInWindow += 1;
}

function normalizePriceAddresses(addresses: string[]) {
  return Array.from(
    new Set(
      addresses
        .map((address) => address.toLowerCase().trim())
        .filter((address) => /^0x[a-f0-9]{40}$/.test(address)),
    ),
  );
}

function buildHistoricalTokenNotFoundCacheKey(chainId: number, address: string) {
  return `${chainId}:${address.toLowerCase()}:token-not-found`;
}

function buildCurrentPriceTokenNotFoundCacheKey(chainId: number, address: string) {
  return `${chainId}:${address.toLowerCase()}:price-not-found`;
}

function buildEmptyCurrentPriceItem(chainId: number, address: string): AlchemyPriceByAddressItem {
  const normalizedAddress = address.toLowerCase();

  return {
    network: getAlchemyNetwork(chainId),
    address: normalizedAddress,
    prices: [],
    error: {
      message: `Price not found for ${getAlchemyNetwork(chainId)}:${normalizedAddress}`,
    },
  };
}

function hasCurrentPrices(item: AlchemyPriceByAddressItem) {
  return Array.isArray(item.prices) && item.prices.length > 0;
}

async function readCurrentPriceTokenNotFoundFlags(chainId: number, addresses: string[]) {
  const results = await Promise.all(
    addresses.map(async (address) => {
      const cached = await readProviderCachedResponse<{ notFound: true }>({
        provider: "alchemy",
        endpoint: "/prices/tokens/by-address/not-found",
        chainId,
        walletAddress: null,
        cacheKey: buildCurrentPriceTokenNotFoundCacheKey(chainId, address),
        maxAgeMs: CURRENT_PRICE_TOKEN_NOT_FOUND_TTL_MS,
      });

      return [address, cached?.notFound === true] as const;
    }),
  );

  return {
    flaggedAddresses: results.filter(([, isNotFound]) => isNotFound).map(([address]) => address),
    candidateAddresses: results.filter(([, isNotFound]) => !isNotFound).map(([address]) => address),
  };
}

async function cacheCurrentPriceTokenNotFound(chainId: number, address: string) {
  await insertProviderCachedResponse({
    provider: "alchemy",
    endpoint: "/prices/tokens/by-address/not-found",
    chainId,
    walletAddress: null,
    cacheKey: buildCurrentPriceTokenNotFoundCacheKey(chainId, address),
    payload: { notFound: true },
    ttlMs: CURRENT_PRICE_TOKEN_NOT_FOUND_TTL_MS,
  });
}

function buildEmptyHistoricalPriceResult(input: {
  chainId: number;
  address: string;
}): AlchemyHistoricalPriceResult {
  return {
    network: getAlchemyNetwork(input.chainId),
    address: input.address.toLowerCase(),
    currency: "USD",
    data: [],
  };
}

function isHistoricalTokenNotFoundError(status: number, body: string) {
  if (status !== 400) {
    return false;
  }

  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    return parsed.error?.message?.includes("Token not found:") === true;
  } catch {
    return body.includes("Token not found:");
  }
}

async function readHistoricalTokenNotFoundFlag(chainId: number, address: string) {
  const cached = await readProviderCachedResponse<{ notFound: true }>({
    provider: "alchemy",
    endpoint: "/prices/tokens/historical/not-found",
    chainId,
    walletAddress: null,
    cacheKey: buildHistoricalTokenNotFoundCacheKey(chainId, address),
    maxAgeMs: HISTORICAL_PRICE_TOKEN_NOT_FOUND_TTL_MS,
  });

  return cached?.notFound === true;
}

async function cacheHistoricalTokenNotFound(chainId: number, address: string) {
  await insertProviderCachedResponse({
    provider: "alchemy",
    endpoint: "/prices/tokens/historical/not-found",
    chainId,
    walletAddress: null,
    cacheKey: buildHistoricalTokenNotFoundCacheKey(chainId, address),
    payload: { notFound: true },
    ttlMs: HISTORICAL_PRICE_TOKEN_NOT_FOUND_TTL_MS,
  });
}

export async function getCurrentTokenPricesByAddress(
  chainId: number,
  addresses: string[],
): Promise<AlchemyPriceByAddressResult> {
  const normalizedAddresses = normalizePriceAddresses(addresses);
  if (normalizedAddresses.length === 0) {
    return { data: [] };
  }

  const requestKey = `${chainId}:${normalizedAddresses.join(",")}`;
  const cachedResponse = readCachedValue(currentPriceResponseCache, requestKey);
  if (cachedResponse) {
    return cachedResponse;
  }

  const { flaggedAddresses, candidateAddresses } = await readCurrentPriceTokenNotFoundFlags(
    chainId,
    normalizedAddresses,
  );
  const flaggedResponseItems = flaggedAddresses.map((address) => buildEmptyCurrentPriceItem(chainId, address));

  if (candidateAddresses.length === 0) {
    const flaggedOnlyResponse = { data: flaggedResponseItems } satisfies AlchemyPriceByAddressResult;
    writeCachedValue(currentPriceResponseCache, requestKey, flaggedOnlyResponse, CURRENT_PRICE_MEMORY_TTL_MS);
    return flaggedOnlyResponse;
  }

  const inFlightResponse = currentPriceInFlight.get(requestKey);
  if (inFlightResponse) {
    return inFlightResponse;
  }

  const persistedResponse = await readProviderCachedResponse<AlchemyPriceByAddressResult>({
    provider: "alchemy",
    endpoint: "/prices/tokens/by-address",
    chainId,
    walletAddress: null,
    cacheKey: requestKey,
    maxAgeMs: CURRENT_PRICE_MEMORY_TTL_MS,
  });

  if (persistedResponse !== null) {
    writeCachedValue(currentPriceResponseCache, requestKey, persistedResponse, CURRENT_PRICE_MEMORY_TTL_MS);
    return persistedResponse;
  }

  const redisClient = getRedisClient();
  const inflightKey = `alchemy-prices:current:${chainId}:${requestKey}`;
  const lockOwner = randomUUID();

  if (redisClient) {
    const lockAcquired = await redisClient.set(inflightKey, lockOwner, {
      nx: true,
      ex: ALCHEMY_PROVIDER_INFLIGHT_TTL_SECONDS,
    });

    if (!lockAcquired) {
      const distributedResponse = await waitForDistributedCachedResponse<AlchemyPriceByAddressResult>({
        provider: "alchemy",
        endpoint: "/prices/tokens/by-address",
        chainId,
        cacheKey: requestKey,
        maxAgeMs: CURRENT_PRICE_MEMORY_TTL_MS,
      });

      if (distributedResponse !== null) {
        writeCachedValue(currentPriceResponseCache, requestKey, distributedResponse, CURRENT_PRICE_MEMORY_TTL_MS);
        return distributedResponse;
      }
    }
  }

  const requestPromise = (async () => {
    if (candidateAddresses.length > MAX_CURRENT_PRICE_ADDRESSES_PER_REQUEST) {
      const combinedResponse = {
        data: [...flaggedResponseItems],
      } satisfies AlchemyPriceByAddressResult;

      for (
        let batchStart = 0;
        batchStart < candidateAddresses.length;
        batchStart += MAX_CURRENT_PRICE_ADDRESSES_PER_REQUEST
      ) {
        const addressBatch = candidateAddresses.slice(
          batchStart,
          batchStart + MAX_CURRENT_PRICE_ADDRESSES_PER_REQUEST,
        );

        const batchResponse = await getCurrentTokenPricesByAddress(chainId, addressBatch);
        combinedResponse.data?.push(...(batchResponse.data ?? []));
      }

      writeCachedValue(currentPriceResponseCache, requestKey, combinedResponse, CURRENT_PRICE_MEMORY_TTL_MS);
      await insertProviderCachedResponse({
        provider: "alchemy",
        endpoint: "/prices/tokens/by-address",
        chainId,
        walletAddress: null,
        cacheKey: requestKey,
        payload: combinedResponse,
        ttlMs: CURRENT_PRICE_MEMORY_TTL_MS,
      });

      return combinedResponse;
    }

    consumeAlchemyBudget();

    const env = getEnv();
    const url = `${PRICES_API_BASE}/${env.ALCHEMY_API_KEY}/tokens/by-address`;
    const tokens: TokenAddressInput[] = candidateAddresses.map((address) => ({
      network: getAlchemyNetwork(chainId),
      address,
    }));

    const parsed = await withProviderRetry({
      provider: "alchemy",
      endpoint: "/prices/tokens/by-address",
      run: async () => {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ addresses: tokens }),
          cache: "no-store",
        });

        if (!response.ok) {
          const body = await response.text();
          throw new Error(`ALCHEMY_PRICES_FAILED:${response.status}:${body}`);
        }

        return (await response.json()) as AlchemyPriceByAddressResult;
      },
    });
    const parsedItems = parsed.data ?? [];

    await Promise.all(
      parsedItems
        .filter((item) => !hasCurrentPrices(item))
        .map((item) => cacheCurrentPriceTokenNotFound(chainId, item.address)),
    );

    const combinedResponse = {
      data: [...flaggedResponseItems, ...parsedItems],
    } satisfies AlchemyPriceByAddressResult;

    writeCachedValue(currentPriceResponseCache, requestKey, combinedResponse, CURRENT_PRICE_MEMORY_TTL_MS);
    await insertProviderCachedResponse({
      provider: "alchemy",
      endpoint: "/prices/tokens/by-address",
      chainId,
      walletAddress: null,
      cacheKey: requestKey,
      payload: combinedResponse,
      ttlMs: CURRENT_PRICE_MEMORY_TTL_MS,
    });

    return combinedResponse;
  })();

  currentPriceInFlight.set(requestKey, requestPromise);

  try {
    return await requestPromise;
  } finally {
    currentPriceInFlight.delete(requestKey);
    if (redisClient) {
      const currentLockOwner = await redisClient.get<string>(inflightKey);
      if (currentLockOwner === lockOwner) {
        await redisClient.del(inflightKey);
      }
    }
  }
}

export async function getHistoricalTokenPricesByAddress(
  chainId: number,
  input: {
    address: string;
    startTime: string;
    endTime: string;
    interval: "1h" | "1d";
  },
): Promise<AlchemyHistoricalPriceResult> {
  const normalizedAddress = input.address.toLowerCase();
  const requestKey = `${chainId}:${normalizedAddress}:${input.startTime}:${input.endTime}:${input.interval}`;
  const cachedResponse = readCachedValue(historicalPriceResponseCache, requestKey);
  if (cachedResponse) {
    return cachedResponse;
  }

  const emptyHistoricalPriceResult = buildEmptyHistoricalPriceResult({
    chainId,
    address: normalizedAddress,
  });

  const tokenNotFoundFlag = await readHistoricalTokenNotFoundFlag(chainId, normalizedAddress);
  if (tokenNotFoundFlag) {
    writeCachedValue(
      historicalPriceResponseCache,
      requestKey,
      emptyHistoricalPriceResult,
      HISTORICAL_PRICE_MEMORY_TTL_MS,
    );
    return emptyHistoricalPriceResult;
  }

  const inFlightResponse = historicalPriceInFlight.get(requestKey);
  if (inFlightResponse) {
    return inFlightResponse;
  }

  const persistedResponse = await readProviderCachedResponse<AlchemyHistoricalPriceResult>({
    provider: "alchemy",
    endpoint: "/prices/tokens/historical",
    chainId,
    walletAddress: null,
    cacheKey: requestKey,
    maxAgeMs: HISTORICAL_PRICE_MEMORY_TTL_MS,
  });

  if (persistedResponse !== null) {
    writeCachedValue(historicalPriceResponseCache, requestKey, persistedResponse, HISTORICAL_PRICE_MEMORY_TTL_MS);
    return persistedResponse;
  }

  const redisClient = getRedisClient();
  const inflightKey = `alchemy-prices:historical:${chainId}:${requestKey}`;
  const lockOwner = randomUUID();

  if (redisClient) {
    const lockAcquired = await redisClient.set(inflightKey, lockOwner, {
      nx: true,
      ex: ALCHEMY_PROVIDER_INFLIGHT_TTL_SECONDS,
    });

    if (!lockAcquired) {
      const distributedResponse = await waitForDistributedCachedResponse<AlchemyHistoricalPriceResult>({
        provider: "alchemy",
        endpoint: "/prices/tokens/historical",
        chainId,
        cacheKey: requestKey,
        maxAgeMs: HISTORICAL_PRICE_MEMORY_TTL_MS,
      });

      if (distributedResponse !== null) {
        writeCachedValue(historicalPriceResponseCache, requestKey, distributedResponse, HISTORICAL_PRICE_MEMORY_TTL_MS);
        return distributedResponse;
      }
    }
  }

  const requestPromise = (async () => {
    consumeAlchemyBudget();

    const env = getEnv();
    const url = `${PRICES_API_BASE}/${env.ALCHEMY_API_KEY}/tokens/historical`;
    const parsed = await withProviderRetry({
      provider: "alchemy",
      endpoint: "/prices/tokens/historical",
      run: async () => {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            network: getAlchemyNetwork(chainId),
            address: normalizedAddress,
            startTime: input.startTime,
            endTime: input.endTime,
            interval: input.interval,
          }),
          cache: "no-store",
        });

        if (!response.ok) {
          const body = await response.text();
          if (isHistoricalTokenNotFoundError(response.status, body)) {
            await cacheHistoricalTokenNotFound(chainId, normalizedAddress);
            writeCachedValue(
              historicalPriceResponseCache,
              requestKey,
              emptyHistoricalPriceResult,
              HISTORICAL_PRICE_MEMORY_TTL_MS,
            );
            await insertProviderCachedResponse({
              provider: "alchemy",
              endpoint: "/prices/tokens/historical",
              chainId,
              walletAddress: null,
              cacheKey: requestKey,
              payload: emptyHistoricalPriceResult,
              ttlMs: HISTORICAL_PRICE_MEMORY_TTL_MS,
            });

            return emptyHistoricalPriceResult;
          }

          throw new Error(`ALCHEMY_HISTORICAL_PRICES_FAILED:${response.status}:${body}`);
        }

        return (await response.json()) as AlchemyHistoricalPriceResult;
      },
    });
    writeCachedValue(historicalPriceResponseCache, requestKey, parsed, HISTORICAL_PRICE_MEMORY_TTL_MS);
    await insertProviderCachedResponse({
      provider: "alchemy",
      endpoint: "/prices/tokens/historical",
      chainId,
      walletAddress: null,
      cacheKey: requestKey,
      payload: parsed,
      ttlMs: HISTORICAL_PRICE_MEMORY_TTL_MS,
    });

    return parsed;
  })();

  historicalPriceInFlight.set(requestKey, requestPromise);

  try {
    return await requestPromise;
  } finally {
    historicalPriceInFlight.delete(requestKey);
    if (redisClient) {
      const currentLockOwner = await redisClient.get<string>(inflightKey);
      if (currentLockOwner === lockOwner) {
        await redisClient.del(inflightKey);
      }
    }
  }
}
