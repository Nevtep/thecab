import {
  buildConnectedWalletStaleContextRecovery,
  deriveConnectedWalletAnalysisState,
  shouldAutoRecoverFailedConnectedWalletReconstruction,
  shouldAutoStartConnectedWalletReconstruction,
  shouldStartThrottledIncrementalRefresh,
  type ConnectedWalletContext
} from "@/ui/wallet/use-connected-wallet-analysis";

const connectedWallet = {
  walletAddress: "0x2000000000000000000000000000000000000002",
  chainId: 8453,
  connectorId: "injected",
  connectorName: "Injected",
  isConnected: true
} satisfies ConnectedWalletContext;

describe("connected wallet state flow", () => {
  it("derives running, empty, and failure states from the connected-wallet analysis model", () => {
    const running = deriveConnectedWalletAnalysisState({
      connectedWallet,
      sessionStatus: {
        session: {
          sessionId: "session_running",
          walletAddress: connectedWallet.walletAddress,
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
      isSessionLoading: false,
      isProjectionLoading: false,
      isRefreshPending: false
    });

    const empty = deriveConnectedWalletAnalysisState({
      connectedWallet,
      sessionStatus: {
        session: {
          sessionId: "session_empty",
          walletAddress: connectedWallet.walletAddress,
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
      isSessionLoading: false,
      isProjectionLoading: false,
      isRefreshPending: false
    });

    const failure = deriveConnectedWalletAnalysisState({
      connectedWallet,
      sessionStatus: {
        session: {
          sessionId: "session_failure",
          walletAddress: connectedWallet.walletAddress,
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
      isSessionLoading: false,
      isProjectionLoading: false,
      isRefreshPending: false
    });

    expect(running.state).toBe("reconstruction_running");
    expect(empty.state).toBe("empty");
    expect(failure.state).toBe("failure");
  });

  it("builds rich stale-context recovery guidance for wallet, chain, and connection mismatches", () => {
    const walletMismatchRecovery = buildConnectedWalletStaleContextRecovery("wallet_mismatch");
    const wrongChainRecovery = buildConnectedWalletStaleContextRecovery("wrong_chain");
    const reconnectRecovery = buildConnectedWalletStaleContextRecovery("not_connected");

    expect(walletMismatchRecovery.title).toContain("different wallet");
    expect(walletMismatchRecovery.primaryActionLabel).toContain("matching analysis");
    expect(wrongChainRecovery.title).toContain("Base");
    expect(wrongChainRecovery.primaryActionLabel).toContain("Switch back to Base");
    expect(reconnectRecovery.title).toContain("Reconnect");
    expect(reconnectRecovery.primaryActionLabel).toContain("Reconnect");
  });

  it("does not auto-start a new reconstruction after the latest run has failed", () => {
    expect(
      shouldAutoStartConnectedWalletReconstruction({
        session: {
          sessionId: "session_failure",
          walletAddress: connectedWallet.walletAddress,
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
      })
    ).toBe(false);

    expect(
      shouldAutoStartConnectedWalletReconstruction({
        session: {
          sessionId: "session_reused",
          walletAddress: connectedWallet.walletAddress,
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
      })
    ).toBe(false);
  });

  it("auto-recovers one failed reused session without an accepted projection", () => {
    expect(
      shouldAutoRecoverFailedConnectedWalletReconstruction({
        session: {
          sessionId: "session_reused_failure",
          walletAddress: connectedWallet.walletAddress,
          chainId: 8453,
          status: "active",
          reusedSession: true,
          latestAcceptedRunId: null
        },
        latestAcceptedRun: null,
        lastFailure: {
          reconstructionRunId: "run_failed",
          sessionId: "session_reused_failure",
          runMode: "initial",
          status: "failed",
          classifierVersion: "2026-04-19.1",
          heuristicsVersion: "2026-04-19.1",
          fromBlock: null,
          toBlock: null,
          startedAt: "2026-04-19T17:00:00.000Z",
          completedAt: "2026-04-19T17:00:10.000Z",
          errorSummary: "RPC failed"
        },
        latestRun: {
          reconstructionRunId: "run_failed",
          sessionId: "session_reused_failure",
          runMode: "initial",
          status: "failed",
          classifierVersion: "2026-04-19.1",
          heuristicsVersion: "2026-04-19.1",
          fromBlock: null,
          toBlock: null,
          startedAt: "2026-04-19T17:00:00.000Z",
          completedAt: "2026-04-19T17:00:10.000Z",
          errorSummary: "RPC failed"
        },
        hasAcceptedProjection: false
      })
    ).toBe(true);

    expect(
      shouldAutoRecoverFailedConnectedWalletReconstruction({
        session: {
          sessionId: "session_accepted_failure",
          walletAddress: connectedWallet.walletAddress,
          chainId: 8453,
          status: "active",
          reusedSession: true,
          latestAcceptedRunId: "run_accepted"
        },
        latestAcceptedRun: {
          reconstructionRunId: "run_accepted",
          sessionId: "session_accepted_failure",
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
        lastFailure: {
          reconstructionRunId: "run_failed_refresh",
          sessionId: "session_accepted_failure",
          runMode: "incremental",
          status: "failed",
          classifierVersion: "2026-04-19.1",
          heuristicsVersion: "2026-04-19.1",
          fromBlock: null,
          toBlock: null,
          startedAt: "2026-04-19T17:10:00.000Z",
          completedAt: "2026-04-19T17:10:10.000Z",
          errorSummary: "Refresh failed"
        },
        latestRun: {
          reconstructionRunId: "run_failed_refresh",
          sessionId: "session_accepted_failure",
          runMode: "incremental",
          status: "failed",
          classifierVersion: "2026-04-19.1",
          heuristicsVersion: "2026-04-19.1",
          fromBlock: null,
          toBlock: null,
          startedAt: "2026-04-19T17:10:00.000Z",
          completedAt: "2026-04-19T17:10:10.000Z",
          errorSummary: "Refresh failed"
        },
        hasAcceptedProjection: true
      })
    ).toBe(false);
  });

  it("starts throttled incremental refresh only on eligible triggers", () => {
    const acceptedSessionStatus = {
      session: {
        sessionId: "session_accepted",
        walletAddress: connectedWallet.walletAddress,
        chainId: 8453,
        status: "active",
        reusedSession: true,
        latestAcceptedRunId: "run_accepted"
      },
      latestAcceptedRun: {
        reconstructionRunId: "run_accepted",
        sessionId: "session_accepted",
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
        sessionId: "session_accepted",
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
    } as const;

    expect(
      shouldStartThrottledIncrementalRefresh({
        sessionStatus: acceptedSessionStatus,
        guard: { isCurrent: true, reason: null },
        hasAnalysisTestOverride: false,
        isStartPending: false,
        triggerType: "visibility",
        visibilityState: "visible",
        now: 10_000,
        lastTriggeredAt: null,
        cooldownMs: 5_000
      })
    ).toBe(true);

    expect(
      shouldStartThrottledIncrementalRefresh({
        sessionStatus: acceptedSessionStatus,
        guard: { isCurrent: true, reason: null },
        hasAnalysisTestOverride: false,
        isStartPending: false,
        triggerType: "visibility",
        visibilityState: "visible",
        now: 12_000,
        lastTriggeredAt: 10_000,
        cooldownMs: 5_000
      })
    ).toBe(false);

    expect(
      shouldStartThrottledIncrementalRefresh({
        sessionStatus: acceptedSessionStatus,
        guard: { isCurrent: true, reason: null },
        hasAnalysisTestOverride: false,
        isStartPending: false,
        triggerType: "visibility",
        visibilityState: "hidden",
        now: 20_000,
        lastTriggeredAt: 10_000,
        cooldownMs: 5_000
      })
    ).toBe(false);

    expect(
      shouldStartThrottledIncrementalRefresh({
        sessionStatus: acceptedSessionStatus,
        guard: { isCurrent: false, reason: "wrong_chain" },
        hasAnalysisTestOverride: false,
        isStartPending: false,
        triggerType: "focus",
        visibilityState: "visible",
        now: 20_000,
        lastTriggeredAt: 10_000,
        cooldownMs: 5_000
      })
    ).toBe(false);
  });
});