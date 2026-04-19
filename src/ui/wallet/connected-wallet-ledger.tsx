"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { base } from "wagmi/chains";

import {
  buildConnectedWalletAnalysisState,
  switchConnectedWalletTestOverrideToBase,
  useBootstrapConnectedWalletSessionMutation,
  useConnectedWalletContext
} from "@/ui/wallet/use-connected-wallet-analysis";

type BootstrappedSession = {
  sessionId: string;
  reusedSession: boolean;
};

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function ConnectedWalletLedger() {
  const router = useRouter();
  const connectedWallet = useConnectedWalletContext();
  const { connect, connectors, error: connectError, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, error: switchError, isPending: isSwitching } = useSwitchChain();
  const bootstrapSession = useBootstrapConnectedWalletSessionMutation();
  const [openedSession, setOpenedSession] = useState<BootstrappedSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isNavigating, startNavigationTransition] = useTransition();

  const isSessionLoading = bootstrapSession.isPending || isNavigating;
  const entryState = buildConnectedWalletAnalysisState({
    isConnected: connectedWallet.isConnected,
    chainId: connectedWallet.chainId,
    isSessionLoading,
    sessionStatus: null,
    hasProjection: false
  });
  const isOnBase = connectedWallet.chainId === base.id;
  const activeError = error ?? bootstrapSession.error?.message ?? switchError?.message ?? connectError?.message ?? null;

  const switchToBase = async () => {
    setError(null);

    if (switchConnectedWalletTestOverrideToBase()) {
      return;
    }

    await switchChainAsync({ chainId: base.id });
  };

  const runAnalysis = () => {
    if (!connectedWallet.walletAddress) {
      setError("Connect a wallet before running reconstruction.");
      return;
    }

    if (connectedWallet.chainId !== base.id) {
      setError("Switch the connected wallet to Base before starting analysis.");
      return;
    }

    setError(null);

    bootstrapSession.mutate(
      {
        walletAddress: connectedWallet.walletAddress,
        chainId: connectedWallet.chainId,
        connectionSource: connectedWallet.connectorId ?? "injected"
      },
      {
        onSuccess: (session) => {
          setOpenedSession({
            sessionId: session.sessionId,
            reusedSession: session.reusedSession
          });
          startNavigationTransition(() => {
            router.push(`/ledger?sessionId=${session.sessionId}`);
          });
        }
      }
    );
  };

  return (
    <section className="wallet-panel">
      <div className="wallet-panel__header">
        <p className="eyebrow">Connected Wallet</p>
        <h2>Analyze live Base activity</h2>
      </div>

      {entryState === "not_connected" ? (
        <>
          <p className="wallet-panel__body">
            Connect one wallet, validate that it is on Base, and start or resume its analysis
            session directly from the connected wallet context.
          </p>
          <div className="wallet-panel__actions">
            {connectors.map((availableConnector) => (
              <button
                key={availableConnector.uid}
                className="button"
                disabled={isConnecting}
                onClick={() => {
                  setError(null);
                  connect({ connector: availableConnector });
                }}
                type="button"
              >
                Connect with {availableConnector.name}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="wallet-card">
            <p>
              Wallet: <strong>{truncateAddress(connectedWallet.walletAddress ?? "")}</strong>
            </p>
            <p>
              Connector: <strong>{connectedWallet.connectorName ?? "Unknown"}</strong>
            </p>
            <p>
              Network: <strong>{isOnBase ? "Base" : `Chain ${connectedWallet.chainId}`}</strong>
            </p>
          </div>

          <div className="wallet-panel__actions">
            {entryState === "wrong_chain" ? (
              <button
                className="button"
                disabled={isSwitching}
                onClick={() => void switchToBase()}
                type="button"
              >
                Switch to Base
              </button>
            ) : (
              <button
                className="button"
                disabled={isSessionLoading}
                onClick={runAnalysis}
                type="button"
              >
                {entryState === "session_loading"
                  ? "Starting connected-wallet analysis..."
                  : "Start analysis from connected wallet"}
              </button>
            )}
            <button className="button button--secondary" onClick={() => disconnect()} type="button">
              Disconnect
            </button>
          </div>
        </>
      )}

      {openedSession ? (
        <p className="status success">
          Session {openedSession.reusedSession ? "resumed" : "created"}. Opening the ledger view for{" "}
          {openedSession.sessionId}. If navigation is blocked, open{" "}
          <Link href={`/ledger?sessionId=${openedSession.sessionId}`}>the session ledger manually</Link>.
        </p>
      ) : null}
      {activeError ? <p className="status error">{activeError}</p> : null}
      {!process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ? (
        <p className="status warning">
          WalletConnect is enabled when <strong>NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID</strong> is set.
          Injected wallets remain available without it.
        </p>
      ) : null}
    </section>
  );
}