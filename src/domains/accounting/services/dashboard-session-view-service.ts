import {
  resolveDashboardDisplayState,
  type DashboardDisplayState
} from "@/domains/accounting/services/dashboard-state-resolver";

export type DashboardBootstrapState = "empty" | "warming" | "ready";

export type DashboardSessionView = {
  analysisSessionId: string;
  walletAddress: string;
  chainId: number;
  acceptedRunId: string | null;
  latestRunId: string | null;
  asOf: string;
  bootstrapState: DashboardBootstrapState;
  displayState: DashboardDisplayState;
};

type BuildDashboardSessionViewInput = {
  analysisSessionId: string;
  walletAddress: string;
  chainId: number;
  acceptedRunId: string | null;
  latestRunId: string | null;
  latestRunStatus: string | null;
  hasAcceptedSnapshot: boolean;
  isReconstructionRunning: boolean;
  snapshotCoverageStatus: "full" | "partial" | null;
};

function resolveBootstrapState(input: {
  hasAcceptedSnapshot: boolean;
  isReconstructionRunning: boolean;
}): DashboardBootstrapState {
  if (!input.hasAcceptedSnapshot) {
    return "empty";
  }

  if (input.isReconstructionRunning) {
    return "warming";
  }

  return "ready";
}

export class DashboardSessionViewService {
  build(input: BuildDashboardSessionViewInput): DashboardSessionView {
    const bootstrapState = resolveBootstrapState({
      hasAcceptedSnapshot: input.hasAcceptedSnapshot,
      isReconstructionRunning: input.isReconstructionRunning
    });

    const displayState = resolveDashboardDisplayState({
      hasAcceptedSnapshot: input.hasAcceptedSnapshot,
      isReconstructionRunning: input.isReconstructionRunning,
      latestRunStatus: input.latestRunStatus,
      snapshotCoverageStatus: input.snapshotCoverageStatus
    });

    return {
      analysisSessionId: input.analysisSessionId,
      walletAddress: input.walletAddress,
      chainId: input.chainId,
      acceptedRunId: input.acceptedRunId,
      latestRunId: input.latestRunId,
      asOf: new Date().toISOString(),
      bootstrapState,
      displayState
    };
  }
}
