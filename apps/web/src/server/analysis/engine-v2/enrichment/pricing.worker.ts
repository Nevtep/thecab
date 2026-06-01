import { engineV2PricePoints } from "@/server/db/schema";

export function toPricePointValues(input: {
  chainId: number;
  tokenAddress: string;
  pricedAt?: Date | null;
  blockNumber?: string | null;
  priceUsd?: string | null;
  sourceProvider: "alchemy" | "moralis";
  resolution: "historical" | "current";
  status?: "resolved" | "unavailable" | "diverged";
  metadataJson?: Record<string, unknown>;
}): typeof engineV2PricePoints.$inferInsert {
  return {
    chainId: input.chainId,
    tokenAddress: input.tokenAddress.toLowerCase(),
    pricedAt: input.pricedAt ?? null,
    blockNumber: input.blockNumber ?? null,
    priceUsd: input.priceUsd ?? null,
    sourceProvider: input.sourceProvider,
    resolution: input.resolution,
    status: input.status ?? (input.priceUsd ? "resolved" : "unavailable"),
    metadataJson: input.metadataJson ?? {},
  };
}

export function compareProviderPrices(input: { primaryUsd?: number | null; validationUsd?: number | null; toleranceBps?: number }) {
  if (input.primaryUsd == null || input.validationUsd == null) return { status: "unavailable" as const, reasonCodes: ["missing_historical_price"] };
  const tolerance = (input.toleranceBps ?? 100) / 10_000;
  const diff = Math.abs(input.primaryUsd - input.validationUsd) / Math.max(input.primaryUsd, 1);
  if (diff > tolerance) return { status: "diverged" as const, reasonCodes: ["provider_price_divergence"] };
  return { status: "resolved" as const, reasonCodes: [] };
}

