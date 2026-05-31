import { createHash } from "node:crypto";

import { and, desc, eq, gte, isNull } from "drizzle-orm";

import { getRedisClient } from "@/server/cache/redis";
import { getDb } from "@/server/db/client";
import { rawProviderRecords } from "@/server/db/schema";
import {
  buildRawProviderRequestHash,
  insertRawProviderRecord,
} from "@/server/providers/raw-provider-records.repository";

const PROVIDER_CACHE_PREFIX = "provider-cache:v1";
type ProviderCacheReadOrder = "redis-first" | "db-first";

function buildProviderCacheStorageKey(input: {
  provider: string;
  endpoint: string;
  chainId: number;
  walletAddress: string | null;
  cacheKey: string;
}) {
  const keyMaterial = [
    input.provider,
    input.endpoint,
    String(input.chainId),
    input.walletAddress?.toLowerCase() ?? "global",
    input.cacheKey,
  ].join("|");
  const keyHash = createHash("sha256").update(keyMaterial).digest("hex");

  return `${PROVIDER_CACHE_PREFIX}:${input.provider}:${input.chainId}:${keyHash}`;
}

export async function readProviderCachedResponse<T>(input: {
  provider: string;
  endpoint: string;
  chainId: number;
  walletAddress: string | null;
  cacheKey: string;
  maxAgeMs: number | null;
  readOrder?: ProviderCacheReadOrder;
}) {
  const storageKey = buildProviderCacheStorageKey(input);
  const requestHash = buildRawProviderRequestHash({
    provider: input.provider,
    endpoint: input.endpoint,
    chainId: input.chainId,
    walletAddress: input.walletAddress,
    requestJson: {
      cacheKey: input.cacheKey,
    },
  });
  const redisClient = getRedisClient();
  const readRedisPayload = async () => {
    if (!redisClient) {
      return null;
    }
    return redisClient.get<T>(storageKey);
  };
  const writeRedisPayload = async (payload: T) => {
    if (!redisClient) {
      return;
    }
    if (input.maxAgeMs === null) {
      await redisClient.set(storageKey, payload);
      return;
    }
    if (input.maxAgeMs > 0) {
      await redisClient.set(storageKey, payload, {
        ex: Math.max(1, Math.ceil(input.maxAgeMs / 1000)),
      });
    }
  };

  if ((input.readOrder ?? "redis-first") === "redis-first") {
    const redisPayload = await readRedisPayload();
    if (redisPayload !== null) {
      return redisPayload;
    }
  }

  const db = getDb();
  const walletPredicate = input.walletAddress
    ? eq(rawProviderRecords.walletAddress, input.walletAddress.toLowerCase())
    : isNull(rawProviderRecords.walletAddress);
  const filters = [
    eq(rawProviderRecords.provider, input.provider),
    eq(rawProviderRecords.endpoint, input.endpoint),
    eq(rawProviderRecords.chainId, input.chainId),
    walletPredicate,
    eq(rawProviderRecords.requestHash, requestHash),
  ];
  if (input.maxAgeMs !== null) {
    filters.push(gte(rawProviderRecords.createdAt, new Date(Date.now() - Math.max(0, input.maxAgeMs))));
  }
  const rows = await db
    .select({
      responseJson: rawProviderRecords.responseJson,
    })
    .from(rawProviderRecords)
    .where(and(...filters))
    .orderBy(desc(rawProviderRecords.createdAt))
    .limit(1);

  const payload = rows[0]?.responseJson?.payload;
  if (payload === undefined) {
    if ((input.readOrder ?? "redis-first") === "db-first") {
      const redisPayload = await readRedisPayload();
      if (redisPayload !== null) {
        return redisPayload;
      }
    }
    return null;
  }

  const parsedPayload = payload as T;

  await writeRedisPayload(parsedPayload);

  return parsedPayload;
}

export async function insertProviderCachedResponse(input: {
  provider: string;
  endpoint: string;
  chainId: number;
  walletAddress: string | null;
  cacheKey: string;
  payload: unknown;
  ttlMs: number | null;
}) {
  const storageKey = buildProviderCacheStorageKey(input);
  const redisClient = getRedisClient();
  if (redisClient) {
    if (input.ttlMs === null) {
      await redisClient.set(storageKey, input.payload);
    } else if (input.ttlMs > 0) {
      await redisClient.set(storageKey, input.payload, {
        ex: Math.max(1, Math.ceil(input.ttlMs / 1000)),
      });
    }
  }

  return insertRawProviderRecord({
    provider: input.provider,
    endpoint: input.endpoint,
    chainId: input.chainId,
    walletAddress: input.walletAddress,
    requestJson: {
      cacheKey: input.cacheKey,
    },
    responseJson: {
      payload: input.payload,
    },
    confidence: "high",
  });
}
