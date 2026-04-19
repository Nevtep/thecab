"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  useAccount,
  useChainId,
  useConnect,
  useDisconnect,
  useSwitchChain
} from "wagmi";
import { base } from "wagmi/chains";

type ApiErrorResponse = {
  error?: string;
};

type AnalysisSessionResponse = {
  sessionId: string;
  walletAddress: string;
  chainId: number;
  status: string;
  latestAcceptedRunId: string | null;
};

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

async function readJson<T>(response: Response) {
  return (await response.json().catch(() => ({}))) as T;
}

export function ConnectedWalletLedger() {
  const router = useRouter();
  const chainId = useChainId();
  const { address, connector, isConnected } = useAccount();
  const { connect, connectors, error: connectError, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, error: switchError, isPending: isSwitching } = useSwitchChain();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, startAnalyzeTransition] = useTransition();

  const isOnBase = chainId === base.id;

  const runAnalysis = async () => {
    if (!address) {
      setError("Connect a wallet before running reconstruction.");
      return;
    }

    setError(null);

    const sessionResponse = await fetch("/api/analysis-sessions", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        walletAddress: address,
        chainId: base.id,
        connectionSource: connector?.id ?? "walletconnect"
      })
    });
    const sessionPayload = await readJson<AnalysisSessionResponse & ApiErrorResponse>(sessionResponse);

    if (!sessionResponse.ok || !sessionPayload.sessionId) {
      setError(sessionPayload.error ?? "Unable to create a wallet analysis session.");
      return;
    }

    setSessionId(sessionPayload.sessionId);

    const reconstructionResponse = await fetch(
      `/api/analysis-sessions/${sessionPayload.sessionId}/reconstructions`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ mode: "initial" })
      }
    );
    const reconstructionPayload = await readJson<ApiErrorResponse>(reconstructionResponse);

    if (!reconstructionResponse.ok) {
      setError(reconstructionPayload.error ?? "Unable to reconstruct the connected wallet.");
      return;
    }

    router.push(`/ledger?sessionId=${sessionPayload.sessionId}`);
  };

  return (
    <section className="wallet-panel">
      <div className="wallet-panel__header">
        <p className="eyebrow">Connected Wallet</p>
        <h2>Analyze live Base activity</h2>
      </div>

      {!isConnected ? (
        <>
          <p className="wallet-panel__body">
            Connect a wallet on Base, create a live analysis session, and reconstruct its
            canonical ledger from onchain transaction receipts and logs.
          </p>
          <div className="wallet-panel__actions">
            {connectors.map((availableConnector) => (
              <button
                key={availableConnector.uid}
                className="button"
                disabled={isConnecting}
                onClick={() => connect({ connector: availableConnector })}
                type="button"
              >
                Connect with {availableConnector.name}
              </button>
            ))}
          </div>
          {connectError ? <p className="status error">{connectError.message}</p> : null}
        </>
      ) : (
        <>
          <div className="wallet-card">
            <p>
              Wallet: <strong>{truncateAddress(address ?? "")}</strong>
            </p>
            <p>
              Connector: <strong>{connector?.name ?? "Unknown"}</strong>
            </p>
            <p>
              Network: <strong>{isOnBase ? "Base" : `Chain ${chainId}`}</strong>
            </p>
          </div>

          <div className="wallet-panel__actions">
            {!isOnBase ? (
              <button
                className="button"
                disabled={isSwitching}
                onClick={() => void switchChainAsync({ chainId: base.id })}
                type="button"
              >
                Switch to Base
              </button>
            ) : (
              <button
                className="button"
                disabled={isAnalyzing}
                onClick={() => startAnalyzeTransition(() => void runAnalysis())}
                type="button"
              >
                {isAnalyzing ? "Reconstructing wallet..." : "Reconstruct connected wallet"}
              </button>
            )}
            <button className="button button--secondary" onClick={() => disconnect()} type="button">
              Disconnect
            </button>
          </div>

          {switchError ? <p className="status error">{switchError.message}</p> : null}
        </>
      )}

      {sessionId ? (
        <p className="status success">
          Session created. Opening live ledger view for {sessionId}. If navigation is blocked, open{" "}
          <Link href={`/ledger?sessionId=${sessionId}`}>the session ledger manually</Link>.
        </p>
      ) : null}
      {error ? <p className="status error">{error}</p> : null}
      {!process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ? (
        <p className="status warning">
          WalletConnect is enabled when <strong>NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID</strong> is set.
          Injected wallets remain available without it.
        </p>
      ) : null}
    </section>
  );
}