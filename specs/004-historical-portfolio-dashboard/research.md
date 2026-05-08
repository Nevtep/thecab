# Research: Historical Portfolio Dashboard

## Decision 1: Build a dedicated dashboard read-model layer above existing accounting and ledger outputs

- **Decision**: Implement dashboard-facing read models that aggregate existing accepted-run outputs (accounting snapshot, time-series, rebalance links, and projection metadata) without reinterpreting raw chain activity.
- **Rationale**: This preserves ledger-first truth and avoids creating a second semantic engine inside the UI layer.
- **Alternatives considered**:
  - Build dashboard values directly from raw transactions and logs: rejected because it violates constitutional boundaries and duplicates classification logic.
  - Build dashboard directly in components from many endpoints with no read model: rejected because reconciliation and state handling become fragile.

## Decision 2: Use on-read composition first, with deterministic accepted-run anchoring

- **Decision**: Generate dashboard payloads on read from accepted-run outputs and include explicit freshness fields (`acceptedRunId`, `asOf`, `bootstrapState`).
- **Rationale**: The feature target is product usability now, not introducing a new persistence-heavy series engine.
- **Alternatives considered**:
  - Persist full historical dashboard series in dedicated tables in this slice: rejected because it adds migration and invalidation complexity before UX fit is proven.
  - Precompute all dashboard payloads in long background jobs: rejected because it delays first meaningful view.

## Decision 3: Progressive delivery model with explicit dashboard states

- **Decision**: Standardize dashboard read states as `loading`, `partial`, `empty`, `failure`, and `ready` and require all dashboard routes to map into one of these states.
- **Rationale**: Fast-first UX is a core product requirement, and silent missing states erode trust.
- **Alternatives considered**:
  - Implicit loading or null-only responses: rejected because users cannot distinguish warm-up from errors.

## Decision 4: Rebalance flow links stay heuristic but explicit

- **Decision**: Represent rebalance migration as explicit flow links (`fromPoolId`, `toPoolId`, `txHash`, `confidence`, `explanation`) derived from canonical event ordering and movement context.
- **Rationale**: This supports explainability without drifting into full attribution-engine complexity.
- **Alternatives considered**:
  - Hide flow inference until attribution engine is complete: rejected because current dashboard would miss a critical user scenario.
  - Present inferred flows as certain by default: rejected because confidence must remain explicit.

## Decision 5: Reconciliation rules are contractual for portfolio, pool, and strategy views

- **Decision**: Define deterministic reconciliation rules in contracts and tests:
  - Portfolio totals reconcile to priced pool and strategy surfaces plus priced idle or residual balances.
  - Manual and supported Mellow remain separate strategy lines inside each pool.
  - Discarded or unsupported events stay reviewable but excluded from trusted totals.
- **Rationale**: Reconciliation is a product trust feature, not just implementation detail.
- **Alternatives considered**:
  - Allow soft reconciliation with undocumented tolerances: rejected because advanced users require strict consistency.

## Decision 6: Dashboard contracts should evolve as versioned product APIs

- **Decision**: Keep explicit versioned response contracts for bootstrap, progress, time-series, rebalance flows, and dashboard drilldowns.
- **Rationale**: The dashboard is now product-facing and must support stable iteration.
- **Alternatives considered**:
  - Treat endpoints as internal unstable payloads: rejected because frontend and test surfaces need compatibility guarantees.

## Decision 7: Pool and strategy drilldowns should remain session-scoped and accepted-run-scoped

- **Decision**: Drilldown endpoints are scoped by session and anchored to latest accepted run; warm-up uses fallback states and progressive enrichment.
- **Rationale**: This keeps temporal coherence and prevents mixed-freshness confusion.
- **Alternatives considered**:
  - Mix in-progress run records into final drilldowns by default: rejected because it risks inconsistent totals.
