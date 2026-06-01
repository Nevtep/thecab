import { z } from "zod";

export const engineV2WalletPayloadSchema = z.object({
  analysisRunId: z.string().uuid().optional(),
  chainId: z.number().int().positive(),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).transform((value) => value.toLowerCase()),
  mode: z.enum(["fresh", "incremental", "reanalysis", "fixture", "full_history"])
    .default("fresh")
    .transform((value) => value === "full_history" ? "fresh" : value),
  collectionRunId: z.string().uuid().optional(),
});

export const engineV2CollectionPagePayloadSchema = engineV2WalletPayloadSchema.extend({
  collectionRunId: z.string().uuid().optional(),
  cursor: z.string().nullish(),
  pageIndex: z.number().int().nonnegative().default(0),
});

export const engineV2EnrichmentBatchPayloadSchema = engineV2WalletPayloadSchema.extend({
  needTypes: z.array(z.string()).optional(),
  limit: z.number().int().positive().max(100).default(25),
});

export const engineV2MaterializationPayloadSchema = engineV2WalletPayloadSchema.extend({
  rowsAlreadyPersisted: z.boolean().default(false),
});

export type EngineV2WalletPayload = z.infer<typeof engineV2WalletPayloadSchema>;
export type EngineV2CollectionPagePayload = z.infer<typeof engineV2CollectionPagePayloadSchema>;
export type EngineV2EnrichmentBatchPayload = z.infer<typeof engineV2EnrichmentBatchPayloadSchema>;
export type EngineV2MaterializationPayload = z.infer<typeof engineV2MaterializationPayloadSchema>;
