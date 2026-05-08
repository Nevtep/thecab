"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useAccount, useChainId } from "wagmi";
import { base } from "wagmi/chains";

import {
  type AccountingBootstrapResponse,
  type AccountingRebalanceFlowsResponse,
  type AccountingResponse,
  type AccountingTimeSeriesResponse,
  type DashboardDisplayState,
} from "@/domains/accounting/contracts/accounting-api-schemas";
import {
  type AnalysisSessionResponse,
  type DiscardedActivityListResponse,
  type LedgerProjectionResponse,
  type ReconstructionRunResponse,
  type SessionStatusResponse
} from "@/domains/ledger/contracts/ledger-api-schemas";

type ApiErrorResponse = {
  error?: string;
};

export type ConnectedWalletContext = {
  walletAddress: string | null;
  chainId: number | null;
  connectorId: string | null;
  connectorName: string | null;
  isConnected: boolean;
};

export type ConnectedWalletAnalysisTestOverride = {
  sessionStatus: SessionStatusResponse | null;
  projection: LedgerProjectionResponse | null;
  accounting?: AccountingResponse | null;
  accountingBootstrap?: AccountingBootstrapResponse | null;
  accountingTimeSeries?: AccountingTimeSeriesResponse | null;
  accountingRebalanceFlows?: AccountingRebalanceFlowsResponse | null;
  discardedActivity: DiscardedActivityListResponse | null;
  errorMessage?: string | null;
  isLoadingSession?: boolean;
  isLoadingProjection?: boolean;
  isRefreshing?: boolean;
};

declare global {
  interface Window {
    __THE_CAB_TEST_WALLET__?: ConnectedWalletContext;
    __THE_CAB_TEST_ANALYSIS__?: Record<string, ConnectedWalletAnalysisTestOverride>;
  }
}

export type LedgerEntryViewState =
  | "not_connected"
  | "wrong_chain"
  | "ready"
  | "session_loading"
  | "reconstruction_running"
  | "refreshing_with_latest"
  | "success"
  | "empty"
  | "failure"
  | "stale_context";

export type SessionContextGuardReason =
  | "wallet_mismatch"
  | "wrong_chain"
  | "not_connected"
  | null;

export type SessionContextGuard = {
  isCurrent: boolean;
  reason: SessionContextGuardReason;
};

export type StaleContextRecoveryAction = "return_home" | "switch_to_base";

export type ConnectedWalletStaleContextRecovery = {
  title: string;
  description: string;
  primaryActionLabel: string;
  primaryAction: StaleContextRecoveryAction;
};

export type ConnectedWalletAnalysisResult = {
  state: LedgerEntryViewState;
  dashboardDisplayState: DashboardDisplayState;
  guard: SessionContextGuard;
  connectedWallet: ConnectedWalletContext;
  sessionStatus: SessionStatusResponse | null;
  projection: LedgerProjectionResponse | null;
  accounting: AccountingResponse | null;
  accountingBootstrap: AccountingBootstrapResponse | null;
  accountingTimeSeries: AccountingTimeSeriesResponse | null;
  accountingRebalanceFlows: AccountingRebalanceFlowsResponse | null;
  discardedActivity: DiscardedActivityListResponse | null;
  isLoadingSession: boolean;
  isLoadingProjection: boolean;
  isRefreshing: boolean;
  errorMessage: string | null;
  retryAnalysis: () => void;
};

export type SessionBootstrapInput = {
  walletAddress: string;
  chainId: number;
  connectionSource: string;
};

const CONNECTED_WALLET_TEST_OVERRIDE_EVENT = "thecab:test-wallet-changed";
const CONNECTED_WALLET_ANALYSIS_TEST_OVERRIDE_EVENT = "thecab:test-analysis-changed";
const RUNNING_RECONSTRUCTION_STATUSES = ["pending", "ingesting", "normalizing", "projecting"] as const;
const AUTO_REFRESH_INTERVAL_MS = 15_000;

function mapLedgerStateToDashboardDisplayState(state: LedgerEntryViewState): DashboardDisplayState {
  switch (state) {
    case "session_loading":
    case "reconstruction_running":
      return "loading";
    case "failure":
      return "failure";
    case "empty":
      return "empty";
    case "refreshing_with_latest":
      return "partial";
    default:
      return "ready";
  }
}

function mapBootstrapStateToDashboardDisplayState(
  bootstrapState: AccountingBootstrapResponse["bootstrapState"] | null | undefined,
  fallback: DashboardDisplayState
): DashboardDisplayState {
  if (bootstrapState === "empty") {
    return "empty";
  }

  if (bootstrapState === "warming") {
    return "partial";
  }

  if (bootstrapState === "ready") {
    return "ready";
  }

  return fallback;
}

function isRunningReconstructionStatus(
  status: ReconstructionRunResponse["status"] | null | undefined
): status is (typeof RUNNING_RECONSTRUCTION_STATUSES)[number] {
  return Boolean(status) && RUNNING_RECONSTRUCTION_STATUSES.includes(status as (typeof RUNNING_RECONSTRUCTION_STATUSES)[number]);
}

async function readJson<T>(response: Response) {
  return (await response.json().catch(() => ({}))) as T;
}

function readConnectedWalletTestOverride() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.__THE_CAB_TEST_WALLET__ ?? null;
}

function readConnectedWalletAnalysisTestOverride(sessionId: string) {
  if (typeof window === "undefined") {
    return null;
  }

  return window.__THE_CAB_TEST_ANALYSIS__?.[sessionId] ?? null;
}

export function buildSessionStatusQueryKey(sessionId: string) {
  return ["analysis-session", sessionId, "status"] as const;
}

export function buildLedgerProjectionQueryKey(sessionId: string) {
  return ["analysis-session", sessionId, "ledger"] as const;
}

export function buildDiscardedActivityQueryKey(sessionId: string) {
  return ["analysis-session", sessionId, "discarded-activity"] as const;
}

export function buildAccountingQueryKey(sessionId: string) {
  return ["analysis-session", sessionId, "accounting"] as const;
}

export function buildAccountingBootstrapQueryKey(sessionId: string) {
  return ["analysis-session", sessionId, "accounting-bootstrap"] as const;
}

export function buildAccountingTimeSeriesQueryKey(sessionId: string) {
  return ["analysis-session", sessionId, "accounting-time-series"] as const;
}

export function buildAccountingRebalanceFlowsQueryKey(sessionId: string) {
  return ["analysis-session", sessionId, "accounting-rebalance-flows"] as const;
}

export function buildConnectedWalletSessionGuard(input: {
  connectedWallet: ConnectedWalletContext;
  session:
    | {
        walletAddress: string;
        chainId: number;
      }
    | null;
}): SessionContextGuard {
  if (!input.connectedWallet.isConnected) {
    return {
      isCurrent: false,
      reason: "not_connected"
    };
  }

  if (!input.session) {
    return {
      isCurrent: true,
      reason: null
    };
  }

  if (input.connectedWallet.chainId !== input.session.chainId) {
    return {
      isCurrent: false,
      reason: "wrong_chain"
    };
  }

  if (input.connectedWallet.walletAddress?.toLowerCase() !== input.session.walletAddress.toLowerCase()) {
    return {
      isCurrent: false,
      reason: "wallet_mismatch"
    };
  }

  return {
    isCurrent: true,
    reason: null
  };
}

export function buildConnectedWalletAnalysisState(input: {
  isConnected: boolean;
  chainId: number | null;
  isSessionLoading: boolean;
  sessionStatus: SessionStatusResponse | null;
  hasProjection: boolean;
}) : LedgerEntryViewState {
  if (!input.isConnected) {
    return "not_connected";
  }

  if (input.chainId !== base.id) {
    return "wrong_chain";
  }

  if (input.isSessionLoading) {
    return "session_loading";
  }

  const latestRun = input.sessionStatus?.latestRun;
  if (latestRun && isRunningReconstructionStatus(latestRun.status)) {
    return input.sessionStatus?.hasAcceptedProjection ? "refreshing_with_latest" : "reconstruction_running";
  }

  if (latestRun?.status === "failed") {
    return "failure";
  }

  if (input.hasProjection) {
    return "success";
  }

  return "ready";
}

export function buildConnectedWalletStaleContextRecovery(
  reason: SessionContextGuardReason
): ConnectedWalletStaleContextRecovery {
  switch (reason) {
    case "wrong_chain":
      return {
        title: "Switch the connected wallet back to Base",
        description: "Trusted ledger results stay locked until the wallet returns to the same Base network used for this session.",
        primaryActionLabel: "Switch back to Base",
        primaryAction: "switch_to_base"
      };
    case "wallet_mismatch":
      return {
        title: "This session belongs to a different wallet",
        description: "Return to a matching analysis so the connected wallet and persisted session agree before trusted results render.",
        primaryActionLabel: "Return to a matching analysis",
        primaryAction: "return_home"
      };
    case "not_connected":
      return {
        title: "Reconnect the wallet that owns this session",
        description: "Trusted ledger results stay guarded until the original connected wallet is available again.",
        primaryActionLabel: "Reconnect the matching wallet",
        primaryAction: "return_home"
      };
    default:
      return {
        title: "Return to a matching connected-wallet analysis",
        description: "Trusted results only render when the connected wallet context matches the persisted session.",
        primaryActionLabel: "Return to the connected-wallet entry flow",
        primaryAction: "return_home"
      };
  }
}

export function deriveConnectedWalletAnalysisState(input: {
  connectedWallet: ConnectedWalletContext;
  sessionStatus: SessionStatusResponse | null;
  projection: LedgerProjectionResponse | null;
  isSessionLoading: boolean;
  isProjectionLoading: boolean;
  isRefreshPending: boolean;
}): {
  state: LedgerEntryViewState;
  guard: SessionContextGuard;
} {
  if (input.isSessionLoading) {
    return {
      state: "session_loading",
      guard: {
        isCurrent: true,
        reason: null
      }
    };
  }

  const guard = buildConnectedWalletSessionGuard({
    connectedWallet: input.connectedWallet,
    session: input.sessionStatus?.session ?? null
  });

  if (!guard.isCurrent) {
    return {
      state: "stale_context",
      guard
    };
  }

  const latestRun = input.sessionStatus?.latestRun;
  const hasVisibleProjection = Boolean(
    input.projection &&
      (input.projection.pools.length > 0 || input.projection.residualHoldings.length > 0)
  );

  if (
    input.isRefreshPending ||
    (latestRun && isRunningReconstructionStatus(latestRun.status))
  ) {
    return {
      state: input.sessionStatus?.hasAcceptedProjection ? "refreshing_with_latest" : "reconstruction_running",
      guard
    };
  }

  if (latestRun?.status === "failed") {
    return {
      state: input.sessionStatus?.hasAcceptedProjection ? "success" : "failure",
      guard
    };
  }

  if (input.sessionStatus?.hasAcceptedProjection && input.isProjectionLoading) {
    return {
      state: "session_loading",
      guard
    };
  }

  if (input.sessionStatus?.hasAcceptedProjection) {
    return {
      state: hasVisibleProjection ? "success" : "empty",
      guard
    };
  }

  return {
    state: "reconstruction_running",
    guard
  };
}

export function useConnectedWalletContext(): ConnectedWalletContext {
  const chainId = useChainId();
  const { address, connector, isConnected } = useAccount();
  const [testOverride, setTestOverride] = useState<ConnectedWalletContext | null>(() =>
    readConnectedWalletTestOverride()
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleOverrideChange = () => {
      setTestOverride(readConnectedWalletTestOverride());
    };

    handleOverrideChange();
    window.addEventListener(CONNECTED_WALLET_TEST_OVERRIDE_EVENT, handleOverrideChange);
    return () => {
      window.removeEventListener(CONNECTED_WALLET_TEST_OVERRIDE_EVENT, handleOverrideChange);
    };
  }, []);

  return useMemo(
    () =>
      testOverride ?? {
        walletAddress: address ?? null,
        chainId: chainId ?? null,
        connectorId: connector?.id ?? null,
        connectorName: connector?.name ?? null,
        isConnected
      },
    [address, chainId, connector, isConnected, testOverride]
  );
}

export function switchConnectedWalletTestOverrideToBase() {
  if (typeof window === "undefined" || !window.__THE_CAB_TEST_WALLET__) {
    return false;
  }

  window.__THE_CAB_TEST_WALLET__ = {
    ...window.__THE_CAB_TEST_WALLET__,
    chainId: base.id
  };
  window.dispatchEvent(new Event(CONNECTED_WALLET_TEST_OVERRIDE_EVENT));
  return true;
}

export function useSessionStatusQuery(sessionId: string | null, enabled = true) {
  return useQuery({
    queryKey: sessionId ? buildSessionStatusQueryKey(sessionId) : ["analysis-session", "idle", "status"],
    enabled: Boolean(sessionId) && enabled,
    refetchInterval: (query) => {
      const data = query.state.data as SessionStatusResponse | undefined;
      const latestStatus = data?.latestRun?.status;

      return isRunningReconstructionStatus(latestStatus) ? 2_500 : false;
    },
    queryFn: async () => {
      if (!sessionId) {
        throw new Error("A session id is required to query session status.");
      }

      const response = await fetch(`/api/analysis-sessions/${sessionId}`);
      const payload = await readJson<SessionStatusResponse & ApiErrorResponse>(response);

      if (!response.ok || !payload.session) {
        throw new Error(payload.error ?? "Unable to load session status.");
      }

      return payload;
    }
  });
}

export function useBootstrapConnectedWalletSessionMutation() {
  return useMutation({
    mutationFn: async (input: SessionBootstrapInput) => {
      const response = await fetch("/api/analysis-sessions", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(input)
      });
      const payload = await readJson<AnalysisSessionResponse & ApiErrorResponse>(response);

      if (!response.ok || !payload.sessionId) {
        throw new Error(payload.error ?? "Unable to start analysis for the connected wallet.");
      }

      return payload;
    }
  });
}

export function useStartReconstructionMutation(sessionId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (mode: ReconstructionRunResponse["runMode"] = "initial") => {
      if (!sessionId) {
        throw new Error("A session id is required to start reconstruction.");
      }

      const response = await fetch(`/api/analysis-sessions/${sessionId}/reconstructions`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ mode })
      });
      const payload = await readJson<ReconstructionRunResponse & ApiErrorResponse>(response);

      if (!response.ok || !payload.reconstructionRunId) {
        throw new Error(payload.error ?? "Unable to start reconstruction.");
      }

      return payload;
    },
    onSuccess: async () => {
      if (sessionId) {
        await queryClient.invalidateQueries({
          queryKey: buildSessionStatusQueryKey(sessionId)
        });
      }
    }
  });
}

export function useLedgerProjectionQuery(sessionId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: sessionId ? buildLedgerProjectionQueryKey(sessionId) : ["analysis-session", "idle", "ledger"],
    enabled: Boolean(sessionId) && enabled,
    queryFn: async () => {
      if (!sessionId) {
        throw new Error("A session id is required to query the ledger projection.");
      }

      const response = await fetch(`/api/analysis-sessions/${sessionId}/ledger`);
      const payload = await readJson<LedgerProjectionResponse & ApiErrorResponse>(response);

      if (!response.ok || !payload.contractVersion) {
        throw new Error(payload.error ?? "Unable to load the latest ledger projection.");
      }

      return payload;
    }
  });
}

export function useDiscardedActivityQuery(sessionId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: sessionId
      ? buildDiscardedActivityQueryKey(sessionId)
      : ["analysis-session", "idle", "discarded-activity"],
    enabled: Boolean(sessionId) && enabled,
    queryFn: async () => {
      if (!sessionId) {
        throw new Error("A session id is required to query discarded activity.");
      }

      const response = await fetch(`/api/analysis-sessions/${sessionId}/discarded-activity`);
      const payload = await readJson<DiscardedActivityListResponse & ApiErrorResponse>(response);

      if (!response.ok || !payload.contractVersion) {
        throw new Error(payload.error ?? "Unable to load discarded activity.");
      }

      return payload;
    }
  });
}

export function useAccountingQuery(sessionId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: sessionId ? buildAccountingQueryKey(sessionId) : ["analysis-session", "idle", "accounting"],
    enabled: Boolean(sessionId) && enabled,
    queryFn: async () => {
      if (!sessionId) {
        throw new Error("A session id is required to query accounting.");
      }

      const response = await fetch(`/api/analysis-sessions/${sessionId}/accounting`);
      const payload = await readJson<AccountingResponse & ApiErrorResponse>(response);

      if (!response.ok || !payload.contractVersion) {
        throw new Error(payload.error ?? "Unable to load portfolio accounting.");
      }

      return payload;
    }
  });
}

export function useAccountingBootstrapQuery(sessionId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: sessionId ? buildAccountingBootstrapQueryKey(sessionId) : ["analysis-session", "idle", "accounting-bootstrap"],
    enabled: Boolean(sessionId) && enabled,
    queryFn: async () => {
      if (!sessionId) {
        throw new Error("A session id is required to query accounting bootstrap.");
      }

      const response = await fetch(`/api/analysis-sessions/${sessionId}/accounting/bootstrap`);
      const payload = await readJson<AccountingBootstrapResponse & ApiErrorResponse>(response);

      if (!response.ok || !payload.contractVersion) {
        throw new Error(payload.error ?? "Unable to load accounting bootstrap.");
      }

      return payload;
    }
  });
}

export function useAccountingTimeSeriesQuery(sessionId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: sessionId ? buildAccountingTimeSeriesQueryKey(sessionId) : ["analysis-session", "idle", "accounting-time-series"],
    enabled: Boolean(sessionId) && enabled,
    queryFn: async () => {
      if (!sessionId) {
        throw new Error("A session id is required to query accounting time series.");
      }

      const response = await fetch(`/api/analysis-sessions/${sessionId}/accounting/time-series`);
      const payload = await readJson<AccountingTimeSeriesResponse & ApiErrorResponse>(response);

      if (!response.ok || !payload.contractVersion) {
        throw new Error(payload.error ?? "Unable to load accounting time series.");
      }

      return payload;
    }
  });
}

export function useAccountingRebalanceFlowsQuery(sessionId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: sessionId
      ? buildAccountingRebalanceFlowsQueryKey(sessionId)
      : ["analysis-session", "idle", "accounting-rebalance-flows"],
    enabled: Boolean(sessionId) && enabled,
    queryFn: async () => {
      if (!sessionId) {
        throw new Error("A session id is required to query accounting rebalance flows.");
      }

      const response = await fetch(`/api/analysis-sessions/${sessionId}/accounting/rebalance-flows`);
      const payload = await readJson<AccountingRebalanceFlowsResponse & ApiErrorResponse>(response);

      if (!response.ok || !payload.contractVersion) {
        throw new Error(payload.error ?? "Unable to load accounting rebalance flows.");
      }

      return payload;
    }
  });
}

export function shouldAutoStartConnectedWalletReconstruction(
  sessionStatus: SessionStatusResponse | null
) {
  const latestRun = sessionStatus?.latestRun;

  if (!sessionStatus) {
    return false;
  }

  if (!latestRun) {
    return true;
  }

  if (isRunningReconstructionStatus(latestRun.status)) {
    return false;
  }

  if (latestRun.status === "failed") {
    return false;
  }

  if (sessionStatus.hasAcceptedProjection) {
    return false;
  }

  return true;
}

export function shouldAutoRecoverFailedConnectedWalletReconstruction(
  sessionStatus: SessionStatusResponse | null
) {
  if (!sessionStatus) {
    return false;
  }

  return Boolean(
    sessionStatus.session.reusedSession &&
      !sessionStatus.hasAcceptedProjection &&
      sessionStatus.latestRun?.status === "failed"
  );
}

export function useConnectedWalletAnalysis(sessionId: string): ConnectedWalletAnalysisResult {
  const connectedWallet = useConnectedWalletContext();
  const [analysisTestOverride, setAnalysisTestOverride] = useState<ConnectedWalletAnalysisTestOverride | null>(
    () => readConnectedWalletAnalysisTestOverride(sessionId)
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleOverrideChange = () => {
      setAnalysisTestOverride(readConnectedWalletAnalysisTestOverride(sessionId));
    };

    handleOverrideChange();
    window.addEventListener(CONNECTED_WALLET_ANALYSIS_TEST_OVERRIDE_EVENT, handleOverrideChange);
    return () => {
      window.removeEventListener(CONNECTED_WALLET_ANALYSIS_TEST_OVERRIDE_EVENT, handleOverrideChange);
    };
  }, [sessionId]);

  const hasAnalysisTestOverride = analysisTestOverride !== null;
  const sessionStatusQuery = useSessionStatusQuery(sessionId, !hasAnalysisTestOverride);
  const startReconstruction = useStartReconstructionMutation(sessionId);
  const guard = buildConnectedWalletSessionGuard({
    connectedWallet,
    session: sessionStatusQuery.data?.session ?? null
  });
  const projectionQuery = useLedgerProjectionQuery(
    sessionId,
    !hasAnalysisTestOverride && Boolean(sessionStatusQuery.data?.hasAcceptedProjection) && guard.isCurrent
  );
  const discardedActivityQuery = useDiscardedActivityQuery(
    sessionId,
    !hasAnalysisTestOverride && Boolean(sessionStatusQuery.data?.hasAcceptedProjection) && guard.isCurrent
  );
  const accountingBootstrapQuery = useAccountingBootstrapQuery(
    sessionId,
    !hasAnalysisTestOverride && guard.isCurrent
  );
  const accountingQuery = useAccountingQuery(
    sessionId,
    !hasAnalysisTestOverride &&
      Boolean(sessionStatusQuery.data?.hasAcceptedProjection) &&
      guard.isCurrent &&
      Boolean(
        accountingBootstrapQuery.data?.hasAcceptedSnapshot &&
          accountingBootstrapQuery.data.bootstrapState !== "empty"
      )
  );
  const accountingTimeSeriesQuery = useAccountingTimeSeriesQuery(
    sessionId,
    !hasAnalysisTestOverride && Boolean(sessionStatusQuery.data?.hasAcceptedProjection) && guard.isCurrent
  );
  const accountingRebalanceFlowsQuery = useAccountingRebalanceFlowsQuery(
    sessionId,
    !hasAnalysisTestOverride && Boolean(sessionStatusQuery.data?.hasAcceptedProjection) && guard.isCurrent
  );
  const [refreshRequestSignature, setRefreshRequestSignature] = useState<string | null>(null);
  const [hasAutoRecoveredFailedRun, setHasAutoRecoveredFailedRun] = useState(false);

  useEffect(() => {
    if (hasAnalysisTestOverride || !sessionStatusQuery.data || !guard.isCurrent || startReconstruction.isPending) {
      return;
    }

    if (
      !hasAutoRecoveredFailedRun &&
      shouldAutoRecoverFailedConnectedWalletReconstruction(sessionStatusQuery.data)
    ) {
      setHasAutoRecoveredFailedRun(true);
      startReconstruction.mutate("initial");
      return;
    }

    if (!shouldAutoStartConnectedWalletReconstruction(sessionStatusQuery.data)) {
      return;
    }

    const latestRun = sessionStatusQuery.data.latestRun;

    const requestedSignature = [
      sessionId,
      sessionStatusQuery.data.latestAcceptedRun?.reconstructionRunId ?? "no-accepted-run",
      latestRun?.reconstructionRunId ?? "no-latest-run"
    ].join(":");

    if (refreshRequestSignature === requestedSignature) {
      return;
    }

    setRefreshRequestSignature(requestedSignature);
    startReconstruction.mutate(
      sessionStatusQuery.data.hasAcceptedProjection ? "incremental" : "initial"
    );
  }, [
    guard.isCurrent,
    refreshRequestSignature,
    sessionId,
    sessionStatusQuery.data,
    startReconstruction,
    hasAnalysisTestOverride
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    if (hasAnalysisTestOverride || !sessionStatusQuery.data || !guard.isCurrent || startReconstruction.isPending) {
      return undefined;
    }

    const latestRun = sessionStatusQuery.data.latestRun;
    if (!sessionStatusQuery.data.hasAcceptedProjection || !latestRun) {
      return undefined;
    }

    if (isRunningReconstructionStatus(latestRun.status) || latestRun.status === "failed") {
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      startReconstruction.mutate("incremental");
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [
    guard.isCurrent,
    hasAnalysisTestOverride,
    sessionStatusQuery.data,
    startReconstruction
  ]);

  if (analysisTestOverride) {
    const derivedState = deriveConnectedWalletAnalysisState({
      connectedWallet,
      sessionStatus: analysisTestOverride.sessionStatus,
      projection: analysisTestOverride.projection,
      isSessionLoading: analysisTestOverride.isLoadingSession ?? false,
      isProjectionLoading: analysisTestOverride.isLoadingProjection ?? false,
      isRefreshPending: analysisTestOverride.isRefreshing ?? false
    });

    return {
      state: derivedState.state,
      dashboardDisplayState:
        mapBootstrapStateToDashboardDisplayState(
          analysisTestOverride.accountingBootstrap?.bootstrapState,
          mapLedgerStateToDashboardDisplayState(derivedState.state)
        ),
      guard: derivedState.guard,
      connectedWallet,
      sessionStatus: analysisTestOverride.sessionStatus,
      projection: analysisTestOverride.projection,
      accounting: analysisTestOverride.accounting ?? null,
      accountingBootstrap: analysisTestOverride.accountingBootstrap ?? null,
      accountingTimeSeries: analysisTestOverride.accountingTimeSeries ?? null,
      accountingRebalanceFlows: analysisTestOverride.accountingRebalanceFlows ?? null,
      discardedActivity: analysisTestOverride.discardedActivity,
      isLoadingSession: analysisTestOverride.isLoadingSession ?? false,
      isLoadingProjection: analysisTestOverride.isLoadingProjection ?? false,
      isRefreshing: analysisTestOverride.isRefreshing ?? false,
      errorMessage: analysisTestOverride.errorMessage ?? null,
      retryAnalysis: () => {}
    };
  }

  const derivedState = deriveConnectedWalletAnalysisState({
    connectedWallet,
    sessionStatus: sessionStatusQuery.data ?? null,
    projection: projectionQuery.data ?? null,
    isSessionLoading: sessionStatusQuery.isLoading,
    isProjectionLoading: projectionQuery.isLoading,
    isRefreshPending: startReconstruction.isPending
  });

  return {
    state: derivedState.state,
    dashboardDisplayState:
      mapBootstrapStateToDashboardDisplayState(
        accountingBootstrapQuery.data?.bootstrapState,
        mapLedgerStateToDashboardDisplayState(derivedState.state)
      ),
    guard: derivedState.guard,
    connectedWallet,
    sessionStatus: sessionStatusQuery.data ?? null,
    projection: projectionQuery.data ?? null,
    accounting: accountingQuery.data ?? null,
    accountingBootstrap: accountingBootstrapQuery.data ?? null,
    accountingTimeSeries: accountingTimeSeriesQuery.data ?? null,
    accountingRebalanceFlows: accountingRebalanceFlowsQuery.data ?? null,
    discardedActivity: discardedActivityQuery.data ?? null,
    isLoadingSession: sessionStatusQuery.isLoading,
    isLoadingProjection: projectionQuery.isLoading,
    isRefreshing:
      startReconstruction.isPending ||
      Boolean(
        sessionStatusQuery.data?.latestRun &&
          isRunningReconstructionStatus(sessionStatusQuery.data.latestRun.status)
      ),
    errorMessage:
      (sessionStatusQuery.error as Error | null)?.message ??
      (projectionQuery.error as Error | null)?.message ??
      (accountingBootstrapQuery.error as Error | null)?.message ??
      (accountingTimeSeriesQuery.error as Error | null)?.message ??
      (accountingRebalanceFlowsQuery.error as Error | null)?.message ??
      (accountingQuery.error as Error | null)?.message ??
      (discardedActivityQuery.error as Error | null)?.message ??
      startReconstruction.error?.message ??
      null,
    retryAnalysis: () => {
      if (!guard.isCurrent) {
        return;
      }

      startReconstruction.mutate(
        sessionStatusQuery.data?.hasAcceptedProjection ? "incremental" : "initial"
      );
    }
  };
}