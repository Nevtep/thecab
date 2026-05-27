# Tasks: Analyzed Pools History

**Input**: Design documents from `/specs/009-pools-history/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Targeted Vitest and Playwright coverage are required because the plan and product requirements call for repository, route, formatting, gating, and history-flow validation.

**Organization**: Tasks are grouped by user story so each Pools outcome can be implemented and validated independently after the foundational layer is complete.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Reserve the app, feature, server, analysis, and test surfaces needed for the routed Pools feature.

- [X] T001 Create the Pools route entry surfaces in apps/web/src/app/pools/page.tsx and apps/web/src/app/pools/[poolId]/page.tsx
- [X] T002 [P] Create the Pools feature module surfaces in apps/web/src/features/pools/Pools.container.tsx, apps/web/src/features/pools/Pools.component.tsx, apps/web/src/features/pools/PoolDetail.container.tsx, apps/web/src/features/pools/PoolDetail.component.tsx, apps/web/src/features/pools/pools.mappers.ts, apps/web/src/features/pools/pools.queries.ts, and apps/web/src/features/pools/pools.types.ts
- [X] T003 [P] Create the server Pools and analysis materialization surfaces in apps/web/src/server/pools/pools.repository.ts, apps/web/src/server/pools/pools.service.ts, apps/web/src/server/pools/pools.route.ts, apps/web/src/server/pools/pools.types.ts, apps/web/src/server/analysis/pool-read-models.ts, and apps/web/src/server/scripts/rebuild-pool-read-models.ts
- [X] T004 [P] Reserve Pools validation surfaces in apps/web/src/server/pools/pools.repository.test.ts, apps/web/src/server/pools/pools.route.test.ts, apps/web/src/server/pools/pools.service.test.ts, apps/web/src/features/pools/pools.mappers.test.ts, apps/web/src/features/pools/pools.validation.test.ts, and apps/web/e2e/pools-gated-and-history.spec.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the shared persistence, route parsing, live query plumbing, localization scaffolding, and formatting rules that every Pools story depends on.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [X] T005 Extend the Drizzle schema for `pool_wallet_summaries`, `pool_history_snapshots`, and `pool_timeline_events` in apps/web/src/server/db/schema.ts
- [X] T006 Generate the corresponding Drizzle migration files in apps/web/src/server/db/migrations/
- [X] T007 [P] Implement wallet-scoped pool read-model repository primitives in apps/web/src/server/pools/pools.repository.ts and apps/web/src/server/pools/pools.types.ts
- [X] T008 [P] Implement shared Pools request parsing, authenticated-wallet enforcement, supported-chain checks, `ready` gating with post-unlock stale retention, and machine-code errors in apps/web/src/server/pools/pools.route.ts, apps/web/src/app/api/pools/route.ts, and apps/web/src/app/api/pools/[poolId]/route.ts
- [X] T009 [P] Implement live Pools query keys and enabled TanStack Query hooks for list/detail routes in apps/web/src/queries/keys.ts, apps/web/src/queries/hooks.ts, and apps/web/src/features/pools/pools.queries.ts
- [X] T010 [P] Add Pools i18n namespace skeletons and shared copy placeholders in apps/web/src/i18n/locales/en/pools.json, apps/web/src/i18n/locales/en/charts.json, apps/web/src/i18n/locales/en/navigation.json, apps/web/src/i18n/locales/en/coverage.json, apps/web/src/i18n/locales/en/common.json, apps/web/src/i18n/locales/es/pools.json, apps/web/src/i18n/locales/es/charts.json, apps/web/src/i18n/locales/es/navigation.json, apps/web/src/i18n/locales/es/coverage.json, and apps/web/src/i18n/locales/es/common.json
- [X] T011 [P] Wire centralized locale-aware Pools formatting for currency, percentages, token amounts, dates, relative times, and covered-range labels in apps/web/src/i18n/formatters.ts and apps/web/src/features/pools/pools.mappers.ts
- [X] T012 Implement the pool read-model rebuild entrypoint in apps/web/src/server/scripts/rebuild-pool-read-models.ts and apps/web/package.json
- [X] T013 Implement shared Pools view-model and API response types in apps/web/src/features/pools/pools.types.ts, apps/web/src/features/pools/pools.mappers.ts, and apps/web/src/server/pools/pools.types.ts
- [X] T014 Update generic pool snapshot handling so `latestPoolTotals` is not treated as truthful Pools history in apps/web/src/server/analysis/computeSnapshots.ts and apps/web/src/server/analysis/computeSnapshots.test.ts

**Checkpoint**: Schema, route guards, live query hooks, rebuild entrypoint, localization scaffolding, and formatter rules are ready for story work.

---

## Phase 3: User Story 1 - Review All Participated Pools At A Glance (Priority: P1) 🎯 MVP

**Goal**: Ship the analysis-ready-gated `/pools` route with a DB-backed list, KPI rail, search/filter controls, and real sidebar unlock behavior, while preserving last-success data during stale refreshes after unlock.

**Independent Test**: Complete analysis for a wallet, wait for status `ready`, open `/pools`, and verify that the list shows every reconstructed pool in the covered window with current attributed value, capital entered, capital withdrawn, rewards, return, active status, and visible coverage; then mark the wallet stale and verify the route still serves the last successful data.

- [X] T015 [P] [US1] Add Vitest coverage for Pools list repository and route contracts in apps/web/src/server/pools/pools.repository.test.ts and apps/web/src/server/pools/pools.route.test.ts
- [X] T016 [US1] Materialize `pool_wallet_summaries` from normalized analysis tables in apps/web/src/server/analysis/pool-read-models.ts and apps/web/src/server/analysis/enginePersistence.ts
- [X] T017 [US1] Hook pool summary materialization into analysis finalization and rebuild flow in apps/web/src/server/trigger/tasks/phase-finalize.task.ts, apps/web/src/server/scripts/rebuild-pool-read-models.ts, and apps/web/src/server/analysis/enginePersistence.test.ts
- [X] T018 [P] [US1] Implement Pools list filtering, sorting, pagination, and covered-range aggregation in apps/web/src/server/pools/pools.repository.ts and apps/web/src/server/pools/pools.service.ts
- [X] T019 [US1] Implement the DB-backed Pools list API contract in apps/web/src/app/api/pools/route.ts and apps/web/src/server/pools/pools.route.ts
- [X] T020 [P] [US1] Implement the `/pools` route and container orchestration with enabled query hooks in apps/web/src/app/pools/page.tsx, apps/web/src/features/pools/Pools.container.tsx, and apps/web/src/features/pools/pools.queries.ts
- [X] T021 [US1] Implement the visually rich Pools list UI with KPI rail and filter/search controls in apps/web/src/features/pools/Pools.component.tsx, apps/web/src/features/pools/components/PoolsMetricRail.tsx, apps/web/src/features/pools/components/PoolsFiltersBar.tsx, and apps/web/src/features/pools/components/PoolsTable.tsx
- [X] T022 [US1] Unlock the Pools sidebar destination across connected navigation surfaces in apps/web/src/features/overview/overview.mappers.ts and apps/web/src/features/settings/Settings.component.tsx
- [X] T023 [US1] Implement gated, post-ready stale-retention, empty, loading, and list-error states for `/pools` in apps/web/src/app/pools/page.tsx and apps/web/src/features/pools/Pools.component.tsx

**Checkpoint**: The connected app exposes a real, analysis-gated Pools list route that reads only from the database and is valuable on its own.

---

## Phase 4: User Story 2 - Inspect One Pool Across Up To One Year Of History (Priority: P1)

**Goal**: Ship a direct `/pools/[poolId]` route with truthful historical charts, segment breakdowns, composition, rewards, and lifecycle/rebalance timelines sourced from wallet-scoped read models.

**Independent Test**: Open `/pools/[poolId]` for a reconstructed pool and verify that the detail route supports the covered window up to one year, preserves rebalance/redeploy continuity, and renders chart, composition, rewards, and timeline sections from DB-backed data.

- [X] T024 [P] [US2] Add Vitest coverage for pool detail repository, service, and mapper contracts in apps/web/src/server/pools/pools.repository.test.ts, apps/web/src/server/pools/pools.service.test.ts, and apps/web/src/features/pools/pools.mappers.test.ts
- [X] T025 [US2] Materialize `pool_history_snapshots` with daily segment values, capital flows, and rewards from normalized analysis data in apps/web/src/server/analysis/pool-read-models.ts and apps/web/src/server/trigger/tasks/phase-finalize.task.ts
- [X] T026 [US2] Materialize grouped `pool_timeline_events` for lifecycle, rebalance, redeploy, and partial-attribution display in apps/web/src/server/analysis/pool-read-models.ts and apps/web/src/server/analysis/enginePersistence.ts
- [X] T027 [P] [US2] Implement pool detail range selection, history queries, related-entity lookups, and timeline pagination in apps/web/src/server/pools/pools.repository.ts and apps/web/src/server/pools/pools.service.ts
- [X] T028 [US2] Implement the DB-backed pool detail API contract in apps/web/src/app/api/pools/[poolId]/route.ts and apps/web/src/server/pools/pools.route.ts
- [X] T029 [P] [US2] Implement the `/pools/[poolId]` route and detail container orchestration with enabled query hooks in apps/web/src/app/pools/[poolId]/page.tsx, apps/web/src/features/pools/PoolDetail.container.tsx, and apps/web/src/features/pools/pools.queries.ts
- [X] T030 [US2] Implement the visually rich pool detail UI with KPI rail, chart panels, segment breakdowns, current composition, and related links in apps/web/src/features/pools/PoolDetail.component.tsx, apps/web/src/features/pools/components/PoolHistoryChart.tsx, apps/web/src/features/pools/components/PoolExposureBreakdown.tsx, apps/web/src/features/pools/components/PoolCompositionPanel.tsx, and apps/web/src/features/pools/components/PoolRelatedLinks.tsx
- [X] T031 [US2] Implement pool lifecycle, rebalance, redeploy, and partial-swap-attribution timeline presentation in apps/web/src/features/pools/PoolDetail.component.tsx and apps/web/src/features/pools/components/PoolTimeline.tsx
- [X] T032 [US2] Add Playwright coverage for ready gating, navigation unlock, stale retention after unlock, and list-to-detail history flows in apps/web/e2e/pools-gated-and-history.spec.ts

**Checkpoint**: A user can inspect a single pool directly by URL and review up to one year of truthful, coverage-aware pool history.

---

## Phase 5: User Story 3 - Trust Partial And Inferred Pool Analytics (Priority: P2)

**Goal**: Make coverage, covered range, partial attribution, and share-level strategy accounting explicit across list and detail so Pools stays honest when reconstruction is incomplete.

**Independent Test**: Use a wallet with missing prices, unresolved attribution, or share-level strategy coverage and verify that `/pools` and `/pools/[poolId]` keep the pool visible while clearly labeling coverage state, covered range, partial attribution, and estimated metrics.

- [X] T033 [US3] Propagate coverage status, covered range, and partial-attribution metadata into pool read models and repository projections in apps/web/src/server/analysis/pool-read-models.ts and apps/web/src/server/pools/pools.repository.ts
- [X] T034 [US3] Implement coverage-aware API payload shaping and `analysis_required` / `pool_not_found` route behavior in apps/web/src/app/api/pools/route.ts, apps/web/src/app/api/pools/[poolId]/route.ts, and apps/web/src/server/pools/pools.route.ts
- [X] T035 [US3] Implement coverage badges, share-level strategy labels, partial notices, estimated-value markers, and covered-range messaging in apps/web/src/features/pools/Pools.component.tsx, apps/web/src/features/pools/PoolDetail.component.tsx, and apps/web/src/features/pools/pools.mappers.ts
- [X] T036 [US3] Add localized Pools, chart, coverage, common, and navigation copy for legends, gated states, partial attribution, and stale-retention messaging after unlock in apps/web/src/i18n/locales/en/pools.json, apps/web/src/i18n/locales/en/charts.json, apps/web/src/i18n/locales/en/coverage.json, apps/web/src/i18n/locales/en/common.json, apps/web/src/i18n/locales/en/navigation.json, apps/web/src/i18n/locales/es/pools.json, apps/web/src/i18n/locales/es/charts.json, apps/web/src/i18n/locales/es/coverage.json, apps/web/src/i18n/locales/es/common.json, and apps/web/src/i18n/locales/es/navigation.json
- [X] T037 [US3] Add locale and formatting regression coverage for Pools labels, covered-range messaging, and approximation markers in apps/web/src/i18n/locale.test.ts, apps/web/src/features/pools/pools.mappers.test.ts, and apps/web/src/features/pools/pools.validation.test.ts

**Checkpoint**: Pools remains usable and truthful under partial, inferred, and share-level accounting scenarios.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Align query consumption, run the documented validation gates, and confirm DB-only request flow, gating, and continuity behavior.

- [X] T038 Run quickstart validation against specs/009-pools-history/quickstart.md, apps/web/src/server/scripts/rebuild-pool-read-models.ts, apps/web/src/app/pools/page.tsx, apps/web/src/app/pools/[poolId]/page.tsx, and apps/web/src/app/api/pools/
- [X] T039 Run static validation for the feature and analysis extensions with `cd apps/web && pnpm lint src && pnpm typecheck && pnpm build`
- [X] T040 Run localization parity validation for apps/web/src/i18n/locales/en/pools.json, apps/web/src/i18n/locales/en/charts.json, apps/web/src/i18n/locales/en/coverage.json, apps/web/src/i18n/locales/en/common.json, apps/web/src/i18n/locales/en/navigation.json, apps/web/src/i18n/locales/es/pools.json, apps/web/src/i18n/locales/es/charts.json, apps/web/src/i18n/locales/es/coverage.json, apps/web/src/i18n/locales/es/common.json, and apps/web/src/i18n/locales/es/navigation.json with `cd apps/web && pnpm i18n:check`
- [X] T041 Validate DB-only request flow and anti-abuse bounds against specs/009-pools-history/contracts/pools-api.md and apps/web/src/app/api/pools/route.ts, apps/web/src/app/api/pools/[poolId]/route.ts, and apps/web/src/server/pools/pools.route.ts
- [X] T042 Validate navigation unlock across Overview and Settings, gated direct routes before `ready`, stale retention after unlock, continuity, and coverage behavior against specs/009-pools-history/contracts/pools-ui.md, specs/009-pools-history/data-model.md, apps/web/src/features/overview/overview.mappers.ts, apps/web/src/features/settings/Settings.component.tsx, apps/web/src/features/pools/Pools.component.tsx, and apps/web/src/features/pools/PoolDetail.component.tsx

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Starts immediately and reserves the implementation and validation surfaces.
- **Foundational (Phase 2)**: Depends on Setup and blocks all user story work.
- **User Story phases (Phase 3 onward)**: Depend on Foundational completion.
- **Polish (Phase 6)**: Depends on the desired user story phases being complete.

### User Story Dependencies

- **US1**: Starts first after Foundational and establishes the unlocked `/pools` route plus summary read-model materialization.
- **US2**: Can start after Foundational and remains independently testable by direct detail URL because query enablement is already in Foundational, though it still benefits from the shared summary contracts completed for US1.
- **US3**: Depends on US1 and US2 surfaces because coverage and partial-attribution behavior must be reflected consistently across both list and detail responses.

### Within Each User Story

- Materialize or extend the required read model before exposing the matching API route.
- Enable the matching query hook before calling the story independently complete.
- Implement repository/service queries before container wiring.
- Implement route/container plumbing before the final presentational screen state work.
- Finish localized copy, formatter adoption, and coverage labeling before final validation.

### Parallel Opportunities

- Setup tasks `T002`, `T003`, and `T004` can run in parallel.
- Foundational tasks `T007` through `T011` can run in parallel after `T005` and `T006` establish the schema baseline.
- In US1, `T018` and `T020` can run in parallel once `T016` and `T017` define the summary read model.
- In US2, `T027` and `T029` can run in parallel once `T025` and `T026` define the history and timeline read models.

---

## Parallel Example: User Story 1

```bash
Task: "Implement Pools list filtering, sorting, pagination, and covered-range aggregation in apps/web/src/server/pools/pools.repository.ts and apps/web/src/server/pools/pools.service.ts"
Task: "Implement the `/pools` route and container orchestration with enabled query hooks in apps/web/src/app/pools/page.tsx and apps/web/src/features/pools/Pools.container.tsx"
```

## Parallel Example: User Story 2

```bash
Task: "Implement pool detail range selection, history queries, related-entity lookups, and timeline pagination in apps/web/src/server/pools/pools.repository.ts and apps/web/src/server/pools/pools.service.ts"
Task: "Implement the `/pools/[poolId]` route and detail container orchestration with enabled query hooks in apps/web/src/app/pools/[poolId]/page.tsx and apps/web/src/features/pools/PoolDetail.container.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Validate `/pools` as a real, unlocked, DB-backed route before expanding to detail history.

### Incremental Delivery

1. Land the DB-backed summary read model and `/pools` route with US1.
2. Add `/pools/[poolId]` history, charts, and timelines with US2.
3. Finish coverage, partial-attribution, and share-level honesty with US3.
4. Run the polish validation gates and quickstart checks.

### Suggested MVP Scope

1. Setup + Foundational.
2. US1 summary materialization and routed Pools list.
3. DB-only request flow, ready gating, post-unlock stale retention, and nav unlock behavior.

---

## Notes

- `[P]` tasks are safe to parallelize because they target different files or isolated contracts.
- Each user story maps directly to the user stories in specs/009-pools-history/spec.md.
- Every task includes an implementation path under apps/web/ or a feature artifact path under specs/009-pools-history/.
- This task list preserves chain-aware identity, authenticated internal APIs, DB-only Pools request flow, and explicit analysis extension for real pool history.