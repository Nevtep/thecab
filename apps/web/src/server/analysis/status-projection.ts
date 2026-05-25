import type { AnalysisStatusResponse } from "@/analysis/analysisStatus";
import { mapToAnalysisStatus, type AnalysisStatus } from "@/analysis/analysisStatus";
import { dedupeCoverageReasons, resolveCoverageLevel, type AnalysisCoverageLevel } from "@/server/analysis/coverage";
import { getEnv } from "@/server/env";
import type { AnalysisSliceProgressRow } from "@/server/analysis/analysis-slice.repository";

type InternalRunStatus = "queued" | "running" | "complete" | "failed" | "cancelled" | string;

export type AnalysisPhaseProjection = {
  status: "queued" | "running" | "complete" | "failed";
  completedSlices?: number;
  totalSlices?: number;
};

export type AnalysisStatusProjection = {
  status: AnalysisStatus;
  coverage: AnalysisCoverageLevel;
  coverageReasons: string[];
};

function resolveSlicePhaseStatus(input: {
  latestRunStatus: string | null;
  totalSlices: number;
  completedSlices: number;
  failedSlices: number;
}): AnalysisStatusResponse["phases"]["deposits"] {
  if (input.totalSlices === 0) {
    return {
      status: input.latestRunStatus === "running"
        ? "running"
        : input.latestRunStatus === "failed"
          ? "failed"
          : "queued",
      completedSlices: 0,
      totalSlices: 0,
    };
  }

  if (input.failedSlices > 0 || input.latestRunStatus === "failed") {
    return {
      status: "failed",
      completedSlices: input.completedSlices,
      totalSlices: input.totalSlices,
    };
  }

  if (input.completedSlices >= input.totalSlices) {
    return {
      status: "complete",
      completedSlices: input.completedSlices,
      totalSlices: input.totalSlices,
    };
  }

  return {
    status: input.latestRunStatus === "running" ? "running" : "queued",
    completedSlices: input.completedSlices,
    totalSlices: input.totalSlices,
  };
}

function resolveLinearPhaseStatus(currentStage: string | null, phase: "activity" | "pools" | "finalize", failed: boolean) {
  if (failed) {
    return "failed" as const;
  }

  const order = ["planning", "slices", "activity", "pools", "finalize", "completed"];
  const currentIndex = order.indexOf(currentStage ?? "planning");
  const phaseIndex = order.indexOf(phase);

  if (currentIndex === phaseIndex) {
    return "running" as const;
  }

  if (currentIndex > phaseIndex || currentStage === "completed") {
    return "complete" as const;
  }

  return "queued" as const;
}

export function projectAnalysisProgress(input: {
  latestRunStatus: string | null;
  currentStage: string | null;
  totalSlices: number;
  completedSlices: number;
  failedSlices: number;
  slices: AnalysisSliceProgressRow[];
}) {
  const slicePhase = resolveSlicePhaseStatus({
    latestRunStatus: input.latestRunStatus,
    totalSlices: input.totalSlices,
    completedSlices: input.completedSlices,
    failedSlices: input.failedSlices,
  });

  return {
    phases: {
      deposits: slicePhase,
      rewards: slicePhase,
      activity: {
        status: resolveLinearPhaseStatus(input.currentStage, "activity", input.latestRunStatus === "failed"),
      },
      pools: {
        status: resolveLinearPhaseStatus(input.currentStage, "pools", input.latestRunStatus === "failed"),
      },
      finalize: {
        status: resolveLinearPhaseStatus(input.currentStage, "finalize", input.latestRunStatus === "failed"),
      },
    } satisfies AnalysisStatusResponse["phases"],
    slices: input.slices.map((slice) => ({
      sliceId: slice.id,
      sliceIndex: slice.sliceIndex,
      status: slice.status,
      sliceStartUtc: slice.sliceStartUtc.toISOString(),
      sliceEndUtc: slice.sliceEndUtc.toISOString(),
      txCountSeen: slice.txCountSeen,
      txCountProcessed: slice.txCountProcessed,
      coverageReasons: slice.coverageReasonsJson ?? [],
      startedAt: slice.startedAt?.toISOString() ?? null,
      completedAt: slice.completedAt?.toISOString() ?? null,
    })) satisfies AnalysisStatusResponse["slices"],
  };
}

export function isAnalysisStatusStale(lastSuccessfulRunAt: Date | null) {
  if (!lastSuccessfulRunAt) {
    return false;
  }

  const staleThresholdMs = getEnv().ANALYSIS_STATUS_STALE_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - lastSuccessfulRunAt.getTime() > staleThresholdMs;
}

export function projectCanonicalAnalysisStatus(input: {
  latestRunStatus: InternalRunStatus | null;
  lastSuccessfulRunAt: Date | null;
}) {
  switch (input.latestRunStatus) {
    case "queued":
    case "running":
      return mapToAnalysisStatus(input.latestRunStatus);
    case "failed":
      return input.lastSuccessfulRunAt ? (isAnalysisStatusStale(input.lastSuccessfulRunAt) ? "stale" : "ready") : "failed";
    case "cancelled":
      return input.lastSuccessfulRunAt ? (isAnalysisStatusStale(input.lastSuccessfulRunAt) ? "stale" : "ready") : "not_analyzed";
    case "complete":
      return input.lastSuccessfulRunAt
        ? (isAnalysisStatusStale(input.lastSuccessfulRunAt) ? "stale" : "ready")
        : "ready";
    default:
      return input.lastSuccessfulRunAt
        ? (isAnalysisStatusStale(input.lastSuccessfulRunAt) ? "stale" : "ready")
        : "not_analyzed";
  }
}

export function projectAnalysisStatus(input: {
  latestRunStatus: InternalRunStatus | null;
  lastSuccessfulRunAt: Date | null;
  coverageReasons?: string[] | null;
  failedSliceCount?: number;
}): AnalysisStatusProjection {
  const coverageReasons = dedupeCoverageReasons(input.coverageReasons);

  return {
    status: projectCanonicalAnalysisStatus({
      latestRunStatus: input.latestRunStatus,
      lastSuccessfulRunAt: input.lastSuccessfulRunAt,
    }),
    coverage: resolveCoverageLevel({
      failedSliceCount: input.failedSliceCount,
      reasonCodes: coverageReasons,
      hasCompletedData: Boolean(input.lastSuccessfulRunAt),
    }),
    coverageReasons,
  };
}