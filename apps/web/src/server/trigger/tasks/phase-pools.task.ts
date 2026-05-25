import { task } from "@trigger.dev/sdk/v3";

import { getAnalysisRunById } from "@/server/analysis/analysis-run.repository";
import { persistPoolSnapshots } from "@/server/analysis/enginePersistence";
import { syncAerodromeMetadata } from "@/server/protocols/aerodrome/syncAerodromeMetadata";
import { syncMellowStrategies } from "@/server/protocols/mellow/syncMellowStrategies";

export type PhasePoolsTaskPayload = {
  runId: string;
  walletAddress: string;
  chainId: number;
};

export const phasePoolsTask = task({
  id: "phase-pools",
  run: async (payload: PhasePoolsTaskPayload) => {
    const run = await getAnalysisRunById(payload.runId);
    if (!run || run.status === "cancelled") {
      return { poolCount: 0 };
    }

    const poolTotals = Array.isArray(run.metadataJson.latestPoolTotals)
      ? run.metadataJson.latestPoolTotals
      : [];
    const dayUtc = run.utcDayBucket;
    const normalizedPoolTotals = poolTotals
      .filter((item): item is { poolId: string; valueUsd: number } => typeof item === "object" && item !== null)
      .map((item) => ({
        poolId: String(item.poolId),
        valueUsd: Number(item.valueUsd ?? 0),
      }));
    const [poolCount, aerodromeMetadata, mellowMetadata] = await Promise.all([
      persistPoolSnapshots({
        chainId: payload.chainId,
        dayUtc,
        poolTotals: normalizedPoolTotals,
      }),
      syncAerodromeMetadata({
        chainId: payload.chainId,
        walletAddress: payload.walletAddress,
      }),
      syncMellowStrategies({
        chainId: payload.chainId,
      }),
    ]);

    return {
      poolCount,
      aerodromeMetadata,
      mellowMetadata,
    };
  },
});