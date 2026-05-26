# Research: Analyzed Pools History

**Feature**: `009-pools-history`  
**Date**: 2026-05-25

## Decision 1: Pools request flow stays DB-only behind internal APIs

**Decision**: The browser will load Pools exclusively through authenticated internal APIs backed by Postgres read models. `GET /api/pools` and `GET /api/pools/:poolId` remain thin read handlers and must not call Moralis, Alchemy, RPC, or Trigger.dev.

**Rationale**:
- The product and architecture documents already define providers as background-ingestion inputs, not browser-facing sources.
- The user explicitly asked to avoid hitting external APIs when loading the screen.
- DB-only request flow is the safest anti-abuse posture and keeps response time predictable.

**Alternatives considered**:
- Compute pool detail directly from normalized tables on every request. Rejected because it would turn list/detail loads into heavy join and aggregation work for every navigation.
- Call provider clients on-demand for missing metrics. Rejected because it violates provider boundaries and creates abuse/fanout risk.

## Decision 2: The analysis engine must be extended with wallet-scoped pool read models

**Decision**: Extend analysis finalization to materialize wallet-scoped Pools read models rather than relying on current `latestPoolTotals` outputs.

**Rationale**:
- Current `computeSnapshots()` writes `performance_snapshots(scope = 'pool')` and `pool_metrics_snapshots` using the same latest pool total across every day in the selected range, which is not sufficient for truthful one-year historical pool charts.
- The existing normalized domain tables already contain the right source signals, but not the final list/detail projections the UI needs.
- Materialized pool read models keep the runtime path simple and predictable.

**Alternatives considered**:
- Use current `performance_snapshots(scope = 'pool')` as-is. Rejected because the daily pool values are not historical yet.
- Push all pool detail computation into the UI. Rejected because it would duplicate business logic and violate the DB-first read-path goal.

## Decision 3: Pools needs three read-model shapes: summary, history, and timeline

**Decision**: Materialize three wallet-scoped pool projections:
- a latest summary row per pool for list and header metrics,
- a daily history row per pool for charts and range-bound detail,
- a timeline row per pool for lifecycle, rebalance, and redeploy events.

**Rationale**:
- The list and detail screens need different access patterns and different bounded query shapes.
- A single generic snapshot table is not expressive enough for grouped rebalance events, attributable lifecycle rows, or mixed manual/automated/residual segments.
- Dedicated read models let the API keep response payloads small and whitelisted.

**Alternatives considered**:
- Store everything in `metadata_json` on generic snapshots. Rejected because it would make validation, indexing, and route-level query bounding much harder.

## Decision 4: Pools routing unlocks only after analysis is `ready` or `stale`

**Decision**: `/pools` and `/pools/[poolId]` become real connected routes, but only for wallets whose canonical analysis status is `ready` or `stale`. Before that, nav remains gated and direct visits render a guided locked state.

**Rationale**:
- Pools is defined in the product spec as analysis-gated.
- Reusing the canonical analysis status vocabulary prevents route-by-route drift.
- A locked route explains product state more clearly than a silent redirect.

**Alternatives considered**:
- Redirect pre-analysis visits to Overview. Rejected because it obscures why the route is unavailable.
- Allow partial recent-view Pools. Rejected because the spec defines Pools as the analyzed surface, not a recent-view approximation.

## Decision 5: Visual richness comes from structured KPI, chart, and detail contracts

**Decision**: The Pools UI should reuse existing dense dashboard primitives and define a stronger visual contract for:
- a KPI rail with sparkline-capable cards,
- a list/detail split optimized for desktop,
- stacked detail sections on mobile,
- chart panels with clear legends, notices, and coverage explanations,
- explicit manual/automated/residual segmentation.

**Rationale**:
- The provided reference image emphasizes analytical density, side-panel detail, and strong metric hierarchy.
- Existing Overview patterns already supply reusable chart, card, and shell primitives.
- UI contracts prevent planning from collapsing into a thin table-only read model.

**Alternatives considered**:
- Build a generic table with modals. Rejected because it would not satisfy the product's visual and analytical expectations.

## Decision 6: API abuse prevention is handled through bounded authenticated DB queries

**Decision**: Pools routes should infer the wallet from authenticated session context, require `chainId`, whitelist filters/sorts/ranges, cap the detail range at 365 days, and paginate or hard-cap timeline rows.

**Rationale**:
- This matches the product's wallet-scoped route model.
- The risk profile is lower when routes never call providers and never allow unbounded scans.
- Request validation can stay stable and machine-code based, consistent with existing analysis routes.

**Alternatives considered**:
- Accept arbitrary wallet addresses from the browser. Rejected because it increases abuse surface and conflicts with auth-gated wallet ownership rules.
- Allow arbitrary date spans and free-text sort fields. Rejected because it undermines predictable query cost.

## Decision 7: Pool rewards and exposure must be aggregated without collapsing source distinctions

**Decision**: Pool totals must aggregate manual deposits, automated strategy exposure, residual attribution, and rewards while preserving source breakdowns in both stored read models and API responses.

**Rationale**:
- The product and protocol research explicitly separate manual Aerodrome deposits from Mellow strategy exposure.
- Pools answers the market-level question, but the user still needs to see where value is coming from.
- Coverage can differ per segment, especially for share-level strategy accounting.

**Alternatives considered**:
- Return only one pool total number and let the UI infer breakdowns later. Rejected because it would hide coverage differences and defeat explainability.