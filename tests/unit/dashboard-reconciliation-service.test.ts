import { DashboardReconciliationService } from "@/domains/accounting/services/dashboard-reconciliation-service";
import { DashboardTrustBoundaryService } from "@/domains/accounting/services/dashboard-trust-boundary-service";

describe("dashboard reconciliation and trust boundaries", () => {
  it("reconciles portfolio totals against pool totals plus idle-residual balances", () => {
    const result = new DashboardReconciliationService().reconcile({
      totalValue: { amount: "3950.0000" },
      poolValues: [{ currentValue: { amount: "3650.0000" } }],
      idleResidualValue: { amount: "300.0000" }
    });

    expect(result.isReconciled).toBe(true);
    expect(result.delta).toBe("0.0000");
  });

  it("separates reviewable unsupported reasons from trusted reason codes", () => {
    const boundary = new DashboardTrustBoundaryService().build({
      discardedCount: 1,
      reasonCodes: ["unsupported_protocol", "partial_price_window"]
    });

    expect(boundary.coverageStatus).toBe("partial");
    expect(boundary.reviewableReasonCodes).toContain("unsupported_protocol");
    expect(boundary.trustedReasonCodes).toContain("partial_price_window");
  });
});
