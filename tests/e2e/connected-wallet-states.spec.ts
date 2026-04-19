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

test("renders the running state while a live reconstruction is still in progress", async ({ page }) => {
  await installConnectedWalletTestOverride(page, {
    walletAddress: "0x2000000000000000000000000000000000000002",
    chainId: 8453
  });
  await installConnectedWalletAnalysisTestOverride(page, {
    sessionId: "session_running",
    payload: {
      sessionStatus: {
        session: {
          sessionId: "session_running",
          walletAddress: "0x2000000000000000000000000000000000000002",
          chainId: 8453,
          status: "active",
          reusedSession: false,
          latestAcceptedRunId: null
        },
        latestAcceptedRun: null,
        lastFailure: null,
        latestRun: {
          reconstructionRunId: "run_pending",
          sessionId: "session_running",
          runMode: "initial",
          status: "pending",
          classifierVersion: "2026-04-19.1",
          heuristicsVersion: "2026-04-19.1",
          fromBlock: null,
          toBlock: null,
          startedAt: "2026-04-19T17:00:00.000Z",
          completedAt: null,
          errorSummary: null
        },
        hasAcceptedProjection: false
      },
      projection: null,
      discardedActivity: null
    }
  });

  await page.goto("/ledger?sessionId=session_running");

  await expect(page.getByText("Starting live reconstruction for the connected wallet")).toBeVisible();
});

test("renders the empty state while keeping discarded activity reviewable", async ({ page }) => {
  await installConnectedWalletTestOverride(page, {
    walletAddress: "0x2000000000000000000000000000000000000002",
    chainId: 8453
  });
  await installConnectedWalletAnalysisTestOverride(page, {
    sessionId: "session_empty",
    payload: {
      sessionStatus: {
        session: {
          sessionId: "session_empty",
          walletAddress: "0x2000000000000000000000000000000000000002",
          chainId: 8453,
          status: "active",
          reusedSession: true,
          latestAcceptedRunId: "run_empty"
        },
        latestAcceptedRun: {
          reconstructionRunId: "run_empty",
          sessionId: "session_empty",
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
          reconstructionRunId: "run_empty",
          sessionId: "session_empty",
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
      projection: {
        contractVersion: "1.0.0",
        classifierVersion: "2026-04-19.1",
        heuristicsVersion: "2026-04-19.1",
        sourceBlockRange: {
          fromBlock: 1,
          toBlock: 2
        },
        pools: [],
        residualHoldings: [],
        discardedSummary: {
          totalCount: 1,
          byReasonType: {
            unsupported: 1
          }
        }
      },
      discardedActivity: {
        contractVersion: "1.0.0",
        items: [
          {
            discardedActivityId: "discarded_1",
            txHash: "0xtx",
            blockNumber: 1,
            timestamp: "2026-04-19T17:00:00.000Z",
            reasonType: "unsupported",
            reasonCode: "unsupported_protocol",
            reasonMessage: "Unsupported protocol interaction.",
            classifierVersion: "2026-04-19.1",
            heuristicsVersion: "2026-04-19.1",
            sourceObservationIds: ["raw_1"]
          }
        ]
      }
    }
  });

  await page.goto("/ledger?sessionId=session_empty");

  await expect(page.getByText("No qualifying connected-wallet activity was found")).toBeVisible();
  await expect(page.getByText("Discarded Activity")).toBeVisible();
  await expect(page.getByText("unsupported: Unsupported protocol interaction.")).toBeVisible();
});

test("renders a failure state with a retry action when no trusted ledger result is available", async ({ page }) => {
  await installConnectedWalletTestOverride(page, {
    walletAddress: "0x2000000000000000000000000000000000000002",
    chainId: 8453
  });
  await installConnectedWalletAnalysisTestOverride(page, {
    sessionId: "session_failure",
    payload: {
      sessionStatus: {
        session: {
          sessionId: "session_failure",
          walletAddress: "0x2000000000000000000000000000000000000002",
          chainId: 8453,
          status: "active",
          reusedSession: false,
          latestAcceptedRunId: null
        },
        latestAcceptedRun: null,
        lastFailure: {
          reconstructionRunId: "run_failure",
          sessionId: "session_failure",
          runMode: "initial",
          status: "failed",
          classifierVersion: "2026-04-19.1",
          heuristicsVersion: "2026-04-19.1",
          fromBlock: null,
          toBlock: null,
          startedAt: "2026-04-19T17:00:00.000Z",
          completedAt: "2026-04-19T17:00:10.000Z",
          errorSummary: "Base RPC unavailable"
        },
        latestRun: {
          reconstructionRunId: "run_failure",
          sessionId: "session_failure",
          runMode: "initial",
          status: "failed",
          classifierVersion: "2026-04-19.1",
          heuristicsVersion: "2026-04-19.1",
          fromBlock: null,
          toBlock: null,
          startedAt: "2026-04-19T17:00:00.000Z",
          completedAt: "2026-04-19T17:00:10.000Z",
          errorSummary: "Base RPC unavailable"
        },
        hasAcceptedProjection: false
      },
      projection: null,
      discardedActivity: null
    }
  });

  await page.goto("/ledger?sessionId=session_failure");

  await expect(page.getByText("Live reconstruction failed before a trusted ledger result was available")).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry live reconstruction" })).toBeVisible();
});

test("renders rich stale-context recovery guidance for wrong-chain sessions", async ({ page }) => {
  await installConnectedWalletTestOverride(page, {
    walletAddress: "0x2000000000000000000000000000000000000002",
    chainId: 1
  });
  await installConnectedWalletAnalysisTestOverride(page, {
    sessionId: "session_stale",
    payload: {
      sessionStatus: {
        session: {
          sessionId: "session_stale",
          walletAddress: "0x2000000000000000000000000000000000000002",
          chainId: 8453,
          status: "active",
          reusedSession: true,
          latestAcceptedRunId: "run_accepted"
        },
        latestAcceptedRun: {
          reconstructionRunId: "run_accepted",
          sessionId: "session_stale",
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
          sessionId: "session_stale",
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

  await page.goto("/ledger?sessionId=session_stale");

  await expect(page.getByText("Switch the connected wallet back to Base")).toBeVisible();
  await expect(page.getByText("Return to the connected-wallet entry flow")).toBeVisible();
});