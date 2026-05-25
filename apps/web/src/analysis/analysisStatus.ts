export const ANALYSIS_STATUSES = [
  "not_analyzed",
  "queued",
  "running",
  "ready",
  "stale",
  "failed",
] as const;

export const ANALYSIS_MODES = ["full_history", "incremental"] as const;

export type AnalysisStatus = (typeof ANALYSIS_STATUSES)[number];

export type AnalysisMode = (typeof ANALYSIS_MODES)[number];

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