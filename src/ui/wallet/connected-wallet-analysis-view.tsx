"use client";

import Link from "next/link";
import { useSwitchChain } from "wagmi";
import { base } from "wagmi/chains";

import {
  buildConnectedWalletStaleContextRecovery,
  type ConnectedWalletAnalysisResult,
  switchConnectedWalletTestOverrideToBase,
  useConnectedWalletAnalysis
} from "@/ui/wallet/use-connected-wallet-analysis";
import { ConnectedWalletAccountingPanel } from "@/ui/wallet/connected-wallet-ledger";

type ConnectedWalletAnalysisViewProps = {
  sessionId: string;
};

function formatBlockNumber(value: number | null | undefined) {
  if (value == null) {
    return "Unknown";
  }

  return new Intl.NumberFormat("en-US").format(value);
}

function formatRunProgress(run: NonNullable<ConnectedWalletAnalysisResult["sessionStatus"]>["latestRun"]) {
  if (!run) {
    return null;
  }

  const latestProcessedBlock = run.checkpointBlock ?? (run.status === "accepted" ? run.toBlock : null);
  const fromBlock = run.fromBlock;
  const toBlock = run.toBlock;
  const hasProgressRange = fromBlock != null && toBlock != null && latestProcessedBlock != null;
  const progressPercent = hasProgressRange && toBlock >= fromBlock
    ? Math.max(
        0,
        Math.min(
          100,
          Math.round(
            ((latestProcessedBlock - fromBlock + 1) / (toBlock - fromBlock + 1)) * 100
          )
        )
      )
    : null;

  return {
    latestProcessedBlock,
    progressPercent
  };
}

export function ConnectedWalletAnalysisView({ sessionId }: ConnectedWalletAnalysisViewProps) {
  const analysis = useConnectedWalletAnalysis(sessionId);
  const projection = analysis.projection;
  const staleRecovery = buildConnectedWalletStaleContextRecovery(analysis.guard.reason);
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const latestRunProgress = formatRunProgress(analysis.sessionStatus?.latestRun ?? null);
  const latestAcceptedRun = analysis.sessionStatus?.latestAcceptedRun ?? null;

  const switchToBase = async () => {
    if (switchConnectedWalletTestOverrideToBase()) {
      return;
    }

    await switchChainAsync({ chainId: base.id });
  };

  return (
    <main className="shell">
      <section className="panel">
        <p className="eyebrow">Ledger Inspection</p>
        <h1>Connected-wallet analysis</h1>
        <p>Session: <strong>{sessionId}</strong></p>

        {analysis.errorMessage ? <p className="status error">{analysis.errorMessage}</p> : null}

        {analysis.sessionStatus?.latestRun ? (
          <div>
            <p>
              Current run: <strong>{analysis.sessionStatus.latestRun.status}</strong>
            </p>
            <p>
              Block window: <strong>{formatBlockNumber(analysis.sessionStatus.latestRun.fromBlock)}</strong> to <strong>{formatBlockNumber(analysis.sessionStatus.latestRun.toBlock)}</strong>
            </p>
            <p>
              Latest processed block: <strong>{formatBlockNumber(latestRunProgress?.latestProcessedBlock ?? null)}</strong>
            </p>
            {latestRunProgress?.progressPercent != null ? (
              <p>
                Ingestion progress: <strong>{latestRunProgress.progressPercent}%</strong>
              </p>
            ) : null}
          </div>
        ) : null}

        {latestAcceptedRun ? (
          <p>
            Latest indexed snapshot: <strong>{formatBlockNumber(latestAcceptedRun.fromBlock)}</strong> to <strong>{formatBlockNumber(latestAcceptedRun.checkpointBlock ?? latestAcceptedRun.toBlock)}</strong>
          </p>
        ) : null}

        {analysis.state === "stale_context" ? (
          <>
            <p className="status warning">{staleRecovery.title}</p>
            <p>{staleRecovery.description}</p>
            <p>
              <Link href="/">Return to the connected-wallet entry flow</Link> and resume a matching
              analysis session.
            </p>
            {staleRecovery.primaryAction === "switch_to_base" ? (
              <button className="button" disabled={isSwitching} onClick={() => void switchToBase()} type="button">
                {staleRecovery.primaryActionLabel}
              </button>
            ) : null}
          </>
        ) : null}

        {analysis.state === "session_loading" ? (
          <p className="status">Loading session status and trusted ledger results...</p>
        ) : null}

        {analysis.state === "reconstruction_running" ? (
          <p className="status">Starting live reconstruction for the connected wallet...</p>
        ) : null}

        {analysis.state === "refreshing_with_latest" ? (
          <>
            <p className="status success">Latest accepted ledger loaded.</p>
            <p className="status warning">Refreshing live reconstruction while the latest accepted result remains visible.</p>
          </>
        ) : null}

        {analysis.state === "failure" ? (
          <>
            <p className="status error">Live reconstruction failed before a trusted ledger result was available.</p>
            {analysis.sessionStatus?.lastFailure?.errorSummary ? (
              <p className="status error">Latest failure: {analysis.sessionStatus.lastFailure.errorSummary}</p>
            ) : null}
            <button className="button" onClick={analysis.retryAnalysis} type="button">
              Retry live reconstruction
            </button>
          </>
        ) : null}

        {analysis.state === "empty" ? (
          <>
            <p className="status warning">No qualifying connected-wallet activity was found for this session.</p>
            <button className="button" onClick={analysis.retryAnalysis} type="button">
              Retry live reconstruction
            </button>
          </>
        ) : null}

        {analysis.state === "success" && analysis.sessionStatus?.latestRun?.status === "failed" ? (
          <>
            <p className="status warning">
              The latest refresh failed. Showing the most recent accepted ledger result instead.
            </p>
            {analysis.sessionStatus.lastFailure?.errorSummary ? (
              <p className="status warning">Latest failure: {analysis.sessionStatus.lastFailure.errorSummary}</p>
            ) : null}
          </>
        ) : null}

        {analysis.state === "empty" && analysis.sessionStatus?.lastFailure?.errorSummary ? (
          <p className="status warning">Latest failure: {analysis.sessionStatus.lastFailure.errorSummary}</p>
        ) : null}

        {projection && analysis.guard.isCurrent ? (
          <>
            <p>
              Pools: {projection.pools.length} · Residual holdings: {projection.residualHoldings.length} ·
              Discarded items: {projection.discardedSummary.totalCount}
            </p>

            <ConnectedWalletAccountingPanel accounting={analysis.accounting} projection={projection} />

            {analysis.discardedActivity && analysis.discardedActivity.items.length > 0 ? (
              <div>
                <h2>Discarded Activity</h2>
                <p>Reviewable discarded items remain available without blocking the main flow.</p>
                <ul>
                  {analysis.discardedActivity.items.map((item) => (
                    <li key={item.discardedActivityId}>
                      {item.reasonType}: {item.reasonMessage}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="wallet-panel__actions">
              <button className="button" disabled={analysis.isRefreshing} onClick={analysis.retryAnalysis} type="button">
                {analysis.isRefreshing ? "Refreshing ledger..." : "Refresh connected-wallet analysis"}
              </button>
            </div>

            <pre style={{ marginTop: "1.5rem", overflowX: "auto", whiteSpace: "pre-wrap" }}>
              {JSON.stringify(projection, null, 2)}
            </pre>
          </>
        ) : null}
      </section>
    </main>
  );
}