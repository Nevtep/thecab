# Tasks: Deposits Lifecycle

**Input**: Design documents from `/specs/010-deposits-lifecycle/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/deposits-api.md](contracts/deposits-api.md), [contracts/deposits-ui.md](contracts/deposits-ui.md), [contracts/i18n-namespaces.md](contracts/i18n-namespaces.md), [quickstart.md](quickstart.md)

**Tests**: Test tasks are included to match the test files declared in plan.md (`deposit-read-models.test.ts`, `deposits.repository.test.ts`, `deposits.route.test.ts`, `deposits.service.test.ts`, `deposits.mappers.test.ts`, `deposits.urlState.test.ts`, `deposits.validation.test.ts`, `e2e/deposits-gated-and-lifecycle.spec.ts`). Tests are authored alongside the code they cover; the reconciliation invariant (FR-011a) MUST be enforced by a failing test before its corresponding implementation lands.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Different file, no dependency on incomplete tasks
- **[Story]**: User story tag (US1–US5) when applicable

---

## Phase 1: Setup

**Purpose**: Branch + workspace baseline. No new tools required; the existing `apps/web` stack already covers everything.

- [X]  Confirm working branch `010-deposits-lifecycle`, pull latest `main`, run `pnpm install` from repo root, and verify `pnpm --filter web lint`, `pnpm --filter web typecheck`, and `pnpm --filter web test --run` are green before touching code.
- [X]  [P] Create empty namespace files [apps/web/src/i18n/locales/en/deposits.json](apps/web/src/i18n/locales/en/deposits.json) and [apps/web/src/i18n/locales/es/deposits.json](apps/web/src/i18n/locales/es/deposits.json) with `{}` so subsequent UI tasks can import without crashing the i18n parity checks.
- [X]  [P] Register the new `deposits` namespace in [apps/web/src/i18n/index.ts](apps/web/src/i18n/index.ts) (or the active i18n bootstrap module) so it is preloaded alongside existing namespaces.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema, materialization plumbing, purge safety, URL state, server module skeleton, query infrastructure, and shared i18n extensions. Nothing in Phase 3+ can begin until this completes.

**⚠️ CRITICAL**: All user stories depend on this phase.

### Schema & migrations

- [X]  Add the three new wallet-scoped tables in [apps/web/src/server/db/schema.ts](apps/web/src/server/db/schema.ts) per data-model.md §2: `deposit_wallet_summaries`, `deposit_lifecycle_events`, `deposit_performance_decompositions` with all columns, FKs to `deposits`, `pools`, `analysis_runs`, `strategies`, and the listed unique + supporting indexes.
- [X]  Generate and review the Drizzle migration under [apps/web/src/server/db/migrations/](apps/web/src/server/db/migrations) via `pnpm --filter web db:generate`; ensure the SQL contains the three tables, FKs, and indexes, and no destructive changes to existing tables.
- [X]  Update [apps/web/src/server/scripts/db-purge.ts](apps/web/src/server/scripts/db-purge.ts) to delete `deposit_lifecycle_events`, `deposit_performance_decompositions`, and `deposit_wallet_summaries` BEFORE `deposits`, `ledger_events`, `asset_movements`, `reward_events`, and `inferred_actions` in the FK-safe purge order (per repo memory `analysis-engine-history-notes`).

### Analysis materializer skeleton

- [X]  Create [apps/web/src/server/analysis/deposit-read-models.ts](apps/web/src/server/analysis/deposit-read-models.ts) exporting `materializeDepositReadModels(runContext)` that orchestrates per-deposit summary, lifecycle, and decomposition writes inside the existing run transaction; implement chunked inserts to avoid the `mergeQueries` overflow noted in repo memory.
- [X]  Wire `materializeDepositReadModels` into the existing `phase-finalize` step in [apps/web/src/server/analysis/enginePersistence.ts](apps/web/src/server/analysis/enginePersistence.ts) so a successful run produces deposit read models with the correct `latest_run_id`.
- [X] T009 [P] Extract reusable price hydration + reward USD backfill helpers in [apps/web/src/server/analysis/computeSnapshots.ts](apps/web/src/server/analysis/computeSnapshots.ts) for use by the materializer; do not change existing call sites' behavior.
- [X] T010 [P] Author the failing materializer test [apps/web/src/server/analysis/deposit-read-models.test.ts](apps/web/src/server/analysis/deposit-read-models.test.ts) with at least: an empty wallet (no rows), a single open CL position (label, range, in-range), a closed basic position (status, closed_at), a transfer-in originated position (`opened_by_transfer_in = true`, `confidence = degraded`), and a position whose decomposition reconciles exactly within 1e-9 (FR-011a).

### Server read layer skeleton

- [X]  [P] Create [apps/web/src/server/deposits/deposits.types.ts](apps/web/src/server/deposits/deposits.types.ts) with `DepositSummaryView`, `DepositDetailView`, `DepositsListResponse`, `DepositDetailResponse`, and error code unions matching [contracts/deposits-api.md](contracts/deposits-api.md).
- [X]  [P] Create [apps/web/src/server/deposits/deposits.repository.ts](apps/web/src/server/deposits/deposits.repository.ts) with `findDepositSummaries({ chainId, walletAddress, filters, sort, page, pageSize })` and `findDepositDetail({ chainId, walletAddress, depositId })` issuing indexed reads against the three new tables only.
- [X]  Create [apps/web/src/server/deposits/deposits.service.ts](apps/web/src/server/deposits/deposits.service.ts) that enforces session wallet match, chain support check, analysis-ready check, filter validation (≤ 365-day range, allowed enums), defensive reconciliation assertion on detail reads, and stable error envelope mapping.
- [X]  Create [apps/web/src/server/deposits/deposits.route.ts](apps/web/src/server/deposits/deposits.route.ts) exposing route-handler functions reused by the App Router endpoints, returning JSON with `Cache-Control: no-store`.

### Client URL/query infrastructure

- [X]  [P] Create [apps/web/src/features/deposits/deposits.types.ts](apps/web/src/features/deposits/deposits.types.ts) re-exporting the view-model shapes from the server types (single source of truth).
- [X]  [P] Create [apps/web/src/features/deposits/deposits.urlState.ts](apps/web/src/features/deposits/deposits.urlState.ts) with `parseDepositsUrlState(searchParams)`, `serializeDepositsUrlState(state)`, and `normalizeFiltersForQueryKey(state)`; cover status, pool, dateRange (`from`/`to`), returnSign, sort, page, pageSize, and selectedDepositId per FR-024. Column visibility and density are explicitly OUT of URL state per FR-024a and MUST NOT be read from or written to `searchParams`.
- [X]  [P] Create [apps/web/src/features/deposits/deposits.viewPrefs.ts](apps/web/src/features/deposits/deposits.viewPrefs.ts) and [apps/web/src/features/deposits/deposits.viewPrefs.test.ts](apps/web/src/features/deposits/deposits.viewPrefs.test.ts) exporting a `useDepositsViewPreferences({ chainId, walletAddress })` hook that reads/writes `{ density: "table" | "compact", visibleColumns: string[] }` from `localStorage` under the key `cab:deposits:viewPrefs:{chainId}:{walletAddress}` per FR-024a; SSR-safe (no access during render on the server), defaults to Table density + the default-visible column set from contracts/deposits-ui.md, and isolates preferences per `(chainId, walletAddress)`.
- [X]  [P] Create [apps/web/src/features/deposits/deposits.urlState.test.ts](apps/web/src/features/deposits/deposits.urlState.test.ts) verifying defaults (FR-005a), round-trip stability, alphabetized normalization for cache hits, 365-day cap rejection, and a negative case asserting that `columns` / `density` are never serialized into nor parsed from URL state (FR-024a boundary).
- [X]  Update [apps/web/src/queries/keys.ts](apps/web/src/queries/keys.ts) to add `deposits.list(chainId, walletAddress, normalizedFilters)` and `deposits.detail(chainId, depositId)` keys including `chainId`.
- [X]  Update [apps/web/src/queries/hooks.ts](apps/web/src/queries/hooks.ts) to add `useDepositsListQuery` and `useDepositDetailQuery` hooks; gate by analysis-ready state mirroring Pools.

### Shared i18n extensions (en + es)

- [X]  [P] Extend [apps/web/src/i18n/locales/en/coverage.json](apps/web/src/i18n/locales/en/coverage.json) and [apps/web/src/i18n/locales/es/coverage.json](apps/web/src/i18n/locales/es/coverage.json) with `reasonCodes.transferInOrigin`, `reasonCodes.unattributedResidual`, `reasonCodes.priceUnavailable`, `reasonCodes.rangeUnavailable`, and `confidence.degraded`.
- [X]  [P] Extend [apps/web/src/i18n/locales/en/charts.json](apps/web/src/i18n/locales/en/charts.json) and [apps/web/src/i18n/locales/es/charts.json](apps/web/src/i18n/locales/es/charts.json) with `decomposition.legend.*`, `decomposition.tooltip.*`, and `range.token1Denom`.
- [X]  [P] Extend [apps/web/src/i18n/locales/en/navigation.json](apps/web/src/i18n/locales/en/navigation.json) and [apps/web/src/i18n/locales/es/navigation.json](apps/web/src/i18n/locales/es/navigation.json) with `items.deposits` and `a11y.openDeposits`.
- [X]  [P] Extend [apps/web/src/i18n/locales/en/common.json](apps/web/src/i18n/locales/en/common.json) and [apps/web/src/i18n/locales/es/common.json](apps/web/src/i18n/locales/es/common.json) with shared chips (`chips.open_active`, `chips.closed`) and actions (`actions.viewInExplorer`, `actions.share`) if not already present.
- [X]  [P] Extend [apps/web/src/i18n/locales/en/errors.json](apps/web/src/i18n/locales/en/errors.json) and [apps/web/src/i18n/locales/es/errors.json](apps/web/src/i18n/locales/es/errors.json) with the codes listed in [contracts/i18n-namespaces.md](contracts/i18n-namespaces.md) (skip duplicates already present).

### Formatters & cross-feature unlocks

- [X] T025 [P] Confirm or extend [apps/web/src/i18n/formatters.ts](apps/web/src/i18n/formatters.ts) so signed-PnL, signed-percent, USD, token-amount, day, and day-range helpers cover all deposit cells; add only what is missing.
- [X]  Update [apps/web/src/features/overview/overview.mappers.ts](apps/web/src/features/overview/overview.mappers.ts) so the Deposits nav target unlocks once analysis is `ready`, with no chrome-level layout changes.
- [X] T027 Update [apps/web/src/features/settings/Settings.component.tsx](apps/web/src/features/settings/Settings.component.tsx) (and any shared nav config it consumes) so the Deposits entry points to `/deposits`; do not change other navigation entries.

**Checkpoint**: Database, materializer, server skeleton, URL contract, query infra, and i18n scaffolding are in place. User-story phases can start in parallel.

---

## Phase 3: User Story 1 — Review All Manual Deposits Across History (P1) 🎯 MVP

**Goal**: An analyzed user opens `/deposits` and sees every manual Aerodrome position from covered history with identity, status, opened/current value, total return, est. APR, coverage, and confidence, behind the analysis-ready gate.

**Independent Test**: With a wallet that has at least one decoded manual Aerodrome position, after analysis transitions to `ready`, opening `/deposits` shows the FR-005a default (open active, all pools, full covered range, opened ↓) with one row per position carrying all FR-003 columns; pre-ready state shows the locked treatment (FR-001); empty state distinguishes "no manual deposits" from "no analyzed activity" (FR-006).

### Materializer completion for list

- [X] T028 [US1] Implement summary materialization in [apps/web/src/server/analysis/deposit-read-models.ts](apps/web/src/server/analysis/deposit-read-models.ts): derive position label per FR-003a, status, opened/closed timestamps, net `opened_value_usd` (FR-022), `current_value_usd`, `total_rewards_usd`, `realized_pnl_usd`, `unrealized_pnl_usd`, `total_return_usd/pct`, `estimated_annualized_return_pct`, coverage/confidence, and `coverage_reason_codes`; persist to `deposit_wallet_summaries` and expose realized/unrealized PnL on `DepositSummaryView` for the FR-L04 row columns.
- [X] T029 [US1] Extend the materializer test [apps/web/src/server/analysis/deposit-read-models.test.ts](apps/web/src/server/analysis/deposit-read-models.test.ts) with assertions for label determinism, net-vs-gross capital, status detection, and `coverage_reason_codes` propagation.

### List API

- [X]  [US1] Implement `findDepositSummaries` query in [apps/web/src/server/deposits/deposits.repository.ts](apps/web/src/server/deposits/deposits.repository.ts) honoring status/pool/date/returnSign filters, named sorts, pagination, and computing `totals`, `coveredRange`, and `sparklines`.
- [X]  [US1] Implement list path of [apps/web/src/server/deposits/deposits.service.ts](apps/web/src/server/deposits/deposits.service.ts) with validation rules from [contracts/deposits-api.md](contracts/deposits-api.md): required `chainId`, allowed enums, ≤ 365-day range, pageSize ∈ {10,25,50}.
- [X]  [US1] Create [apps/web/src/app/api/deposits/route.ts](apps/web/src/app/api/deposits/route.ts) wiring the App Router `GET` to `deposits.route.ts`; ensure `Cache-Control: no-store` and stable error envelope.
- [X] T033 [P] [US1] Author [apps/web/src/server/deposits/deposits.repository.test.ts](apps/web/src/server/deposits/deposits.repository.test.ts) for filter combinations, sort stability, pagination boundaries, and totals math.
- [X] T034 [P] [US1] Author [apps/web/src/server/deposits/deposits.service.test.ts](apps/web/src/server/deposits/deposits.service.test.ts) for analysis-ready gating, chain support, error envelope mapping, and 365-day cap.
- [X] T035 [P] [US1] Author [apps/web/src/server/deposits/deposits.route.test.ts](apps/web/src/server/deposits/deposits.route.test.ts) covering authenticated success, `wallet_not_authenticated`, `chain_unsupported`, `analysis_not_ready`, and `invalid_request` cases.

### List UI composition

- [X]  [P] [US1] Create [apps/web/src/features/deposits/deposits.mappers.ts](apps/web/src/features/deposits/deposits.mappers.ts) mapping `DepositSummaryView` → table-cell view models using locale formatters; no hardcoded copy.
- [X]  [P] [US1] Create [apps/web/src/features/deposits/deposits.mappers.test.ts](apps/web/src/features/deposits/deposits.mappers.test.ts) verifying signed PnL, USD, token amount, percent, and coverage label formatting in en + es.
- [X]  [P] [US1] Create [apps/web/src/features/deposits/components/PositionLabelCell.tsx](apps/web/src/features/deposits/components/PositionLabelCell.tsx) rendering the deterministic FR-003a label + truncated owner.
- [X]  [P] [US1] Create [apps/web/src/features/deposits/components/DepositsFiltersBar.tsx](apps/web/src/features/deposits/components/DepositsFiltersBar.tsx) composing `CabFilterBar` + `CabRangeSelector` per [contracts/deposits-ui.md](contracts/deposits-ui.md) §Filter bar; reads/writes URL state only.
- [X]  [P] [US1] Create [apps/web/src/features/deposits/components/DepositsKpiStrip.tsx](apps/web/src/features/deposits/components/DepositsKpiStrip.tsx) composing `CabKpiStrip` + six `CabMetricCard` instances with optional `CabAreaChart` sparklines (no extrapolation past covered range).
- [X]  [P] [US1] Create [apps/web/src/features/deposits/components/DepositsTable.tsx](apps/web/src/features/deposits/components/DepositsTable.tsx) composing the `DataTable` family with the FR-L04 column catalog in Table density (Deposit, Pool, Status, Opened, Closed, Opened value, Current value, Total rewards, Realized PnL, Unrealized PnL, Total return, Est. APR, Coverage, Confidence, chevron), the default-visible subset from contracts/deposits-ui.md, the Compact-density `Performance` collapsed cell (Total rewards + Realized PnL + Unrealized PnL + Est. APR → Total return + chevron), a column-settings affordance for non-default-visible columns wired through `useDepositsViewPreferences` (T016a) for `localStorage`-backed visibility + density persistence per FR-024a (NOT URL state), the density toggle, and the pagination footer.
- [X] T042 [P] [US1] Create [apps/web/src/features/deposits/components/DepositsEmptyState.tsx](apps/web/src/features/deposits/components/DepositsEmptyState.tsx) composing `CabEmptyState` distinguishing FR-006 cases (no manual deposits vs no analyzed activity vs filter-no-match).
- [X] T043 [US1] Create [apps/web/src/features/deposits/Deposits.component.tsx](apps/web/src/features/deposits/Deposits.component.tsx) composing `CabSectionHeader`, `DepositsFiltersBar`, `DepositsKpiStrip`, and `DepositsTable` inside `CabDashboardGrid` per FR-L01.
- [X]  [US1] Create [apps/web/src/features/deposits/Deposits.container.tsx](apps/web/src/features/deposits/Deposits.container.tsx) that derives state from `deposits.urlState.ts`, runs `useDepositsListQuery`, handles loading / error / empty / locked branches, and forwards view models to the component.
- [X]  [US1] Create [apps/web/src/app/deposits/page.tsx](apps/web/src/app/deposits/page.tsx) mounting `Deposits.container` inside `ConnectedShell`; surface `CabSectionLockState` when analysis is not ready (FR-001) reusing the Pools treatment.
- [X] T046 [US1] Add [apps/web/src/features/deposits/deposits.validation.test.ts](apps/web/src/features/deposits/deposits.validation.test.ts) ensuring URL state + filter validation rejects invalid combos and the container handles each error code branch.
- [X] T047 [US1] Populate [apps/web/src/i18n/locales/en/deposits.json](apps/web/src/i18n/locales/en/deposits.json) and [apps/web/src/i18n/locales/es/deposits.json](apps/web/src/i18n/locales/es/deposits.json) with `title`, `subtitle`, `howItWorks.*`, `gating.*`, `filters.*`, `list.*`, `kpi.*`, `status.*`, `poolKind.*`, and `a11y.*` keys per [contracts/i18n-namespaces.md](contracts/i18n-namespaces.md); enforce en/es parity.

**Checkpoint**: `/deposits` list is fully functional, gated, URL-driven, and localized. MVP shippable.

---

## Phase 4: User Story 2 — Inspect One Position Across Its Lifecycle (P1)

**Goal**: A user opens a deposit and sees full identity, KPI tiles, CL range (when CL), lifecycle timeline, per-event movements, and the performance decomposition that reconciles exactly with total return.

**Independent Test**: With a position that has at least an open, an increase or stake, a claim, and either a close or open state, opening it from the list (desktop pane) or via direct URL (`/deposits/[depositId]` mobile) shows the FR-L05 sections; the decomposition stacked bars plus the explicit Unattributed bar sum to the displayed Total return within `1e-9` (FR-011a); CL positions show `rangeLowerPrice`/`rangeUpperPrice` token1-denominated and the in/out-of-range badge (FR-021); the `View in explorer` CTA uses Cab Gold.

### Materializer completion for detail

- [X] T048 [US2] Implement lifecycle event materialization in [apps/web/src/server/analysis/deposit-read-models.ts](apps/web/src/server/analysis/deposit-read-models.ts) populating `deposit_lifecycle_events` with stable `sequence_index`, signed token deltas, USD value with backfill (FR-025), `price_source`, confidence, `inferred_action_id` linkage, and `coverage_reason_codes`.
- [X] T049 [US2] Implement performance decomposition materialization in the same file per data-model §3 rules 10 and 11 and FR-011b: for each `decrease_liquidity` / `withdraw` / `close` / `burn` event, value the withdrawn token deltas at observed event-block prices (single-asset CL out-of-range withdrawals included), fall back to the nearest `price_points` value within the configured tolerance window and tag `priceFallbackDca` when no block-level observation exists, and accumulate the realized impermanent-loss contribution `(LP_value_at_event − HODL_basket_value_at_event)` into `rebalance_effect_usd` (`x·y=k` for basic pools, Uniswap-v3 tick formula for CL pools). Attribute any subsequent swap of withdrawn tokens to `realized_pnl_usd` only (`swap_proceeds_usd − withdrawal_block_cost_basis_usd`); never re-attribute to `rebalance_effect_usd`. Persist `capital_entered_usd` / `capital_withdrawn_usd` as gross flow magnitudes on the summary row (NOT inside the reconciling sum). Compute attributed components, set `unattributed_usd = total_return − Σ(rewards + fees + asset_price_effect + rebalance_effect + realized + unrealized)`, persist `unattributed_reason_codes` + `component_percentages`, and assert the reconciliation invariant within `1e-9`.
- [X] T050 [US2] Copy CL range fields from `readAerodromeManualPositions` outputs into `deposit_wallet_summaries` (`range_lower_price`, `range_upper_price`, `tick_lower`, `tick_upper`, `is_in_range`); when unavailable, leave null and add `rangeUnavailable` reason code.
- [X] T051 [US2] Extend [apps/web/src/server/analysis/deposit-read-models.test.ts](apps/web/src/server/analysis/deposit-read-models.test.ts) with: a reconciliation invariant test (returns sum ties Total return within `1e-9` and explicitly excludes `capital_entered_usd` / `capital_withdrawn_usd`), an `unattributed_reason_codes` test, a CL-range copy test, a rewards-backfill test (FR-025), an **impermanent-loss realization** test for a CL position that exits range and is withdrawn single-asset (verifies the IL delta lands in `rebalance_effect_usd` and the withdrawn token is valued at the event-block price with `priceFallbackDca` flagged when the block price is unavailable, per FR-011b), and a **no double-count** test asserting that a subsequent swap of the withdrawn token contributes only to `realized_pnl_usd`.

### Detail API

- [X] T052 [US2] Implement `findDepositDetail` in [apps/web/src/server/deposits/deposits.repository.ts](apps/web/src/server/deposits/deposits.repository.ts) with a single summary read, a single decomposition read, and an ordered scan of lifecycle events.
- [X] T053 [US2] Implement detail path of [apps/web/src/server/deposits/deposits.service.ts](apps/web/src/server/deposits/deposits.service.ts) with `deposit_not_found` (ownership check), defensive reconciliation assertion that maps to `internal_error` on violation, and derivation of the `valueChart` series + `gaps` from the ordered lifecycle events per data-model §6 (FR-009).
- [X] T054 [US2] Create [apps/web/src/app/api/deposits/[depositId]/route.ts](apps/web/src/app/api/deposits/[depositId]/route.ts) wiring `GET` to the service.
- [X] T055 [P] [US2] Extend [apps/web/src/server/deposits/deposits.repository.test.ts](apps/web/src/server/deposits/deposits.repository.test.ts) with detail-shape assertions.
- [X] T056 [P] [US2] Extend [apps/web/src/server/deposits/deposits.route.test.ts](apps/web/src/server/deposits/deposits.route.test.ts) covering `deposit_not_found`, ownership mismatch, and reconciliation defensive failure.

### Detail UI composition

- [X] T057 [P] [US2] Create [apps/web/src/features/deposits/components/DepositDetailHeader.tsx](apps/web/src/features/deposits/components/DepositDetailHeader.tsx) composing `CabSectionHeader` + status `CabBadge` + a chain-scoped token-id chip (monospaced, `CabTxHash`-style) per FR-007 + close icon + `View in explorer` link per FR-L05(a).
- [X] T058 [P] [US2] Create [apps/web/src/features/deposits/components/DepositRangeIndicator.tsx](apps/web/src/features/deposits/components/DepositRangeIndicator.tsx) rendering token1-denominated band, current price marker, and `IN RANGE`/`OUT OF RANGE` `CabBadge` (FR-021); render `—` when unavailable.
- [X] T059 [P] [US2] Create [apps/web/src/features/deposits/components/DepositLifecycleTimeline.tsx](apps/web/src/features/deposits/components/DepositLifecycleTimeline.tsx) composing `CabRewardTimeline` + `CabRebalanceMarker` + `CabActivityEventRow` and a `View all events` `CabAccordion` (FR-008).
- [X] T060 [P] [US2] Create [apps/web/src/features/deposits/components/DepositPerformanceDecomposition.tsx](apps/web/src/features/deposits/components/DepositPerformanceDecomposition.tsx) rendering the Performance panel as two visually distinct surfaces inside one `CabChartPanel` per FR-011 / FR-L05(h): (a) a contextual **Capital flow strip** (paired `CabImpactMetricCard` for gross `Capital entered` and `Capital withdrawn`, with a `CabBadge` flow-context label and per-event tooltips citing the price source from FR-011b), and (b) a reconciling **Return attribution stack** of horizontal stacked bars on `CabBarChart` over Rewards, Fees, Asset price effect, Rebalance / IL effect, Realized PnL, Unrealized PnL, and an explicit Unattributed bar with reason-code tooltips; the bar set MUST tie to a Cab Gold `Total return` reconciliation row within `1e-9` and MUST NOT include `Capital entered` / `Capital withdrawn` inside the reconciling sum. Render component USD values in a monospaced numeric column with `formatPercent` share of |Total return|; render an adjacent `Est. annualized return` readout (`formatPercent` signed); surface per-event IL contributions in the Rebalance / IL bar tooltip (FR-011a).
- [X] T060a [P] [US2] Create [apps/web/src/features/deposits/components/DepositValueChart.tsx](apps/web/src/features/deposits/components/DepositValueChart.tsx) composing `CabChartPanel` + `CabAreaChart` to plot the event-anchored series (`openedValue`, `additionalCapital`, `rewards`, `currentValue`, `withdrawal`, `closedValue`) returned by `DepositDetailResponse.valueChart` per FR-009; do NOT interpolate across `gaps[]` and render a `CabPartialCoverageNotice` annotation for each gap.
- [X] T060b [P] [US2] Create [apps/web/src/features/deposits/components/DepositEventMovementsTable.tsx](apps/web/src/features/deposits/components/DepositEventMovementsTable.tsx) composing `DataTable` over `lifecycle[].signedTokenDeltas` (FR-010) with columns Event, Token, Direction (in/out), Amount (`CabTokenAmount` signed), USD value at event (`CabUsdValue`), Price source (`CabBadge`); mount one instance per event inside the `View all events` `CabAccordion`.
- [X] T060c [P] [US2] Create [apps/web/src/features/deposits/components/DepositCoveredRangeNote.tsx](apps/web/src/features/deposits/components/DepositCoveredRangeNote.tsx) rendering the actual covered start/end via `formatDayRange` and surfacing `t("deposits:detail.coveredRange.shorterThanWindow")` when the covered range is shorter than the requested window (FR-015).
- [X] T061 [US2] Create [apps/web/src/features/deposits/DepositDetail.component.tsx](apps/web/src/features/deposits/DepositDetail.component.tsx) composing, in FR-L05 order (a)–(j): `DepositDetailHeader`, identity row, two `CabImpactMetricCard` KPI tiles, secondary stats (Est. APR, Total rewards, Realized PnL, Unrealized PnL, Coverage, Confidence), `DepositCoveredRangeNote`, `DepositRangeIndicator` (CL only), `DepositValueChart`, `DepositLifecycleTimeline` with the `View all events` `CabAccordion` mounting one `DepositEventMovementsTable` per event, `DepositPerformanceDecomposition` (Capital flow strip + Return attribution stack with full bars + Unattributed + Est. annualized return), `DepositStrategiesCrossLink`, and the bottom CTA row (Cab Gold primary + secondary) per FR-L05.
- [X] T062 [US2] Create [apps/web/src/features/deposits/DepositDetail.container.tsx](apps/web/src/features/deposits/DepositDetail.container.tsx) running `useDepositDetailQuery`, handling loading / error / not-found branches, and forwarding mapped view models.
- [X] T063 [US2] Wire desktop in-page detail pane: in [apps/web/src/features/deposits/Deposits.component.tsx](apps/web/src/features/deposits/Deposits.component.tsx), open `DepositDetail.container` in the right column when `selectedDepositId` is set (FR-L05), with Esc + close affordance returning focus to the originating row.
- [X] T064 [US2] Create [apps/web/src/app/deposits/[depositId]/page.tsx](apps/web/src/app/deposits/[depositId]/page.tsx) mounting `DepositDetail.container` full-width for mobile and direct deep-links (FR-L06).
- [X] T065 [US2] Extend [apps/web/src/features/deposits/deposits.mappers.ts](apps/web/src/features/deposits/deposits.mappers.ts) with detail-view mappers (range, lifecycle events, decomposition components, secondary stats) and add cases to [apps/web/src/features/deposits/deposits.mappers.test.ts](apps/web/src/features/deposits/deposits.mappers.test.ts).
- [X] T066 [US2] Extend [apps/web/src/i18n/locales/en/deposits.json](apps/web/src/i18n/locales/en/deposits.json) and [apps/web/src/i18n/locales/es/deposits.json](apps/web/src/i18n/locales/es/deposits.json) with `detail.*`, `events.*`, `transferIn.*`, `unattributed.*` keys; maintain en/es parity.

**Checkpoint**: Detail surface is fully functional and reconciles exactly. US1 + US2 deliverable as a unit.

---

## Phase 5: User Story 3 — Keep Manual And Automated Exposure Cleanly Separated (P1)

**Goal**: Deposits surfaces only manual Aerodrome positions; Mellow exposure is excluded from list + lifecycle; the detail surface renders a labeled cross-link (placeholder → live when Strategies ships).

**Independent Test**: For a wallet with both a manual Aerodrome NFT position and Mellow exposure in the same pool, the list shows only the manual position; the detail lifecycle contains zero `mellow_*` events; the Strategies cross-link is visible, labeled, and reachable in one interaction (disabled placeholder today, live link when the route exists).

- [X] T067 [US3] In [apps/web/src/server/analysis/deposit-read-models.ts](apps/web/src/server/analysis/deposit-read-models.ts), restrict lifecycle ingestion to the FR-013 event set and assert (via test fixture) that no `mellow_*` event ever lands in `deposit_lifecycle_events`.
- [X] T068 [US3] Populate `mellow_strategy_cross_link_id` per materialization rule §6 (match by `(chainId, walletAddress, pool_id)` against `strategy_exposures.strategy_id.primary_pool_id`); leave null when no exposure.
- [X] T069 [US3] Extend [apps/web/src/server/analysis/deposit-read-models.test.ts](apps/web/src/server/analysis/deposit-read-models.test.ts) with a fixture where the same pool has manual + Mellow exposure; assert manual position is materialized, no `mellow_*` events appear, and `mellow_strategy_cross_link_id` is set.
- [X] T070 [US3] Create [apps/web/src/features/deposits/components/DepositStrategiesCrossLink.tsx](apps/web/src/features/deposits/components/DepositStrategiesCrossLink.tsx) rendering a disabled `CabButton` with tooltip when Strategies is not yet routed and a live link when it is (FR-012a); detect availability via a simple feature-flag/config lookup, not a runtime probe.
- [X] T071 [US3] Mount `DepositStrategiesCrossLink` inside [apps/web/src/features/deposits/DepositDetail.component.tsx](apps/web/src/features/deposits/DepositDetail.component.tsx) above the bottom CTA row, conditional on `mellowStrategyCrossLinkId` being non-null.
- [X] T072 [US3] Update [apps/web/src/features/deposits/components/DepositsEmptyState.tsx](apps/web/src/features/deposits/components/DepositsEmptyState.tsx) to point users to Strategies when the wallet has Mellow exposure but no manual deposits (FR-006).
- [X] T073 [US3] Add `strategiesCrossLink.*` keys to [apps/web/src/i18n/locales/en/deposits.json](apps/web/src/i18n/locales/en/deposits.json) and [apps/web/src/i18n/locales/es/deposits.json](apps/web/src/i18n/locales/es/deposits.json) (label, placeholder, available).

**Checkpoint**: Manual vs Mellow separation is enforced end-to-end with a usable cross-link path.

---

## Phase 6: User Story 4 — Trust Partial Or Inferred Position Analytics (P2)

**Goal**: Deposits remains honest when reconstruction is partial — missing prices, ambiguous classifications, and uncovered ranges are visible with reason codes and degraded confidence, never silently absorbed.

**Independent Test**: For a position with at least one missing price event, one ambiguous classification, and one event whose USD value cannot be resolved, the list and detail show explicit coverage + confidence indicators, the lifecycle row carries `price_source = unavailable` or equivalent, the decomposition surfaces `unattributed_usd > 0` with reason codes, and no metric is fabricated.

- [X] T074 [US4] In [apps/web/src/server/analysis/deposit-read-models.ts](apps/web/src/server/analysis/deposit-read-models.ts), aggregate `coverage_reason_codes` from per-event signals onto the summary row and propagate `unattributed_reason_codes` onto the decomposition row.
- [X] T075 [US4] Implement the FR-025 reward USD backfill path in the materializer: when `reward_events.amount_usd IS NULL`, recompute from `amount_raw + token_address + price_points` for the claim day; mark `price_source = unavailable` and add `priceUnavailable` reason code when no historical price exists.
- [X] T076 [US4] Extend [apps/web/src/server/analysis/deposit-read-models.test.ts](apps/web/src/server/analysis/deposit-read-models.test.ts) with a fixture covering: missing historical price, ambiguous classification, unresolved attribution, and asserts the row remains present with degraded confidence and reason codes.
- [X] T077 [US4] In [apps/web/src/features/deposits/deposits.mappers.ts](apps/web/src/features/deposits/deposits.mappers.ts), surface coverage + confidence labels through `CabCoverageBadge` and pipe `unattributed_reason_codes` into the decomposition tooltip; cover the cases in [apps/web/src/features/deposits/deposits.mappers.test.ts](apps/web/src/features/deposits/deposits.mappers.test.ts).
- [X] T078 [US4] Update [apps/web/src/features/deposits/components/DepositPerformanceDecomposition.tsx](apps/web/src/features/deposits/components/DepositPerformanceDecomposition.tsx) so the Unattributed bar renders even when 0 to keep the reconciliation row visible, and its tooltip lists localized reason-code strings.
- [X] T079 [US4] Update [apps/web/src/features/deposits/components/DepositLifecycleTimeline.tsx](apps/web/src/features/deposits/components/DepositLifecycleTimeline.tsx) to render `price unavailable` and confidence states inline per event (FR-014).
- [X] T080 [US4] Confirm Deposits does NOT mount any top-of-page coverage banner (FR-023) — global surface remains; add a check in [apps/web/src/features/deposits/Deposits.component.tsx](apps/web/src/features/deposits/Deposits.component.tsx) review comment and a snapshot in the list component test if available.

**Checkpoint**: Partial / degraded states are visible and explainable across list and detail.

---

## Phase 7: User Story 5 — Filter, Sort, And Reach Detail Efficiently (P3)

**Goal**: Filters compose, named sorts work, session state is preserved across navigation, and Pools→Deposits cross-link arrives pre-filtered by pool.

**Independent Test**: With a wallet holding ≥ 10 positions across multiple pools and statuses: combining status + pool + returnSign + date range filters yields a correct result set with all active filters visibly chipped and individually clearable; switching sort orders is stable; arriving from a Pool detail "see deposits in this pool" affordance pre-applies the pool filter; navigating to a detail and back preserves filters + sort.

- [X] T081 [US5] Verify and harden [apps/web/src/features/deposits/components/DepositsFiltersBar.tsx](apps/web/src/features/deposits/components/DepositsFiltersBar.tsx) so all filters compose, each active filter is individually clearable, and "More filters" hosts `returnSign` plus future extensions via `CabAccordion`.
- [X] T082 [US5] Verify named sort handling in [apps/web/src/server/deposits/deposits.repository.ts](apps/web/src/server/deposits/deposits.repository.ts) and the URL contract — `opened_desc`, `opened_asc`, `return_desc`, `return_asc`, `apr_desc`, `apr_asc` — with tie-breaker on `deposit_id` for stability.
- [X] T083 [US5] Add a "See deposits in this pool" affordance to the existing Pools detail surface ([apps/web/src/features/pools/PoolDetail.component.tsx](apps/web/src/features/pools/PoolDetail.component.tsx) or equivalent) linking to `/deposits?chainId={chainId}&pool={poolId}`; render the affordance only when the wallet has manual deposits in that pool.
- [X] T084 [US5] Ensure [apps/web/src/features/deposits/Deposits.container.tsx](apps/web/src/features/deposits/Deposits.container.tsx) reads the incoming pool filter from the URL on arrival and renders an active, clearable pool chip.
- [X] T085 [US5] Extend [apps/web/src/features/deposits/deposits.urlState.test.ts](apps/web/src/features/deposits/deposits.urlState.test.ts) with cases for composed filters, named sort round-trip, and back/forward navigation parity.

**Checkpoint**: Discovery at portfolio scale works; cross-surface entry from Pools is wired.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T086 [P] Create [apps/web/e2e/deposits-gated-and-lifecycle.spec.ts](apps/web/e2e/deposits-gated-and-lifecycle.spec.ts) covering: pre-analysis lock, list default state, filter compose, list→detail in-page pane on desktop, mobile full-screen detail, **Performance panel split rendering** (contextual Capital flow strip + reconciling Return attribution stack with bars summing exactly to Total return), per-event IL contribution surfaced in the Rebalance / IL tooltip for a CL-out-of-range withdrawal fixture (FR-011b), value-chart event markers without interpolation across covered-range gaps (FR-009), per-event movement table inside `View all events` (FR-010), Pools→Deposits pre-filter arrival, live refresh after a successful re-analysis preserving filters + `selectedDepositId` (FR-L08, SC-005), graceful `deposit_not_found` when the selected deposit disappears after re-analysis, and locale switch.
- [ ] T087 Run [specs/010-deposits-lifecycle/quickstart.md](specs/010-deposits-lifecycle/quickstart.md) end-to-end against a local Postgres + a wallet with decoded manual positions; record any deltas and fix.
- [ ] T088 Confirm performance contracts in [contracts/deposits-api.md](contracts/deposits-api.md): list p95 ≤ 200ms, detail p95 ≤ 300ms with warm DB; capture timings in the PR description.
- [X] T089 [P] Run i18n parity + hardcoded-copy lint (`pnpm --filter web lint:i18n` or established equivalent) and fix any drift in `deposits`, `coverage`, `charts`, `common`, `navigation`, `errors`.
- [X] T090 [P] Run `pnpm --filter web lint` and `pnpm --filter web typecheck`; ensure no rule suppressions are added.
- [X] T091 [P] Verify brand-token usage in DS audit: no raw hex, Cab Gold reserved for primary CTA and the Performance Total-return reconciliation row, Signal Teal for positive/in-range/OPEN ACTIVE, neutral/danger tokens for negative/closed/unattributed.
- [X] T095a Produce a one-page audit-hygiene note attached to the PR description that explicitly checks off the constitution Implementation Gate + Review Gate items for this feature (CA-001 brand, CA-002 i18n parity, CA-003 formatters, CA-004 chain-aware, CA-005 provider boundary, CA-006 explainability) with links to the corresponding completed tasks (T091, T089/T047, T025/T036, T092, T093, T060/T078) and a confirmation that FR-024 (URL state) and FR-024a (localStorage view prefs) are honored by T016/T016a/T017/T041.
- [X] T092 Confirm chain-aware compliance: every API call carries `chainId`, every query key includes `chainId`, no Base-only assumptions outside the chain config layer.
- [X] T093 Confirm provider-boundary compliance: zero direct Moralis / Alchemy / RPC calls in `apps/web/src/app/api/deposits/**`, `apps/web/src/server/deposits/**`, `apps/web/src/features/deposits/**` (grep gate).
- [X] T094 Wire FR-L08 live refresh: in [apps/web/src/queries/hooks.ts](apps/web/src/queries/hooks.ts), subscribe to the existing analysis-control `ready` transition for the active `(chainId, walletAddress)` and invalidate both `deposits.list(...)` and `deposits.detail(...)` query keys; in [apps/web/src/features/deposits/Deposits.container.tsx](apps/web/src/features/deposits/Deposits.container.tsx) and [apps/web/src/features/deposits/DepositDetail.container.tsx](apps/web/src/features/deposits/DepositDetail.container.tsx) preserve URL-derived filters / sort / pagination / `selectedDepositId` across the refetch and surface `deposit_not_found` gracefully when the previously selected deposit is no longer in the new analyzed set (FR-020, FR-024, SC-005).
- [X] T095 Final repo-memory check: re-read [memories/repo/analysis-engine-history-notes.md](/memories/repo/analysis-engine-history-notes.md) and confirm the chunked-insert and FK-safe purge guidance is honored by the new materializer + purge updates.

---

## Dependencies & Execution Order

### Phase dependencies

- Phase 1 (Setup) → Phase 2 (Foundational) → Phases 3–7 (User Stories) → Phase 8 (Polish).
- Phases 3–7 can be parallelized across contributors once Phase 2 is done.

### Within Phase 2

- T004 → T005 (schema before migration generation).
- T005 → T006 (migration before purge update that references the new tables).
- T007 + T009 → T008 (materializer + helpers before wiring into finalize).
- T010 can be authored as a failing test before T028/T048/T067 land.
- T011 → T012 → T013 → T014 (types → repo → service → route).
- T015 → T016 → T017 (types → URL state → its test).
- T018 → T019 (keys before hooks).
- T020–T024 are independent (different files).

### Within each user story

- Materializer changes precede API changes precede UI composition.
- Mappers + DS-composing leaf components can be authored in parallel (different files).
- Containers + pages depend on hooks (Phase 2) and leaf components within the story.
- Story-level tests follow the unit-under-test and MUST pass before checkpoint.

### Story dependencies

- US1, US2, US3, US4, US5 share Phase 2 as the only blocker.
- US2 detail pane mounts inside US1's list component (T063 depends on T043).
- US3 cross-link mounts inside US2's detail component (T071 depends on T061).
- US5's Pools→Deposits link (T083) depends on US1 routes being live (T045).

### Parallel opportunities

- All [P]-marked tasks within a phase can run concurrently.
- Phase 2 i18n extensions (T020–T024) run fully in parallel.
- Phase 3 leaf components (T036–T042) run in parallel; container/page assemble them.
- Phase 4 leaf components (T057–T060, T060a, T060b, T060c) run in parallel.

---

## Parallel Example: Phase 3 leaf composition

```bash
# After Phase 2 + T030–T032 are in, launch the leaf components together:
Task: "Create PositionLabelCell in apps/web/src/features/deposits/components/PositionLabelCell.tsx"
Task: "Create DepositsFiltersBar in apps/web/src/features/deposits/components/DepositsFiltersBar.tsx"
Task: "Create DepositsKpiStrip in apps/web/src/features/deposits/components/DepositsKpiStrip.tsx"
Task: "Create DepositsTable in apps/web/src/features/deposits/components/DepositsTable.tsx"
Task: "Create DepositsEmptyState in apps/web/src/features/deposits/components/DepositsEmptyState.tsx"
Task: "Create deposits.mappers + tests in apps/web/src/features/deposits/deposits.mappers.ts"
```

---

## Implementation Strategy

### MVP first (US1 only)

1. Phase 1 → Phase 2 complete.
2. Phase 3 (US1) — list visible, gated, URL-driven, localized.
3. STOP and VALIDATE against [quickstart.md](quickstart.md) steps 1–4 (list checkpoints).
4. Ship MVP.

### Incremental delivery

1. MVP → Add US2 → reconcile decomposition + detail flow end-to-end → ship.
2. Add US3 → enforce manual/Mellow separation + cross-link placeholder → ship.
3. Add US4 → harden partial-coverage explainability → ship.
4. Add US5 → portfolio-scale filters + Pools cross-link → ship.
5. Polish (Phase 8) closes out perf, lint, parity, and e2e.

### Parallel team strategy

- After Phase 2: assign US1 (list) + US2 (detail) to two contributors; US3 to a third in parallel since it touches the same materializer file via additive logic; US4 and US5 follow once US1+US2 land.

---

## Summary

- **Total tasks**: 100
- **Setup (Phase 1)**: 3
- **Foundational (Phase 2)**: 25 (T004–T027 + T016a)
- **US1 (Phase 3)**: 20 (T028–T047)
- **US2 (Phase 4)**: 22 (T048–T066 + T060a, T060b, T060c)
- **US3 (Phase 5)**: 7 (T067–T073)
- **US4 (Phase 6)**: 7 (T074–T080)
- **US5 (Phase 7)**: 5 (T081–T085)
- **Polish (Phase 8)**: 11 (T086–T095 + T095a; T094 covers FR-L08 live refresh; nav unlock is owned by T026/T027)
- **Parallel opportunities**: 43 tasks marked [P] across phases.
- **MVP scope**: User Story 1 (Phase 3) — list visible, gated, URL-driven, localized.
- **Independent test criteria**: documented per user story above and validated by [quickstart.md](quickstart.md).
- **Format validation**: every task uses `- [ ] T### [P?] [US?] description with file path`.
