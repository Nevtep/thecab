# Quickstart: Historical Portfolio Dashboard

## Purpose

Validate that the first product-facing dashboard for The Cab delivers fast, trustworthy, and explainable portfolio surfaces for one connected wallet on Base.

## Prerequisites

- Database migrated and application running.
- Wallet session creation and reconstruction routes available.
- Canonical ledger, pricing, and accounting outputs available for at least one fixture-backed wallet.

## Validation Scenario 1: First Meaningful Dashboard Load

1. Create or reuse a connected-wallet session.
2. Open the dashboard immediately after session load.

Expected:

- A meaningful first view appears quickly (target under 10 seconds for available accepted data).
- UI renders one explicit state: `loading`, `partial`, `empty`, `failure`, or `ready`.
- No blank ambiguous state is shown.

## Validation Scenario 2: Current Portfolio Overview

1. Load a session with accepted accounting output.
2. Read dashboard overview card values.

Expected:

- Dashboard shows total value, capital entered, capital withdrawn, realized PnL, unrealized PnL.
- Idle and residual balances are visible and included in portfolio truth.

## Validation Scenario 3: Historical Portfolio Chart

1. Load historical dashboard time-series for the session.
2. Render portfolio evolution chart.

Expected:

- Historical total portfolio points are ordered and timestamped.
- Partial windows are explicitly marked as partial rather than silently omitted.

## Validation Scenario 4: Pool Deployed-Capital Chart

1. Open pool-level chart surface.
2. Inspect deployed-capital series by pool.

Expected:

- Each pool has its own series.
- Changes in deployed capital over time are visible.
- Pool-level surfaces reconcile with portfolio-level totals.

## Validation Scenario 5: Strategy Drilldowns

1. Open a pool containing manual and supported Mellow activity.
2. Inspect strategy rows.

Expected:

- Manual and Mellow strategy lines remain separate.
- Strategy values reconcile to pool summary.

## Validation Scenario 6: Rebalance Migration Visualization

1. Load a fixture or replay with cross-pool rebalance behavior.
2. Inspect rebalance flow links and timeline markers.

Expected:

- Flow link shows migration from source pool to destination pool.
- Value migration is visible without default false-loss labeling.
- Marker metadata includes timestamp and event context.

## Validation Scenario 7: Partial, Empty, and Failure States

1. Test with no accepted run.
2. Test with partial historical coverage.
3. Test with forced read error.

Expected:

- No accepted run -> `empty` or `warming` path is explicit.
- Partial coverage -> `partial` path is explicit with available data preserved.
- Read failure -> `failure` path is explicit with retry guidance.

## Contract Validation Targets

- Contract tests for:
  - dashboard bootstrap/overview payload
  - time-series payload
  - pool detail payload
  - strategy drilldown payload
  - rebalance flow payload
  - timeline marker payload
- Existing accounting and reconstruction progress contracts continue to pass.

## Acceptance Threshold

The feature is ready for task generation when:

- Dashboard first view is meaningful and state-explicit.
- Current and historical portfolio surfaces are available from accepted-run outputs.
- Pool and strategy drilldowns reconcile correctly.
- Rebalance migration links and timeline markers are visible and explainable.
- Partial, empty, and failure states are contract-tested.

## Validation Execution Log

Completed during final implementation hardening:

1. Type safety and focused dashboard test sweep:

```bash
pnpm -s typecheck
pnpm -s vitest run \
  tests/unit/dashboard-composition-service.test.ts \
  tests/contract/accounting-bootstrap.contract.test.ts \
  tests/contract/accounting-time-series.contract.test.ts \
  tests/contract/accounting-rebalance-flows.contract.test.ts \
  tests/contract/dashboard-pools.contract.test.ts \
  tests/contract/dashboard-timeline.contract.test.ts \
  tests/integration/accounting-portfolio-flow.test.ts \
  tests/integration/accounting-explainability-flow.test.ts \
  tests/integration/accounting-breakdown-flow.test.ts \
  tests/integration/connected-wallet-state-flow.test.ts
```

Observed result:
- Typecheck passed.
- Vitest passed: 10 files, 24 tests.

2. Dashboard e2e pass:

```bash
pnpm -s playwright test \
  tests/e2e/accounting-portfolio.spec.ts \
  tests/e2e/accounting-explainability.spec.ts
```

Observed result:
- Playwright passed: 5 tests.

Scenario coverage summary:
- Scenario 1 validated through bootstrap explicit-state e2e and contract coverage.
- Scenario 2 validated through portfolio overview integration/e2e assertions.
- Scenario 3 validated through time-series contract + explainability integration/e2e.
- Scenario 4 validated through pool series checks in time-series service and UI rendering.
- Scenario 5 validated through pool/strategy reconciliation contract + integration coverage.
- Scenario 6 validated through rebalance-flow contract + drilldown e2e visibility.
- Scenario 7 validated through no-accepted-run, partial, and failure-path regression/flow tests.
