"use client";

import Link from "next/link";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useSwitchChain } from "wagmi";
import { base } from "wagmi/chains";

import {
  buildConnectedWalletStaleContextRecovery,
  type ConnectedWalletAnalysisResult,
  switchConnectedWalletTestOverrideToBase,
  useConnectedWalletAnalysis
} from "@/ui/wallet/use-connected-wallet-analysis";
import { CashFlowPanel } from "@/ui/wallet/cash-flow-panel";
import { MigrationFlowPanel } from "@/ui/wallet/migration-flow-panel";
import { PortfolioHistoryChart } from "@/ui/wallet/portfolio-history-chart";

type ConnectedWalletAnalysisViewProps = {
  sessionId: string;
};

type ActivityItem = {
  id: string;
  timestamp: string;
  label: string;
  detail: string;
  tone: "neutral" | "success" | "warning";
};

const ALLOCATION_COLORS = ["#00e0e1", "#3b82f6", "#f2c14e", "#22c55e", "#fb7185", "#a78bfa"];

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2
});

function formatBlockNumber(value: number | null | undefined) {
  if (value == null) {
    return "Unknown";
  }

  return new Intl.NumberFormat("en-US").format(value);
}

function formatUsd(value: string | number | null | undefined) {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(numeric)) {
    return "$0.00";
  }

  return usdFormatter.format(numeric);
}

function formatRunProgress(run: NonNullable<ConnectedWalletAnalysisResult["sessionStatus"]>["latestRun"]) {
  if (!run) {
    return null;
  }

  const latestProcessedBlock = run.checkpointBlock ?? (run.status === "accepted" ? run.toBlock : null);
  const fromBlock = run.fromBlock;
  const toBlock = run.toBlock;
  const hasProgressRange = fromBlock != null && toBlock != null && latestProcessedBlock != null;
  const progressPercent =
    hasProgressRange && toBlock >= fromBlock
      ? Math.max(
          0,
          Math.min(100, Math.round(((latestProcessedBlock - fromBlock + 1) / (toBlock - fromBlock + 1)) * 100))
        )
      : null;

  return {
    latestProcessedBlock,
    progressPercent
  };
}

function formatTimestamp(value: string) {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return value;
  }

  return timestamp.toLocaleString();
}

function buildRecentActivity(analysis: ReturnType<typeof useConnectedWalletAnalysis>): ActivityItem[] {
  const markerItems = (analysis.accountingTimeSeries?.eventMarkers ?? []).slice(-8).map((marker) => ({
    id: `marker:${marker.ledgerRecordId}:${marker.markerType}`,
    timestamp: marker.timestamp,
    label: marker.label,
    detail: marker.markerType,
    tone:
      marker.markerType === "close" || marker.markerType === "other"
        ? ("warning" as const)
        : ("success" as const)
  }));

  const flowItems = (analysis.accountingRebalanceFlows?.flows ?? []).slice(-5).map((flow) => ({
    id: `flow:${flow.flowId}`,
    timestamp: flow.timestamp,
    label: "Position migration",
    detail: `${flow.fromPoolId} -> ${flow.toPoolId}`,
    tone: "neutral" as const
  }));

  const discardedItems = (analysis.discardedActivity?.items ?? []).slice(0, 4).map((item) => ({
    id: `discarded:${item.discardedActivityId}`,
    timestamp: item.timestamp,
    label: "Discarded activity",
    detail: item.reasonType,
    tone: "warning" as const
  }));

  return [...markerItems, ...flowItems, ...discardedItems]
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
    .slice(0, 10);
}

export function ConnectedWalletAnalysisView({ sessionId }: ConnectedWalletAnalysisViewProps) {
  const analysis = useConnectedWalletAnalysis(sessionId);
  const projection = analysis.projection;
  const staleRecovery = buildConnectedWalletStaleContextRecovery(analysis.guard.reason);
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const latestRunProgress = formatRunProgress(analysis.sessionStatus?.latestRun ?? null);
  const latestAcceptedRun = analysis.sessionStatus?.latestAcceptedRun ?? null;
  const bootstrap = analysis.accountingBootstrap;
  const recentActivity = buildRecentActivity(analysis);

  const totalValue = formatUsd(analysis.accounting?.totalValue.amount);
  const unrealizedPnl = formatUsd(analysis.accounting?.unrealizedPnl.amount);
  const capitalEntered = formatUsd(analysis.accounting?.capitalEntered.amount);
  const coverageStatus = analysis.accounting?.coverageSummary.coverageStatus ?? "pending";

  const allocation = (analysis.accounting?.pools ?? [])
    .map((pool) => ({
      name: pool.displayName,
      value: Number(pool.currentValue.amount ?? 0)
    }))
    .filter((pool) => Number.isFinite(pool.value) && pool.value > 0);

  const switchToBase = async () => {
    if (switchConnectedWalletTestOverrideToBase()) {
      return;
    }

    await switchChainAsync({ chainId: base.id });
  };

  return (
    <main className="shell">
      <section className="panel">
        <header className="dashboard-topbar">
          <div className="dashboard-topbar__meta motion-fade-up motion-delay-1">
            <p className="eyebrow">Portfolio Dashboard</p>
            <h1 className="dashboard-title">Connected-wallet portfolio analysis</h1>
            <p className="dashboard-session data-accent">Session: {sessionId}</p>
          </div>
          <div className="dashboard-topbar__right motion-fade-up motion-delay-2">
            <div className="wallet-panel__actions">
              <button className="button" disabled={analysis.isRefreshing} onClick={analysis.retryAnalysis} type="button">
                {analysis.isRefreshing ? "Refreshing portfolio snapshot..." : "Refresh connected-wallet portfolio"}
              </button>
              <Link className="button button--secondary" href="/">
                Reconnect wallet
              </Link>
            </div>
          </div>
        </header>

        {analysis.errorMessage ? <p className="status error">{analysis.errorMessage}</p> : null}

        {analysis.sessionStatus?.latestRun ? (
          <p className="status">
            Current run <strong>{analysis.sessionStatus.latestRun.status}</strong> | blocks{" "}
            <strong>{formatBlockNumber(analysis.sessionStatus.latestRun.fromBlock)}</strong> to{" "}
            <strong>{formatBlockNumber(analysis.sessionStatus.latestRun.toBlock)}</strong> | latest processed{" "}
            <strong>{formatBlockNumber(latestRunProgress?.latestProcessedBlock ?? null)}</strong>
            {latestRunProgress?.progressPercent != null ? (
              <>
                {" "}| ingestion <strong>{latestRunProgress.progressPercent}%</strong>
              </>
            ) : null}
          </p>
        ) : null}

        {latestAcceptedRun ? (
          <p className="status success">
            Latest indexed snapshot: <strong>{formatBlockNumber(latestAcceptedRun.fromBlock)}</strong> to{" "}
            <strong>{formatBlockNumber(latestAcceptedRun.checkpointBlock ?? latestAcceptedRun.toBlock)}</strong>
          </p>
        ) : null}

        {bootstrap ? (
          <p className="status">
            Bootstrap state: <strong>{bootstrap.bootstrapState}</strong> | dashboard display state{" "}
            <strong>{analysis.dashboardDisplayState}</strong>
          </p>
        ) : (
          <p className="status">
            Dashboard display state: <strong>{analysis.dashboardDisplayState}</strong>
          </p>
        )}

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
              <Link href="/">Return to the connected-wallet entry flow</Link> and resume a matching analysis
              session.
            </p>
            {staleRecovery.primaryAction === "switch_to_base" ? (
              <button className="button" disabled={isSwitching} onClick={() => void switchToBase()} type="button">
                {staleRecovery.primaryActionLabel}
              </button>
            ) : null}
          </>
        ) : null}

        {analysis.state === "session_loading" ? (
          <p className="status">Loading session status and trusted portfolio results...</p>
        ) : null}

        {analysis.state === "reconstruction_running" ? (
          <p className="status">Starting live reconstruction for the connected wallet...</p>
        ) : null}

        {analysis.state === "refreshing_with_latest" ? (
          <>
            <p className="status success">Latest accepted portfolio snapshot loaded.</p>
            <p className="status warning">
              Refreshing reconstruction on demand while the latest accepted result remains visible.
            </p>
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
          <div className="dashboard-grid">
            <article className="dashboard-card dashboard-card--summary motion-fade-up motion-delay-1">
              <p className="eyebrow">Portfolio Summary</p>
              <h2>{totalValue}</h2>
              <div className="wallet-metrics wallet-metrics--compact">
                <div className="wallet-metric-card">
                  <span className="wallet-metric-card__label">Unrealized PnL</span>
                  <strong className="wallet-metric-card__value">{unrealizedPnl}</strong>
                </div>
                <div className="wallet-metric-card">
                  <span className="wallet-metric-card__label">Capital Entered</span>
                  <strong className="wallet-metric-card__value">{capitalEntered}</strong>
                </div>
                <div className="wallet-metric-card">
                  <span className="wallet-metric-card__label">Coverage</span>
                  <strong className="wallet-metric-card__value">{coverageStatus}</strong>
                </div>
                <div className="wallet-metric-card">
                  <span className="wallet-metric-card__label">Pools Tracked</span>
                  <strong className="wallet-metric-card__value">{projection.pools.length}</strong>
                </div>
              </div>
            </article>

            <article className="dashboard-card dashboard-card--history motion-fade-up motion-delay-2">
              <p className="eyebrow">Portfolio Value Over Time</p>
              {analysis.accountingTimeSeries ? (
                <PortfolioHistoryChart
                  series={analysis.accountingTimeSeries.portfolioSeries}
                  markers={analysis.accountingTimeSeries.eventMarkers}
                />
              ) : (
                <p className="status">Awaiting historical time series.</p>
              )}
            </article>

            <article className="dashboard-card motion-fade-up motion-delay-3">
              <p className="eyebrow">Allocated By Pool</p>
              {allocation.length ? (
                <>
                  <div className="dashboard-allocation-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          cx="50%"
                          cy="50%"
                          data={allocation}
                          dataKey="value"
                          innerRadius={58}
                          outerRadius={82}
                          paddingAngle={2}
                        >
                          {allocation.map((entry, index) => (
                            <Cell fill={ALLOCATION_COLORS[index % ALLOCATION_COLORS.length]} key={entry.name} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number | string | ReadonlyArray<number | string> | undefined) => {
                            const normalizedValue = Array.isArray(value)
                              ? value[0]
                              : (value as number | string | null | undefined);
                            return formatUsd(normalizedValue);
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="dashboard-allocation-list">
                    {allocation.map((entry, index) => (
                      <li key={`allocation:${entry.name}`}>
                        <span>
                          <i
                            style={{ background: ALLOCATION_COLORS[index % ALLOCATION_COLORS.length] }}
                            className="dashboard-dot"
                          />
                          {entry.name}
                        </span>
                        <strong className="data-accent">{formatUsd(entry.value)}</strong>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="status">Pool allocations are not available yet.</p>
              )}
            </article>

            <article className="dashboard-card motion-fade-up motion-delay-4">
              <p className="eyebrow">Recent Activity</p>
              {recentActivity.length ? (
                <ul className="dashboard-activity-list">
                  {recentActivity.map((item) => (
                    <li key={item.id}>
                      <div>
                        <p className="dashboard-activity-label">{item.label}</p>
                        <p className="dashboard-activity-detail">{item.detail}</p>
                      </div>
                      <span className={`dashboard-activity-time dashboard-activity-time--${item.tone}`}>
                        {formatTimestamp(item.timestamp)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="status">No recent activity markers are available.</p>
              )}
            </article>

            <article className="dashboard-card motion-fade-up motion-delay-1">
              <p className="eyebrow">Market Overview</p>
              <p>
                Partial reasons: <strong>{analysis.accountingTimeSeries?.partialReasonCodes.join(", ") || "None"}</strong>
              </p>
              {analysis.accounting?.idleBalances.length ? (
                <ul className="dashboard-market-list">
                  {analysis.accounting.idleBalances.slice(0, 6).map((holding) => (
                    <li key={`${holding.tokenAddress}:${holding.reasonCode}:${holding.amountRaw}`}>
                      <span>{holding.symbol ?? holding.tokenAddress}</span>
                      <strong className="data-accent">
                        {holding.currentValue ? formatUsd(holding.currentValue.amount) : "Unpriced"}
                      </strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="status">No idle holdings detected.</p>
              )}
            </article>

            <article className="dashboard-card motion-fade-up motion-delay-2">
              <p className="eyebrow">Cash In And Cash Out</p>
              <CashFlowPanel
                accounting={analysis.accounting}
                series={analysis.accountingTimeSeries?.portfolioSeries ?? []}
              />
            </article>

            <article className="dashboard-card motion-fade-up motion-delay-3">
              <p className="eyebrow">Position Migrations</p>
              <MigrationFlowPanel flows={analysis.accountingRebalanceFlows?.flows ?? []} />
            </article>
          </div>
        ) : null}
      </section>
    </main>
  );
}
