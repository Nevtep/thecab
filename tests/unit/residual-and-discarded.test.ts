import { DiscardedActivityService } from "@/domains/ledger/services/discarded-activity-service";
import { ResidualHoldingService } from "@/domains/residual-holdings/services/residual-holding-service";

describe("residual and discarded handling", () => {
  it("keeps residual holdings at portfolio level with candidate pools", () => {
    const service = new ResidualHoldingService();
    const holdings = service.build({
      reconstructionRunId: "run_1",
      semantic: {
        protocol: "aerodrome",
        action: "closePosition",
        residuals: [
          {
            tokenAddress: "0xusdc",
            amountRaw: "50000000",
            decimals: 6,
            attributionConfidence: 0.42,
            candidatePoolAddresses: ["0xpool"],
            reasonCode: "rebalance_leftover"
          }
        ]
      },
      poolAddressToId: new Map([["0xpool", "pool_1"]]),
      latestSourceLedgerRecordId: "ledger_1"
    });

    expect(holdings[0]?.candidatePoolIds).toEqual(["pool_1"]);
    expect(holdings[0]?.reasonCode).toBe("rebalance_leftover");
  });

  it("creates discarded activity with stable metadata", () => {
    const service = new DiscardedActivityService();
    const item = service.build({
      reconstructionRunId: "run_1",
      analysisSessionId: "session_1",
      classifierVersion: "2026-04-19.1",
      heuristicsVersion: "2026-04-19.1",
      txHash: "0xdead",
      blockNumber: 1n,
      timestamp: new Date("2026-04-19T00:00:00.000Z"),
      ordinal: 0,
      sourceObservationIds: ["raw_1"],
      semantic: {
        protocol: "unsupported",
        action: "unsupported",
        discarded: {
          reasonType: "unsupported",
          reasonCode: "unsupported_protocol",
          reasonMessage: "Unsupported protocol."
        }
      }
    });

    expect(item.reasonType).toBe("unsupported");
    expect(item.reasonCode).toBe("unsupported_protocol");
    expect(item.sourceObservationIds).toEqual(["raw_1"]);
  });
});