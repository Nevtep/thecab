export const ANALYSIS_STATUSES = [
  "not_analyzed",
  "queued",
  "running",
  "ready",
  "stale",
  "failed",
] as const;

export const ANALYSIS_MODES = ["full_history", "incremental"] as const;

export const ANALYSIS_PHASE_STATUSES = ["queued", "running", "complete", "failed"] as const;

export const ANALYSIS_PHASE_KEYS = ["deposits", "rewards", "activity", "pools", "finalize"] as const;

export const ANALYSIS_SLICE_STATUSES = ["queued", "running", "complete", "skipped_cached", "failed"] as const;

export type AnalysisStatus = (typeof ANALYSIS_STATUSES)[number];

export type AnalysisMode = (typeof ANALYSIS_MODES)[number];

export type AnalysisPhaseStatus = (typeof ANALYSIS_PHASE_STATUSES)[number];

export type AnalysisPhaseKey = (typeof ANALYSIS_PHASE_KEYS)[number];

export type AnalysisSliceStatus = (typeof ANALYSIS_SLICE_STATUSES)[number];

export type AnalysisCoverageLevel = "full" | "partial" | "unknown";

export type AnalysisPhaseProgress = {
  status: AnalysisPhaseStatus;
  completedSlices?: number;
  totalSlices?: number;
};

export type AnalysisSliceProgress = {
  sliceId: string;
  sliceIndex: number;
  status: AnalysisSliceStatus;
  sliceStartUtc: string;
  sliceEndUtc: string;
  txCountSeen: number;
  txCountProcessed: number;
  coverageReasons: string[];
  startedAt: string | null;
  completedAt: string | null;
};

export type AnalysisSummary = {
  status: AnalysisStatus;
  runId: string | null;
  mode: AnalysisMode | null;
  stage: string | null;
  progressPct: number;
  lastSuccessfulRunAt: string | null;
  lastUpdatedAt: string | null;
  lastError: string | null;
};

export type AnalysisStatusResponse = AnalysisSummary & {
  walletAddress: string;
  chainId: number;
  triggeredAtUtc: string | null;
  completedAtUtc: string | null;
  coverage: AnalysisCoverageLevel;
  coverageReasons: string[];
  phases: Record<AnalysisPhaseKey, AnalysisPhaseProgress>;
  slices: AnalysisSliceProgress[];
};

export function mapToAnalysisStatus(status: string | null | undefined): AnalysisStatus {
  switch (status) {
    case "queued":
    case "running":
    case "ready":
    case "stale":
    case "failed":
    case "not_analyzed":
      return status;
    default:
      return "not_analyzed";
  }
}