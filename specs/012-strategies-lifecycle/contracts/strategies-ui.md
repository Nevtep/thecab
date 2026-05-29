# Contract: Strategies UI Composition

**Feature**: `012-strategies-lifecycle`  
**Date**: 2026-05-29

This contract turns the Strategy DataView mockup into implementation guidance. The mockup controls density, hierarchy, master-detail behavior, and look and feel. It does not freeze exact column order, example numbers, or pixel layout.

## Routes

| Route | Purpose | Gating |
|---|---|---|
| `/strategies` | DataView workspace: KPI strip, filters, master list, selected-strategy panel | Analysis-ready required |
| `/strategies/[strategyId]` | Direct/narrow-screen strategy detail | Analysis-ready required |

## First Screen DataView

Inside `ConnectedShell`, render top-to-bottom:

1. `CabSectionHeader`: title, subtitle, refresh action, help/coverage info action.
2. `StrategiesKpiStrip`: five dense KPI cards for strategy value, active strategies, claimed rewards, total return, and protocol coverage health.
3. `StrategiesFiltersBar`: search plus status, protocol, pool, coverage, share-level, partial, and return filters.
4. Two-zone DataView:
   - Left/master: `StrategiesTable` in `CabDataPanel`.
   - Right/detail: `StrategySelectedPanel` in an elevated panel.

On desktop-sized viewports, the KPI strip, at least five strategy rows when available, and the selected panel should be visible without initial vertical scrolling. On narrow viewports, preserve the same information architecture through stacked sections or drill-in to `/strategies/[strategyId]`.

## KPI Strip

KPI cards use existing metric/card/chart primitives and render compact trend cues only when backed by `strategy_history_snapshots`.

| KPI | Source |
|---|---|
| Current strategy value | Sum of visible `current_estimated_value_usd` where available. |
| Active strategies | Count of active strategy summaries. |
| Claimed rewards | Sum of resolved strategy rewards. |
| Total return | Sum of reconstructable strategy returns, partial if any contributor is partial. |
| Protocol coverage | Share of strategy exposures with full/share-level coverage over all detected exposures. |

Every KPI must show full/share-level/partial/unavailable state when relevant. Mixed-coverage aggregates must not look fully covered.

## Master List

The master list composes the existing DataTable family. Default visible columns:

| Column | Notes |
|---|---|
| Strategy / Pool | Token-pair or strategy label, underlying pool, token icons, Mellow badge, mapping status. |
| Protocol | Mellow for v1. |
| Status | Active, closed, unknown. |
| Current value | Estimated value plus token/share sub-line when available. |
| Shares | Current share balance and share symbol. |
| Rewards claimed | Resolved strategy rewards only. |
| Result | Total return and percent when reconstructable. |
| Estimated APR | Signed annualized estimate when available. |
| Coverage | Full/share-level/partial/unknown badge. |
| Confidence | High/medium/low/degraded/unknown indicator. |

Rows are selectable. Selection updates the selected panel in place and marks the row visibly active. If filters remove the selected row, select the highest-ranked remaining row or show an empty selected state.

## Selected Strategy Panel

The selected panel contains:

1. Header with strategy label, protocol, underlying pool, Mellow badge, mapping status, current value, share balance, return, coverage, and confidence.
2. Exposure summary with deposited value, withdrawn value, shares received, shares redeemed, current shares, and current estimated value.
3. Rewards summary/table with resolved strategy rewards and unresolved strategy-shaped reward rows marked but excluded from totals.
4. Lifecycle timeline with strategy deposit, share receive, stake, claim, unstake, withdraw, share redeem, close, internal activity when proven, and baseline transfer-in when applicable.
5. Coverage note that is visually prominent whenever coverage is not `full`.

## Coverage Note

For `share_level`, the note must explain that user deposits, withdrawals, shares, and resolved rewards are counted, while underlying strategy internals may be incomplete.

For `partial`, the note must list missing or degraded reasons such as missing price, missing share valuation, inferred pool mapping, unresolved reward, or incomplete internal events.

For `unknown`, the note must avoid return claims and explain that exposure was detected but not reliably analyzable.

## Navigation

- Sidebar/connected nav exposes Strategies as a real destination once implemented.
- Deposits cross-links become active when `mellowStrategyCrossLinkId` is present.
- Pool detail automated exposure rows link to Strategies filtered by pool or directly selected strategy.
- Back navigation from `/strategies/[strategyId]` returns to `/strategies` preserving URL filters where available.

## Empty, Loading, Error States

| State | Component behavior |
|---|---|
| Analysis not ready | Existing analysis-required lock state. |
| No strategy exposure | Empty state distinguishing no automated strategy exposure from no analysis. |
| Filter no matches | Table empty state; filters remain visible and clearable. |
| Selected strategy missing after refresh | Contextual selected-panel empty state; list filters preserved. |
| API error | Error panel keyed by machine error code. |
| Loading | KPI skeletons, table loading rows, selected-panel loading state. |

## Brand And Accessibility

- Use dark control-tower surfaces, thin technical dividers, compact tabular numerals, restrained glow, and cyan/gold/semantic accents from design tokens.
- Do not use raw hex values or hardcoded product copy.
- Keep table cells and badges readable at compact density.
- Selection, filters, and panel controls must be keyboard reachable.
- Active filters use real buttons with clear affordances.
- External transaction links use accessible labels and open explorer URLs consistently with Pools/Deposits.
