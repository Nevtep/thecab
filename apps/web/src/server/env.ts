import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPPORTED_CHAIN_ID: z.coerce.number().default(8453),
  MORALIS_API_KEY: z.string().min(1),
  ALCHEMY_API_KEY: z.string().min(1),
  ALCHEMY_BASE_RPC_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  TRIGGER_SECRET_KEY: z.string().min(1),
  TRIGGER_API_URL: z.string().url().default("https://api.trigger.dev"),
  ANALYSIS_DEFAULT_MODE: z.enum(["full_history", "incremental"]).default("full_history"),
  ANALYSIS_HISTORY_DAYS: z.coerce.number().int().positive().default(365),
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
