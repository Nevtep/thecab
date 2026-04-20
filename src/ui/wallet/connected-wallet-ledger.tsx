"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { base } from "wagmi/chains";

import { type AccountingResponse } from "@/domains/accounting/contracts/accounting-api-schemas";
import { type LedgerProjectionResponse } from "@/domains/ledger/contracts/ledger-api-schemas";

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

function formatTraceRefs(traceRefs: { ledgerRecordIds: string[]; pricePointIds: string[] }) {
  return `${traceRefs.ledgerRecordIds.length} ledger refs · ${traceRefs.pricePointIds.length} price refs`;
}

type ConnectedWalletAccountingPanelProps = {
  projection: LedgerProjectionResponse;
  accounting: AccountingResponse | null;
};

export function ConnectedWalletAccountingPanel({ projection, accounting }: ConnectedWalletAccountingPanelProps) {
  return (
    <>
      {accounting ? (
        <section className="wallet-metrics">
          <article className="wallet-metric-card">
            <span className="wallet-metric-card__label">Total Value</span>
            <strong className="wallet-metric-card__value">${accounting.totalValue.amount}</strong>
            <span className="wallet-metric-card__meta">{formatTraceRefs(accounting.traceRefs)}</span>
          </article>
          <article className="wallet-metric-card">
            <span className="wallet-metric-card__label">Unrealized PnL</span>
            <strong className="wallet-metric-card__value">${accounting.unrealizedPnl.amount}</strong>
          </article>
          <article className="wallet-metric-card">
            <span className="wallet-metric-card__label">Capital Entered</span>
            <strong className="wallet-metric-card__value">${accounting.capitalEntered.amount}</strong>
          </article>
          <article className="wallet-metric-card">
            <span className="wallet-metric-card__label">Idle Balance</span>
            <strong className="wallet-metric-card__value">${accounting.idleBalanceValue.amount}</strong>
          </article>
        </section>
      ) : null}

      {projection.pools.length > 0 ? (
        <div className="wallet-hierarchy">
          {projection.pools.map((pool) => {
            const poolAccounting = accounting?.pools.find((entry) => entry.poolId === pool.poolId);
            return (
              <article className="wallet-hierarchy__card" key={pool.poolId}>
                <div className="wallet-hierarchy__header">
                  <div>
                    <h2>{pool.displayName}</h2>
                    <p>Pool value: {poolAccounting ? `$${poolAccounting.currentValue.amount}` : "Pending pricing"}</p>
                  </div>
                  <span className="wallet-pill">{pool.strategies.length} strategies</span>
                </div>

                {poolAccounting?.strategies.map((strategy) => (
                  <div className="wallet-scope" key={strategy.strategyId}>
                    <div className="wallet-scope__header">
                      <strong>{strategy.strategyType === "manual" ? "Manual strategy" : "Mellow auto strategy"}</strong>
                      <span>${strategy.currentValue.amount}</span>
                    </div>
                    <p className="wallet-scope__meta">{formatTraceRefs(strategy.traceRefs)}</p>
                    {strategy.positions.map((position) => (
                      <div className="wallet-scope__detail" key={position.positionInstanceId}>
                        <span>{position.positionType}</span>
                        <span>${position.currentValue.amount}</span>
                        <span>Precision: {position.precisionStatus}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </article>
            );
          })}
        </div>
      ) : null}

      {accounting ? (
        <div className="wallet-explainability">
          <h2>Explainability</h2>
          <p>
            Coverage: <strong>{accounting.coverageSummary.coverageStatus}</strong> · Unpriced components:{" "}
            <strong>{accounting.coverageSummary.unpricedComponentsCount}</strong>
          </p>
          <p className="wallet-scope__meta">Portfolio trace: {formatTraceRefs(accounting.traceRefs)}</p>
          {accounting.idleBalances.length > 0 ? (
            <div className="wallet-scope-list">
              {accounting.idleBalances.map((holding) => (
                <div className="wallet-scope__detail" key={`${holding.tokenAddress}:${holding.reasonCode}:${holding.amountRaw}`}>
                  <span>{holding.symbol ?? holding.tokenAddress} idle balance</span>
                  <span>{holding.currentValue ? `$${holding.currentValue.amount}` : "Unpriced"}</span>
                  <span>{holding.reasonCode}</span>
                </div>
              ))}
            </div>
          ) : null}
          {accounting.coverageSummary.reasonCodes.length > 0 ? (
            <div className="wallet-reason-list">
              {accounting.coverageSummary.reasonCodes.map((reasonCode) => (
                <span className="wallet-pill" key={reasonCode}>{reasonCode}</span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
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