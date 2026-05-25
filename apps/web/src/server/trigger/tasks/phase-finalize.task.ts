import { task } from "@trigger.dev/sdk/v3";

import {
  finalizeAnalysisRun,
  getAnalysisRunById,
  readRunSliceCoverage,
} from "@/server/analysis/analysis-run.repository";
import { listRunSlices } from "@/server/analysis/analysis-slice.repository";
import { computeSnapshots } from "@/server/analysis/computeSnapshots";
import { upsertProcessingCursor } from "@/server/analysis/processing-cursor.repository";
import { upsertOverviewFreshness } from "@/server/overview/overview.repository";

export type PhaseFinalizeTaskPayload = {
  runId: string;
  walletAddress: string;
  chainId: number;
};

export const phaseFinalizeTask = task({
  id: "phase-finalize",
  run: async (payload: PhaseFinalizeTaskPayload) => {
    const run = await getAnalysisRunById(payload.runId);
    if (!run) {
      throw new Error(`ANALYSIS_RUN_NOT_FOUND:${payload.runId}`);
    }

    if (run.status === "cancelled") {
      return { cancelled: true };
    }

    const capturedAt = new Date();
    const slices = await listRunSlices(payload.runId);
    const snapshot = await computeSnapshots({
      walletAddress: payload.walletAddress,
      chainId: payload.chainId,
      startDayUtc: slices[0]?.sliceStartUtc.toISOString().slice(0, 10) ?? run.utcDayBucket,
      endDayUtc: run.utcDayBucket,
      capturedAt,
      poolTotals: Array.isArray(run.metadataJson.latestPoolTotals)
        ? run.metadataJson.latestPoolTotals
          .filter((item): item is { poolId: string; valueUsd: number } => typeof item === "object" && item !== null)
          .map((item) => ({
            poolId: String(item.poolId),
            valueUsd: Number(item.valueUsd ?? 0),
          }))
        : [],
    });
    const sliceCoverage = await readRunSliceCoverage(payload.runId);

    await upsertProcessingCursor({
      walletAddress: payload.walletAddress,
      chainId: payload.chainId,
      lastProcessedDayUtc: run.utcDayBucket,
      lastSuccessfulRunId: payload.runId,
      lastAdvancedAt: capturedAt,
      metadataJson: {
        totalValueUsd: snapshot.totalValueUsd,
      },
    });

    await upsertOverviewFreshness({
      walletAddress: payload.walletAddress,
      chainId: payload.chainId,
      lastAnalyzedAt: capturedAt,
      lastSuccessfulRunId: payload.runId,
      metadataJson: {
        coverage: sliceCoverage.coverage,
        coverageReasons: sliceCoverage.coverageReasons,
        totalValueUsd: snapshot.totalValueUsd,
      },
    });

    const finalizedRun = await finalizeAnalysisRun({
      runId: payload.runId,
      coverage: sliceCoverage.coverage,
      coverageReasonsJson: sliceCoverage.coverageReasons,
    });

    return {
      runId: payload.runId,
      status: finalizedRun.status,
      coverage: finalizedRun.coverage,
      coverageReasons: finalizedRun.coverageReasonsJson,
      totalValueUsd: snapshot.totalValueUsd,
    };
  },
});