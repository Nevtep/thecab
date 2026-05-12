"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import type { AccountingTimeSeriesResponse } from "@/domains/accounting/contracts/accounting-api-schemas";

type PortfolioHistoryChartProps = {
  series: AccountingTimeSeriesResponse["portfolioSeries"];
  markers: AccountingTimeSeriesResponse["eventMarkers"];
};

type PortfolioChartPoint = {
  id: string;
  ts: string;
  timestampLabel: string;
  totalValue: number;
  coverageStatus: "full" | "partial";
};

function parseAmount(amount: string) {
  const parsed = Number.parseFloat(amount);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return parsed;
}

function formatTimestamp(ts: string) {
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) {
    return ts;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "2-digit"
  }).format(date);
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(value);
}

function normalizeChartValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export function PortfolioHistoryChart({ series, markers }: PortfolioHistoryChartProps) {
  if (series.length === 0) {
    return (
      <div className="chart-empty-state">
        <p>No historical portfolio points are available yet.</p>
      </div>
    );
  }

  const points: PortfolioChartPoint[] = series.map((point) => ({
    id: point.ledgerRecordId,
    ts: point.timestamp,
    timestampLabel: formatTimestamp(point.timestamp),
    totalValue: parseAmount(point.totalValue.amount),
    coverageStatus: point.coverageStatus
  }));

  const markerById = new Set(markers.map((marker) => marker.ledgerRecordId));

  return (
    <div className="history-chart-card" aria-label="Portfolio history line chart">
      <div className="history-chart-card__header">
        <h3>Portfolio Value Evolution</h3>
        <p>Accepted-run historical value of the connected wallet portfolio.</p>
      </div>

      <div className="history-chart-card__plot">
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={points} margin={{ top: 12, right: 18, bottom: 8, left: 6 }}>
            <CartesianGrid stroke="rgba(159, 181, 209, 0.2)" strokeDasharray="4 4" />
            <XAxis
              dataKey="timestampLabel"
              minTickGap={28}
              stroke="rgba(159, 181, 209, 0.85)"
              tick={{ fontSize: 12 }}
            />
            <YAxis
              stroke="rgba(159, 181, 209, 0.85)"
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => formatUsd(Number(value))}
              width={96}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: "1px solid rgba(120, 210, 255, 0.4)",
                backgroundColor: "rgba(8, 17, 31, 0.94)",
                color: "#eef4ff"
              }}
              cursor={{ stroke: "rgba(120, 210, 255, 0.5)", strokeWidth: 1 }}
              formatter={(value: unknown) => [formatUsd(normalizeChartValue(value)), "Portfolio"]}
              labelFormatter={(_, payload) => {
                const data = payload?.[0]?.payload as PortfolioChartPoint | undefined;
                if (!data) {
                  return "";
                }

                return `${data.timestampLabel} (${data.coverageStatus})`;
              }}
            />
            <Line
              type="monotone"
              dataKey="totalValue"
              stroke="#78d2ff"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 5, fill: "#eef4ff", stroke: "#78d2ff" }}
            />

            {points
              .filter((point) => markerById.has(point.id))
              .map((point) => (
                <ReferenceDot
                  key={`marker:${point.id}`}
                  x={point.timestampLabel}
                  y={point.totalValue}
                  r={4}
                  fill="#facc15"
                  stroke="#f59e0b"
                />
              ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
