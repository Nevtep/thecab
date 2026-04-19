"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useAccount, useChainId } from "wagmi";
import { base } from "wagmi/chains";

import {
  type AnalysisSessionResponse,
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

declare global {
  interface Window {
    __THE_CAB_TEST_WALLET__?: ConnectedWalletContext;
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
  | "failure";

export type SessionBootstrapInput = {
  walletAddress: string;
  chainId: number;
  connectionSource: string;
};

const CONNECTED_WALLET_TEST_OVERRIDE_EVENT = "thecab:test-wallet-changed";

async function readJson<T>(response: Response) {
  return (await response.json().catch(() => ({}))) as T;
}

function readConnectedWalletTestOverride() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.__THE_CAB_TEST_WALLET__ ?? null;
}

export function buildSessionStatusQueryKey(sessionId: string) {
  return ["analysis-session", sessionId, "status"] as const;
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
  if (latestRun && ["pending", "ingesting", "normalizing", "projecting"].includes(latestRun.status)) {
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

export function useSessionStatusQuery(sessionId: string | null) {
  return useQuery({
    queryKey: sessionId ? buildSessionStatusQueryKey(sessionId) : ["analysis-session", "idle", "status"],
    enabled: Boolean(sessionId),
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