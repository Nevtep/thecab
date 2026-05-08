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

test("renders partial coverage, fallback disclosure, and discarded activity", async ({ page }) => {
  await installConnectedWalletTestOverride(page, {
    walletAddress: "0x3000000000000000000000000000000000000003",
    chainId: 8453
  });
  await installConnectedWalletAnalysisTestOverride(page, {
    sessionId: "session_explainability",
    payload: {
      sessionStatus: {
        session: { sessionId: "session_explainability", walletAddress: "0x3000000000000000000000000000000000000003", chainId: 8453, status: "active", reusedSession: true, latestAcceptedRunId: "run_explainability" },
        latestAcceptedRun: { reconstructionRunId: "run_explainability", sessionId: "session_explainability", runMode: "initial", status: "accepted", classifierVersion: "2026-04-19.1", heuristicsVersion: "2026-04-19.1", fromBlock: 1, toBlock: 3, startedAt: "2026-04-19T17:00:00.000Z", completedAt: "2026-04-19T17:00:10.000Z", errorSummary: null },
        lastFailure: null,
        latestRun: { reconstructionRunId: "run_explainability", sessionId: "session_explainability", runMode: "initial", status: "accepted", classifierVersion: "2026-04-19.1", heuristicsVersion: "2026-04-19.1", fromBlock: 1, toBlock: 3, startedAt: "2026-04-19T17:00:00.000Z", completedAt: "2026-04-19T17:00:10.000Z", errorSummary: null },
        hasAcceptedProjection: true
      },
      projection: {
        contractVersion: "1.0.0",
        classifierVersion: "2026-04-19.1",
        heuristicsVersion: "2026-04-19.1",
        sourceBlockRange: { fromBlock: 1, toBlock: 3 },
        pools: [],
        residualHoldings: [{ residualHoldingId: "residual_1", tokenAddress: "0xusdc", symbol: "USDC", amountRaw: "50000000", attributionConfidence: 0.42, candidatePoolIds: ["pool_1"], reasonCode: "rebalance_leftover" }],
        discardedSummary: { totalCount: 1, byReasonType: { unsupported: 1 } }
      },
      accounting: {
        contractVersion: "1.0.0",
        sessionId: "session_explainability",
        acceptedRunId: "run_explainability",
        asOf: "2026-04-19T17:00:10.000Z",
        quoteCurrency: "usd",
        totalValue: { currency: "usd", amount: "400.0000" },
        capitalEntered: { currency: "usd", amount: "0.0000" },
        capitalWithdrawn: { currency: "usd", amount: "0.0000" },
        realizedPnl: { currency: "usd", amount: "0.0000" },
        unrealizedPnl: { currency: "usd", amount: "0.0000" },
        idleBalanceValue: { currency: "usd", amount: "400.0000" },
        coverageSummary: { coverageStatus: "partial", pricedValue: { currency: "usd", amount: "400.0000" }, excludedValue: null, unpricedComponentsCount: 1, reasonCodes: ["unsupported_protocol"] },
        pools: [],
        idleBalances: [
          { tokenAddress: "0xusdc", symbol: "USDC", amountRaw: "350", currentValue: { currency: "usd", amount: "350.0000" }, coverageStatus: "priced", reasonCode: "current_price_direct", candidatePoolIds: [], traceRefs: { ledgerRecordIds: ["ledger_close"], pricePointIds: ["price_usdc"] } },
          { tokenAddress: "0xusdc", symbol: "USDC", amountRaw: "50", currentValue: { currency: "usd", amount: "50.0000" }, coverageStatus: "priced", reasonCode: "current_price_direct", candidatePoolIds: ["pool_1"], traceRefs: { ledgerRecordIds: ["ledger_close"], pricePointIds: ["price_usdc"] } }
        ],
        traceRefs: { ledgerRecordIds: ["ledger_close"], pricePointIds: ["price_usdc"] }
      },
      discardedActivity: {
        contractVersion: "1.0.0",
        items: [
          { discardedActivityId: "discarded_1", txHash: "0xdiscarded", blockNumber: 302, timestamp: "2026-04-19T12:10:00.000Z", reasonType: "unsupported", reasonCode: "unsupported_protocol", reasonMessage: "The transaction targets an unsupported protocol and is excluded from trusted analytics.", classifierVersion: "2026-04-19.1", heuristicsVersion: "2026-04-19.1", sourceObservationIds: ["raw_unsupported"] }
        ]
      }
    }
  });

  await page.goto("/ledger?sessionId=session_explainability");

  await expect(page.locator(".wallet-metric-card").filter({ hasText: "Total Value" }).locator("strong")).toHaveText("$400.0000");
  await expect(page.getByText("unsupported_protocol")).toBeVisible();
  await expect(page.getByText("Discarded Activity")).toBeVisible();
});

test("renders historical portfolio series and accepted-run timeline markers", async ({ page }) => {
  await installConnectedWalletTestOverride(page, {
    walletAddress: "0x2000000000000000000000000000000000000002",
    chainId: 8453
  });
  await installConnectedWalletAnalysisTestOverride(page, {
    sessionId: "session_historical_series",
    payload: {
      sessionStatus: {
        session: { sessionId: "session_historical_series", walletAddress: "0x2000000000000000000000000000000000000002", chainId: 8453, status: "active", reusedSession: true, latestAcceptedRunId: "run_hist" },
        latestAcceptedRun: { reconstructionRunId: "run_hist", sessionId: "session_historical_series", runMode: "initial", status: "accepted", classifierVersion: "2026-04-19.1", heuristicsVersion: "2026-04-19.1", fromBlock: 1, toBlock: 4, startedAt: "2026-04-19T17:00:00.000Z", completedAt: "2026-04-19T17:00:10.000Z", errorSummary: null },
        lastFailure: null,
        latestRun: { reconstructionRunId: "run_hist", sessionId: "session_historical_series", runMode: "initial", status: "accepted", classifierVersion: "2026-04-19.1", heuristicsVersion: "2026-04-19.1", fromBlock: 1, toBlock: 4, startedAt: "2026-04-19T17:00:00.000Z", completedAt: "2026-04-19T17:00:10.000Z", errorSummary: null },
        hasAcceptedProjection: true
      },
      projection: {
        contractVersion: "1.0.0",
        classifierVersion: "2026-04-19.1",
        heuristicsVersion: "2026-04-19.1",
        sourceBlockRange: { fromBlock: 1, toBlock: 4 },
        pools: [
          {
            poolId: "pool_hist",
            displayName: "WETH / USDC",
            poolAddress: "0xpoolhist",
            strategies: [
              { strategyId: "strategy_hist", strategyType: "manual", sourceContractAddress: "0xmanual", positions: [{ positionInstanceId: "position_hist", positionType: "manual_cl", status: "open", identityReference: "501", ledgerRecords: [] }] }
            ]
          }
        ],
        residualHoldings: [],
        discardedSummary: { totalCount: 0, byReasonType: {} }
      },
      accounting: {
        contractVersion: "1.0.0",
        sessionId: "session_historical_series",
        acceptedRunId: "run_hist",
        asOf: "2026-04-19T17:00:10.000Z",
        quoteCurrency: "usd",
        totalValue: { currency: "usd", amount: "4290.0000" },
        capitalEntered: { currency: "usd", amount: "4200.0000" },
        capitalWithdrawn: { currency: "usd", amount: "0.0000" },
        realizedPnl: { currency: "usd", amount: "0.0000" },
        unrealizedPnl: { currency: "usd", amount: "90.0000" },
        idleBalanceValue: { currency: "usd", amount: "0.0000" },
        coverageSummary: { coverageStatus: "full", pricedValue: { currency: "usd", amount: "4290.0000" }, excludedValue: null, unpricedComponentsCount: 0, reasonCodes: [] },
        pools: [],
        idleBalances: [],
        traceRefs: { ledgerRecordIds: ["ledger_hist_1"], pricePointIds: ["price_hist_1"] }
      },
      accountingTimeSeries: {
        contractVersion: "1.0.0",
        sessionId: "session_historical_series",
        acceptedRunId: "run_hist",
        quoteCurrency: "usd",
        seriesState: "partial",
        partialReasonCodes: ["missing_asset_movements"],
        portfolioSeries: [
          { ledgerRecordId: "ledger_hist_1", blockNumber: 10, timestamp: "2026-04-19T12:00:00.000Z", eventType: "deposit", totalValue: { currency: "usd", amount: "1000.0000" }, coverageStatus: "full" },
          { ledgerRecordId: "ledger_hist_2", blockNumber: 12, timestamp: "2026-04-19T12:10:00.000Z", eventType: "rebalance", totalValue: { currency: "usd", amount: "950.0000" }, coverageStatus: "partial" }
        ],
        poolSeries: [
          {
            poolId: "pool_hist",
            displayName: "WETH / USDC",
            points: [
              { ledgerRecordId: "ledger_hist_1", blockNumber: 10, timestamp: "2026-04-19T12:00:00.000Z", eventType: "deposit", flowDirection: "in", deployedCapital: { currency: "usd", amount: "1000.0000" } },
              { ledgerRecordId: "ledger_hist_2", blockNumber: 12, timestamp: "2026-04-19T12:10:00.000Z", eventType: "rebalance", flowDirection: "internal", deployedCapital: { currency: "usd", amount: "950.0000" } }
            ]
          }
        ],
        eventMarkers: [
          { ledgerRecordId: "ledger_hist_2", blockNumber: 12, timestamp: "2026-04-19T12:10:00.000Z", markerType: "rebalance", label: "rebalance" },
          { ledgerRecordId: "ledger_hist_3", blockNumber: 14, timestamp: "2026-04-19T12:20:00.000Z", markerType: "close", label: "close_position" }
        ]
      },
      discardedActivity: { contractVersion: "1.0.0", items: [] }
    }
  });

  await page.goto("/ledger?sessionId=session_historical_series");

  await expect(page.getByText("Historical Portfolio Series")).toBeVisible();
  await expect(page.getByText("Series state:").locator("..")).toContainText("partial");
  await expect(page.getByText("Accepted-Run Timeline Markers")).toBeVisible();
  await expect(page.getByText("rebalance (rebalance)")).toBeVisible();
});