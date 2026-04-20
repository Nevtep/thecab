import { AccountingCoverageService } from "@/domains/accounting/services/accounting-coverage-service";
import { AccountingTraceService } from "@/domains/accounting/services/accounting-trace-service";

describe("accounting explainability", () => {
  it("builds partial coverage summaries with stable reason codes", () => {
    const service = new AccountingCoverageService();
    const summary = service.buildSummary({
      pricedValueUsd: "400.0000",
      reasonCodes: ["unsupported_protocol"],
      unpricedComponentsCount: 1
    });

    expect(summary.coverageStatus).toBe("partial");
    expect(summary.reasonCodes).toEqual(["unsupported_protocol"]);
  });

  it("deduplicates ledger and price trace references", () => {
    const service = new AccountingTraceService();
    expect(
      service.buildTraceRefs({
        ledgerRecordIds: ["ledger_1", "ledger_1", "ledger_2"],
        pricePointIds: ["price_1", "price_1"]
      })
    ).toEqual({
      ledgerRecordIds: ["ledger_1", "ledger_2"],
      pricePointIds: ["price_1"]
    });
  });
});