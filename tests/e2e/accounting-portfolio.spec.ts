import { expect, test, type Page } from "@playwright/test";

import type { ConnectedWalletAnalysisTestOverride } from "@/ui/wallet/use-connected-wallet-analysis";

async function installConnectedWalletTestOverride(
  page: Page,
  input: { walletAddress: string; chainId: number; connectorId?: string; connectorName?: string; isConnected?: boolean }
) {
  await page.addInitScript((override) => {
    window.__THE_CAB_TEST_WALLET__ = {
      walletAddress: override.walletAddress,
      chainId: override.chainId,
      connectorId: override.connectorId ?? "injected",
      connectorName: override.connectorName ?? "Injected",
      isConnected: override.isConnected ?? true
    };
  }, input);
}

async function installConnectedWalletAnalysisTestOverride(page: Page, input: { sessionId: string; payload: ConnectedWalletAnalysisTestOverride }) {
  await page.addInitScript(({ sessionId, payload }) => {
    window.__THE_CAB_TEST_ANALYSIS__ = {
      ...(window.__THE_CAB_TEST_ANALYSIS__ ?? {}),
      [sessionId]: payload
    };
  }, input);
}

test("renders portfolio totals and idle-balance visibility", async ({ page }) => {
  await installConnectedWalletTestOverride(page, {
    walletAddress: "0x1000000000000000000000000000000000000001",
    chainId: 8453
  });
  await installConnectedWalletAnalysisTestOverride(page, {
    sessionId: "session_portfolio",
    payload: {
      sessionStatus: {
        session: { sessionId: "session_portfolio", walletAddress: "0x1000000000000000000000000000000000000001", chainId: 8453, status: "active", reusedSession: true, latestAcceptedRunId: "run_portfolio" },
        latestAcceptedRun: { reconstructionRunId: "run_portfolio", sessionId: "session_portfolio", runMode: "initial", status: "accepted", classifierVersion: "2026-04-19.1", heuristicsVersion: "2026-04-19.1", fromBlock: 1, toBlock: 4, startedAt: "2026-04-19T17:00:00.000Z", completedAt: "2026-04-19T17:00:10.000Z", errorSummary: null },
        lastFailure: null,
        latestRun: { reconstructionRunId: "run_portfolio", sessionId: "session_portfolio", runMode: "initial", status: "accepted", classifierVersion: "2026-04-19.1", heuristicsVersion: "2026-04-19.1", fromBlock: 1, toBlock: 4, startedAt: "2026-04-19T17:00:00.000Z", completedAt: "2026-04-19T17:00:10.000Z", errorSummary: null },
        hasAcceptedProjection: true
      },
      projection: {
        contractVersion: "1.0.0",
        classifierVersion: "2026-04-19.1",
        heuristicsVersion: "2026-04-19.1",
        sourceBlockRange: { fromBlock: 1, toBlock: 4 },
        pools: [
          {
            poolId: "pool_1",
            displayName: "WETH / USDC",
            poolAddress: "0xpool",
            strategies: [
              { strategyId: "strategy_1", strategyType: "manual", sourceContractAddress: "0xmanual", positions: [{ positionInstanceId: "position_1", positionType: "manual_cl", status: "open", identityReference: "101", ledgerRecords: [] }] }
            ]
          }
        ],
        residualHoldings: [],
        discardedSummary: { totalCount: 0, byReasonType: {} }
      },
      accounting: {
        contractVersion: "1.0.0",
        sessionId: "session_portfolio",
        acceptedRunId: "run_portfolio",
        asOf: "2026-04-19T17:00:10.000Z",
        quoteCurrency: "usd",
        totalValue: { currency: "usd", amount: "3950.0000" },
        capitalEntered: { currency: "usd", amount: "1000.0000" },
        capitalWithdrawn: { currency: "usd", amount: "200.0000" },
        realizedPnl: { currency: "usd", amount: "0.0000" },
        unrealizedPnl: { currency: "usd", amount: "150.0000" },
        idleBalanceValue: { currency: "usd", amount: "300.0000" },
        coverageSummary: { coverageStatus: "full", pricedValue: { currency: "usd", amount: "3950.0000" }, excludedValue: null, unpricedComponentsCount: 0, reasonCodes: [] },
        pools: [
          {
            poolId: "pool_1",
            displayName: "WETH / USDC",
            currentValue: { currency: "usd", amount: "3650.0000" },
            capitalEntered: { currency: "usd", amount: "3500.0000" },
            capitalWithdrawn: { currency: "usd", amount: "0.0000" },
            realizedPnl: { currency: "usd", amount: "0.0000" },
            unrealizedPnl: { currency: "usd", amount: "150.0000" },
            coverageSummary: { coverageStatus: "full", pricedValue: { currency: "usd", amount: "3650.0000" }, excludedValue: null, unpricedComponentsCount: 0, reasonCodes: [] },
            strategies: [
              {
                strategyId: "strategy_1",
                strategyType: "manual",
                currentValue: { currency: "usd", amount: "3650.0000" },
                capitalEntered: { currency: "usd", amount: "3500.0000" },
                capitalWithdrawn: { currency: "usd", amount: "0.0000" },
                realizedPnl: { currency: "usd", amount: "0.0000" },
                unrealizedPnl: { currency: "usd", amount: "150.0000" },
                coverageSummary: { coverageStatus: "full", pricedValue: { currency: "usd", amount: "3650.0000" }, excludedValue: null, unpricedComponentsCount: 0, reasonCodes: [] },
                positions: [
                  { positionInstanceId: "position_1", positionType: "manual_cl", currentValue: { currency: "usd", amount: "3650.0000" }, capitalEntered: { currency: "usd", amount: "3500.0000" }, capitalWithdrawn: { currency: "usd", amount: "0.0000" }, realizedPnl: { currency: "usd", amount: "0.0000" }, unrealizedPnl: { currency: "usd", amount: "150.0000" }, precisionStatus: "exact", coverageSummary: { coverageStatus: "full", pricedValue: { currency: "usd", amount: "3650.0000" }, excludedValue: null, unpricedComponentsCount: 0, reasonCodes: [] }, traceRefs: { ledgerRecordIds: ["ledger_1"], pricePointIds: ["price_1"] } }
                ],
                traceRefs: { ledgerRecordIds: ["ledger_1"], pricePointIds: ["price_1"] }
              }
            ],
            traceRefs: { ledgerRecordIds: ["ledger_1"], pricePointIds: ["price_1"] }
          }
        ],
        idleBalances: [
          { tokenAddress: "0xusdc", symbol: "USDC", amountRaw: "300", currentValue: { currency: "usd", amount: "300.0000" }, coverageStatus: "priced", reasonCode: "current_price_direct", candidatePoolIds: [], traceRefs: { ledgerRecordIds: ["ledger_1"], pricePointIds: ["price_usdc"] } }
        ],
        traceRefs: { ledgerRecordIds: ["ledger_1"], pricePointIds: ["price_1", "price_usdc"] }
      },
      discardedActivity: { contractVersion: "1.0.0", items: [] }
    }
  });

  await page.goto("/ledger?sessionId=session_portfolio");

  await expect(page.locator(".wallet-metric-card").filter({ hasText: "Total Value" }).locator("strong")).toHaveText("$3950.0000");
  await expect(page.locator(".wallet-metric-card").filter({ hasText: "Idle Balance" }).locator("strong")).toHaveText("$300.0000");
  await expect(page.getByText("USDC idle balance")).toBeVisible();
});