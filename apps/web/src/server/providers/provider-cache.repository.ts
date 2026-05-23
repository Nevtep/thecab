import { createHash } from "node:crypto";

import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";

import { getRedisClient } from "@/server/cache/redis";
import { getDb } from "@/server/db/client";
import { rawProviderRecords } from "@/server/db/schema";

const PROVIDER_CACHE_PREFIX = "provider-cache:v1";

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
  maxAgeMs: number;
}) {
  const storageKey = buildProviderCacheStorageKey(input);
  const redisClient = getRedisClient();
  if (redisClient) {
    const redisPayload = await redisClient.get<T>(storageKey);
    if (redisPayload !== null) {
      return redisPayload;
    }
  }

  const db = getDb();
  const minimumCreatedAt = new Date(Date.now() - Math.max(0, input.maxAgeMs));
  const walletPredicate = input.walletAddress
    ? eq(rawProviderRecords.walletAddress, input.walletAddress.toLowerCase())
    : isNull(rawProviderRecords.walletAddress);
  const rows = await db
    .select({
      responseJson: rawProviderRecords.responseJson,
    })
    .from(rawProviderRecords)
    .where(
      and(
        eq(rawProviderRecords.provider, input.provider),
        eq(rawProviderRecords.endpoint, input.endpoint),
        eq(rawProviderRecords.chainId, input.chainId),
        walletPredicate,
        gte(rawProviderRecords.createdAt, minimumCreatedAt),
        sql`(${rawProviderRecords.requestJson} ->> 'cacheKey') = ${input.cacheKey}`,
      ),
    )
    .orderBy(desc(rawProviderRecords.createdAt))
    .limit(1);

  const payload = rows[0]?.responseJson?.payload;
  if (payload === undefined) {
    return null;
  }

  const parsedPayload = payload as T;

  if (redisClient && input.maxAgeMs > 0) {
    await redisClient.set(storageKey, parsedPayload, {
      ex: Math.max(1, Math.ceil(input.maxAgeMs / 1000)),
    });
  }

  return parsedPayload;
}

export async function insertProviderCachedResponse(input: {
  provider: string;
  endpoint: string;
  chainId: number;
  walletAddress: string | null;
  cacheKey: string;
  payload: unknown;
  ttlMs: number;
}) {
  const storageKey = buildProviderCacheStorageKey(input);
  const redisClient = getRedisClient();
  if (redisClient && input.ttlMs > 0) {
    await redisClient.set(storageKey, input.payload, {
      ex: Math.max(1, Math.ceil(input.ttlMs / 1000)),
    });
  }

  const db = getDb();
  const [row] = await db
    .insert(rawProviderRecords)
    .values({
      provider: input.provider,
      endpoint: input.endpoint,
      chainId: input.chainId,
      walletAddress: input.walletAddress?.toLowerCase() ?? null,
      requestJson: {
        cacheKey: input.cacheKey,
      },
      responseJson: {
        payload: input.payload,
      },
      confidence: "high",
    })
    .returning();

  return row;
}