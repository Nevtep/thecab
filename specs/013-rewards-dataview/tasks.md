# Tasks: Rewards DataView

**Input**: Design documents from `/specs/013-rewards-dataview/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Required by the feature spec and quickstart. Use unit, route, service, mapper, materializer, integration, i18n, design-system, and deterministic regression tests only. Do not add Playwright, browser E2E, or automated browser/a11y tasks.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete tasks)
- **[Story]**: Maps to user stories in `spec.md`
- All tasks include exact file paths

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the Rewards feature, route, server, and locale scaffolding needed by every story.

- [X] T001 Create Rewards app route scaffold in `apps/web/src/app/rewards/page.tsx`
- [X] T002 Create Rewards API route scaffold in `apps/web/src/app/api/rewards/route.ts`
- [X] T003 Create Rewards server module files in `apps/web/src/server/rewards/rewards.contract.ts`, `apps/web/src/server/rewards/rewards.types.ts`, `apps/web/src/server/rewards/rewards.repository.ts`, `apps/web/src/server/rewards/rewards.service.ts`, and `apps/web/src/server/rewards/rewards.route.ts`
- [X] T004 Create Rewards feature module files in `apps/web/src/features/rewards/Rewards.container.tsx`, `apps/web/src/features/rewards/Rewards.component.tsx`, `apps/web/src/features/rewards/RewardsWorkspace.module.css`, `apps/web/src/features/rewards/rewards.types.ts`, `apps/web/src/features/rewards/rewards.mappers.ts`, `apps/web/src/features/rewards/rewards.queries.ts`, `apps/web/src/features/rewards/rewards.validation.ts`, `apps/web/src/features/rewards/rewards.urlState.ts`, `apps/web/src/features/rewards/rewards.navigation.ts`, and `apps/web/src/features/rewards/rewards.filters.ts`
- [X] T005 [P] Create Rewards component scaffolds in `apps/web/src/features/rewards/components/RewardsKpiStrip.tsx`, `apps/web/src/features/rewards/components/RewardsFiltersBar.tsx`, `apps/web/src/features/rewards/components/RewardsOverTimePanel.tsx`, `apps/web/src/features/rewards/components/RewardsSourceBreakdown.tsx`, `apps/web/src/features/rewards/components/RewardsPoolContributionBreakdown.tsx`, `apps/web/src/features/rewards/components/RewardsTokenBreakdown.tsx`, `apps/web/src/features/rewards/components/RewardsEventsTable.tsx`, `apps/web/src/features/rewards/components/SelectedRewardRail.tsx`, `apps/web/src/features/rewards/components/RewardOwnershipTrace.tsx`, `apps/web/src/features/rewards/components/RewardPoolContribution.tsx`, `apps/web/src/features/rewards/components/RewardClaimDetails.tsx`, `apps/web/src/features/rewards/components/RewardCoverageNotes.tsx`, `apps/web/src/features/rewards/components/UnresolvedExcludedActivity.tsx`, and `apps/web/src/features/rewards/components/RewardsEmptyState.tsx`
- [X] T006 [P] Create Rewards test scaffolds in `apps/web/src/server/rewards/rewards.repository.test.ts`, `apps/web/src/server/rewards/rewards.service.test.ts`, `apps/web/src/server/rewards/rewards.route.test.ts`, `apps/web/src/features/rewards/rewards.mappers.test.ts`, `apps/web/src/features/rewards/rewards.navigation.test.ts`, `apps/web/src/features/rewards/rewards.urlState.test.ts`, and `apps/web/src/features/rewards/rewards.validation.test.ts`
- [X] T007 [P] Replace placeholder Rewards locale structure in `apps/web/src/i18n/locales/en/rewards.json` and `apps/web/src/i18n/locales/es/rewards.json` with top-level groups from `specs/013-rewards-dataview/contracts/i18n-namespaces.md`
- [X] T008 [P] Add Rewards navigation label placeholders in `apps/web/src/i18n/locales/en/navigation.json` and `apps/web/src/i18n/locales/es/navigation.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish shared contracts, filter state, read boundaries, and localization before user-story implementation.

**CRITICAL**: No user story work can begin until this phase is complete.

- [X] T009 Define Rewards API response, filter, error, and DTO types from `contracts/rewards-api.md` in `apps/web/src/server/rewards/rewards.contract.ts`
- [X] T010 Mirror server response and view-model types in `apps/web/src/features/rewards/rewards.types.ts`
- [X] T011 Implement Rewards filter parsing and validation rules in `apps/web/src/server/rewards/rewards.route.ts`
- [X] T012 [P] Implement client URL-state parsing and serialization for Rewards filters in `apps/web/src/features/rewards/rewards.urlState.ts`
- [X] T013 [P] Implement Rewards filter defaults and chip metadata in `apps/web/src/features/rewards/rewards.filters.ts`
- [X] T014 Update query keys for chain/wallet/filter-scoped Rewards data in `apps/web/src/queries/keys.ts`
- [X] T015 Update typed Rewards query options and hook enablement in `apps/web/src/queries/hooks.ts` and `apps/web/src/features/rewards/rewards.queries.ts`
- [X] T016 Implement stable Rewards API error codes and error mapping in `apps/web/src/server/rewards/rewards.route.ts`
- [X] T017 [P] Add Rewards backend validation tests for filters and error codes in `apps/web/src/server/rewards/rewards.route.test.ts`
- [X] T018 [P] Add Rewards URL-state validation tests for date presets, incoming context, selection, pagination, and chips in `apps/web/src/features/rewards/rewards.urlState.test.ts`
- [X] T019 [P] Add Rewards i18n key groups for KPI, filter, panel, table, selected rail, reason, and action copy in `apps/web/src/i18n/locales/en/rewards.json` and `apps/web/src/i18n/locales/es/rewards.json`
- [X] T020 [P] Add Rewards coverage reason labels in `apps/web/src/i18n/locales/en/coverage.json` and `apps/web/src/i18n/locales/es/coverage.json`
- [X] T021 [P] Add Rewards chart legend labels in `apps/web/src/i18n/locales/en/charts.json` and `apps/web/src/i18n/locales/es/charts.json`
- [X] T022 [P] Add Rewards API error translations in `apps/web/src/i18n/locales/en/errors.json` and `apps/web/src/i18n/locales/es/errors.json`
- [X] T023 Add Rewards route to connected navigation configuration in `apps/web/src/features/rewards/rewards.navigation.ts`
- [X] T024 Update application navigation to enable Rewards in `apps/web/src/i18n/locales/en/navigation.json`, `apps/web/src/i18n/locales/es/navigation.json`, and `apps/web/src/features/overview/overview.mappers.ts`
- [X] T025 Add provider-boundary guard documentation comment to Rewards route implementation in `apps/web/src/server/rewards/rewards.route.ts`

**Checkpoint**: Foundation ready. User story implementation can begin.

---

## Phase 3: User Story 1 - Review All Claimed Rewards (Priority: P1) MVP

**Goal**: Users can open Rewards after analysis and see the mockup-aligned DataView with five KPIs, filters, chart, breakdown panels, reward table, and selected reward rail shell.

**Independent Test**: Open Rewards for an analyzed wallet with at least one reward and verify title/subtitle, KPI cards, filters, over-time panel, source/pool/token breakdowns, table, and selected reward area appear for the active chain.

### Tests for User Story 1

- [X] T026 [P] [US1] Add repository tests for summary, KPI, chart, distribution, and pagination queries in `apps/web/src/server/rewards/rewards.repository.test.ts`
- [X] T027 [P] [US1] Add service tests for locked, empty, ready, and stale-ready responses in `apps/web/src/server/rewards/rewards.service.test.ts`
- [X] T028 [P] [US1] Add mapper tests for API-to-view-model KPI, chart, distribution, and table state in `apps/web/src/features/rewards/rewards.mappers.test.ts`
- [X] T029 [P] [US1] Add route tests for `GET /api/rewards?chainId=8453` ready and locked responses in `apps/web/src/server/rewards/rewards.route.test.ts`

### Implementation for User Story 1

- [X] T030 [US1] Implement wallet/analysis readiness lookup for Rewards in `apps/web/src/server/rewards/rewards.repository.ts`
- [X] T031 [US1] Implement DB-only reward summary aggregation in `apps/web/src/server/rewards/rewards.repository.ts`
- [X] T032 [US1] Implement rewards-over-time bucket aggregation in `apps/web/src/server/rewards/rewards.repository.ts`
- [X] T033 [US1] Implement source, pool contribution, and token distribution aggregation in `apps/web/src/server/rewards/rewards.repository.ts`
- [X] T034 [US1] Implement reward events table query with pagination and default date sorting in `apps/web/src/server/rewards/rewards.repository.ts`
- [X] T035 [US1] Implement Rewards service assembly for locked, empty, and ready states in `apps/web/src/server/rewards/rewards.service.ts`
- [X] T036 [US1] Wire API route handler to service and contract in `apps/web/src/server/rewards/rewards.route.ts` and `apps/web/src/app/api/rewards/route.ts`
- [X] T037 [US1] Implement API response validation and view-model mapping in `apps/web/src/features/rewards/rewards.validation.ts` and `apps/web/src/features/rewards/rewards.mappers.ts`
- [X] T038 [US1] Implement Rewards route container with wallet, chain, analysis, filters, and query hook in `apps/web/src/features/rewards/Rewards.container.tsx`
- [X] T039 [US1] Implement Rewards page composition shell in `apps/web/src/features/rewards/Rewards.component.tsx`
- [X] T040 [US1] Implement five-card KPI strip in `apps/web/src/features/rewards/components/RewardsKpiStrip.tsx`
- [X] T041 [US1] Implement Rewards filter bar controls and active chips in `apps/web/src/features/rewards/components/RewardsFiltersBar.tsx`
- [X] T042 [US1] Implement rewards-over-time chart panel in `apps/web/src/features/rewards/components/RewardsOverTimePanel.tsx`
- [X] T043 [P] [US1] Implement source breakdown panel in `apps/web/src/features/rewards/components/RewardsSourceBreakdown.tsx`
- [X] T044 [P] [US1] Implement pool contribution breakdown panel in `apps/web/src/features/rewards/components/RewardsPoolContributionBreakdown.tsx`
- [X] T045 [P] [US1] Implement token breakdown panel in `apps/web/src/features/rewards/components/RewardsTokenBreakdown.tsx`
- [X] T046 [US1] Implement reward events table with selectable row shell in `apps/web/src/features/rewards/components/RewardsEventsTable.tsx`
- [X] T047 [US1] Implement locked, no-rewards, and filtered-empty states in `apps/web/src/features/rewards/components/RewardsEmptyState.tsx`
- [X] T048 [US1] Implement mockup-aligned desktop workspace grid, responsive base layout, and tabular numeric alignment for financial values, token amounts, percentages, timestamps, and hashes in `apps/web/src/features/rewards/RewardsWorkspace.module.css`
- [X] T049 [US1] Wire `/rewards` page to Rewards container in `apps/web/src/app/rewards/page.tsx`

**Checkpoint**: MVP Rewards DataView is independently functional.

---

## Phase 4: User Story 2 - Trace Reward Ownership And Pool Contribution (Priority: P1)

**Goal**: Every reward row clearly shows owner status, source surface, linked entity, pool contribution, coverage, and confidence without pool/time-window inference.

**Independent Test**: Use a wallet with manual deposit rewards and Mellow strategy rewards in the same pool; verify owner/source and pool contribution are distinct and no reward inflates the wrong owner totals.

### Tests for User Story 2

- [X] T050 [P] [US2] Extend reward resolution tests for manual deposit, strategy exposure, governance, v2 fee aggregate, unknown surface, and excluded airdrop cases in `apps/web/src/server/analysis/rewardResolution.test.ts`
- [X] T051 [P] [US2] Add repository tests for owner/source/pool contribution filters and no duplicate contribution totals in `apps/web/src/server/rewards/rewards.repository.test.ts`
- [X] T052 [P] [US2] Add mapper tests for owner/source, linked entity, pool contribution, confidence, and coverage row badges in `apps/web/src/features/rewards/rewards.mappers.test.ts`

### Implementation for User Story 2

- [X] T053 [US2] Harden reward ownership basis and reason-code output in `apps/web/src/server/analysis/rewardResolution.ts`
- [X] T054 [US2] Ensure persisted reward metadata contains source surface, component key, fee attribution basis, external strategy reference, and reason codes in `apps/web/src/server/analysis/enginePersistence.ts`
- [X] T055 [US2] Map reward owner, source surface, linked entity, pool contribution, and counting rule in `apps/web/src/server/rewards/rewards.repository.ts`
- [X] T056 [US2] Implement owner/source/pool contribution service normalization in `apps/web/src/server/rewards/rewards.service.ts`
- [X] T057 [US2] Update reward table row rendering for owner/source, linked entity, pool contribution, coverage, confidence, and transaction action in `apps/web/src/features/rewards/components/RewardsEventsTable.tsx`
- [X] T058 [US2] Implement owner/source and pool contribution visual states without color-only meaning in `apps/web/src/features/rewards/RewardsWorkspace.module.css`
- [X] T059 [US2] Add owner/source, pool contribution, counting rule, and confidence localization keys in `apps/web/src/i18n/locales/en/rewards.json` and `apps/web/src/i18n/locales/es/rewards.json`
- [ ] T060 [US2] Update pool/deposit/strategy reward reconciliation assertions in `apps/web/src/server/analysis/pool-read-models.test.ts`, `apps/web/src/server/analysis/deposit-read-models.test.ts`, and `apps/web/src/server/analysis/strategy-read-models.test.ts`

**Deferred data-quality note**: T060 remains open because current analysis output
contains known classification errors. The Rewards UI must not compensate with
pool/time-window or spam heuristics; reconciliation assertions should be finalized
after Governance and Activity DataViews expose the remaining engine surfaces.

**Checkpoint**: Ownership, source, and pool contribution are independently auditable from rows and totals.

---

## Phase 5: User Story 3 - Inspect Selected Reward Evidence (Priority: P1)

**Goal**: Selecting a reward row updates the selected reward rail with summary, ownership trace, pool contribution, claim details, coverage notes, and unresolved/excluded activity.

**Independent Test**: Select a resolved reward row and verify the rail explains owner evidence, linked pool, counting rule, tx details, coverage, and nearby unresolved/excluded rows without a route transition.

### Tests for User Story 3

- [X] T061 [P] [US3] Add service tests for selected reward defaulting, selected reward lookup, filtered-out selection, and unresolved/excluded rail context in `apps/web/src/server/rewards/rewards.service.test.ts`
- [X] T062 [P] [US3] Add mapper tests for selected reward summary, ownership trace, pool contribution, claim details, coverage notes, and unresolved/excluded activity in `apps/web/src/features/rewards/rewards.mappers.test.ts`
- [X] T063 [P] [US3] Add URL-state tests for selected reward persistence and removal when filters change in `apps/web/src/features/rewards/rewards.urlState.test.ts`

### Implementation for User Story 3

- [X] T064 [US3] Implement selected reward query and default selection behavior in `apps/web/src/server/rewards/rewards.repository.ts`
- [X] T065 [US3] Implement selected reward rail DTO assembly in `apps/web/src/server/rewards/rewards.service.ts`
- [X] T066 [US3] Implement selected reward URL state wiring in `apps/web/src/features/rewards/rewards.urlState.ts`
- [X] T067 [US3] Wire row selection from table to selected reward state in `apps/web/src/features/rewards/Rewards.container.tsx`
- [X] T068 [US3] Implement selected reward summary layout in `apps/web/src/features/rewards/components/SelectedRewardRail.tsx`
- [X] T069 [P] [US3] Implement Ownership Trace section in `apps/web/src/features/rewards/components/RewardOwnershipTrace.tsx`
- [X] T070 [P] [US3] Implement Pool Contribution section in `apps/web/src/features/rewards/components/RewardPoolContribution.tsx`
- [X] T071 [P] [US3] Implement Claim Details section in `apps/web/src/features/rewards/components/RewardClaimDetails.tsx`
- [X] T072 [P] [US3] Implement Coverage Notes section in `apps/web/src/features/rewards/components/RewardCoverageNotes.tsx`
- [X] T073 [P] [US3] Implement Unresolved & Excluded Activity section in `apps/web/src/features/rewards/components/UnresolvedExcludedActivity.tsx`
- [X] T074 [US3] Add selected rail responsive drawer/stacking styles in `apps/web/src/features/rewards/RewardsWorkspace.module.css`
- [X] T075 [US3] Add selected reward rail localization keys in `apps/web/src/i18n/locales/en/rewards.json` and `apps/web/src/i18n/locales/es/rewards.json`

**Checkpoint**: Selected reward explainability works independently.

---

## Phase 6: User Story 4 - Analyze Reward Performance Over Time (Priority: P2)

**Goal**: Users can analyze rewards over time and see estimated reward return only when historical capital coverage supports it.

**Independent Test**: Select date ranges for a wallet with multiple rewards and verify totals, chart buckets, timeline, and estimated return update with full/estimated/partial/unavailable coverage labels.

### Tests for User Story 4

- [X] T076 [P] [US4] Add repository tests for date presets, custom ranges, bucket grouping, missing valuation, and estimated return coverage in `apps/web/src/server/rewards/rewards.repository.test.ts`
- [X] T077 [P] [US4] Add service tests for reward return labeling as full, estimated, partial, or unavailable in `apps/web/src/server/rewards/rewards.service.test.ts`
- [X] T078 [P] [US4] Add mapper tests for chart points, claim markers, coverage percentage, and reward return display in `apps/web/src/features/rewards/rewards.mappers.test.ts`

### Implementation for User Story 4

- [X] T079 [US4] Implement historical capital lookup for reward return calculations in `apps/web/src/server/rewards/rewards.repository.ts`
- [X] T080 [US4] Implement estimated reward return and coverage classification in `apps/web/src/server/rewards/rewards.service.ts`
- [X] T081 [US4] Implement date preset and custom date filter application in `apps/web/src/server/rewards/rewards.route.ts`
- [ ] T082 [US4] Update filter bar date controls for 7d, 30d, 90d, 1y, all, and custom date in `apps/web/src/features/rewards/components/RewardsFiltersBar.tsx`
- [ ] T083 [US4] Update Rewards Over Time panel with return series, reward count axis, claim markers, grouping control, chart/table emphasis control where supported by available data, and partial coverage note in `apps/web/src/features/rewards/components/RewardsOverTimePanel.tsx`
- [ ] T084 [US4] Add reward return and chart localization keys in `apps/web/src/i18n/locales/en/rewards.json`, `apps/web/src/i18n/locales/es/rewards.json`, `apps/web/src/i18n/locales/en/charts.json`, and `apps/web/src/i18n/locales/es/charts.json`

**Deferred UX note**: Rewards now defaults to the historical `all` range and shows
daily bars with return/count series for available data. Custom date entry,
claim-marker polish, grouping controls, and table/chart emphasis controls are
deferred until the broader Governance and Activity DataViews establish the final
analytics control pattern.

**Checkpoint**: Reward performance over time is independently testable.

---

## Phase 7: User Story 5 - Filter And Compare Reward Flows (Priority: P2)

**Goal**: Users can filter rewards by source, pool, strategy, deposit, token, reward type, coverage, resolution, and incoming context while all panels remain synchronized.

**Independent Test**: Arrive from Pool, Deposit, or Strategy detail and verify Rewards opens with a visible removable filter chip; compose filters and verify summaries, charts, distributions, table, and selected rail update together.

### Tests for User Story 5

- [X] T085 [P] [US5] Add route tests for composed filters, available filter options, and pagination metadata in `apps/web/src/server/rewards/rewards.route.test.ts`
- [X] T086 [P] [US5] Add navigation tests for Pool, Deposit, Strategy, and selected reward filter links in `apps/web/src/features/rewards/rewards.navigation.test.ts`
- [X] T087 [P] [US5] Add URL-state tests for composed filters, active chips, clear-all, page, page size, sort, and incoming context in `apps/web/src/features/rewards/rewards.urlState.test.ts`

### Implementation for User Story 5

- [X] T088 [US5] Implement composed filter SQL predicates and available filter option queries in `apps/web/src/server/rewards/rewards.repository.ts`
- [X] T089 [US5] Implement server-side filter normalization, sort validation, and pagination boundaries in `apps/web/src/server/rewards/rewards.route.ts`
- [X] T090 [US5] Implement client filter state transitions, active chips, clear-all, sort, page, and rows-per-page in `apps/web/src/features/rewards/rewards.urlState.ts`
- [X] T091 [US5] Implement Rewards navigation helpers for incoming context and filtered links in `apps/web/src/features/rewards/rewards.navigation.ts`
- [X] T092 [US5] Update `RewardsFiltersBar` with all menu controls, active chips, clear-all, and rows-per-page bindings in `apps/web/src/features/rewards/components/RewardsFiltersBar.tsx`
- [X] T093 [US5] Add filtered-view link actions to source, pool, and token breakdown panels in `apps/web/src/features/rewards/components/RewardsSourceBreakdown.tsx`, `apps/web/src/features/rewards/components/RewardsPoolContributionBreakdown.tsx`, and `apps/web/src/features/rewards/components/RewardsTokenBreakdown.tsx`
- [X] T094 [US5] Add Rewards cross-link actions from Pool surfaces in `apps/web/src/features/pools/components/PoolRelatedLinks.tsx`
- [X] T095 [US5] Add Rewards cross-link actions from Deposit surfaces in `apps/web/src/features/deposits/components/DepositDetailHeader.tsx` and `apps/web/src/features/deposits/components/DepositStrategiesCrossLink.tsx`
- [X] T096 [US5] Add Rewards cross-link actions from Strategy surfaces in `apps/web/src/features/strategies/components/StrategySelectedPanel.tsx` and `apps/web/src/features/strategies/components/StrategyRewardsTable.tsx`
- [X] T097 [US5] Add filter, chip, sort, pagination, and cross-link localization keys in `apps/web/src/i18n/locales/en/rewards.json`, `apps/web/src/i18n/locales/es/rewards.json`, `apps/web/src/i18n/locales/en/common.json`, and `apps/web/src/i18n/locales/es/common.json`

**Checkpoint**: Reward flow filtering and cross-surface context are independently testable.

---

## Phase 8: User Story 6 - Understand Unresolved And Excluded Reward-Shaped Activity (Priority: P2)

**Goal**: Users can see why unresolved and excluded reward-shaped activity does or does not affect totals, and the system keeps those values separate from confident rewards.

**Independent Test**: Use sample events for unknown surface, ambiguous wrapper withdraw, governance claim, and spam-like airdrop; verify reason labels, coverage states, and aggregate exclusion behavior.

### Tests for User Story 6

- [X] T098 [P] [US6] Extend reward resolution tests for unknown reward surface, ambiguous wrapper withdrawal, governance exclusion from LP totals, and spam airdrop exclusion in `apps/web/src/server/analysis/rewardResolution.test.ts`
- [X] T099 [P] [US6] Add service tests for unresolved/excluded KPI value separation and reason-code visibility in `apps/web/src/server/rewards/rewards.service.test.ts`
- [X] T100 [P] [US6] Add mapper tests for unresolved/excluded table rows, KPI cards, rail list, and coverage notes in `apps/web/src/features/rewards/rewards.mappers.test.ts`

### Implementation for User Story 6

- [X] T101 [US6] Ensure reward candidate classification preserves unresolved and excluded reason evidence in `apps/web/src/server/trigger/tasks/phase-rewards.task.ts`
- [X] T102 [US6] Persist unresolved, excluded, ambiguous, and missing-price metadata for display in `apps/web/src/server/analysis/enginePersistence.ts`
- [X] T103 [US6] Implement unresolved/excluded aggregation and reason-code grouping in `apps/web/src/server/rewards/rewards.repository.ts`
- [X] T104 [US6] Implement unresolved/excluded KPI and selected rail list assembly in `apps/web/src/server/rewards/rewards.service.ts`
- [X] T105 [US6] Implement unresolved/excluded KPI styling and text separation in `apps/web/src/features/rewards/components/RewardsKpiStrip.tsx`
- [X] T106 [US6] Implement unresolved/excluded table row treatment in `apps/web/src/features/rewards/components/RewardsEventsTable.tsx`
- [X] T107 [US6] Add unresolved/excluded coverage reason copy in `apps/web/src/i18n/locales/en/coverage.json` and `apps/web/src/i18n/locales/es/coverage.json`
- [X] T108 [US6] Add unresolved/excluded Rewards copy in `apps/web/src/i18n/locales/en/rewards.json` and `apps/web/src/i18n/locales/es/rewards.json`

**Checkpoint**: Unresolved and excluded activity is visible, reasoned, and excluded from confident totals.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, regression, performance, brand, and documentation work across stories.

- [X] T109 [P] Add deterministic rewards regression script in `apps/web/src/server/scripts/analysis-rewards-regression.ts`
- [X] T110 Add reward regression command documentation to `specs/013-rewards-dataview/quickstart.md`
- [ ] T111 [P] Profile `GET /api/rewards` against 2,000-row target and 10,000-row stress fixtures, then add or update database indexes for profiled Rewards filters in `apps/web/src/server/db/schema.ts` and generate migration in `apps/web/src/server/db/migrations/` only if existing indexes miss the plan performance goals
- [X] T112 Update unit test script entries for Rewards tests in `apps/web/package.json`
- [X] T113 Run focused Rewards test command from `specs/013-rewards-dataview/quickstart.md`
- [X] T114 Run full unit suite command from `apps/web/package.json`
- [X] T115 Run typecheck command from `apps/web/package.json`
- [X] T116 Run i18n parity command from `apps/web/package.json`
- [X] T117 Run design-system checks command from `apps/web/package.json`
- [X] T118 Run deterministic reward regression script from `apps/web/src/server/scripts/analysis-rewards-regression.ts`
- [X] T119 Record manual auth-gated UI signoff results for mockup hierarchy, responsive behavior, tabular numeric alignment, and selected-rail reachability in `specs/013-rewards-dataview/quickstart.md`
- [X] T120 Review Rewards implementation for provider-boundary, chain-aware identity, no hardcoded copy, no owner guessing, and no browser automation against `AGENTS.md`

**Staged closure note**: Rewards is accepted as a DataView surface so Governance
and Activity can proceed. T111 remains open until representative 2,000/10,000-row
fixtures are available, and the known phishing/spam airdrop misclassification
`0xca23a1618b416be4f082ae26e59dd9bfcea5e028f00a2cd9f1b8dd95fbff77ea`
is carried into the later analysis-engine classification pass.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup and blocks all user stories.
- **US1 MVP (Phase 3)**: Depends on Foundational.
- **US2 (Phase 4)**: Depends on Foundational; can run after or alongside US1, but table integration is easier after US1 table shell exists.
- **US3 (Phase 5)**: Depends on US1 table shell and foundational selected reward URL state.
- **US4 (Phase 6)**: Depends on US1 API/chart shell.
- **US5 (Phase 7)**: Depends on Foundational; cross-link UI updates can proceed after target surfaces are identified.
- **US6 (Phase 8)**: Depends on Foundational; visible UI integration is easiest after US1 and US3 shells exist.
- **Polish (Phase 9)**: Depends on desired story phases being complete.

### User Story Completion Order

1. **US1 Review All Claimed Rewards**: MVP first screen.
2. **US2 Trace Reward Ownership And Pool Contribution**: hardens financial correctness.
3. **US3 Inspect Selected Reward Evidence**: completes mockup right rail.
4. **US4 Analyze Reward Performance Over Time**: adds estimated return depth.
5. **US5 Filter And Compare Reward Flows**: adds full audit navigation.
6. **US6 Understand Unresolved And Excluded Activity**: completes ambiguity/exclusion experience.

### Independent Test Criteria

- **US1**: Rewards route shows complete mockup-aligned first screen for analyzed wallet.
- **US2**: Manual deposit, strategy, governance, and pool contribution ownership reconcile without cross-contamination.
- **US3**: Selecting a row updates selected reward evidence without route transition.
- **US4**: Date range changes update totals, chart, table, and estimated return coverage.
- **US5**: Filters and incoming links update all panels and expose removable active chips.
- **US6**: Unresolved/excluded cases show reasons and never enter confident totals.

---

## Parallel Opportunities

- Setup component/test scaffolds T005-T008 can run in parallel after T001-T004.
- Foundational tests and locale additions T017-T022 can run in parallel after contracts T009-T016 are underway.
- US1 repository/service/mapper/route tests T026-T029 can run in parallel.
- US1 breakdown panels T043-T045 can run in parallel after aggregation DTOs are stable.
- US2 tests T050-T052 can run in parallel.
- US3 rail section components T069-T073 can run in parallel after selected reward DTO shape is stable.
- US4 tests T076-T078 can run in parallel.
- US5 tests T085-T087 can run in parallel.
- US5 cross-link updates T094-T096 can run in parallel in different feature modules.
- US6 tests T098-T100 can run in parallel.
- Polish checks T113-T117 run sequentially only where local resources require it; otherwise they can be started independently after implementation settles.

## Parallel Example: User Story 3

```text
Task: "Add service tests for selected reward defaulting, selected reward lookup, filtered-out selection, and unresolved/excluded rail context in apps/web/src/server/rewards/rewards.service.test.ts"
Task: "Add mapper tests for selected reward summary, ownership trace, pool contribution, claim details, coverage notes, and unresolved/excluded activity in apps/web/src/features/rewards/rewards.mappers.test.ts"
Task: "Add URL-state tests for selected reward persistence and removal when filters change in apps/web/src/features/rewards/rewards.urlState.test.ts"
```

```text
Task: "Implement Ownership Trace section in apps/web/src/features/rewards/components/RewardOwnershipTrace.tsx"
Task: "Implement Pool Contribution section in apps/web/src/features/rewards/components/RewardPoolContribution.tsx"
Task: "Implement Claim Details section in apps/web/src/features/rewards/components/RewardClaimDetails.tsx"
Task: "Implement Coverage Notes section in apps/web/src/features/rewards/components/RewardCoverageNotes.tsx"
Task: "Implement Unresolved & Excluded Activity section in apps/web/src/features/rewards/components/UnresolvedExcludedActivity.tsx"
```

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1 Setup.
2. Complete Phase 2 Foundational.
3. Complete Phase 3 US1.
4. Validate the DataView opens with KPIs, filters, chart, breakdowns, table, and rail shell.
5. Stop and demo before adding deeper ownership rail and cross-surface filtering.

### Correctness-First Increment

1. Complete US1.
2. Complete US2 before broadening UX polish, because reward ownership and pool contribution are the financial trust boundary.
3. Run reward resolution and read-model reconciliation tests before US3-US6.

### Incremental Delivery

1. US1: basic Rewards DataView.
2. US2: owner/source/pool contribution correctness.
3. US3: selected reward evidence rail.
4. US4: over-time performance and estimated return.
5. US5: full filters and cross-surface navigation.
6. US6: unresolved/excluded audit detail.
7. Polish: regression, i18n, DS, manual signoff.

## Notes

- [P] tasks touch different files and can run in parallel when their prerequisites are met.
- Every user story has tests before implementation because the feature spec and quickstart require focused automated validation.
- Do not add Playwright, browser E2E, or automated browser/a11y tests.
- Any missing evidence must remain unresolved, excluded, partial, or unavailable rather than guessed.
