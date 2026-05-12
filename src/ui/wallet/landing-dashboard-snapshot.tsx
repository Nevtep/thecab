"use client";

import { useEffect, useMemo, useState } from "react";

import {
  accountingBootstrapResponseSchema,
  dashboardTimelineResponseSchema
} from "@/domains/accounting/contracts/accounting-api-schemas";

const LAST_SESSION_STORAGE_KEY = "thecab:last-session-id";

type SnapshotState = {
  isLoading: boolean;
  error: string | null;
  sessionId: string | null;
  portfolioValue: string | null;
  netCapitalFlow: string | null;
  poolRotations: number | null;
  trackedPositions: number | null;
};

const initialState: SnapshotState = {
  isLoading: true,
  error: null,
  sessionId: null,
  portfolioValue: null,
  netCapitalFlow: null,
  poolRotations: null,
  trackedPositions: null
};

function parseAmount(amount: string | null | undefined) {
  const parsed = Number(amount ?? 0);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return parsed;
}

function formatUsd(value: number | null) {
  if (value == null) {
    return "--";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(value);
}

function formatSignedUsd(value: number | null) {
  if (value == null) {
    return "--";
  }

  const formatted = formatUsd(Math.abs(value));
  if (value === 0) {
    return formatted;
  }

  return value > 0 ? `+${formatted}` : `-${formatted}`;
}

export function LandingDashboardSnapshot() {
  const [state, setState] = useState<SnapshotState>(initialState);

  useEffect(() => {
    let isCancelled = false;

    async function load() {
      if (typeof window === "undefined") {
        return;
      }

      const sessionId = window.localStorage.getItem(LAST_SESSION_STORAGE_KEY);
      if (!sessionId) {
        if (!isCancelled) {
          setState({
            ...initialState,
            isLoading: false,
            sessionId: null
          });
        }
        return;
      }

      try {
        const [bootstrapResponse, timelineResponse] = await Promise.all([
          fetch(`/api/analysis-sessions/${sessionId}/accounting/bootstrap`, { cache: "no-store" }),
          fetch(`/api/analysis-sessions/${sessionId}/dashboard/timeline`, { cache: "no-store" })
        ]);

        if (!bootstrapResponse.ok) {
          throw new Error("Unable to load bootstrap snapshot.");
        }

        if (!timelineResponse.ok) {
          throw new Error("Unable to load timeline snapshot.");
        }

        const bootstrapPayload = accountingBootstrapResponseSchema.parse(await bootstrapResponse.json());
        const timelinePayload = dashboardTimelineResponseSchema.parse(await timelineResponse.json());

        const snapshot = bootstrapPayload.snapshot;
        const entered = parseAmount(snapshot?.capitalEntered.amount);
        const withdrawn = parseAmount(snapshot?.capitalWithdrawn.amount);
        const trackedPositions = snapshot
          ? snapshot.pools.reduce((count, pool) => {
              const strategyPositions = pool.strategies.reduce((innerCount, strategy) => innerCount + strategy.positions.length, 0);
              return count + strategyPositions;
            }, 0)
          : 0;

        const poolRotations = timelinePayload.markers.filter((marker) => marker.markerType === "rebalance").length;

        if (!isCancelled) {
          setState({
            isLoading: false,
            error: null,
            sessionId,
            portfolioValue: snapshot?.totalValue.amount ?? null,
            netCapitalFlow: String(entered - withdrawn),
            poolRotations,
            trackedPositions
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to load dashboard snapshot.";
        if (!isCancelled) {
          setState({
            ...initialState,
            isLoading: false,
            sessionId,
            error: message
          });
        }
      }
    }

    void load();

    return () => {
      isCancelled = true;
    };
  }, []);

  const title = useMemo(() => {
    if (!state.sessionId) {
      return "Connect to load snapshot";
    }

    return state.isLoading ? "Loading latest snapshot" : "Latest session snapshot";
  }, [state.isLoading, state.sessionId]);

  const portfolioValue = formatUsd(parseAmount(state.portfolioValue));
  const netFlow = formatSignedUsd(parseAmount(state.netCapitalFlow));

  return (
    <aside className="landing__summary-card motion-fade-up motion-delay-3">
      <h2 className="landing__summary-title">{title}</h2>
      <p className="landing__summary-value data-accent">{state.sessionId ? portfolioValue : "--"}</p>
      <ul className="landing__summary-list">
        <li className="landing__summary-row">
          <span>Net Capital Flow</span>
          <strong className="data-accent">{state.sessionId ? netFlow : "--"}</strong>
        </li>
        <li className="landing__summary-row">
          <span>Pool Rotations</span>
          <strong className="data-accent">{state.sessionId ? (state.poolRotations ?? 0) : "--"}</strong>
        </li>
        <li className="landing__summary-row">
          <span>Tracked Positions</span>
          <strong className="data-accent">{state.sessionId ? (state.trackedPositions ?? 0) : "--"}</strong>
        </li>
      </ul>
      {state.error ? <p className="status warning">{state.error}</p> : null}
      {!state.sessionId ? (
        <p className="wallet-scope__meta">Connect and sign once to populate this card from live services.</p>
      ) : null}
    </aside>
  );
}
