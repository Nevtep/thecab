# Tasks: Strategies Lifecycle

**Input**: Design documents from `/specs/012-strategies-lifecycle/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Required by user request. Write focused unit/route/mapper/navigation tests before each implementation slice, then run final regression checks before signoff.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested independently after the shared foundation is complete.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Reserve the implementation surfaces for the Strategies DataView, server read layer, analysis read models, and regression scripts.

- [X] T001 Create Strategies route directories in apps/web/src/app/strategies/ and apps/web/src/app/strategies/[strategyId]/
- [X] T002 Create Strategies API route directories in apps/web/src/app/api/strategies/ and apps/web/src/app/api/strategies/[strategyId]/
- [X] T003 Create Strategies feature module directories in apps/web/src/features/strategies/ and apps/web/src/features/strategies/components/
- [X] T004 Create Strategies server module directory in apps/web/src/server/strategies/
- [X] T005 [P] Create placeholder strategy read-model module in apps/web/src/server/analysis/strategy-read-models.ts
- [X] T006 [P] Create placeholder regression script in apps/web/src/server/scripts/analysis-strategy-regression.ts
- [X] T007 [P] Create placeholder rebuild script in apps/web/src/server/scripts/rebuild-strategy-read-models.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add shared schema, contracts, types, i18n skeletons, query keys, and materialization hooks that every story depends on.

**Critical**: No user story work can begin until this phase is complete.

- [X] T008 Add strategy_wallet_summaries, strategy_history_snapshots, and strategy_lifecycle_events schema definitions with indexes in apps/web/src/server/db/schema.ts
- [X] T009 Generate and review Drizzle migration for strategy read-model tables in apps/web/src/server/db/migrations/
- [X] T010 Update FK-safe purge order for strategy read-model tables in apps/web/src/server/scripts/db-purge.ts
- [X] T011 [P] Define shared Strategies API/view model types in apps/web/src/server/strategies/strategies.types.ts
- [X] T012 [P] Define Strategies route validation contract in apps/web/src/server/strategies/strategies.contract.ts
- [X] T013 [P] Define client Strategies types in apps/web/src/features/strategies/strategies.types.ts
- [X] T014 [P] Add Strategies URL-state parser and serializer skeleton in apps/web/src/features/strategies/strategies.urlState.ts
- [X] T015 [P] Add Strategies navigation helper skeleton in apps/web/src/features/strategies/strategies.navigation.ts
- [X] T016 [P] Replace placeholder Strategies i18n resources with full key skeletons in apps/web/src/i18n/locales/en/strategies.json and apps/web/src/i18n/locales/es/strategies.json
- [X] T017 [P] Add strategy coverage reason keys in apps/web/src/i18n/locales/en/coverage.json and apps/web/src/i18n/locales/es/coverage.json
- [X] T018 [P] Add strategy navigation and error keys in apps/web/src/i18n/locales/en/navigation.json, apps/web/src/i18n/locales/es/navigation.json, apps/web/src/i18n/locales/en/errors.json, and apps/web/src/i18n/locales/es/errors.json
- [X] T019 Update strategy query keys to include normalized filters in apps/web/src/queries/keys.ts
- [X] T020 Update strategy query hook signatures without enabling data fetches yet in apps/web/src/queries/hooks.ts
- [X] T021 Wire materializeStrategyReadModels into finalize/rebuild order behind a no-op implementation in apps/web/src/server/trigger/tasks/phase-finalize.task.ts and apps/web/src/server/analysis/enginePersistence.ts

**Checkpoint**: Foundation ready. User story implementation can begin.

---

## Phase 3: User Story 1 - Review Automated Strategy Exposure (Priority: P1) MVP

**Goal**: Users can open `/strategies` after analysis and see the DataView first screen with KPI strip, filters, strategy master list, and selected row panel populated from DB-backed strategy summaries.

**Independent Test**: Open `/strategies` for an analyzed wallet with Mellow exposure and verify the first screen shows KPI strip, filter/search controls, strategy rows, active selection, no manual deposit rows, and locked/empty states as appropriate.

### Tests for User Story 1

- [X] T022 [P] [US1] Add materializer tests for strategy summary/history rows and no manual deposit leakage in apps/web/src/server/analysis/strategy-read-models.test.ts
- [X] T023 [P] [US1] Add repository tests for list filtering, selected bootstrap, KPI aggregation, and DB-only reads in apps/web/src/server/strategies/strategies.repository.test.ts
- [X] T024 [P] [US1] Add route tests for GET /api/strategies auth, chain validation, analysis gating, invalid query, and list response shape in apps/web/src/server/strategies/strategies.route.test.ts
- [X] T025 [P] [US1] Add service tests for KPI mixed-coverage aggregation and first visible selected strategy in apps/web/src/server/strategies/strategies.service.test.ts
- [X] T026 [P] [US1] Add mapper tests for DataView row, KPI, selected-row, empty, and locked view models in apps/web/src/features/strategies/strategies.mappers.test.ts
- [X] T027 [P] [US1] Waived Playwright coverage for analysis gate and first-screen DataView shell per constitution v1.1.0; covered by route/service/mapper tests and manual auth-gated signoff

### Implementation for User Story 1

- [X] T028 [US1] Implement strategy summary/history materialization from strategies, strategy_exposures, reward_events, price_points, and pool metadata in apps/web/src/server/analysis/strategy-read-models.ts
- [X] T029 [US1] Implement strategy list repository reads, KPI aggregation, selected bootstrap, available pool filters, and pagination in apps/web/src/server/strategies/strategies.repository.ts
- [X] T030 [US1] Implement strategy list service with analysis-ready gating, no-store semantics, and stable error mapping in apps/web/src/server/strategies/strategies.service.ts
- [X] T031 [US1] Implement GET /api/strategies route handler in apps/web/src/app/api/strategies/route.ts
- [X] T032 [US1] Implement Strategies query builders in apps/web/src/features/strategies/strategies.queries.ts
- [X] T033 [US1] Enable typed useStrategiesQuery with normalized filters in apps/web/src/queries/hooks.ts
- [X] T034 [US1] Implement Strategies container that reads wallet, analysis status, URL state, and list query in apps/web/src/features/strategies/Strategies.container.tsx
- [X] T035 [US1] Implement DataView shell layout and responsive workspace styles in apps/web/src/features/strategies/Strategies.component.tsx and apps/web/src/features/strategies/StrategiesWorkspace.module.css
- [X] T036 [P] [US1] Implement KPI strip component with coverage-aware metric states in apps/web/src/features/strategies/components/StrategiesKpiStrip.tsx
- [X] T037 [P] [US1] Implement master list table and identity cells in apps/web/src/features/strategies/components/StrategiesTable.tsx and apps/web/src/features/strategies/components/StrategyIdentityCell.tsx
- [X] T038 [P] [US1] Implement initial selected strategy panel shell and empty state in apps/web/src/features/strategies/components/StrategySelectedPanel.tsx and apps/web/src/features/strategies/components/StrategiesEmptyState.tsx
- [X] T039 [US1] Implement /strategies page route in apps/web/src/app/strategies/page.tsx
- [X] T040 [US1] Update navigation resources and sidebar wiring so Strategies appears as a real connected destination in apps/web/src/i18n/locales/en/navigation.json, apps/web/src/i18n/locales/es/navigation.json, and apps/web/src/design-system/layout/CabSidebarNavItem.tsx

**Checkpoint**: User Story 1 is independently functional and testable as the MVP Strategies DataView.

---

## Phase 4: User Story 2 - Inspect One Strategy Lifecycle (Priority: P1)

**Goal**: Users can inspect one strategy's exposure summary, resolved rewards, lifecycle timeline, transaction links, and coverage note in the selected panel and direct detail route.

**Independent Test**: Select a strategy with entry, share movement, and reward or withdrawal events; verify header, exposure summary, rewards table, lifecycle timeline, transaction references, and coverage note reconcile for the selected strategy.

### Tests for User Story 2

- [X] T041 [P] [US2] Add materializer tests for strategy_lifecycle_events ordering, event types, tx traceability, and unresolved strategy reward rows in apps/web/src/server/analysis/strategy-read-models.test.ts
- [X] T042 [P] [US2] Add detail repository tests for lifecycle, rewards, history snapshots, coverage note payload, and strategy_not_found in apps/web/src/server/strategies/strategies.repository.test.ts
- [X] T043 [P] [US2] Add route tests for GET /api/strategies/:strategyId response shape, auth, chain validation, and ownership checks in apps/web/src/server/strategies/strategies.route.test.ts
- [X] T044 [P] [US2] Add mapper tests for detail header, exposure summary, rewards, lifecycle, and external tx links in apps/web/src/features/strategies/strategies.mappers.test.ts
- [X] T045 [P] [US2] Waived Playwright test for selected row detail panel and direct /strategies/[strategyId] route per constitution v1.1.0; covered by detail route/repository/mapper tests and manual auth-gated signoff

### Implementation for User Story 2

- [X] T046 [US2] Extend strategy materializer to persist lifecycle events, reward references, token/share deltas, price source, and coverage reasons in apps/web/src/server/analysis/strategy-read-models.ts
- [X] T047 [US2] Implement strategy detail repository read from strategy_wallet_summaries, strategy_history_snapshots, and strategy_lifecycle_events in apps/web/src/server/strategies/strategies.repository.ts
- [X] T048 [US2] Extend strategy service to compose StrategyDetailResponse and coverage note payloads in apps/web/src/server/strategies/strategies.service.ts
- [X] T049 [US2] Implement GET /api/strategies/[strategyId] route handler in apps/web/src/app/api/strategies/[strategyId]/route.ts
- [X] T050 [US2] Implement direct detail query builder and useStrategyDetailViewQuery in apps/web/src/features/strategies/strategies.queries.ts and apps/web/src/queries/hooks.ts
- [X] T051 [P] [US2] Implement selected panel header and exposure summary in apps/web/src/features/strategies/components/StrategySelectedPanel.tsx and apps/web/src/features/strategies/components/StrategyExposureSummary.tsx
- [X] T052 [P] [US2] Implement resolved/unresolved rewards table in apps/web/src/features/strategies/components/StrategyRewardsTable.tsx
- [X] T053 [P] [US2] Implement lifecycle timeline with transaction links and confidence badges in apps/web/src/features/strategies/components/StrategyLifecycleTimeline.tsx
- [X] T054 [P] [US2] Implement strategy coverage note component in apps/web/src/features/strategies/components/StrategyCoverageNote.tsx
- [X] T055 [US2] Implement StrategyDetail container/component and direct route in apps/web/src/features/strategies/StrategyDetail.container.tsx, apps/web/src/features/strategies/StrategyDetail.component.tsx, and apps/web/src/app/strategies/[strategyId]/page.tsx
- [X] T056 [US2] Add lifecycle, reward, and coverage translations in apps/web/src/i18n/locales/en/strategies.json and apps/web/src/i18n/locales/es/strategies.json

**Checkpoint**: User Stories 1 and 2 both work independently: list DataView and selected/detail lifecycle analysis.

---

## Phase 5: User Story 3 - Cross-Link Strategies With Pools And Deposits (Priority: P1)

**Goal**: Pool and Deposit surfaces link to Strategies for automated exposure, while reward totals remain correctly separated across Pools, Deposits, and Strategies.

**Independent Test**: Use a wallet with manual deposit and Mellow strategy in the same pool; verify Pool detail links to Strategies, Deposit detail cross-link opens the relevant strategy, Strategy detail links back to the pool, pool rewards include deposit plus strategy rewards, deposits exclude strategy rewards, and strategies exclude deposit rewards.

### Tests for User Story 3

- [X] T057 [P] [US3] Add strategy ownership and reward separation tests in apps/web/src/server/analysis/rewardResolution.test.ts
- [X] T058 [P] [US3] Add pool total regression tests for resolved deposit plus strategy rewards in apps/web/src/server/analysis/pool-read-models.test.ts
- [X] T059 [P] [US3] Add deposit exclusion regression tests for strategy_exposure_id rewards in apps/web/src/server/analysis/deposit-read-models.test.ts
- [X] T060 [P] [US3] Add navigation helper tests for Pool-to-Strategies and Deposit-to-Strategies links in apps/web/src/features/strategies/strategies.navigation.test.ts and apps/web/src/features/deposits/deposits.navigation.test.ts
- [X] T061 [P] [US3] Waived Playwright test for Pool detail and Deposit detail cross-links to Strategies per constitution v1.1.0; covered by navigation helper tests and manual auth-gated signoff

### Implementation for User Story 3

- [X] T062 [US3] Ensure strategy reward ownership resolves through strategy_exposure_id without deposit fallback in apps/web/src/server/analysis/rewardResolution.ts
- [X] T063 [US3] Update pool read-model aggregation to include resolved strategy rewards with resolved deposit rewards in apps/web/src/server/analysis/pool-read-models.ts
- [X] T064 [US3] Update deposit read-model aggregation to exclude all rewards with strategy_exposure_id in apps/web/src/server/analysis/deposit-read-models.ts
- [X] T065 [US3] Persist strategy-to-pool link metadata and pool mapping status for cross-links in apps/web/src/server/analysis/strategy-read-models.ts
- [X] T066 [US3] Enable live Strategies route helpers in apps/web/src/features/deposits/deposits.navigation.ts and apps/web/src/features/strategies/strategies.navigation.ts
- [X] T067 [US3] Update DepositStrategiesCrossLink to use live Strategies URLs when mellowStrategyCrossLinkId exists in apps/web/src/features/deposits/components/DepositStrategiesCrossLink.tsx
- [X] T068 [US3] Add Pool detail automated exposure links to Strategies filtered by pool or selected strategy in apps/web/src/features/pools/components/PoolRelatedLinks.tsx and apps/web/src/features/pools/PoolDetail.component.tsx
- [X] T069 [US3] Add strategy back-link to underlying pool in apps/web/src/features/strategies/components/StrategySelectedPanel.tsx
- [X] T070 [US3] Add cross-link translations in apps/web/src/i18n/locales/en/strategies.json, apps/web/src/i18n/locales/es/strategies.json, apps/web/src/i18n/locales/en/deposits.json, and apps/web/src/i18n/locales/es/deposits.json

**Checkpoint**: User Stories 1, 2, and 3 preserve the product model across Strategies, Pools, and Deposits.

---

## Phase 6: User Story 4 - Understand Coverage Limits Honestly (Priority: P2)

**Goal**: Users can distinguish full, share-level, partial, unknown, unavailable, and mixed-coverage strategy accounting from the list, KPI strip, selected panel, and coverage note.

**Independent Test**: View strategies with full, share-level, partial, and unknown coverage; verify metrics degrade honestly, non-full coverage notes appear, KPI aggregates show mixed coverage, and internal strategy activity is never shown as manual deposit activity.

### Tests for User Story 4

- [X] T071 [P] [US4] Add coverage-state derivation tests for full/share_level/partial/unknown strategies in apps/web/src/server/analysis/strategy-read-models.test.ts
- [X] T072 [P] [US4] Add service tests for mixed-coverage KPI states and unavailable value behavior in apps/web/src/server/strategies/strategies.service.test.ts
- [X] T073 [P] [US4] Add mapper tests for coverage note content and non-full styling signals in apps/web/src/features/strategies/strategies.mappers.test.ts
- [X] T074 [P] [US4] Waived Playwright test for visible non-full coverage note and no fabricated internal activity per constitution v1.1.0; covered by coverage derivation/mapper tests and manual auth-gated signoff

### Implementation for User Story 4

- [X] T075 [US4] Implement strategy coverage derivation and reason-code rollup in apps/web/src/server/analysis/strategy-read-models.ts
- [X] T076 [US4] Implement mixed-coverage KPI projection and unavailable metric handling in apps/web/src/server/strategies/strategies.service.ts
- [X] T077 [US4] Implement coverage-note view model mapping in apps/web/src/features/strategies/strategies.mappers.ts
- [X] T078 [US4] Add coverage note UI states and warning/accent behavior in apps/web/src/features/strategies/components/StrategyCoverageNote.tsx and apps/web/src/features/strategies/StrategiesWorkspace.module.css
- [X] T079 [US4] Add strategy coverage reason labels in apps/web/src/i18n/locales/en/coverage.json and apps/web/src/i18n/locales/es/coverage.json
- [X] T080 [US4] Guard internal strategy activity display behind confidence and source checks in apps/web/src/features/strategies/components/StrategyLifecycleTimeline.tsx

**Checkpoint**: Coverage behavior is honest and visible across the Strategies DataView.

---

## Phase 7: User Story 5 - Filter And Compare Strategies Efficiently (Priority: P3)

**Goal**: Users with several strategies can filter, search, sort, preserve selection, and arrive from cross-links with the relevant pool or strategy pre-selected.

**Independent Test**: Use a wallet with multiple strategy exposures and verify filters compose, active filters are clearable, URL state is stable, sorting works, selected strategy is preserved or replaced predictably, and cross-link arrivals are pre-filtered.

### Tests for User Story 5

- [X] T081 [P] [US5] Add URL state parser/serializer tests for status, protocol, pool, coverage, returnSign, search, sort, page, and selectedStrategyId in apps/web/src/features/strategies/strategies.urlState.test.ts
- [X] T082 [P] [US5] Add validation tests for bounded search, enum filters, pagination, and selected fallback in apps/web/src/features/strategies/strategies.validation.test.ts
- [X] T083 [P] [US5] Add repository tests for composed filters, search, sort, pagination, and selected row fallback in apps/web/src/server/strategies/strategies.repository.test.ts
- [X] T084 [P] [US5] Waived Playwright test for filters, sorting, clear chips, and narrow-screen drill-in per constitution v1.1.0; covered by URL-state/repository/validation tests and manual auth-gated signoff

### Implementation for User Story 5

- [X] T085 [US5] Implement full Strategies URL state parser, serializer, and normalized query-key helpers in apps/web/src/features/strategies/strategies.urlState.ts
- [X] T086 [US5] Implement bounded filter and sort validation in apps/web/src/features/strategies/strategies.validation.ts
- [X] T087 [US5] Implement server-side composed filtering, search, sort, pagination, and selected fallback in apps/web/src/server/strategies/strategies.repository.ts
- [X] T088 [US5] Implement Strategies filter bar with clearable chips and search in apps/web/src/features/strategies/components/StrategiesFiltersBar.tsx
- [X] T089 [US5] Wire URL state mutations and selected row preservation in apps/web/src/features/strategies/Strategies.container.tsx
- [X] T090 [US5] Implement responsive stack/drill-in behavior for narrow screens in apps/web/src/features/strategies/Strategies.component.tsx and apps/web/src/features/strategies/StrategiesWorkspace.module.css
- [X] T091 [US5] Add filter, sort, pagination, and responsive labels in apps/web/src/i18n/locales/en/strategies.json and apps/web/src/i18n/locales/es/strategies.json

**Checkpoint**: All user stories are independently functional and testable.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Complete validation, regression, quality gates, and documentation before signoff.

- [X] T092 [P] Add strategy read-model rebuild script implementation in apps/web/src/server/scripts/rebuild-strategy-read-models.ts
- [X] T093 [P] Implement analysis strategy regression script for DB rows vs tx sources and reward-total invariants in apps/web/src/server/scripts/analysis-strategy-regression.ts
- [X] T094 Update package test script coverage to include Strategies unit tests in apps/web/package.json
- [X] T095 Run unit test suite for strategy materializer, route, service, repository, mappers, navigation, URL state, pool totals, and deposit exclusion using apps/web/package.json
- [X] T096 Run lint, typecheck, i18n parity, and design-system checks using apps/web/package.json
- [X] T097 Waived Playwright DataView/navigation/a11y checks for Strategies per constitution v1.1.0; product owner manual screenshots accepted for auth-gated UI signoff
- [X] T098 Execute quickstart migration, analysis, and read-model rebuild validation from specs/012-strategies-lifecycle/quickstart.md
- [X] T099 Run final regression script after fresh analysis and verify strategy_wallet_summaries, strategy_lifecycle_events, reward_events, pool_wallet_summaries, and deposit_wallet_summaries against apps/web/src/server/scripts/analysis-strategy-regression.ts
- [X] T100 Record representative transaction hashes and product owner signoff evidence in specs/012-strategies-lifecycle/quickstart.md
- [X] T101 Confirm Pools total rewards equal resolved deposit rewards plus resolved strategy rewards using SQL in specs/012-strategies-lifecycle/quickstart.md
- [X] T102 Confirm Deposits show only deposit-owned rewards and Strategies show only strategy-owned rewards using SQL in specs/012-strategies-lifecycle/quickstart.md
- [X] T103 Update implementation notes and any discovered regression caveats in specs/012-strategies-lifecycle/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Starts immediately.
- **Foundational (Phase 2)**: Depends on Setup and blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational and is the MVP.
- **User Story 2 (Phase 4)**: Depends on Foundational; can begin after Strategy summary contracts exist, but integrates best after US1.
- **User Story 3 (Phase 5)**: Depends on Foundational plus enough US1/US2 data shape to link selected strategies.
- **User Story 4 (Phase 6)**: Depends on coverage fields from Foundational and selected panel from US2.
- **User Story 5 (Phase 7)**: Depends on US1 DataView and URL-state foundation.
- **Polish (Phase 8)**: Depends on desired stories being complete.

### User Story Dependencies

- **US1 Review Automated Strategy Exposure**: No dependency on other stories after Foundation.
- **US2 Inspect One Strategy Lifecycle**: Can be built after Foundation, but shares DataView selection with US1.
- **US3 Cross-Link Strategies With Pools And Deposits**: Requires Strategies routes and selected strategy identity from US1/US2.
- **US4 Understand Coverage Limits Honestly**: Requires selected panel and coverage fields from US1/US2.
- **US5 Filter And Compare Strategies Efficiently**: Requires list state and master list from US1.

### Testing Dependency

- Story tests should be written before story implementation and should fail before implementation.
- Final regression tasks T098-T102 must run only after all selected user stories and backend materialization changes are complete.

---

## Parallel Opportunities

- Setup placeholders T005-T007 can run in parallel.
- Foundational type/i18n/query tasks T011-T018 can run in parallel after schema decisions are known.
- US1 test tasks T022-T027 can run in parallel.
- US1 UI component tasks T036-T038 can run in parallel after response/view-model types exist.
- US2 component tasks T051-T054 can run in parallel after detail view-model mapping exists.
- US3 backend reward tests T057-T059 and navigation tests T060-T061 can run in parallel.
- US4 tests T071-T074 can run in parallel.
- US5 tests T081-T084 can run in parallel.
- Polish scripts T092-T093 can run in parallel once materializers exist.

---

## Parallel Example: User Story 1

```text
Task: "Add materializer tests for strategy summary/history rows and no manual deposit leakage in apps/web/src/server/analysis/strategy-read-models.test.ts"
Task: "Add repository tests for list filtering, selected bootstrap, KPI aggregation, and DB-only reads in apps/web/src/server/strategies/strategies.repository.test.ts"
Task: "Add mapper tests for DataView row, KPI, selected-row, empty, and locked view models in apps/web/src/features/strategies/strategies.mappers.test.ts"
Task: "Implement KPI strip component with coverage-aware metric states in apps/web/src/features/strategies/components/StrategiesKpiStrip.tsx"
Task: "Implement master list table and identity cells in apps/web/src/features/strategies/components/StrategiesTable.tsx and apps/web/src/features/strategies/components/StrategyIdentityCell.tsx"
```

## Parallel Example: User Story 2

```text
Task: "Add detail repository tests for lifecycle, rewards, history snapshots, coverage note payload, and strategy_not_found in apps/web/src/server/strategies/strategies.repository.test.ts"
Task: "Add mapper tests for detail header, exposure summary, rewards, lifecycle, and external tx links in apps/web/src/features/strategies/strategies.mappers.test.ts"
Task: "Implement selected panel header and exposure summary in apps/web/src/features/strategies/components/StrategySelectedPanel.tsx and apps/web/src/features/strategies/components/StrategyExposureSummary.tsx"
Task: "Implement resolved/unresolved rewards table in apps/web/src/features/strategies/components/StrategyRewardsTable.tsx"
Task: "Implement lifecycle timeline with transaction links and confidence badges in apps/web/src/features/strategies/components/StrategyLifecycleTimeline.tsx"
```

## Parallel Example: User Story 3

```text
Task: "Add strategy ownership and reward separation tests in apps/web/src/server/analysis/rewardResolution.test.ts"
Task: "Add pool total regression tests for resolved deposit plus strategy rewards in apps/web/src/server/analysis/pool-read-models.test.ts"
Task: "Add deposit exclusion regression tests for strategy_exposure_id rewards in apps/web/src/server/analysis/deposit-read-models.test.ts"
Task: "Add navigation helper tests for Pool-to-Strategies and Deposit-to-Strategies links in apps/web/src/features/strategies/strategies.navigation.test.ts and apps/web/src/features/deposits/deposits.navigation.test.ts"
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 setup.
2. Complete Phase 2 foundation.
3. Complete Phase 3 US1.
4. Stop and validate `/strategies` first screen independently with unit tests, regression checks, and manual auth-gated product signoff.

### Incremental Delivery

1. US1 delivers the first Strategy DataView list and selected shell.
2. US2 fills the selected lifecycle/detail panel and direct detail route.
3. US3 activates Pools/Deposits navigation and reward-total correctness.
4. US4 hardens coverage honesty and partial-data behavior.
5. US5 adds efficient filtering, sorting, URL state, and responsive comparison.
6. Phase 8 runs full quality gates and final DB-vs-chain regression before signoff.

### Suggested MVP Scope

Ship US1 only as the first reviewable increment if time is constrained: DB-backed strategy summaries, KPI strip, master list, selected row shell, analysis gate, empty state, and no manual deposit leakage.

## Notes

- Every task follows `- [ ] T### [P?] [US?] Description with file path`.
- `[P]` tasks touch different files or are safe to run independently.
- User-story labels map to the five stories in specs/012-strategies-lifecycle/spec.md.
- Tests are intentionally included because the user requested unit testing and final regression before signoff.
- Final signoff requires the quickstart regression checks, including DB rows compared against blockchain transactions and reward totals across Pools, Deposits, and Strategies.
