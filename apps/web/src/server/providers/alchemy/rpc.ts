import { createHash, randomUUID } from "node:crypto";

import { SUPPORTED_CHAIN_ID } from "@/server/chains";
import { getRedisClient } from "@/server/cache/redis";
import { getEnv } from "@/server/env";
import {
  insertProviderCachedResponse,
  readProviderCachedResponse,
} from "@/server/providers/provider-cache.repository";

type JsonRpcPayload = {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params: unknown[];
};

type JsonRpcResponse<T> = {
  id: number;
  jsonrpc: "2.0";
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
};

const ALCHEMY_RPC_CACHE_TTL_MS = 5 * 60 * 1000;
const ALCHEMY_RPC_STABLE_LOOKUP_ETH_CALL_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const ALCHEMY_RPC_STABLE_ETH_CALL_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ALCHEMY_RPC_INFLIGHT_TTL_SECONDS = 20;
const ALCHEMY_RPC_WAIT_TIMEOUT_MS = 20 * 1000;
const ALCHEMY_RPC_WAIT_INTERVAL_MS = 250;
const IMMUTABLE_ETH_CALL_SELECTORS = new Set([
  "0x16f0115b",
  "0xc45a0155",
  "0x0dfe1681",
  "0xd21220a7",
  "0x95d89b41",
  "0x313ce567",
]);
const STABLE_LOOKUP_ETH_CALL_SELECTORS = new Set([
  "0x28af8d0b",
]);

type TimedCacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const alchemyRpcMemoryCache = new Map<string, TimedCacheEntry<unknown>>();
const alchemyRpcInFlight = new Map<string, Promise<unknown>>();

function buildRpcCacheKey(method: string, params: unknown[], chainId: number) {
  console.log("Building cache key for RPC method:", method, "with params:", params, "on chainId:", chainId);
  return createHash("sha256")
    .update(JSON.stringify({ method, params, chainId }))
    .digest("hex");
}

function getMemoryCachedResponse<T>(cacheKey: string): T | null {
  const cachedEntry = alchemyRpcMemoryCache.get(cacheKey);
  if (!cachedEntry) {
    return null;
  }

  if (cachedEntry.expiresAt <= Date.now()) {
    alchemyRpcMemoryCache.delete(cacheKey);
    return null;
  }

  return cachedEntry.value as T;
}

function setMemoryCachedResponse(cacheKey: string, value: unknown, ttlMs: number) {
  alchemyRpcMemoryCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + Math.max(0, ttlMs),
  });
}

function waitForDuration(durationMs: number) {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

function getEthCallSelector(params: unknown[]) {
  const call = params[0];
  if (!call || typeof call !== "object" || !("data" in call)) {
    return null;
  }

  const data = call.data;
  if (typeof data !== "string" || !data.startsWith("0x") || data.length < 10) {
    return null;
  }

  return data.slice(0, 10).toLowerCase();
}

function resolveRpcCacheTtlMs(method: string, params: unknown[]) {
  if (method !== "eth_call") {
    return ALCHEMY_RPC_CACHE_TTL_MS;
  }

  const selector = getEthCallSelector(params);
  if (selector && IMMUTABLE_ETH_CALL_SELECTORS.has(selector)) {
    return ALCHEMY_RPC_STABLE_ETH_CALL_CACHE_TTL_MS;
  }

  if (selector && STABLE_LOOKUP_ETH_CALL_SELECTORS.has(selector)) {
    return ALCHEMY_RPC_STABLE_LOOKUP_ETH_CALL_CACHE_TTL_MS;
  }

  return ALCHEMY_RPC_CACHE_TTL_MS;
}

export async function alchemyRpc<T>(
  method: string,
  params: unknown[] = [],
  options?: { chainId?: number },
): Promise<T> {
  const chainId = options?.chainId ?? SUPPORTED_CHAIN_ID;
  const cacheKey = buildRpcCacheKey(method, params, chainId);
  const cacheTtlMs = resolveRpcCacheTtlMs(method, params);
  const memoryCachedResponse = getMemoryCachedResponse<T>(cacheKey);
  if (memoryCachedResponse !== null) {
    return memoryCachedResponse;
  }

  const inFlightResponse = alchemyRpcInFlight.get(cacheKey);
  if (inFlightResponse) {
    return inFlightResponse as Promise<T>;
  }

  const dbCachedResponse = await readProviderCachedResponse<T>({
    provider: "alchemy",
    endpoint: `/rpc/${method}`,
    chainId,
    walletAddress: null,
    cacheKey,
    maxAgeMs: cacheTtlMs,
  });

  if (dbCachedResponse !== null) {
    setMemoryCachedResponse(cacheKey, dbCachedResponse, cacheTtlMs);
    return dbCachedResponse;
  }

  const redisClient = getRedisClient();
  const inflightKey = `alchemy-rpc:inflight:${chainId}:${cacheKey}`;
  const lockOwner = randomUUID();

  if (redisClient) {
    const lockAcquired = await redisClient.set(inflightKey, lockOwner, {
      nx: true,
      ex: ALCHEMY_RPC_INFLIGHT_TTL_SECONDS,
    });

    if (!lockAcquired) {
      const waitStartedAt = Date.now();
      while (Date.now() - waitStartedAt < ALCHEMY_RPC_WAIT_TIMEOUT_MS) {
        const cachedResponse = await readProviderCachedResponse<T>({
          provider: "alchemy",
          endpoint: `/rpc/${method}`,
          chainId,
          walletAddress: null,
          cacheKey,
          maxAgeMs: cacheTtlMs,
        });

        if (cachedResponse !== null) {
          setMemoryCachedResponse(cacheKey, cachedResponse, cacheTtlMs);
          return cachedResponse;
        }

        await waitForDuration(ALCHEMY_RPC_WAIT_INTERVAL_MS);
      }
    }
  }

  const env = getEnv();
  const requestPromise = (async () => {
    const payload: JsonRpcPayload = {
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params,
    };

    const response = await fetch(env.ALCHEMY_BASE_RPC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`ALCHEMY_RPC_HTTP_FAILED:${response.status}:${body}`);
    }

    const json = (await response.json()) as JsonRpcResponse<T>;
    if (json.error) {
      throw new Error(`ALCHEMY_RPC_FAILED:${json.error.code}:${json.error.message}`);
    }

    const result = json.result as T;
    setMemoryCachedResponse(cacheKey, result, cacheTtlMs);
    await insertProviderCachedResponse({
      provider: "alchemy",
      endpoint: `/rpc/${method}`,
      chainId,
      walletAddress: null,
      cacheKey,
      payload: result,
      ttlMs: cacheTtlMs,
    });

    return result;
  })();

  alchemyRpcInFlight.set(cacheKey, requestPromise as Promise<unknown>);

  try {
    return await requestPromise;
  } finally {
    alchemyRpcInFlight.delete(cacheKey);
    if (redisClient) {
      const currentLockOwner = await redisClient.get<string>(inflightKey);
      if (currentLockOwner === lockOwner) {
        await redisClient.del(inflightKey);
      }
    }
  }
}
