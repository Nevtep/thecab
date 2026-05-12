"use client";

import type {
  AccountingResponse,
  AccountingTimeSeriesResponse
} from "@/domains/accounting/contracts/accounting-api-schemas";

type CashFlowPanelProps = {
  accounting: AccountingResponse | null;
  series: AccountingTimeSeriesResponse["portfolioSeries"];
};

type CashEvent = {
  id: string;
  timestamp: string;
  eventType: string;
  direction: "in" | "out";
  deltaValue: number;
};

function parseAmount(amount: string) {
  const parsed = Number.parseFloat(amount);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return parsed;
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(value);
}

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

function deriveCashEvents(series: AccountingTimeSeriesResponse["portfolioSeries"]) {
  const events: CashEvent[] = [];

  for (let index = 0; index < series.length; index += 1) {
    const point = series[index];
    if (!point) {
      continue;
    }

    const normalized = point.eventType.toLowerCase();
    if (normalized !== "external_deposit" && normalized !== "external_withdrawal") {
      continue;
    }

    const prev = series[index - 1];
    const previousValue = prev ? parseAmount(prev.totalValue.amount) : 0;
    const currentValue = parseAmount(point.totalValue.amount);
    const rawDelta = currentValue - previousValue;
    const direction = normalized === "external_deposit" ? "in" : "out";

    events.push({
      id: point.ledgerRecordId,
      timestamp: point.timestamp,
      eventType: point.eventType,
      direction,
      deltaValue: Math.abs(rawDelta)
    });
  }

  return events.sort((left, right) => {
    if (left.timestamp !== right.timestamp) {
      return left.timestamp > right.timestamp ? -1 : 1;
    }

    return left.id.localeCompare(right.id);
  });
}

export function CashFlowPanel({ accounting, series }: CashFlowPanelProps) {
  if (!accounting) {
    return null;
  }

  const capitalEntered = parseAmount(accounting.capitalEntered.amount);
  const capitalWithdrawn = parseAmount(accounting.capitalWithdrawn.amount);
  const netFlow = capitalEntered - capitalWithdrawn;
  const cashEvents = deriveCashEvents(series).slice(0, 6);

  return (
    <section className="wallet-hierarchy__card" aria-label="Cash in and cash out">
      <h3>Cash In / Cash Out</h3>
      <div className="wallet-metrics wallet-metrics--compact">
        <article className="wallet-metric-card">
          <span className="wallet-metric-card__label">Capital In</span>
          <strong className="wallet-metric-card__value">{formatUsd(capitalEntered)}</strong>
        </article>
        <article className="wallet-metric-card">
          <span className="wallet-metric-card__label">Capital Out</span>
          <strong className="wallet-metric-card__value">{formatUsd(capitalWithdrawn)}</strong>
        </article>
        <article className="wallet-metric-card">
          <span className="wallet-metric-card__label">Net Cash Flow</span>
          <strong className="wallet-metric-card__value">{formatUsd(netFlow)}</strong>
        </article>
      </div>

      {cashEvents.length > 0 ? (
        <div className="wallet-scope-list">
          {cashEvents.map((event) => (
            <div className="wallet-scope__detail" key={`cash-event:${event.id}`}>
              <span>{formatTimestamp(event.timestamp)}</span>
              <span>{event.eventType}</span>
              <span className={event.direction === "in" ? "cashflow-badge cashflow-badge--in" : "cashflow-badge cashflow-badge--out"}>
                {event.direction === "in" ? "+" : "-"}
                {formatUsd(event.deltaValue)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="wallet-scope__meta">No external deposit/withdrawal events were found in the accepted historical series.</p>
      )}
    </section>
  );
}
