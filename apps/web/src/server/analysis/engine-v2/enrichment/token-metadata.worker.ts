import { engineV2TokenMetadata } from "@/server/db/schema";

export type TokenMetadataResult = {
  tokenAddress: string;
  symbol?: string | null;
  name?: string | null;
  decimals?: number | null;
  category?: string | null;
  verified?: boolean;
  possibleSpam?: boolean;
  rawJson?: Record<string, unknown>;
};

export function toTokenMetadataValues(input: {
  chainId: number;
  metadata: TokenMetadataResult;
}): typeof engineV2TokenMetadata.$inferInsert {
  return {
    chainId: input.chainId,
    tokenAddress: input.metadata.tokenAddress.toLowerCase(),
    symbol: input.metadata.symbol ?? null,
    name: input.metadata.name ?? null,
    decimals: input.metadata.decimals ?? null,
    category: input.metadata.category ?? null,
    verified: input.metadata.verified ?? false,
    possibleSpam: input.metadata.possibleSpam ?? false,
    sourceProvider: "moralis",
    rawJson: input.metadata.rawJson ?? {},
  };
}

export async function persistTokenMetadataBatch(input: {
  db: { insert(table: unknown): { values(value: unknown): { onConflictDoUpdate(input: unknown): Promise<unknown> } } };
  chainId: number;
  metadata: TokenMetadataResult[];
}) {
  if (input.metadata.length === 0) return { persistedCount: 0 };
  await input.db.insert(engineV2TokenMetadata)
    .values(input.metadata.map((metadata) => toTokenMetadataValues({ chainId: input.chainId, metadata })))
    .onConflictDoUpdate({
      target: [engineV2TokenMetadata.chainId, engineV2TokenMetadata.tokenAddress],
      set: { updatedAt: new Date() },
    });

  return { persistedCount: input.metadata.length };
}

