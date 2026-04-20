import { PortfolioAccountingService } from "@/domains/accounting/services/portfolio-accounting-service";

describe("portfolio accounting service", () => {
  it("keeps idle balances separate from position exposure while reconciling total value", () => {
    const service = new PortfolioAccountingService();
    const snapshot = service.buildPortfolioSnapshot({
      contractVersion: "1.0.0",
      sessionId: "session_1",
      acceptedRunId: "run_1",
      asOf: new Date("2026-04-19T10:15:00.000Z"),
      movements: [
        {
          assetMovementId: "movement_deposit",
          ledgerRecordId: "ledger_deposit",
          txHash: "0xtx1",
          timestamp: new Date("2026-04-19T10:00:00.000Z"),
          eventType: "external_deposit",
          poolId: null,
          strategyId: null,
          positionInstanceId: null,
          tokenAddress: "0xusdc",
          symbol: "USDC",
          amountRaw: "1000000000",
          decimals: 6,
          amount: "1000",
          direction: "in",
          movementRole: "principal",
          priceAssetId: "price_asset_usdc",
          pricePointId: "price_usdc",
          priceUsd: "1",
          eventValueUsd: "1000",
          coverage: {
            subjectType: "asset_movement",
            subjectId: "movement_deposit",
            coverageStatus: "priced",
            reasonCode: "historical_price_direct",
            reasonMessage: "historical price direct",
            pricePointId: "price_usdc",
            fallbackUsed: false
          }
        }
      ],
      currentHoldings: [
        {
          holdingType: "position",
          subjectId: "position:1",
          poolId: "pool_1",
          strategyId: "strategy_1",
          positionInstanceId: "position_1",
          tokenAddress: "0xweth",
          symbol: "WETH",
          amount: "1.5",
          costBasisUsd: "3500",
          currentValueUsd: "3650",
          pricePointId: "price_weth",
          coverage: {
            subjectType: "holding_balance",
            subjectId: "position:1",
            coverageStatus: "priced",
            reasonCode: "current_price_direct",
            reasonMessage: "current price direct",
            pricePointId: "price_weth",
            fallbackUsed: false
          },
          traceLedgerRecordIds: ["ledger_position"]
        },
        {
          holdingType: "idle_balance",
          subjectId: "idle:0xusdc",
          poolId: null,
          strategyId: null,
          positionInstanceId: null,
          tokenAddress: "0xusdc",
          symbol: "USDC",
          amount: "300",
          costBasisUsd: "300",
          currentValueUsd: "300",
          pricePointId: "price_usdc_current",
          coverage: {
            subjectType: "holding_balance",
            subjectId: "idle:0xusdc",
            coverageStatus: "priced",
            reasonCode: "current_price_direct",
            reasonMessage: "current price direct",
            pricePointId: "price_usdc_current",
            fallbackUsed: false
          },
          traceLedgerRecordIds: ["ledger_deposit"]
        }
      ],
      discarded: [],
      poolSummaries: []
    });

    expect(snapshot.totalValue.amount).toBe("3950.0000");
    expect(snapshot.idleBalanceValue.amount).toBe("300.0000");
    expect(snapshot.unrealizedPnl.amount).toBe("150.0000");
  });
});