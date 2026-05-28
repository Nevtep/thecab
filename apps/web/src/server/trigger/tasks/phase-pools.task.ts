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

type PhasePoolsTaskDeps = {
  getAnalysisRunById: (runId: string) => Promise<{
    status: string;
    utcDayBucket: string;
    metadataJson: {
      latestPoolTotals?: unknown;
    };
  } | null>;
  persistPoolSnapshots: (input: {
    chainId: number;
    dayUtc: string;
    poolTotals: Array<{
      poolId: string;
      valueUsd: number;
    }>;
  }) => Promise<number>;
  syncAerodromeMetadata: (input: {
    chainId: number;
    walletAddress: string;
  }) => Promise<unknown>;
  syncMellowStrategies: (input: {
    chainId: number;
  }) => Promise<unknown>;
};

function getPhasePoolsTaskDeps(): PhasePoolsTaskDeps {
  return {
    getAnalysisRunById,
    persistPoolSnapshots,
    syncAerodromeMetadata,
    syncMellowStrategies,
  };
}

export function normalizeLatestPoolTotals(poolTotals: unknown) {
  const items = Array.isArray(poolTotals) ? poolTotals : [];

  return items
    .filter((item): item is { poolId: string; valueUsd: number } => typeof item === "object" && item !== null)
    .map((item) => ({
      poolId: String(item.poolId),
      valueUsd: Number(item.valueUsd ?? 0),
    }));
}

export async function runPhasePoolsTask(
  payload: PhasePoolsTaskPayload,
  deps: PhasePoolsTaskDeps = getPhasePoolsTaskDeps(),
) {
  const run = await deps.getAnalysisRunById(payload.runId);
  if (!run || run.status === "cancelled") {
    return { poolCount: 0 };
  }

  const dayUtc = run.utcDayBucket;
  const normalizedPoolTotals = normalizeLatestPoolTotals(run.metadataJson.latestPoolTotals);
  const [poolCount, aerodromeMetadata, mellowMetadata] = await Promise.all([
    deps.persistPoolSnapshots({
      chainId: payload.chainId,
      dayUtc,
      poolTotals: normalizedPoolTotals,
    }),
    deps.syncAerodromeMetadata({
      chainId: payload.chainId,
      walletAddress: payload.walletAddress,
    }),
    deps.syncMellowStrategies({
      chainId: payload.chainId,
    }),
  ]);

  return {
    poolCount,
    aerodromeMetadata,
    mellowMetadata,
  };
}

export const phasePoolsTask = task({
  id: "phase-pools",
  run: async (payload: PhasePoolsTaskPayload) => runPhasePoolsTask(payload),
});