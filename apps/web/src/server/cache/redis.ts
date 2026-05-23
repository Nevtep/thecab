import { Redis } from "@upstash/redis";

import { getEnv } from "@/server/env";

let redisClient: Redis | null | undefined;

function resolveRedisConfig() {
  const env = getEnv();
  const url =
    env.UPSTASH_REDIS_REST_URL ??
    env.KV_REST_API_URL ??
    env.UPSTASH_REDIS_REST_KV_REST_API_URL ??
    null;
  const token =
    env.UPSTASH_REDIS_REST_TOKEN ??
    env.KV_REST_API_TOKEN ??
    env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN ??
    null;

  if (!url || !token) {
    return null;
  }

  return { url, token };
}

export function getRedisClient() {
  if (redisClient !== undefined) {
    return redisClient;
  }

  const config = resolveRedisConfig();
  if (!config) {
    redisClient = null;
    return redisClient;
  }

  redisClient = new Redis(config);
  return redisClient;
}