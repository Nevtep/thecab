import { engineV2ProtocolStateSnapshots } from "@/server/db/schema";

export function strategyStateSnapshot(input: {
  chainId: number;
  wrapperAddress: string;
  strategyExposureId?: string | null;
  blockNumber?: string | null;
  shareTokenAddress?: string | null;
  underlyingPoolAddress?: string | null;
  currentSharesRaw?: string | null;
  token0Address?: string | null;
  token1Address?: string | null;
  token0AmountRaw?: string | null;
  token1AmountRaw?: string | null;
  currentEstimatedValueUsd?: string | null;
  sourceProvider?: string;
  evidenceJson?: Record<string, unknown>;
}): typeof engineV2ProtocolStateSnapshots.$inferInsert {
  return {
    chainId: input.chainId,
    protocol: "mellow",
    subjectType: "strategy",
    subjectAddress: input.wrapperAddress.toLowerCase(),
    subjectId: input.strategyExposureId ?? null,
    blockNumber: input.blockNumber ?? null,
    sourceProvider: input.sourceProvider ?? "alchemy_eth_call",
    stateJson: {
      shareTokenAddress: input.shareTokenAddress?.toLowerCase() ?? null,
      underlyingPoolAddress: input.underlyingPoolAddress?.toLowerCase() ?? null,
      currentSharesRaw: input.currentSharesRaw ?? null,
      token0Address: input.token0Address?.toLowerCase() ?? null,
      token1Address: input.token1Address?.toLowerCase() ?? null,
      token0AmountRaw: input.token0AmountRaw ?? null,
      token1AmountRaw: input.token1AmountRaw ?? null,
      currentEstimatedValueUsd: input.currentEstimatedValueUsd ?? null,
    },
    evidenceJson: {
      currentStateOnly: true,
      cannotCreateHistoricalOwnership: true,
      ...input.evidenceJson,
    },
  };
}

