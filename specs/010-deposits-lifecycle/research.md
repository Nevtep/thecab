# Research: Deposits Lifecycle

**Feature**: `010-deposits-lifecycle`
**Date**: 2026-05-27

## Decision 1: Request flow stays DB-only behind internal APIs

**Decision**: The browser loads Deposits exclusively through authenticated internal APIs backed by Postgres read models. `GET /api/deposits` and `GET /api/deposits/:depositId` are thin read handlers and never call Moralis, Alchemy, RPC, or Trigger.dev.

**Rationale**: Mirrors the Pools pattern (009) and the constitution's provider-discipline principle. Keeps p95 predictable, eliminates fanout/abuse risk, and ensures Deposits unlocks only after canonical analysis is ready.

**Alternatives considered**:
- Compute decomposition on the fly from `ledger_events` + `asset_movements` per request. Rejected — repeats expensive joins and re-applies the reconciliation rule per request, drifting from the materialization-once principle.
- On-demand provider hydration for missing prices. Rejected — violates CA-005 and reintroduces drift; price hydration belongs in `phase-finalize` materialization (see Decision 7).

## Decision 2: Extend the analysis engine with three new wallet-scoped deposit read models

**Decision**: Materialize during `phase-finalize`:
- `deposit_wallet_summaries` — one current row per `(chainId, walletAddress, depositId)` powering list rows, KPI strip, and detail header.
- `deposit_lifecycle_events` — chronological ordered rows per `(chainId, walletAddress, depositId, sequenceIndex)` powering the timeline (FR-008) and the "View all events" expander.
- `deposit_performance_decompositions` — one current row per `(chainId, walletAddress, depositId)` carrying the reconciled components plus the explicit `unattributed` residual (FR-011a) and reason codes.

**Rationale**: Three shapes satisfy three distinct access patterns (list scan vs ordered timeline vs single-row analytical breakdown), keep responses small, and let the materializer enforce the exact reconciliation rule once.

**Alternatives considered**:
- Single fat `deposits_read_model` row with embedded JSON arrays. Rejected — lifecycle ordering, indexing, and the timeline expander pagination need a tabular shape.
- Reuse `performance_snapshots(scope='deposit')` as-is. Rejected — those rows don't carry the rebalance-effect or `unattributed` columns and are written from `latestPoolTotals` not from per-deposit lifecycle reconstruction.

## Decision 3: Performance decomposition reconciles exactly with an explicit `unattributed` residual

**Decision**: The materializer computes attributed components (`rewards_usd`, `fees_usd`, `asset_price_effect_usd`, `rebalance_effect_usd`, `realized_pnl_usd`, `unrealized_pnl_usd`) from `ledger_events` + `asset_movements` + `reward_events` + `inferred_actions` + `price_points`, then writes `total_return_usd` and `unattributed_usd = total_return_usd - sum(attributed)`. When `unattributed_usd` is non-zero, the row carries `unattributed_reason_codes` (e.g. `missingHistoricalPrice`, `unresolvedRewardClaim`, `coverageGap`, `lowConfidenceClassification`).

**Rationale**: FR-011a + SC-002 + SC-003 require exact reconciliation with an explicit residual surfaced in the UI. Hiding it inside any attributed component would silently overstate that component.

**Alternatives considered**:
- Absorb residual into `rebalance_effect`. Rejected — silently distorts the rebalance signal and breaks SC-002.
- Show a "≈ approximate" badge instead of a residual. Rejected — the spec mandates an explicit `unattributed` bucket with a reason.

## Decision 4: Transfer-in positions are included with degraded confidence (FR-002a)

**Decision**: Positions whose earliest known lifecycle event is a wallet-inbound NFT transfer (not a `mint_position` decoded for this wallet) are persisted in `deposits` with `opened_by_transfer_in = true`. The materializer values `opened_value_usd` and `capital_entered_usd` at the transfer-in event using `price_points` at that timestamp, sets `confidence = degraded`, and adds `transferInOrigin` to `coverage_reason_codes`. They render in the list and detail with a coverage chip explaining the origin.

**Rationale**: Excluding them would silently drop real wallet exposure; valuing them at "first internal mint" would invent capital this wallet never contributed.

**Alternatives considered**:
- Skip them entirely. Rejected — the user owns the NFT and sees current value; not showing it breaks trust.
- Value capital entered as zero. Rejected — distorts performance decomposition (return looks infinite).

## Decision 5: Position labels are deterministic, non-editable, and identical across surfaces (FR-003a)

**Decision**: The label is derived once at materialization as `{token0Symbol}/{token1Symbol}-{poolKind} #{shortTokenId}` where `poolKind` is the CL `tickSpacing` (numeric, e.g. `100`, `2000`) or `stable`/`volatile` for basic pools, and `shortTokenId` is a collision-safe shortened form of the NFT `tokenId` (full id available for explorer links and `CabTxHash`-style copy). The label is persisted on `deposit_wallet_summaries.position_label` and consumed verbatim by the list, the detail header, the URL `selectedDepositId` lookups, and any cross-surface reference (Pools→Deposits).

**Rationale**: Deterministic derivation keeps list/detail/breadcrumb consistent without round-tripping a translation layer, keeps the label stable across re-analyses, and avoids storage cost of editable nicknames in v1.

**Alternatives considered**:
- Pair-only label (`WETH/USDC`). Rejected — ambiguous when a wallet has multiple positions in the same pool.
- User-editable nickname. Rejected — out of scope for v1; not blocked from future spec.

## Decision 6: Filter, sort, page, and selection state are URL-derived (FR-024)

**Decision**: Deposits page state lives in `URLSearchParams` via a feature-local `deposits.urlState.ts` adapter. Supported keys: `status`, `pool`, `from`, `to`, `returnSign`, `sort`, `page`, `pageSize`, `density`, `selectedDepositId`. Defaults are applied at parse time (FR-005a). TanStack Query keys read directly from the parsed state so deep links, back/forward, and Pools→Deposits cross-links (FR-018) hydrate the same query without prop-to-state effects.

**Rationale**: Avoids the `react-hooks/set-state-in-effect` trap encountered in Pools (memory note `pools-container-lint-note.md`) and makes deep-linkable shared states (e.g. "open positions over the last 90 days, sorted by return desc") trivial.

**Alternatives considered**:
- Zustand store with URL sync. Rejected — duplicates source of truth, needs effects to reconcile, regresses the Pools lint lesson.
- Server-component search params only. Rejected — the detail pane and filter chips are interactive client components; URL adapter on the client is simpler.

## Decision 7: Pricing and reward USD backfills happen in materialization, not at request time (FR-025)

**Decision**: `deposit-read-models.ts` extends the existing `phase-finalize` price-hydration pass to cover the manual deposit's tokens (pool tokens + reward tokens). When `reward_events.amount_usd IS NULL`, the materializer recomputes the USD value from `amount_raw + token_address + price_points` for the claim day; when no historical price exists for that day the row is persisted with `priceUnavailable` in its reason codes and renders an explicit "price unavailable" state — never a future or latest-price fallback.

**Rationale**: Codifies the analysis-engine note `reward_events.amount_usd can remain null for older claims`. Keeps the request path read-only and ensures determinism across reloads.

**Alternatives considered**:
- Lazy backfill on detail load. Rejected — request flow would need provider/DB writes (CA-005 violation) and breaks idempotence.

## Decision 8: CL price range and in-range state come from the existing protocol-position read model (FR-021)

**Decision**: For CL deposits, the materializer copies `rangeLowerPrice`, `rangeUpperPrice`, `tickLower`, `tickUpper`, and the latest `isInRange` from the existing `readAerodromeManualPositions` outputs into `deposit_wallet_summaries`. Token1-denominated direction is preserved as-is; nulls propagate as `—` in the UI and degrade the position's confidence. Basic pools persist `null` for all four range fields and the `DepositRangeIndicator` component renders the basic-pool variant.

**Rationale**: The engine already computes these values (`apps/web/src/server/protocol-positions/readAerodromeManualPositions.ts`). Reusing them avoids re-deriving from `tickLower/tickUpper + decimals` at read time and prevents direction inversion bugs.

**Alternatives considered**:
- Re-derive prices in the read layer using `convertTickToToken1Price`. Rejected — duplicates engine logic; risk of decimals desync.

## Decision 9: Capital metric is net in headlines, gross in the decomposition (FR-022)

**Decision**: `deposit_wallet_summaries.opened_value_usd` and the KPI strip's `total_capital_deployed_usd` are net contributed principal (`capital_entered_usd - capital_withdrawn_usd`). Gross `capital_entered_usd` and `capital_withdrawn_usd` remain visible only inside the detail's Performance decomposition. The summary header reuses `formatUsd` and a signed `formatPnl` helper.

**Rationale**: Matches the canonical Pools fix recorded in `analysis-engine-history-notes.md` ("For user-facing `capital invested`, derive net contributed principal"). Prevents overstating manual redeploy-heavy wallets.

## Decision 10: DS-first composition; no new DS package primitives required

**Decision**: All UI composes existing DS exports:
- Shell/layout: `ConnectedShell`, `CabSidebar` (existing, unchanged), `CabSectionHeader`, `CabFilterBar`, `CabRangeSelector`, `CabDashboardGrid`, `CabSectionLockState`.
- Data display: `CabKpiStrip`, `CabMetricCard`, `CabImpactMetricCard`, `CabChartPanel`, `CabDataPanel`, `CabCoverageBadge`, `CabAnalysisStatusBadge`, `CabAccordion`, `CabTokenAmount`, `CabUsdValue`, `CabTxHash`, `CabWalletAddress`, `DataTable` family.
- Domain: `CabDepositCard` (compact list view density), `CabRebalanceMarker`, `CabRewardTimeline`, `CabActivityEventRow`, `CabResidualAttributionPanel`.
- Charts: `CabPoolValueChart` (value chart), `CabRewardsTimelineChart`, `CabRebalanceTimelineChart`, `CabBarChart` (decomposition base), `CabAreaChart` (sparklines).
- Feedback: `CabEmptyState`, `CabErrorPanel`, `CabLoadingPanel`, `CabPartialCoverageNotice`.
- Primitives: `CabCard`, `CabStack`, `CabBox`, `CabText`, `CabBadge`, `CabButton`, `CabSeparator`, `CabTooltip`, `CabSwitch`.

Feature-local compositions (live in `features/deposits/components/`, not in the DS): `PositionLabelCell`, `DepositPerformanceDecomposition` (stacked horizontal bars with explicit unattributed bar; built on `CabBarChart` + `CabBox`), `DepositRangeIndicator` (CL price band built on `CabStack` + `CabTooltip` + tokens), `DepositStrategiesCrossLink` (FR-012a placeholder), `DepositLifecycleTimeline` (composes `CabRewardTimeline` + `CabRebalanceMarker` rows), `DepositsKpiStrip` (composes `CabKpiStrip` + six `CabMetricCard` instances).

**Rationale**: Keeps the DS package stable, matches the constitutional rule that DS receives strings via props, and demonstrably reuses every relevant existing primitive. Three feature-local compositions are kept local because they encode product-specific semantics (decomposition reconciliation, CL band direction, Strategies placeholder) that don't belong in the shared DS.

**Alternatives considered**:
- Promote `DepositPerformanceDecomposition` into the DS as a generic `CabStackedReconciliationBar`. Rejected for v1 to avoid expanding DS surface before a second consumer exists.

## Decision 11: Route handlers reuse the Pools authentication and error envelope

**Decision**: Reuse the `parsePoolsListRequest`/`getPoolsErrorStatus` pattern from `apps/web/src/server/pools/pools.route.ts` as a template for `apps/web/src/server/deposits/deposits.route.ts`, returning the same shaped JSON error envelope and stable machine codes (`wallet_not_authenticated`, `chain_unsupported`, `analysis_not_ready`, `deposit_not_found`, `invalid_request`, `internal_error`). Per-deposit endpoints additionally validate `depositId` as a UUID and ensure ownership by the authenticated wallet on the active chain.

**Rationale**: Consistent error model means the i18n `errors` namespace maps codes to copy once.

## Decision 12: Pools→Deposits cross-link uses URL params (FR-018 + FR-024)

**Decision**: From Pools detail, the "View deposits in this pool" affordance navigates to `/deposits?pool=<poolId>&status=open` (defaults preserved per FR-005a). The chip MUST appear visible and clearable on arrival via the standard `DepositsFiltersBar` controls.

**Rationale**: Single URL contract carries the cross-surface intent; no shared store.

## Decision 13: FK-safe purge update

**Decision**: `db-purge.ts` deletes new tables before their dependencies (existing convention): `deposit_lifecycle_events` → `deposit_performance_decompositions` → `deposit_wallet_summaries` → existing dependencies. Mirrors the existing analysis-engine note about purge ordering.

**Rationale**: Required by repo convention to keep `pnpm db:purge` working.
