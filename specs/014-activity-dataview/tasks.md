# Tasks: Activity DataView

**Input**: Design documents from `/specs/014-activity-dataview/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included because the specification, quickstart, and constitution require automated unit, mapper, service, route, materializer, integration, and deterministic regression coverage. Browser E2E, Playwright, and automated browser/a11y tasks are intentionally excluded.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested independently after shared foundation is complete.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other marked tasks in the same phase because files do not overlap.
- **[Story]**: Maps the task to the user story from `spec.md`.
- All task descriptions include exact file paths.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create feature scaffolding, namespaces, and package/script placeholders without implementing story behavior.

- [X] T001 Create Activity route and API directories in `apps/web/src/app/activity/` and `apps/web/src/app/api/activity/`
- [X] T002 Create Activity feature module directories in `apps/web/src/features/activity/` and `apps/web/src/features/activity/components/`
- [X] T003 Create Activity server read-layer directory in `apps/web/src/server/activity/`
- [X] T004 Create supplemental explorer provider directory in `apps/web/src/server/providers/explorer/`
- [X] T005 [P] Create empty Activity English i18n namespace in `apps/web/src/i18n/locales/en/activity.json`
- [X] T006 [P] Create empty Activity Spanish i18n namespace in `apps/web/src/i18n/locales/es/activity.json`
- [X] T007 [P] Add Activity regression package script placeholder in `apps/web/package.json`
- [X] T008 [P] Add Activity feature barrel exports if the project uses them in `apps/web/src/features/activity/index.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Define shared contracts, validation, read-model shape, and query/i18n foundations required by every user story.

**Critical**: No user story work starts until this phase is complete.

- [X] T009 Define Activity server contract types, enums, stable error codes, filter schema, response shapes, and coverage/confidence unions in `apps/web/src/server/activity/activity.contract.ts`
- [X] T010 [P] Define Activity server implementation types for rows, summaries, selected detail, linked entities, movements, evidence, and rebalance explanation in `apps/web/src/server/activity/activity.types.ts`
- [X] T011 [P] Define Activity frontend view-model types matching the API contract in `apps/web/src/features/activity/activity.types.ts`
- [X] T012 Implement Activity route/filter validation helpers for chainId, date range, pagination, action, surface, coverage, confidence, selected row, and entity filters in `apps/web/src/features/activity/activity.validation.ts`
- [X] T013 [P] Add validation tests for all Activity filter and pagination cases in `apps/web/src/features/activity/activity.validation.test.ts`
- [X] T014 Define Activity query key, stale/placeholder behavior, and fetch helper in `apps/web/src/features/activity/activity.queries.ts`
- [X] T015 Update shared query keys or hooks to include wallet/chain/filter-aware Activity keys in `apps/web/src/queries/keys.ts`
- [X] T016 Define Activity URL state parser/serializer for filters, selected row, sort, page, and pageSize in `apps/web/src/features/activity/activity.urlState.ts`
- [X] T017 [P] Add Activity URL state tests for shallow/client state preservation and active filter chips in `apps/web/src/features/activity/activity.urlState.test.ts`
- [X] T018 Define Activity navigation helpers for incoming context from pools, deposits, strategies, rewards, and overview in `apps/web/src/features/activity/activity.navigation.ts`
- [X] T019 [P] Add Activity navigation helper tests for chain-aware cross-surface filter links in `apps/web/src/features/activity/activity.navigation.test.ts`
- [X] T020 Define Activity read-model materializer types and pure row-building helpers in `apps/web/src/server/analysis/activity-read-models.ts`
- [X] T021 [P] Add Activity read-model unit tests for identity, coverage, valuation, entity links, and summary counts in `apps/web/src/server/analysis/activity-read-models.test.ts`
- [X] T022 Add Activity repository skeleton with DB-only method signatures in `apps/web/src/server/activity/activity.repository.ts`
- [X] T023 Add Activity service skeleton with analysis gating, filter normalization, and selected-row fallback signatures in `apps/web/src/server/activity/activity.service.ts`
- [X] T024 Add Activity route handler skeleton that delegates to the service and returns stable errors in `apps/web/src/server/activity/activity.route.ts`
- [X] T025 Add Next.js API route wrapper for Activity in `apps/web/src/app/api/activity/route.ts`
- [X] T026 [P] Populate shared Activity action, surface, coverage, confidence, filter, table, selected rail, and error keys in `apps/web/src/i18n/locales/en/activity.json`
- [X] T027 [P] Populate matching Spanish Activity keys with parity in `apps/web/src/i18n/locales/es/activity.json`
- [X] T028 [P] Add or confirm Activity navigation labels in `apps/web/src/i18n/locales/en/navigation.json`
- [X] T029 [P] Add or confirm Activity navigation labels in `apps/web/src/i18n/locales/es/navigation.json`
- [X] T030 [P] Add Activity coverage/error labels to `apps/web/src/i18n/locales/en/coverage.json` and `apps/web/src/i18n/locales/en/errors.json`
- [X] T031 [P] Add Activity coverage/error labels to `apps/web/src/i18n/locales/es/coverage.json` and `apps/web/src/i18n/locales/es/errors.json`

**Checkpoint**: Foundation ready. User story implementation can now proceed in priority order or in parallel where files do not conflict.

---

## Phase 3: User Story 1 - Review The Interpreted Activity Ledger (Priority: P1) MVP

**Goal**: Users can open `/activity` after analysis is ready and see a chronological interpreted ledger with summary metrics, rows, coverage, confidence, and locked/empty states.

**Independent Test**: Open Activity for a ready wallet with supported transactions and verify summary metrics plus a ledger row containing timestamp, action, transaction, protocol surface, linked context when available, token movement, value, coverage, and confidence.

### Tests for User Story 1

- [X] T032 [P] [US1] Add repository tests for paginated Activity ledger rows and summary counts in `apps/web/src/server/activity/activity.repository.test.ts`
- [X] T033 [P] [US1] Add service tests for ready, locked, empty, stale-ready, and selected-default states in `apps/web/src/server/activity/activity.service.test.ts`
- [X] T034 [P] [US1] Add route tests for `/api/activity` success, locked, unsupported-chain, unauthenticated, and invalid-filter responses in `apps/web/src/server/activity/activity.route.test.ts`
- [X] T035 [P] [US1] Add mapper tests for Activity KPI and table view models in `apps/web/src/features/activity/activity.mappers.test.ts`

### Implementation for User Story 1

- [X] T036 [US1] Implement Activity repository list, summary, filter option, and pagination queries in `apps/web/src/server/activity/activity.repository.ts`
- [X] T037 [US1] Implement Activity service analysis gating, filter normalization, selected-default behavior, and locked/empty responses in `apps/web/src/server/activity/activity.service.ts`
- [X] T038 [US1] Implement Activity route contract and stable error mapping in `apps/web/src/server/activity/activity.route.ts`
- [X] T039 [US1] Wire the Next.js Activity API route to the server route handler in `apps/web/src/app/api/activity/route.ts`
- [X] T040 [US1] Implement Activity API client query and placeholderData behavior in `apps/web/src/features/activity/activity.queries.ts`
- [X] T041 [US1] Implement Activity mapper from API response to page, KPI, table, filter, empty, loading, and error view models in `apps/web/src/features/activity/activity.mappers.ts`
- [X] T042 [P] [US1] Implement Activity KPI strip using shared impact metric primitives in `apps/web/src/features/activity/components/ActivityKpiStrip.tsx`
- [X] T043 [P] [US1] Implement Activity ledger table using shared DataTable and DataTablePagination in `apps/web/src/features/activity/components/ActivityEventsTable.tsx`
- [X] T044 [P] [US1] Implement Activity empty, locked, loading, and error states in `apps/web/src/features/activity/components/ActivityEmptyState.tsx`
- [X] T045 [US1] Implement Activity presentation component with DS stacks, KPI strip, filter placeholder, ledger table, and selected placeholder in `apps/web/src/features/activity/Activity.component.tsx`
- [X] T046 [US1] Implement Activity container with wallet/chain scope, analysis gating, URL state, and query wiring in `apps/web/src/features/activity/Activity.container.tsx`
- [X] T047 [US1] Create Activity page route that renders the container in `apps/web/src/app/activity/page.tsx`
- [X] T048 [US1] Add Activity workspace layout CSS limited to grid/panel composition in `apps/web/src/features/activity/ActivityWorkspace.module.css`
- [X] T049 [US1] Enable Activity navigation state in the connected shell source that currently marks Activity disabled in `apps/web/src/features/overview/overview.mappers.ts`

**Checkpoint**: US1 MVP is independently functional: `/activity` shows an analyzed ledger or a correct locked/empty state.

---

## Phase 4: User Story 7 - Improve Classification With Supplemental Explorer Evidence (Priority: P1)

**Goal**: Background analysis can use supplemental explorer indexed evidence to improve classification and decomposition while preserving unresolved states when evidence is insufficient.

**Independent Test**: Run Activity classification regression with transactions where decoded history is incomplete and verify explorer-enriched rows improve action labels without inventing ownership.

### Tests for User Story 7

- [X] T050 [P] [US7] Add explorer provider client tests for success, missing credentials, rate limit, malformed response, and chain mismatch in `apps/web/src/server/providers/explorer/client.test.ts`
- [X] T051 [P] [US7] Add tx classification tests for explorer-enriched classification without ownership inference in `apps/web/src/server/analysis/txClassification.test.ts`
- [X] T052 [P] [US7] Add phase activity tests for persisting supplemental evidence metadata and evidence-gap reasons in `apps/web/src/server/trigger/tasks/phase-activity.test.ts`
- [ ] T053 [P] [US7] Add deterministic Activity regression fixture coverage for explorer-enriched, ambiguous, unsupported, and phishing airdrop transactions in `apps/web/src/server/scripts/analysis-activity-regression.ts`

### Implementation for User Story 7

- [X] T054 [US7] Implement supplemental explorer client with chain-scoped transaction receipt, logs, internal transfer, and contract interaction fetch helpers in `apps/web/src/server/providers/explorer/client.ts`
- [X] T055 [US7] Export explorer provider helpers through `apps/web/src/server/providers/explorer/index.ts`
- [X] T056 [US7] Integrate supplemental explorer evidence lookup into the background Activity phase without request-time calls in `apps/web/src/server/trigger/tasks/phase-activity.task.ts`
- [X] T057 [US7] Extend tx classification inputs to accept supplemental explorer evidence and return evidence-used or evidence-gap reason codes in `apps/web/src/server/analysis/txClassification.ts`
- [X] T058 [US7] Persist supplemental evidence references, conflict reasons, and missing-evidence reasons in Activity materialization in `apps/web/src/server/analysis/activity-read-models.ts`
- [X] T059 [US7] Update raw provider record persistence or metadata typing for explorer evidence references in `apps/web/src/server/providers/raw-provider-records.repository.ts`
- [ ] T060 [US7] Implement deterministic Activity regression script for known good, ambiguous, unsupported, explorer-enriched, and phishing airdrop cases in `apps/web/src/server/scripts/analysis-activity-regression.ts`
- [X] T061 [US7] Add `analysis:activity-regression` script command to `apps/web/package.json`

**Checkpoint**: US7 is independently testable through unit tests and deterministic regression without any Activity UI dependency beyond persisted evidence semantics.

---

## Phase 5: User Story 2 - Trace Metrics Back To Transactions (Priority: P1)

**Goal**: Activity rows expose evidence-backed links to Pools, Deposits, Strategies, Rewards, and Governance context without guessing ownership.

**Independent Test**: Select rows that contributed to Pool, Deposit, Strategy, Reward, and Governance contexts and verify each row links to the correct entity or shows why a link is unavailable.

### Tests for User Story 2

- [X] T062 [P] [US2] Add Activity read-model tests for Pool, Deposit, Strategy, Reward, Governance, and unavailable linked entities in `apps/web/src/server/analysis/activity-read-models.test.ts`
- [ ] T063 [P] [US2] Add service tests for linked entity filtering and selected detail links in `apps/web/src/server/activity/activity.service.test.ts`
- [ ] T064 [P] [US2] Add mapper tests for linked entity pills, routes, and unavailable reasons in `apps/web/src/features/activity/activity.mappers.test.ts`
- [ ] T065 [P] [US2] Add cross-surface navigation tests for Activity links from Pools, Deposits, Strategies, Rewards, and Overview in `apps/web/src/features/activity/activity.navigation.test.ts`

### Implementation for User Story 2

- [X] T066 [US2] Extend Activity materialization to attach evidence-backed linked entities for Pool, Deposit, StrategyExposure, RewardEvent, and GovernanceEvent in `apps/web/src/server/analysis/activity-read-models.ts`
- [X] T067 [US2] Extend Activity repository filters and selected detail queries for linked entity context in `apps/web/src/server/activity/activity.repository.ts`
- [X] T068 [US2] Extend Activity service to enforce no pool/time-window ownership fallback and return unavailable link reasons in `apps/web/src/server/activity/activity.service.ts`
- [X] T069 [P] [US2] Implement linked entity display component with DS badges and chain-aware routes in `apps/web/src/features/activity/components/ActivityLinkedEntities.tsx`
- [X] T070 [US2] Render linked entities in ledger rows and selected detail in `apps/web/src/features/activity/components/ActivityEventsTable.tsx`
- [ ] T071 [US2] Add Activity deep links from Overview recent activity rows in `apps/web/src/features/overview/Overview.component.tsx`
- [ ] T072 [US2] Add Activity evidence links from Pool detail metrics and rebalance surfaces in `apps/web/src/features/pools/PoolDetail.component.tsx`
- [ ] T073 [US2] Add Activity evidence links from Deposit lifecycle and movements in `apps/web/src/features/deposits/DepositDetail.component.tsx`
- [ ] T074 [US2] Add Activity evidence links from Strategy lifecycle, rewards, and internal activity sections in `apps/web/src/features/strategies/StrategyDetail.component.tsx`
- [ ] T075 [US2] Add Activity evidence links from selected reward details in `apps/web/src/features/rewards/components/SelectedRewardRail.tsx`

**Checkpoint**: US2 can be validated from Activity and from incoming links in existing product sections.

---

## Phase 6: User Story 3 - Inspect Transaction Detail Evidence (Priority: P1)

**Goal**: Selecting an Activity row shows transaction evidence, movements, classification basis, source evidence, coverage, and confidence without route reload.

**Independent Test**: Select an Activity row and verify the detail rail updates inline with transaction hash, block/time, classification, movement, pricing, evidence, coverage, and confidence.

### Tests for User Story 3

- [ ] T076 [P] [US3] Add route tests for selectedActivity detail payload and selected-not-found behavior in `apps/web/src/server/activity/activity.route.test.ts`
- [X] T077 [P] [US3] Add service tests for selected row fallback when filters remove the selected event in `apps/web/src/server/activity/activity.service.test.ts`
- [ ] T078 [P] [US3] Add mapper tests for selected detail, movement rows, classification evidence, and source evidence refs in `apps/web/src/features/activity/activity.mappers.test.ts`

### Implementation for User Story 3

- [X] T079 [US3] Implement selected activity detail repository query with transaction, movements, evidence, coverage, and source refs in `apps/web/src/server/activity/activity.repository.ts`
- [X] T080 [US3] Implement selected activity detail service behavior with inline loading-compatible fallback state in `apps/web/src/server/activity/activity.service.ts`
- [X] T081 [P] [US3] Implement selected Activity rail shell and summary sections using DS primitives in `apps/web/src/features/activity/components/SelectedActivityRail.tsx`
- [X] T082 [P] [US3] Implement token movement list component with localized formatting in `apps/web/src/features/activity/components/ActivityMovementList.tsx`
- [X] T083 [P] [US3] Implement classification evidence component with evidence-used and evidence-gap notes in `apps/web/src/features/activity/components/ActivityClassificationEvidence.tsx`
- [X] T084 [P] [US3] Implement coverage notes component with affectsTotals and reason code copy in `apps/web/src/features/activity/components/ActivityCoverageNotes.tsx`
- [X] T085 [US3] Wire row selection state, selected rail loading state, and selected-empty state into `apps/web/src/features/activity/Activity.component.tsx`
- [X] T086 [US3] Update Activity container to preserve selected row during query refresh with no full-page visual reload in `apps/web/src/features/activity/Activity.container.tsx`

**Checkpoint**: US3 selected detail is independently testable from the ledger without requiring cross-surface navigation.

---

## Phase 7: User Story 4 - Understand Rebalances And Residual Attribution (Priority: P1)

**Goal**: Activity explains full-pool rebalances, partial swap attribution, residual attribution state, source allocation, and unsupported remainder.

**Independent Test**: Use a wallet with decrease/swap/increase activity and verify Activity detail shows related events, residual state, pool effect, source allocation, coverage, and confidence.

### Tests for User Story 4

- [ ] T087 [P] [US4] Add canonical inference tests for source allocation breakdown and unsupported remainder in `apps/web/src/server/analysis/canonicalInference.test.ts`
- [ ] T088 [P] [US4] Add Activity read-model tests for full-pool rebalance, partial swap attribution, and unresolved attribution rows in `apps/web/src/server/analysis/activity-read-models.test.ts`
- [ ] T089 [P] [US4] Add mapper tests for rebalance explanation view model states in `apps/web/src/features/activity/activity.mappers.test.ts`

### Implementation for User Story 4

- [ ] T090 [US4] Expose related withdraw, swap, deposit, residual state, source allocation, and pool effect from canonical inference in `apps/web/src/server/analysis/canonicalInference.ts`
- [ ] T091 [US4] Materialize rebalance explanation fields into Activity rows in `apps/web/src/server/analysis/activity-read-models.ts`
- [ ] T092 [US4] Include rebalance explanation in selected Activity repository and service responses in `apps/web/src/server/activity/activity.repository.ts`
- [ ] T093 [P] [US4] Implement rebalance explanation component with DS key-value lists and allocation rows in `apps/web/src/features/activity/components/ActivityRebalanceExplanation.tsx`
- [ ] T094 [US4] Render rebalance and partial swap attribution cues in the ledger table in `apps/web/src/features/activity/components/ActivityEventsTable.tsx`
- [ ] T095 [US4] Add Pool detail links into Activity rebalance filters where relevant in `apps/web/src/features/pools/PoolDetail.component.tsx`

**Checkpoint**: US4 can be tested from Activity selected detail and by comparing Pool detail links into Activity.

---

## Phase 8: User Story 5 - Filter And Investigate Activity (Priority: P2)

**Goal**: Users can filter, search, sort, page, and clear Activity state without breaking layout or causing full-page reload behavior.

**Independent Test**: Apply multiple filters, paginate, select a row, clear filters, and verify summaries/table/detail update while preserving shell layout and visible active chips.

### Tests for User Story 5

- [X] T096 [P] [US5] Add URL state tests for combined filters, selected row, sort, page, pageSize, and clear-all behavior in `apps/web/src/features/activity/activity.urlState.test.ts`
- [X] T097 [P] [US5] Add route tests for every Activity filter and sort option in `apps/web/src/server/activity/activity.route.test.ts`
- [ ] T098 [P] [US5] Add mapper tests for active filter chips, available filters, no-results state, and pagination view model in `apps/web/src/features/activity/activity.mappers.test.ts`

### Implementation for User Story 5

- [X] T099 [US5] Implement complete repository filtering, sorting, search, result count, and pagination query behavior in `apps/web/src/server/activity/activity.repository.ts`
- [X] T100 [US5] Implement filter bar component with DS controls, active chips, and clear-all behavior in `apps/web/src/features/activity/components/ActivityFiltersBar.tsx`
- [X] T101 [US5] Wire Activity URL state to filters, sort, pagination, rows per page, and selected row in `apps/web/src/features/activity/Activity.container.tsx`
- [X] T102 [US5] Update Activity table pagination and sort interactions to use shared client-side navigation patterns in `apps/web/src/features/activity/components/ActivityEventsTable.tsx`
- [X] T103 [US5] Add no-results empty state while preserving summary/filter layout in `apps/web/src/features/activity/components/ActivityEmptyState.tsx`
- [X] T104 [US5] Extend Activity i18n filter labels, chip labels, sort labels, and empty-state copy in `apps/web/src/i18n/locales/en/activity.json`
- [X] T105 [US5] Extend matching Spanish Activity filter labels, chip labels, sort labels, and empty-state copy in `apps/web/src/i18n/locales/es/activity.json`

**Checkpoint**: US5 filter workflow is independently testable with any non-empty Activity dataset.

---

## Phase 9: User Story 6 - Surface Unsupported, Ambiguous, And Malicious Activity (Priority: P2)

**Goal**: Activity surfaces unsupported, ambiguous, malicious, spam-like, discarded, partial, unresolved, and unavailable rows honestly and excludes them from confident totals.

**Independent Test**: Use fixtures containing unsupported transfers, ambiguous protocol actions, and the known phishing airdrop; verify labels, reasons, detail notes, and total exclusion behavior.

### Tests for User Story 6

- [X] T106 [P] [US6] Add reward exclusion regression for phishing airdrop staying excluded from rewards and Activity earned value in `apps/web/src/server/analysis/rewardResolution.test.ts`
- [ ] T107 [P] [US6] Add Activity read-model tests for malicious, unsupported, ambiguous, discarded, unresolved, and unavailable rows in `apps/web/src/server/analysis/activity-read-models.test.ts`
- [ ] T108 [P] [US6] Add mapper tests for non-full row badges, reason copy keys, and affectsTotals false states in `apps/web/src/features/activity/activity.mappers.test.ts`
- [X] T109 [P] [US6] Add deterministic regression assertions for the known phishing airdrop transaction in `apps/web/src/server/scripts/analysis-activity-regression.ts`

### Implementation for User Story 6

- [ ] T110 [US6] Extend Activity materialization to preserve unsupported, malicious, ambiguous, discarded, unresolved, and unavailable rows with reason codes in `apps/web/src/server/analysis/activity-read-models.ts`
- [X] T111 [US6] Ensure spam/phishing transfer signals from Activity classification cannot create reward rows or earned-value totals in `apps/web/src/server/trigger/tasks/phase-rewards.task.ts`
- [X] T112 [US6] Extend Activity service summaries to count excluded/malicious rows separately from supported interpreted rows in `apps/web/src/server/activity/activity.service.ts`
- [X] T113 [P] [US6] Add non-full coverage badge and reason rendering in Activity table rows in `apps/web/src/features/activity/components/ActivityEventsTable.tsx`
- [X] T114 [P] [US6] Add non-full selected detail messaging in `apps/web/src/features/activity/components/ActivityCoverageNotes.tsx`
- [X] T115 [US6] Add localized malicious, spam-like, unsupported, ambiguous, discarded, unresolved, and unavailable reason labels in `apps/web/src/i18n/locales/en/activity.json`
- [X] T116 [US6] Add matching Spanish reason labels in `apps/web/src/i18n/locales/es/activity.json`

**Checkpoint**: US6 proves visible uncertainty and malicious exclusion without relying on visual smoke alone.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Product-wide consistency, validation, docs, and signoff.

- [X] T117 [P] Run and fix Activity i18n parity issues in `apps/web/src/i18n/locales/en/activity.json` and `apps/web/src/i18n/locales/es/activity.json`
- [X] T118 [P] Run and fix DS compliance issues for Activity components in `apps/web/src/features/activity/`
- [X] T119 [P] Run and fix type errors across Activity server, feature, and script files in `apps/web/src/server/activity/` and `apps/web/src/features/activity/`
- [X] T120 Run full unit suite and address regressions in `apps/web/src/server/activity/`, `apps/web/src/server/analysis/`, and `apps/web/src/features/activity/`
- [X] T121 Run Activity deterministic regression and document output expectations in `apps/web/src/server/scripts/analysis-activity-regression.ts`
- [X] T122 Verify no request-time provider, RPC, or explorer calls exist in Activity route/service/repository code in `apps/web/src/server/activity/`
- [X] T123 Verify no hardcoded BaseScan URLs, raw chain IDs, user-facing copy, local `new Intl`, or local `toFixed` formatting remain in Activity code in `apps/web/src/features/activity/`
- [X] T124 Update Activity quickstart with final validation commands and manual signoff notes in `specs/014-activity-dataview/quickstart.md`
- [X] T125 Record known engine coverage limitations and follow-up cases in `docs/informe-avance-product-spec-gaps.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup and blocks all user stories.
- **US1 (Phase 3)**: First MVP after Foundation.
- **US7 (Phase 4)**: P1 engine hardening; can begin after Foundation and is recommended before broad data validation.
- **US2 (Phase 5)**: Depends on Foundation; benefits from US1 table/API and US7 evidence metadata.
- **US3 (Phase 6)**: Depends on US1 selected-row shell and benefits from US2 linked entities.
- **US4 (Phase 7)**: Depends on Foundation and selected detail patterns from US3.
- **US5 (Phase 8)**: Depends on US1 base query/table and URL-state foundation.
- **US6 (Phase 9)**: Depends on Foundation and benefits from US7 classification hardening.
- **Polish (Phase 10)**: Depends on all desired stories.

### User Story Dependencies

- **US1 Review Ledger**: MVP. No dependency on other stories after Foundation.
- **US7 Explorer Evidence**: No UI dependency after Foundation, but improves data quality for all stories.
- **US2 Trace Metrics**: Can start after Foundation; best after US1 API/table shell.
- **US3 Detail Evidence**: Can start after US1; best after US2 if linked entities should be complete.
- **US4 Rebalance Explainability**: Can start after Foundation; best after US3 detail rail exists.
- **US5 Filtering**: Can start after US1 table/query shell exists.
- **US6 Unsupported/Malicious**: Can start after Foundation; best after US7 evidence handling exists.

### Within Each User Story

- Tests first and expected to fail before implementation.
- Materializer/read-model changes before repository/service/route.
- Route/service/repository before feature query/container wiring.
- Mappers before presentation components where view-model shape is new.
- i18n keys before final UI copy review.

---

## Parallel Opportunities

- Setup directory and namespace tasks T005-T008 can run in parallel.
- Foundational type, validation, URL-state, navigation, read-model, and i18n tasks T010-T031 can run in parallel where files differ.
- US1 test tasks T032-T035 can run in parallel.
- US1 UI component tasks T042-T044 can run in parallel after mapper shape is known.
- US7 test tasks T050-T053 can run in parallel.
- US2 test tasks T062-T065 and component task T069 can run in parallel.
- US3 component tasks T081-T084 can run in parallel.
- US4 tests T087-T089 and component T093 can run in parallel.
- US5 tests T096-T098 can run in parallel.
- US6 tests T106-T109 and UI tasks T113-T114 can run in parallel.
- Polish checks T117-T119 can run in parallel.

---

## Parallel Example: US1 Review Ledger

```bash
Task: "Add repository tests for paginated Activity ledger rows and summary counts in apps/web/src/server/activity/activity.repository.test.ts"
Task: "Add service tests for ready, locked, empty, stale-ready, and selected-default states in apps/web/src/server/activity/activity.service.test.ts"
Task: "Add route tests for /api/activity success, locked, unsupported-chain, unauthenticated, and invalid-filter responses in apps/web/src/server/activity/activity.route.test.ts"
Task: "Add mapper tests for Activity KPI and table view models in apps/web/src/features/activity/activity.mappers.test.ts"
```

## Parallel Example: US7 Explorer Evidence

```bash
Task: "Add explorer provider client tests for success, missing credentials, rate limit, malformed response, and chain mismatch in apps/web/src/server/providers/explorer/client.test.ts"
Task: "Add tx classification tests for explorer-enriched classification without ownership inference in apps/web/src/server/analysis/txClassification.test.ts"
Task: "Add deterministic Activity regression fixture coverage for explorer-enriched, ambiguous, unsupported, and phishing airdrop transactions in apps/web/src/server/scripts/analysis-activity-regression.ts"
```

## Parallel Example: US3 Detail Evidence

```bash
Task: "Implement selected Activity rail shell and summary sections using DS primitives in apps/web/src/features/activity/components/SelectedActivityRail.tsx"
Task: "Implement token movement list component with localized formatting in apps/web/src/features/activity/components/ActivityMovementList.tsx"
Task: "Implement classification evidence component with evidence-used and evidence-gap notes in apps/web/src/features/activity/components/ActivityClassificationEvidence.tsx"
Task: "Implement coverage notes component with affectsTotals and reason code copy in apps/web/src/features/activity/components/ActivityCoverageNotes.tsx"
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 Setup.
2. Complete Phase 2 Foundation.
3. Complete Phase 3 US1 Review Ledger.
4. Validate `/activity` locked, empty, ready, table, KPI, pagination, and selected-default behavior.
5. Stop and demo the Activity ledger before adding deeper detail.

### Recommended Incremental Order

1. US1 Review Ledger.
2. US7 Explorer Evidence hardening.
3. US2 Trace Metrics.
4. US3 Detail Evidence.
5. US4 Rebalance Explainability.
6. US5 Filters.
7. US6 Unsupported/Malicious Activity.
8. Polish and validation.

### Quality Gates

Run before signoff:

```bash
pnpm --dir apps/web typecheck
pnpm --dir apps/web test:unit
pnpm --dir apps/web i18n:check
pnpm --dir apps/web ds:check
pnpm --dir apps/web analysis:activity-regression
```

Manual signoff remains required for auth-gated UI behavior and visual consistency.

## Notes

- [P] tasks indicate different files and no direct dependency on another incomplete task in the same phase.
- Every story has its own tests and an independent checkpoint.
- Request-time Activity code must remain DB-only.
- Supplemental explorer evidence is background-only and cannot infer ownership without explicit identity or protocol-backed semantics.
- Use shared DS primitives and i18next formatters; do not introduce feature-local table, pagination, KPI, or number-formatting systems.
