import { engineV2ProtocolStateSnapshots } from "@/server/db/schema";

export function poolDefinitionSnapshot(input: {
  chainId: number;
  poolAddress: string;
  blockNumber?: string | null;
  token0?: string | null;
  token1?: string | null;
  tickSpacing?: number | null;
  feeTier?: string | null;
  sourceProvider?: string;
  evidenceJson?: Record<string, unknown>;
}): typeof engineV2ProtocolStateSnapshots.$inferInsert {
  return {
    chainId: input.chainId,
    protocol: "aerodrome",
    subjectType: "pool",
    subjectAddress: input.poolAddress.toLowerCase(),
    subjectId: null,
    blockNumber: input.blockNumber ?? null,
    sourceProvider: input.sourceProvider ?? "alchemy_eth_call",
    stateJson: {
      token0: input.token0?.toLowerCase() ?? null,
      token1: input.token1?.toLowerCase() ?? null,
      tickSpacing: input.tickSpacing ?? null,
      feeTier: input.feeTier ?? null,
    },
    evidenceJson: input.evidenceJson ?? {},
  };
}

