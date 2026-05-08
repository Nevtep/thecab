export type DashboardDisplayState = "loading" | "partial" | "empty" | "failure" | "ready";

type ResolveDashboardDisplayStateInput = {
  hasAcceptedSnapshot: boolean;
  isReconstructionRunning: boolean;
  latestRunStatus: string | null;
  snapshotCoverageStatus: "full" | "partial" | null;
};

export function resolveDashboardDisplayState(
  input: ResolveDashboardDisplayStateInput
): DashboardDisplayState {
  if (!input.hasAcceptedSnapshot) {
    return input.isReconstructionRunning ? "loading" : "empty";
  }

  if (input.latestRunStatus === "failed") {
    return "partial";
  }

  if (input.snapshotCoverageStatus === "partial") {
    return "partial";
  }

  if (input.isReconstructionRunning) {
    return "partial";
  }

  return "ready";
}
