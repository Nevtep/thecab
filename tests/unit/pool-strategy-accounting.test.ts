import { PositionAccountingService } from "@/domains/accounting/services/position-accounting-service";

describe("pool and strategy accounting precision", () => {
  it("marks exact positions when lifecycle linkage stays unambiguous", () => {
    const service = new PositionAccountingService();

    expect(
      service.determinePrecisionStatus({
        positionInstanceId: "position_1",
        records: [
          {
            ledgerRecordId: "ledger_1",
            positionInstanceId: "position_1",
            strategyId: "strategy_1",
            eventType: "manual_position_opened"
          },
          {
            ledgerRecordId: "ledger_2",
            positionInstanceId: "position_1",
            strategyId: "strategy_1",
            eventType: "manual_liquidity_added"
          }
        ],
        residuals: []
      })
    ).toBe("exact");
  });
});