"use client";

import type { AccountingRebalanceFlowsResponse } from "@/domains/accounting/contracts/accounting-api-schemas";

type MigrationFlowPanelProps = {
  flows: AccountingRebalanceFlowsResponse["flows"];
};

function formatTimestamp(ts: string) {
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) {
    return ts;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function MigrationFlowPanel({ flows }: MigrationFlowPanelProps) {
  return (
    <section className="wallet-hierarchy__card" aria-label="Position and pool migrations">
      <h3>Position Migrations</h3>
      <p className="wallet-scope__meta">
        Cross-pool movement inferred from canonical rebalance flows.
      </p>

      {flows.length === 0 ? (
        <p className="wallet-scope__meta">No migration flows found for the accepted run.</p>
      ) : (
        <div className="migration-flow-list">
          {flows.slice(0, 8).map((flow) => (
            <article className="migration-flow-card" key={flow.flowId}>
              <div className="migration-flow-card__row">
                <span className="migration-flow-card__time">{formatTimestamp(flow.timestamp)}</span>
                <span className="wallet-pill">{flow.confidence}</span>
              </div>
              <div className="migration-flow-card__path">
                <strong>{flow.fromPoolId}</strong>
                <span className="migration-flow-card__arrow">to</span>
                <strong>{flow.toPoolId}</strong>
              </div>
              <p className="wallet-scope__meta">{flow.explanation}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
