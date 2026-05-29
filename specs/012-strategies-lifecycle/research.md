# Research: Strategies Lifecycle

**Feature**: `012-strategies-lifecycle`  
**Date**: 2026-05-29

## Decision 1: Implement Strategies As A DataView Workspace

**Decision**: Build `/strategies` as one dense DataView workspace: KPI strip, filter/search controls, strategy master list, selected-strategy analysis panel, and prominent coverage note. `/strategies/[strategyId]` exists for direct links and narrow-screen detail.

**Rationale**: The spec clarification and mockup both point to an operational analysis panel, not a marketing page or a loose collection of repeated cards. The master-detail pattern also matches the existing Deposits selection model and lets users compare exposures while inspecting one lifecycle.

**Alternatives considered**:

- Separate list and detail pages only: simpler, but loses the mockup's operational panel feel and slows comparisons.
- Cards-only dashboard: visually softer but less suitable for dense strategy accounting and row-level confidence.
- Exact mockup replication: too brittle because available strategy data and responsive constraints may change.

## Decision 2: Add Strategy Read Models Instead Of Heavy Request-Time Joins

**Decision**: Add wallet-scoped `strategy_wallet_summaries`, `strategy_history_snapshots`, and `strategy_lifecycle_events` materialized during analysis finalization.

**Rationale**: Pools and Deposits already use DB-backed read models for fast UI routes. Strategy DataView needs summary KPIs, selected detail, lifecycle rows, reward rows, coverage notes, and sparklines without provider calls or expensive joins in request flow.

**Alternatives considered**:

- Query normalized `strategies`, `strategy_exposures`, `ledger_events`, `asset_movements`, and `reward_events` directly in the API: would increase route complexity, latency, and risk of inconsistent aggregation.
- Reuse only `strategy_exposures`: enough for current share balance, not enough for lifecycle, rewards, coverage notes, or DataView summaries.
- Store all UI-ready JSON in one blob: fast but weak for filtering, testing, and explainability.

## Decision 3: Strategy Rewards Resolve Through StrategyExposure First

**Decision**: Strategy-owned rewards displayed in Strategies must be tied to `strategy_exposure_id` where proven. Missing external dashboard references do not block strategy ownership, but unresolved ownership remains visible and uncounted.

**Rationale**: Existing reward resolution already models strategy ownership separately from manual deposits. Keeping `StrategyExposure` as the canonical owner prevents strategy claims from leaking into deposit totals and supports pool aggregate checks.

**Alternatives considered**:

- Resolve strategy rewards only to `strategies.id`: loses wallet-specific ownership and breaks exposure-level lifecycle.
- Require an external strategy position reference for every strategy reward: too strict; current research says the external reference may be absent while wrapper or staking evidence still proves `StrategyExposure`.
- Fallback to same-pool manual deposits: explicitly forbidden by product and deterministic reward specs.

## Decision 4: Pool And Deposit Reward Regression Is Required

**Decision**: Feature-complete validation must compare database rows against source blockchain transactions and assert reward totals across surfaces:

- Pools: total rewards equal resolved deposit rewards plus resolved strategy rewards for the pool.
- Deposits: rewards include only rewards resolved to that deposit.
- Strategies: rewards include only rewards resolved to the selected strategy exposure.

**Rationale**: The user specifically requested after-feature regression that reviews DB rows after analysis and compares against blockchain transactions. This is also the core correctness risk of adding the Strategies surface: totals must not double-count across Pools, Deposits, and Strategies.

**Alternatives considered**:

- UI-only regression: insufficient because incorrect aggregation can still render cleanly.
- Unit tests only: necessary but insufficient for provider payload and real-chain edge cases.
- Manual SQL only: valuable for investigation but should be backed by a repeatable script.

## Decision 5: Coverage Note Is A Required Panel Element

**Decision**: Every selected strategy panel shows a coverage note when coverage is not `full`, and the note explains whether values are share-level, partial, unknown, unavailable, or excluded from pool-level interpretation.

**Rationale**: Mellow strategy internals may not be fully reconstructable. The DataView can be useful at share level, but it must not imply full internal strategy PnL, fee dilution, or pool-level precision when evidence is missing.

**Alternatives considered**:

- Badge-only coverage: too easy to miss and does not explain the accounting boundary.
- Global coverage banner: duplicates existing global coverage patterns and does not explain the selected strategy.
- Hide partial strategies: destroys useful share-level insight and makes data loss invisible.

## Decision 6: Responsive Behavior Preserves Master-Detail Semantics

**Decision**: Desktop uses side-by-side master list and selected panel. Narrow screens preserve the same information architecture through stacked sections or drill-in to `/strategies/[strategyId]`, with list-to-detail in no more than two interactions.

**Rationale**: The mockup is wide, but the spec requires narrow-screen usability. Preserving the information model matters more than preserving exact column placement.

**Alternatives considered**:

- Horizontal scrolling table on mobile: poor lifecycle access and accessibility.
- Remove selected panel on mobile: hides the feature's primary value.
- Separate mobile-only feature scope: unnecessary if the same contracts drive both layouts.

## Decision 7: Navigation Enables Existing Placeholders

**Decision**: Replace the disabled strategy navigation seam in `deposits.navigation.ts` with live `/strategies` and `/strategies/[strategyId]` links, and add Pool detail links to strategy-filtered views where automated exposure exists.

**Rationale**: Deposits already promises a strategy cross-link for Mellow exposure and currently disables it. Activating this route completes the product model: Pools aggregate exposure, Deposits owns manual positions, Strategies owns automated exposure.

**Alternatives considered**:

- Keep placeholder until Rewards ships: unnecessary because strategy lifecycle and rewards can be strategy-local.
- Only add sidebar navigation: misses contextual cross-links from Deposits and Pools.
- Link to Pool detail only: keeps automated strategy lifecycle buried.

## Decision 8: Testing Extends Backend, Engine, UI, And Regression Layers

**Decision**: Planning requires unit tests for strategy materialization, route/service/repository, mappers, URL state, navigation helpers, and reward aggregation; Playwright for DataView/gating/cross-link flows; and a regression script for DB rows vs chain transaction evidence.

**Rationale**: The feature touches both analysis correctness and a new data-dense UI. Unit tests catch deterministic mapping and aggregation mistakes; E2E tests catch navigation and responsive behavior; regression checks catch real-chain/provider mismatch.

**Alternatives considered**:

- Add only E2E coverage: too slow and misses materializer edge cases.
- Add only backend coverage: misses the core DataView behavior and cross-link UX.
- Rely on existing analysis smoke: useful baseline but not specific to strategy reward ownership or DataView contracts.
