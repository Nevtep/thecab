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
  const bootstrap = analysis.accountingBootstrap;

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

        {bootstrap ? (
          <div>
            <p>
              Bootstrap state: <strong>{bootstrap.bootstrapState}</strong>
            </p>
            <p>
              Dashboard display state: <strong>{analysis.dashboardDisplayState}</strong>
            </p>
            {bootstrap.snapshot ? (
              <p>
                Bootstrap portfolio value: <strong>{bootstrap.snapshot.totalValue.amount} {bootstrap.snapshot.totalValue.currency.toUpperCase()}</strong>
              </p>
            ) : (
              <p>Bootstrap snapshot not available yet.</p>
            )}
          </div>
        ) : null}

        {!bootstrap ? (
          <p>
            Dashboard display state: <strong>{analysis.dashboardDisplayState}</strong>
          </p>
        ) : null}

        {analysis.dashboardDisplayState === "loading" ? (
          <p className="status">Preparing the first meaningful dashboard view...</p>
        ) : null}

        {analysis.dashboardDisplayState === "partial" ? (
          <p className="status warning">Showing trusted partial data while reconstruction or enrichment continues.</p>
        ) : null}

        {analysis.dashboardDisplayState === "failure" ? (
          <>
            <p className="status error">Dashboard read failed before trusted results were available.</p>
            <button className="button" onClick={analysis.retryAnalysis} type="button">
              Retry dashboard bootstrap
            </button>
          </>
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

            {analysis.accountingTimeSeries ? (
              <div>
                <h2>Historical Portfolio Series</h2>
                <p>
                  Series state: <strong>{analysis.accountingTimeSeries.seriesState}</strong>
                </p>
                {analysis.accountingTimeSeries.partialReasonCodes.length > 0 ? (
                  <p>
                    Partial reasons: <strong>{analysis.accountingTimeSeries.partialReasonCodes.join(", ")}</strong>
                  </p>
                ) : null}
                <p>
                  Portfolio points: <strong>{analysis.accountingTimeSeries.portfolioSeries.length}</strong> · Pool series: <strong>{analysis.accountingTimeSeries.poolSeries.length}</strong> · Timeline markers: <strong>{analysis.accountingTimeSeries.eventMarkers.length}</strong>
                </p>

                {analysis.accountingTimeSeries.portfolioSeries.length > 0 ? (
                  <div>
                    <h3>Portfolio Value Points</h3>
                    <ul>
                      {analysis.accountingTimeSeries.portfolioSeries.slice(0, 5).map((point) => (
                        <li key={`portfolio-point:${point.ledgerRecordId}`}>
                          {point.timestamp}: {point.totalValue.amount} {point.totalValue.currency.toUpperCase()} ({point.coverageStatus})
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {analysis.accountingTimeSeries.poolSeries.length > 0 ? (
                  <div>
                    <h3>Pool Deployed-Capital Series</h3>
                    <ul>
                      {analysis.accountingTimeSeries.poolSeries.slice(0, 3).map((pool) => {
                        const latestPoint = pool.points.at(-1);
                        return (
                          <li key={`pool-series:${pool.poolId}`}>
                            {pool.displayName}: {pool.points.length} points
                            {latestPoint ? ` · latest ${latestPoint.deployedCapital.amount} ${latestPoint.deployedCapital.currency.toUpperCase()} (${latestPoint.flowDirection})` : ""}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}

                {analysis.accountingTimeSeries.eventMarkers.length > 0 ? (
                  <div>
                    <h3>Accepted-Run Timeline Markers</h3>
                    <ul>
                      {analysis.accountingTimeSeries.eventMarkers.slice(0, 5).map((marker) => (
                        <li key={`timeline-marker:${marker.ledgerRecordId}:${marker.markerType}`}>
                          {marker.timestamp}: {marker.markerType} ({marker.label})
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {analysis.accountingRebalanceFlows?.flows.length ? (
                  <div>
                    <h3>Rebalance Flow Links</h3>
                    <ul>
                      {analysis.accountingRebalanceFlows.flows.slice(0, 5).map((flow) => (
                        <li key={`rebalance-flow:${flow.flowId}`}>
                          {flow.timestamp}: {flow.fromPoolId}{" -> "}{flow.toPoolId} ({flow.confidence}) - {flow.explanation}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {analysis.accounting?.pools.length ? (
                  <div>
                    <h3>Pool Drilldown</h3>
                    <ul>
                      {analysis.accounting.pools.map((pool) => (
                        <li key={`pool-drilldown:${pool.poolId}`}>
                          {pool.displayName}: {pool.currentValue.amount} {pool.currentValue.currency.toUpperCase()} · strategies {pool.strategies.length}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}

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