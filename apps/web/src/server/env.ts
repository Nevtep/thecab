import { z } from "zod";

const envSchema = z.object({
  CAB_WALLET_AUTH_MODE: z.enum(["PROD", "DEBUG"]).optional(),
  DEBUG_WALLET_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  NEXT_PUBLIC_CAB_WALLET_AUTH_MODE: z.enum(["PROD", "DEBUG"]).optional(),
  NEXT_PUBLIC_DEBUG_WALLET_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  NEXT_PUBLIC_SUPPORTED_CHAIN_ID: z.coerce.number().default(8453),
  MORALIS_API_KEY: z.string().min(1),
  ALCHEMY_API_KEY: z.string().min(1),
  ALCHEMY_BASE_RPC_URL: z.string().url(),
  BASESCAN_API_KEY: z.string().min(1).optional(),
  ETHERSCAN_API_KEY: z.string().min(1).optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  KV_REST_API_URL: z.string().url().optional(),
  KV_REST_API_TOKEN: z.string().min(1).optional(),
  UPSTASH_REDIS_REST_KV_REST_API_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_KV_REST_API_TOKEN: z.string().min(1).optional(),
  DATABASE_URL: z.string().min(1),
  TRIGGER_SECRET_KEY: z.string().min(1),
  TRIGGER_API_URL: z.string().url().default("https://api.trigger.dev"),
  TRIGGER_PROJECT_REF: z.string().min(1).optional(),
  TRIGGER_QUEUE_MORALIS_CONCURRENCY: z.coerce.number().int().positive().default(4),
  TRIGGER_QUEUE_ALCHEMY_PRICES_CONCURRENCY: z.coerce.number().int().positive().default(3),
  TRIGGER_QUEUE_ALCHEMY_RPC_CONCURRENCY: z.coerce.number().int().positive().default(6),
  ANALYSIS_MIN_HISTORY_WINDOW_HOURS: z.coerce.number().int().positive().default(1),
  ANALYSIS_SLICE_CONCURRENCY: z.coerce.number().int().positive().default(2),
  ANALYSIS_REBALANCE_WINDOW_HOURS: z.coerce.number().int().positive().default(24),
  ANALYSIS_REORG_SOFT_BLOCKS: z.coerce.number().int().positive().default(32),
  ANALYSIS_STATUS_STALE_DAYS: z.coerce.number().int().positive().default(7),
  ANALYSIS_SUPPLEMENTAL_EXPLORER_EVIDENCE: z.enum(["disabled", "cache_only", "live"]).default("cache_only"),
});

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cachedEnv) return cachedEnv;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`ENV_VALIDATION_ERROR: ${details}`);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}
