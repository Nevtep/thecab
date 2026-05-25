import { randomUUID } from "node:crypto";

import { getRedisClient } from "@/server/cache/redis";
import { getMoralisChain } from "@/server/chains";
import { getEnv } from "@/server/env";
import {
  insertProviderCachedResponse,
  readProviderCachedResponse,
} from "@/server/providers/provider-cache.repository";
import { withProviderRetry } from "@/server/providers/providerErrors";

const BASE_URL = "https://deep-index.moralis.io/api/v2.2";
const MORALIS_DEFAULT_CACHE_TTL_MS = 60 * 60 * 1000;
const MORALIS_CURRENT_ASSETS_CACHE_TTL_MS = 30 * 1000;
const MORALIS_INFLIGHT_TTL_SECONDS = 20;
const MORALIS_WAIT_TIMEOUT_MS = 20 * 1000;
const MORALIS_WAIT_INTERVAL_MS = 250;

type MoralisCachePolicy = {
  ttlMs: number;
  persistToDb: boolean;
};

type TimedCacheEntry<T> = {
  expiresAt: number;
  value: T;
};

type MoralisQuery = Record<string, string | number | boolean | undefined>;

const moralisMemoryCache = new Map<string, TimedCacheEntry<unknown>>();
const moralisInFlight = new Map<string, Promise<unknown>>();

function buildUrl(path: string, query: MoralisQuery = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    params.set(key, String(value));
  }

  const search = params.toString();
  return `${BASE_URL}${path}${search ? `?${search}` : ""}`;
}

function getMoralisCachePolicy(path: string): MoralisCachePolicy {
  const normalizedPath = path.toLowerCase();

  if (normalizedPath.includes("/tokens") || normalizedPath.includes("/nft")) {
    return {
      ttlMs: MORALIS_CURRENT_ASSETS_CACHE_TTL_MS,
      persistToDb: true,
    };
  }

  return {
    ttlMs: MORALIS_DEFAULT_CACHE_TTL_MS,
    persistToDb: true,
  };
}

function getMemoryCachedResponse<T>(cacheKey: string): T | null {
  const cachedEntry = moralisMemoryCache.get(cacheKey);
  if (!cachedEntry) {
    return null;
  }

  if (cachedEntry.expiresAt <= Date.now()) {
    moralisMemoryCache.delete(cacheKey);
    return null;
  }

  return cachedEntry.value as T;
}

function setMemoryCachedResponse(cacheKey: string, value: unknown, ttlMs: number) {
  moralisMemoryCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + Math.max(0, ttlMs),
  });
}

function waitForDuration(durationMs: number) {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

function extractWalletAddressFromPath(path: string): string | null {
  const walletAddressMatch = path.match(/\/wallets\/(0x[a-fA-F0-9]{40})(?:\/|$)/);
  if (!walletAddressMatch) {
    return null;
  }

  return walletAddressMatch[1]?.toLowerCase() ?? null;
}

export async function moralisGet<T>(
  path: string,
  chainId: number,
  query: MoralisQuery = {},
): Promise<T> {
  const cachePolicy = getMoralisCachePolicy(path);
  const env = getEnv();
  const url = buildUrl(path, {
    ...query,
    chain: getMoralisChain(chainId),
  });
  const cacheKey = `${chainId}:${url}`;

  if (cachePolicy.ttlMs > 0) {
    const memoryCachedResponse = getMemoryCachedResponse<T>(cacheKey);
    if (memoryCachedResponse !== null) {
      return memoryCachedResponse;
    }

    const inFlightRequest = moralisInFlight.get(cacheKey);
    if (inFlightRequest) {
      return inFlightRequest as Promise<T>;
    }

    if (cachePolicy.persistToDb) {
      const dbCachedResponse = await readProviderCachedResponse<T>({
        provider: "moralis",
        endpoint: path,
        chainId,
        walletAddress: extractWalletAddressFromPath(path),
        cacheKey,
        maxAgeMs: cachePolicy.ttlMs,
      });

      if (dbCachedResponse !== null) {
        setMemoryCachedResponse(cacheKey, dbCachedResponse, cachePolicy.ttlMs);
        return dbCachedResponse;
      }
    }
  }

  const redisClient = cachePolicy.ttlMs > 0 ? getRedisClient() : null;
  const inflightKey = cachePolicy.ttlMs > 0 ? `moralis:inflight:${chainId}:${cacheKey}` : null;
  const lockOwner = inflightKey ? randomUUID() : null;

  if (cachePolicy.ttlMs > 0 && cachePolicy.persistToDb && redisClient && inflightKey && lockOwner) {
    const lockAcquired = await redisClient.set(inflightKey, lockOwner, {
      nx: true,
      ex: MORALIS_INFLIGHT_TTL_SECONDS,
    });

    if (!lockAcquired) {
      const waitStartedAt = Date.now();
      while (Date.now() - waitStartedAt < MORALIS_WAIT_TIMEOUT_MS) {
        const cachedResponse = await readProviderCachedResponse<T>({
          provider: "moralis",
          endpoint: path,
          chainId,
          walletAddress: extractWalletAddressFromPath(path),
          cacheKey,
          maxAgeMs: cachePolicy.ttlMs,
        });

        if (cachedResponse !== null) {
          setMemoryCachedResponse(cacheKey, cachedResponse, cachePolicy.ttlMs);
          return cachedResponse;
        }

        await waitForDuration(MORALIS_WAIT_INTERVAL_MS);
      }
    }
  }

  const requestPromise = (async () => {
    const parsed = await withProviderRetry({
      provider: "moralis",
      endpoint: path,
      run: async () => {
        const response = await fetch(url, {
          method: "GET",
          headers: {
            accept: "application/json",
            "X-API-Key": env.MORALIS_API_KEY,
          },
          cache: "no-store",
        });

        if (!response.ok) {
          const body = await response.text();
          throw new Error(`MORALIS_REQUEST_FAILED:${response.status}:${body}`);
        }

        return (await response.json()) as T;
      },
    });

    if (cachePolicy.ttlMs > 0) {
      setMemoryCachedResponse(cacheKey, parsed, cachePolicy.ttlMs);

      if (cachePolicy.persistToDb) {
        await insertProviderCachedResponse({
          provider: "moralis",
          endpoint: path,
          chainId,
          walletAddress: extractWalletAddressFromPath(path),
          cacheKey,
          payload: parsed,
            ttlMs: cachePolicy.ttlMs,
        });
      }
    }

    return parsed;
  })();

  if (cachePolicy.ttlMs > 0) {
    moralisInFlight.set(cacheKey, requestPromise as Promise<unknown>);
  }

  try {
    return await requestPromise;
  } finally {
    if (cachePolicy.ttlMs > 0) {
      moralisInFlight.delete(cacheKey);
    }

    if (cachePolicy.ttlMs > 0 && redisClient && inflightKey && lockOwner) {
      const currentLockOwner = await redisClient.get<string>(inflightKey);
      if (currentLockOwner === lockOwner) {
        await redisClient.del(inflightKey);
      }
    }
  }
}
