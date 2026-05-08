import { DashboardReconciliationService } from "@/domains/accounting/services/dashboard-reconciliation-service";
import { DashboardSessionViewService } from "@/domains/accounting/services/dashboard-session-view-service";
import { DashboardTrustBoundaryService } from "@/domains/accounting/services/dashboard-trust-boundary-service";

describe("dashboard composition regression", () => {
  it("handles no-accepted-run state deterministically", () => {
    const sessionView = new DashboardSessionViewService().build({
      analysisSessionId: "session_no_run",
      walletAddress: "0x1000000000000000000000000000000000000001",
      chainId: 8453,
      acceptedRunId: null,
      latestRunId: null,
      latestRunStatus: null,
      hasAcceptedSnapshot: false,
      isReconstructionRunning: false,
      snapshotCoverageStatus: null
    });

    expect(sessionView.bootstrapState).toBe("empty");
    expect(sessionView.displayState).toBe("empty");
  });

  it("keeps discarded activity reviewable while trusted outputs stay partial", () => {
    const trust = new DashboardTrustBoundaryService().build({
      discardedCount: 2,
      reasonCodes: ["unsupported_protocol", "discarded_event", "partial_price_window"]
    });

    expect(trust.coverageStatus).toBe("partial");
    expect(trust.reviewableReasonCodes).toEqual(
      expect.arrayContaining(["unsupported_protocol", "discarded_event"])
    );
    expect(trust.trustedReasonCodes).toEqual(expect.arrayContaining(["partial_price_window"]));
  });

  it("flags mixed-freshness reconciliation mismatches across pool and idle totals", () => {
    const service = new DashboardReconciliationService();

    expect(() =>
      service.assertPortfolioReconciliation({
        totalValue: { amount: "1000.0000" },
        pools: [{ currentValue: { amount: "600.0000" } }, { currentValue: { amount: "300.0000" } }],
        idleResidualValue: { amount: "50.0000" }
      })
    ).toThrow(/Portfolio reconciliation failed/);
  });
});
