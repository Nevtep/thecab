# Contract: Deposits UI Composition

**Feature**: `010-deposits-lifecycle`
**Date**: 2026-05-27

This contract codifies the FR-L01–FR-L07 layout against the existing The Cab design system. Navigation chrome is **not** modified. Every product string passes through `useTranslation("deposits")` (or the listed shared namespace).

## Routes

| Route | Purpose | Gating |
|---|---|---|
| `/deposits` | List + KPI strip + filter bar; desktop opens an in-page detail pane on row selection via `?selectedDepositId=...` | Analysis-ready required (FR-001) |
| `/deposits/[depositId]` | Mobile/full-screen detail; canonical deep-link for sharing | Analysis-ready required |

## Layout (FR-L01)

Composed inside `ConnectedShell` (existing). The page content area renders, top-to-bottom:

1. `CabSectionHeader` — title `t("deposits:title")`, subtitle `t("deposits:subtitle")`, right slot = `CabButton` (link variant) with `t("deposits:howItWorks.label")`.
2. `DepositsFiltersBar` (FR-L02) — composes `CabFilterBar` and `CabRangeSelector`.
3. `DepositsKpiStrip` (FR-L03) — composes `CabKpiStrip` + six `CabMetricCard` instances with optional `CabAreaChart` sparklines.
4. `CabDashboardGrid` two-column on desktop ≥ `breakpoints.lg`:
   - Left: `DepositsTable` (FR-L04) inside `CabDataPanel`.
   - Right: `DepositDetailPane` (FR-L05) inside a sticky `CabCard`. Closes via `CabButton` icon variant; resets `selectedDepositId`.
5. Below `breakpoints.lg`: detail pane collapses to a full-screen view reachable from the row (FR-L06).

## Filter bar (FR-L02)

`DepositsFiltersBar` composes:

- `CabFilterBar` with chips in order: Status, Pool, Date range, More filters.
- Status chip: `CabBadge` variant `chip-toggle`; default value reflects FR-005a (`open_active`).
- Pool chip: dropdown driven by the existing `pools` query; default `all`.
- Date range chip: `CabRangeSelector` bounded to covered range, capped at 365 days.
- "More filters" overflow surface: `CabAccordion` panel exposing `returnSign` (positive/negative/any) and any future filters.
- Active filters render as removable chips with individual clear affordances (`CabBadge` + close icon).

All filter changes mutate the URL via `deposits.urlState.ts`; no local component state holds filter values.

## KPI strip (FR-L03)

`DepositsKpiStrip` renders, in order, using `CabMetricCard` (and optional sparkline via `CabAreaChart`):

| # | Card | Source field | Sub-line |
|---:|---|---|---|
| 1 | Total deposits | `totals.inFilterCount` | `t("deposits:kpi.ofTotal", { total: totals.coveredCount })` |
| 2 | Total capital deployed (net) | `totals.totalCapitalDeployedUsd` | `t("deposits:kpi.pctOfManual", { pct })` |
| 3 | Current value | `totals.currentValueUsd` | `t("deposits:kpi.pctOfCapital", { pct })` |
| 4 | Total rewards | `totals.totalRewardsUsd` | `t("deposits:kpi.pctOfCapital", { pct })` |
| 5 | Realized PnL | `totals.realizedPnlUsd` (signed) | signed `formatPercent` |
| 6 | Unrealized PnL | `totals.unrealizedPnlUsd` (signed) | signed `formatPercent` |

Sparklines are bounded to covered range and MUST NOT extrapolate.

## List (FR-L04)

`DepositsTable` composes `DataTable` family (`DataTable.component.tsx`, `DataTableHeader`, `DataTableSortHeader`, `DataTableCell`, `DataTableEmptyState`, `DataTableToolbar`). Columns (Table density, left-to-right) cover the full FR-003 row set. The `Default visible` column codifies the FR-L04 default visible set; columns marked `no` are reachable via the column-settings affordance.

| Column | Default visible | Cell composition |
|---|:---:|---|
| Deposit | yes | `PositionLabelCell` = `CabStack` of `CabText` (label per FR-003a) + `CabWalletAddress` (truncated owner) |
| Pool | yes | `CabText` pool name + `CabBadge` pool-kind |
| Status | yes | `CabBadge` (`OPEN ACTIVE` Signal Teal token / `CLOSED` neutral token) |
| Opened | yes | `formatDate` |
| Closed | no | `formatDate` or `—` |
| Opened value | yes | `CabUsdValue` + `CabTokenAmount` sub-line |
| Current value | yes | `CabUsdValue` + `CabTokenAmount` sub-line |
| Total rewards | yes | `CabUsdValue` |
| Realized PnL | no | `CabUsdValue` signed + `formatPercent` signed |
| Unrealized PnL | no | `CabUsdValue` signed + `formatPercent` signed |
| Total return | yes | `CabUsdValue` signed + `formatPercent` signed |
| Est. APR | yes | `formatPercent` signed |
| Coverage | yes | `CabCoverageBadge` |
| Confidence | no | `CabCoverageBadge` confidence variant |
| (chevron) | yes | `CabButton` icon variant, opens detail pane (desktop) or `/deposits/[depositId]` (mobile) |

Compact density collapses Total rewards, Realized PnL, Unrealized PnL, and Est. APR into a single `Performance` cell rendering Total return + a chevron that opens the detail pane for the full breakdown. The column-settings affordance and the density toggle are presentation preferences governed by FR-024a: they MUST be persisted via `localStorage` under the key `cab:deposits:viewPrefs:{chainId}:{walletAddress}` and MUST NOT be encoded in URL query parameters. Recipients of a shared link MUST NOT inherit the sender's column or density preferences.

Toolbar (`DataTableToolbar`) hosts:

- Count header `t("deposits:list.count", { count })`.
- Density toggle Table/Compact (`CabSwitch` group).
- Column-settings affordance (`CabButton` icon → `CabAccordion` panel) that toggles non-default-visible columns and reorders within DS-allowed bounds.

Pagination footer composes `DataTable` pagination primitives with `Showing X to Y of N` counter and page-size selector (10/25/50; default 10).

## Detail pane (FR-L05 desktop)

`DepositDetailPane` is a sticky `CabCard` rendered inside the right column of `CabDashboardGrid`. Composition (top-to-bottom):

1. **Header** (`DepositDetailHeader`):
   - `CabSectionHeader` left: position label + `CabBadge` status + a monospaced (`CabTxHash`-style) token-id chip rendering the chain-scoped NFT token id (or manual-position reference) per FR-007.
   - Right: `CabButton` link variant `t("deposits:detail.viewInExplorer")` + close `CabButton` icon variant.
2. **Identity row**: token-pair icons (`CabIcon` × 2) + `CabBadge` pool-kind (`Concentrated LP` / `Basic Stable` / `Basic Volatile`) + fee-tier text.
3. **KPI tiles**: two `CabImpactMetricCard` side by side — Current value, Total return (signed + percent).
4. **Secondary stats row**: `CabStack` row of `CabMetricCard` compact variants — Est. APR, Total rewards, Realized PnL, Unrealized PnL, `CabCoverageBadge` Coverage, `CabCoverageBadge` Confidence.
5. **Covered-range note** (FR-015): `DepositCoveredRangeNote` renders an inline disclosure of the actual covered start/end via `formatDayRange` and marks shorter-than-window coverage explicitly using `t("deposits:detail.coveredRange.shorterThanWindow")`.
6. **CL range** (CL only, FR-021): `DepositRangeIndicator` built on `CabStack` + `CabTooltip` showing token1-denominated band + current price marker + `CabBadge` `IN RANGE` / `OUT OF RANGE`; `—` when unavailable.
7. **Value chart** (FR-009): `DepositValueChart` composes `CabChartPanel` + `CabAreaChart` plotting event-anchored series for opened value, additional capital, rewards, current value, withdrawal events, and closed value (when applicable). The chart MUST anchor on observed event markers only and MUST NOT interpolate across uncovered ranges; gaps render as broken segments with a `CabPartialCoverageNotice` annotation when the gap exceeds the per-event density threshold.
8. **Lifecycle timeline** (FR-008): `DepositLifecycleTimeline` composes `CabRewardTimeline` rows for `claim_reward`/`collect_fees`, `CabRebalanceMarker` rows for `decrease_liquidity`/`increase_liquidity` paired with an `inferred_actions` rebalance link, and `CabActivityEventRow` for the remaining event types. Each row shows timestamp, event type, signed token deltas (`CabTokenAmount` signed), USD value, `CabCoverageBadge` confidence, `CabTxHash` linking the block explorer.
9. **View all events** (`CabAccordion`): expands the full chronological list with `CabActivityEventRow` per event and, beneath each, the per-event movement table (FR-010) rendered by `DepositEventMovementsTable` (composes `DataTable`) with columns Event, Token, Direction (in/out), Amount (`CabTokenAmount` signed), USD value at event (`CabUsdValue`), Price source (`CabBadge`).
10. **Performance panel** (FR-011, FR-011a, FR-011b): `DepositPerformanceDecomposition` renders two visually distinct surfaces inside one `CabChartPanel`, both following the brand's futuristic data-dense treatment:
    - **(a) Capital flow strip** — contextual, non-reconciling. A compact horizontal pair of `CabImpactMetricCard` cells showing gross `Capital entered` and gross `Capital withdrawn`, with a small inline `CabBadge` `t("deposits:detail.decomposition.flow.context")` clarifying these are flow magnitudes, not return components. Hover surfaces a tooltip that lists the contributing events and the price source used at each event (FR-011b).
    - **(b) Return attribution stack** — reconciling. Horizontal stacked bars on `CabBarChart` over exactly: Rewards, Fees, Asset price effect, Rebalance / IL effect, Realized PnL, Unrealized PnL, plus an explicit Unattributed bar. Component USD values render in a monospaced numeric column to the right of each bar; component shares render as `formatPercent` of |Total return|. A `Total return` reconciliation row at the bottom uses Cab Gold and MUST tie within `1e-9`. The Rebalance / IL bar tooltip MUST surface the per-event IL contributions (LP value at event − HODL benchmark at event) and any `priceFallbackDca` reason codes; the Unattributed bar tooltip MUST surface `unattributedReasonCodes`. An `Est. annualized return` readout (`formatPercent` signed) renders adjacent to the Total return row.
11. **Strategies cross-link** (FR-012a): `DepositStrategiesCrossLink` — when `mellowStrategyCrossLinkId` is non-null and the Strategies route doesn't yet exist, renders a disabled `CabButton` with tooltip `t("deposits:strategiesCrossLink.placeholder")`; once the route exists, switches to a live link.
12. **Bottom CTAs**: primary `CabButton` Cab Gold `t("deposits:detail.viewInExplorer")` + secondary `CabButton` `t("deposits:detail.share")`.

## Detail page (FR-L06 mobile / direct deep-link)

`/deposits/[depositId]` mounts `DepositDetailPane` full-width. Back navigation returns to `/deposits` preserving URL state.

## Coverage placement (FR-023)

Global coverage stays in the existing surface. Deposits MUST NOT mount a duplicate top-of-page banner; per-deposit coverage and confidence remain inline via `CabCoverageBadge`.

## Empty / loading / error states

| State | Component |
|---|---|
| Wallet has no manual deposits (FR-006) | `DepositsEmptyState` composing `CabEmptyState` with link to Strategies when Mellow exposure exists |
| Filter yields no matches | `DataTableEmptyState` with `t("deposits:list.emptyFiltered")` |
| Analysis not ready | `CabSectionLockState` reusing Pools' analysis-required treatment |
| Loading | `CabLoadingPanel` shell + `DataTableLoadingState` rows |
| API error | `CabErrorPanel` keyed by machine error code |

## Brand tokens (FR-L07)

- Primary CTAs use `cabColors.action.primaryBg` (Cab Gold) with `primaryText` (Cab Night).
- Positive deltas, `OPEN ACTIVE` chip, `IN RANGE` chip, and the Rewards component bar use Signal Teal variants.
- Negative deltas, `CLOSED` chip negative-variant, and the Unattributed bar use neutral/danger tokens (never raw hex).
- Typography: Orbitron only for section headers and headline KPI numerals via existing DS variants; Inter for body; IBM Plex Mono only inside `CabTxHash`/`CabWalletAddress`/timestamp accents.
- All numeric cells inherit `font-variant-numeric: tabular-nums` from the DS primitives.

## Accessibility

- Skip-link reuses the Pools `cab-skip-link` pattern.
- Detail pane open/close is keyboard-driven (Esc closes, focus returns to the originating row).
- All interactive chips are real buttons with `aria-pressed`.
- Locale changes update the document `lang` attribute via existing root layout logic.
