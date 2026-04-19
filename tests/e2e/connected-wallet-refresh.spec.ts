import { expect, test, type Page } from "@playwright/test";

import type { ConnectedWalletAnalysisTestOverride } from "@/ui/wallet/use-connected-wallet-analysis";

async function installConnectedWalletTestOverride(
  page: Page,
  input: {
    walletAddress: string;
    chainId: number;
    connectorId?: string;
    connectorName?: string;
    isConnected?: boolean;
  }
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

async function installConnectedWalletAnalysisTestOverride(
  page: Page,
  input: {
    sessionId: string;
    payload: ConnectedWalletAnalysisTestOverride;
  }
) {
  await page.addInitScript(({ sessionId, payload }) => {
    window.__THE_CAB_TEST_ANALYSIS__ = {
      ...(window.__THE_CAB_TEST_ANALYSIS__ ?? {}),
      [sessionId]: payload
    };
  }, input);
}

test("shows the latest accepted ledger while a reused session refresh runs", async ({ page }) => {
  await installConnectedWalletTestOverride(page, {
    walletAddress: "0x2000000000000000000000000000000000000002",
    chainId: 8453
  });
  await installConnectedWalletAnalysisTestOverride(page, {
    sessionId: "session_reused",
    payload: {
      sessionStatus: {
        session: {
          sessionId: "session_reused",
          walletAddress: "0x2000000000000000000000000000000000000002",
          chainId: 8453,
          status: "active",
          reusedSession: true,
          latestAcceptedRunId: "run_accepted"
        },
        latestAcceptedRun: {
          reconstructionRunId: "run_accepted",
          sessionId: "session_reused",
          runMode: "initial",
          status: "accepted",
          classifierVersion: "2026-04-19.1",
          heuristicsVersion: "2026-04-19.1",
          fromBlock: 1,
          toBlock: 2,
          startedAt: "2026-04-19T17:00:00.000Z",
          completedAt: "2026-04-19T17:00:10.000Z",
          errorSummary: null
        },
        lastFailure: null,
        latestRun: {
          reconstructionRunId: "run_refresh",
          sessionId: "session_reused",
          runMode: "incremental",
          status: "ingesting",
          classifierVersion: "2026-04-19.1",
          heuristicsVersion: "2026-04-19.1",
          fromBlock: 2,
          toBlock: 3,
          startedAt: "2026-04-19T17:05:00.000Z",
          completedAt: null,
          errorSummary: null
        },
        hasAcceptedProjection: true
      },
      projection: {
        contractVersion: "1.0.0",
        classifierVersion: "2026-04-19.1",
        heuristicsVersion: "2026-04-19.1",
        sourceBlockRange: {
          fromBlock: 1,
          toBlock: 2
        },
        pools: [
          {
            poolId: "pool_1",
            displayName: "WETH / USDC",
            poolAddress: "0xpool",
            strategies: []
          }
        ],
        residualHoldings: [],
        discardedSummary: {
          totalCount: 0,
          byReasonType: {}
        }
      },
      discardedActivity: {
        contractVersion: "1.0.0",
        items: []
      }
    }
  });

  await page.goto("/ledger?sessionId=session_reused");

  await expect(page.getByText("Latest accepted ledger loaded")).toBeVisible();
  await expect(page.getByText("Refreshing live reconstruction")).toBeVisible();
  await expect(page.locator("ul li").filter({ hasText: "WETH / USDC" })).toBeVisible();
});

test("guards a reused session when the connected wallet no longer matches", async ({ page }) => {
  await installConnectedWalletTestOverride(page, {
    walletAddress: "0x3000000000000000000000000000000000000003",
    chainId: 8453
  });
  await installConnectedWalletAnalysisTestOverride(page, {
    sessionId: "session_reused",
    payload: {
      sessionStatus: {
        session: {
          sessionId: "session_reused",
          walletAddress: "0x2000000000000000000000000000000000000002",
          chainId: 8453,
          status: "active",
          reusedSession: true,
          latestAcceptedRunId: "run_accepted"
        },
        latestAcceptedRun: {
          reconstructionRunId: "run_accepted",
          sessionId: "session_reused",
          runMode: "initial",
          status: "accepted",
          classifierVersion: "2026-04-19.1",
          heuristicsVersion: "2026-04-19.1",
          fromBlock: 1,
          toBlock: 2,
          startedAt: "2026-04-19T17:00:00.000Z",
          completedAt: "2026-04-19T17:00:10.000Z",
          errorSummary: null
        },
        lastFailure: null,
        latestRun: {
          reconstructionRunId: "run_accepted",
          sessionId: "session_reused",
          runMode: "initial",
          status: "accepted",
          classifierVersion: "2026-04-19.1",
          heuristicsVersion: "2026-04-19.1",
          fromBlock: 1,
          toBlock: 2,
          startedAt: "2026-04-19T17:00:00.000Z",
          completedAt: "2026-04-19T17:00:10.000Z",
          errorSummary: null
        },
        hasAcceptedProjection: true
      },
      projection: null,
      discardedActivity: null
    }
  });

  await page.goto("/ledger?sessionId=session_reused");

  await expect(page.getByText("This session belongs to a different wallet")).toBeVisible();
  await expect(page.getByText("WETH / USDC")).not.toBeVisible();
});