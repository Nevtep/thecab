import { resolveDashboardDisplayState } from "@/domains/accounting/services/dashboard-state-resolver";
import { DashboardSessionViewService } from "@/domains/accounting/services/dashboard-session-view-service";

describe("dashboard state resolver", () => {
  it("maps empty and loading states when no accepted snapshot exists", () => {
    expect(
      resolveDashboardDisplayState({
        hasAcceptedSnapshot: false,
        isReconstructionRunning: false,
        latestRunStatus: null,
        snapshotCoverageStatus: null
      })
    ).toBe("empty");

    expect(
      resolveDashboardDisplayState({
        hasAcceptedSnapshot: false,
        isReconstructionRunning: true,
        latestRunStatus: "pending",
        snapshotCoverageStatus: null
      })
    ).toBe("loading");
  });

  it("maps accepted snapshots to partial or ready based on freshness and coverage", () => {
    expect(
      resolveDashboardDisplayState({
        hasAcceptedSnapshot: true,
        isReconstructionRunning: true,
        latestRunStatus: "projecting",
        snapshotCoverageStatus: "full"
      })
    ).toBe("partial");

    expect(
      resolveDashboardDisplayState({
        hasAcceptedSnapshot: true,
        isReconstructionRunning: false,
        latestRunStatus: "accepted",
        snapshotCoverageStatus: "full"
      })
    ).toBe("ready");
  });

  it("builds deterministic display-state and bootstrap-state outcomes for identical inputs", () => {
    const service = new DashboardSessionViewService();
    const input = {
      analysisSessionId: "session_1",
      walletAddress: "0x1000000000000000000000000000000000000001",
      chainId: 8453,
      acceptedRunId: "run_1",
      latestRunId: "run_2",
      latestRunStatus: "projecting",
      hasAcceptedSnapshot: true,
      isReconstructionRunning: true,
      snapshotCoverageStatus: "full" as const
    };

    const first = service.build(input);
    const second = service.build(input);

    expect(first.bootstrapState).toBe("warming");
    expect(first.displayState).toBe("partial");
    expect(second.bootstrapState).toBe(first.bootstrapState);
    expect(second.displayState).toBe(first.displayState);
  });
});
