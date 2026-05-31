# Tasks: Governance Engine Processing And Metrics DataView

**Input**: Design documents from `/specs/015-governance-engine-dataview/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are required by the spec and plan. Use unit, route, service, mapper, materializer, integration, deterministic regression, i18n, and design-system checks only. Do not add Playwright, browser E2E, or automated browser/a11y tasks.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the Governance feature/server structure and shared scaffolding.

- [X] T001 Create Governance feature module directories in apps/web/src/features/governance and apps/web/src/features/governance/components
- [X] T002 Create Governance server module directory in apps/web/src/server/governance
- [X] T003 Create Governance route directories in apps/web/src/app/governance and apps/web/src/app/api/governance
- [X] T004 Create Governance analysis files in apps/web/src/server/analysis/governance-classification.ts and apps/web/src/server/analysis/governance-read-models.ts
- [X] T005 Create Governance task/script placeholders in apps/web/src/server/trigger/tasks/phase-governance.task.ts and apps/web/src/server/scripts/analysis-governance-regression.ts
- [X] T006 [P] Create Governance feature barrel export in apps/web/src/features/governance/index.ts
- [X] T007 [P] Create Governance workspace stylesheet in apps/web/src/features/governance/GovernanceWorkspace.module.css using existing DataView CSS patterns

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared contracts, persistence, query identity, i18n, and validation primitives that block all user stories.

**CRITICAL**: No user story work can begin until this phase is complete.

- [X] T008 Define Governance API/server response contracts in apps/web/src/server/governance/governance.contract.ts
- [X] T009 [P] Define Governance server/domain types in apps/web/src/server/governance/governance.types.ts
- [X] T010 [P] Define Governance client view types in apps/web/src/features/governance/governance.types.ts
- [X] T011 Add Governance read-model tables and indexes in apps/web/src/server/db/schema.ts
- [X] T012 Add Drizzle migration for Governance read-model tables in apps/web/src/server/db/migrations/0013_governance_read_models.sql
- [X] T013 Update DB purge support for Governance read models in apps/web/src/server/scripts/db-purge.ts
- [X] T014 Add Governance filter-aware query key in apps/web/src/queries/keys.ts
- [X] T015 Update Governance query hook to use typed query options in apps/web/src/queries/hooks.ts
- [X] T016 [P] Implement Governance URL state parser/serializer in apps/web/src/features/governance/governance.urlState.ts
- [X] T017 [P] Implement Governance URL validation helpers in apps/web/src/features/governance/governance.validation.ts
- [X] T018 [P] Implement Governance navigation helpers in apps/web/src/features/governance/governance.navigation.ts
- [X] T019 Seed Governance i18n namespace keys in apps/web/src/i18n/locales/en/governance.json
- [X] T020 Seed Governance Spanish i18n namespace keys in apps/web/src/i18n/locales/es/governance.json
- [X] T021 Update shared coverage/error/navigation copy for Governance in apps/web/src/i18n/locales/en/coverage.json, apps/web/src/i18n/locales/es/coverage.json, apps/web/src/i18n/locales/en/errors.json, apps/web/src/i18n/locales/es/errors.json, apps/web/src/i18n/locales/en/navigation.json, and apps/web/src/i18n/locales/es/navigation.json
- [X] T022 [P] Add Governance filter validation tests in apps/web/src/features/governance/governance.validation.test.ts
- [X] T023 [P] Add Governance URL state tests in apps/web/src/features/governance/governance.urlState.test.ts
- [X] T024 [P] Add Governance navigation helper tests in apps/web/src/features/governance/governance.navigation.test.ts

**Checkpoint**: Foundation ready - user story implementation can now begin.

---

## Phase 3: User Story 1 - Reconstruct Governance Activity (Priority: P1) MVP

**Goal**: Classify and persist governance activity from explicit protocol evidence so Governance has trustworthy engine output.

**Independent Test**: Use a wallet fixture containing known veAERO lock, lock increase/extend, vote/reset, relay, and governance reward claim transactions. After analysis, supported transactions appear as governance activity with chain-scoped identity, action, timestamp, coverage/confidence, and evidence; router-only or unrelated transfers do not become Governance.

### Tests for User Story 1

- [X] T025 [P] [US1] Add governance protocol surface detection tests in apps/web/src/server/analysis/governance-classification.test.ts
- [X] T026 [P] [US1] Add governance event materialization tests in apps/web/src/server/analysis/governance-read-models.test.ts
- [X] T027 [P] [US1] Add engine persistence governance event tests in apps/web/src/server/analysis/enginePersistence.test.ts
- [X] T028 [P] [US1] Add governance reward ownership regression tests in apps/web/src/server/analysis/rewardResolution.test.ts
- [X] T029 [P] [US1] Add phase-governance task tests in apps/web/src/server/trigger/tasks/phase-governance.test.ts
- [X] T030 [P] [US1] Add deterministic governance regression script fixture assertions in apps/web/src/server/scripts/analysis-governance-regression.ts

### Implementation for User Story 1

- [X] T031 [US1] Implement explicit governance protocol surface classifier in apps/web/src/server/analysis/governance-classification.ts
- [X] T032 [US1] Extend transaction classification signals for governance surfaces in apps/web/src/server/analysis/txClassification.ts
- [X] T033 [US1] Materialize GovernanceEvent rows from ledger/reward/provider evidence in apps/web/src/server/analysis/governance-read-models.ts
- [X] T034 [US1] Persist governance events and read-model rows during engine finalization in apps/web/src/server/analysis/enginePersistence.ts
- [X] T035 [US1] Implement background governance materialization task in apps/web/src/server/trigger/tasks/phase-governance.task.ts
- [X] T036 [US1] Wire phase-governance into the analysis workflow in apps/web/src/server/trigger/tasks/analysis-run.task.ts
- [X] T037 [US1] Preserve governance reward ownership separate from deposit/strategy/pool ownership in apps/web/src/server/analysis/rewardResolution.ts
- [X] T038 [US1] Add governance raw evidence references to persisted metadata in apps/web/src/server/analysis/enginePersistence.ts
- [X] T039 [US1] Implement rebuild utility for Governance read models in apps/web/src/server/scripts/rebuild-governance-read-models.ts
- [X] T040 [US1] Complete deterministic governance regression script in apps/web/src/server/scripts/analysis-governance-regression.ts
- [X] T041 [US1] Add package script for governance regression in apps/web/package.json

**Checkpoint**: User Story 1 independently classifies and persists Governance activity from explicit evidence.

---

## Phase 4: User Story 2 - Inspect Governance Metrics (Priority: P1)

**Goal**: Deliver the dashboard-first Governance first screen with KPI strip, persistent lock panel, compact epoch timeline, governance rewards list, reward-type breakdown, and selected-detail panel.

**Independent Test**: Open Governance after historical analysis for a wallet with governance activity. The first screen shows all mandatory surfaces, coverage/confidence, and no generic table-first layout.

### Tests for User Story 2

- [X] T042 [P] [US2] Add Governance API route contract tests in apps/web/src/server/governance/governance.route.test.ts
- [X] T043 [P] [US2] Add Governance service summary/readiness tests in apps/web/src/server/governance/governance.service.test.ts
- [X] T044 [P] [US2] Add Governance repository DB-only query tests in apps/web/src/server/governance/governance.repository.test.ts
- [X] T045 [P] [US2] Add Governance feature mapper tests for KPI/lock/timeline/rewards/breakdown in apps/web/src/features/governance/governance.mappers.test.ts

### Implementation for User Story 2

- [X] T046 [US2] Implement Governance repository DB reads in apps/web/src/server/governance/governance.repository.ts
- [X] T047 [US2] Implement Governance service assembling GovernanceViewModel in apps/web/src/server/governance/governance.service.ts
- [X] T048 [US2] Implement Governance route validation and locked/ready responses in apps/web/src/server/governance/governance.route.ts
- [X] T049 [US2] Implement Next API route wrapper in apps/web/src/app/api/governance/route.ts
- [X] T050 [US2] Implement Governance query options in apps/web/src/features/governance/governance.queries.ts
- [X] T051 [US2] Implement Governance data mappers in apps/web/src/features/governance/governance.mappers.ts
- [X] T052 [US2] Implement Governance page shell in apps/web/src/app/governance/page.tsx
- [X] T053 [US2] Implement Governance container data/loading/locked handling in apps/web/src/features/governance/Governance.container.tsx
- [X] T054 [US2] Implement Governance component first-screen layout in apps/web/src/features/governance/Governance.component.tsx
- [X] T055 [US2] Implement KPI strip using CabImpactMetricCard in apps/web/src/features/governance/components/GovernanceKpiStrip.tsx
- [X] T056 [US2] Implement persistent lock status panel in apps/web/src/features/governance/components/GovernanceLockPanel.tsx
- [X] T057 [US2] Implement compact epoch timeline in apps/web/src/features/governance/components/GovernanceEpochTimeline.tsx
- [X] T058 [US2] Implement governance rewards table with shared DataTable in apps/web/src/features/governance/components/GovernanceRewardsTable.tsx
- [X] T059 [US2] Implement reward-type/value breakdown with DS chart primitives in apps/web/src/features/governance/components/GovernanceRewardBreakdown.tsx
- [X] T060 [US2] Implement selected-detail rail shell in apps/web/src/features/governance/components/SelectedGovernanceRail.tsx
- [X] T061 [US2] Implement Governance empty/locked/partial states in apps/web/src/features/governance/components/GovernanceEmptyState.tsx
- [X] T062 [US2] Enable Governance navigation as analysis-gated in apps/web/src/features/overview/overview.mappers.ts

**Checkpoint**: User Story 2 renders the mandatory Governance control surface from DB-backed data.

---

## Phase 5: User Story 3 - Explain Governance Rewards Without Double Counting (Priority: P2)

**Goal**: Reconcile Governance rewards with Rewards and Pools while preventing duplicate totals and fabricated pool associations.

**Independent Test**: Use a fixture with bribe/fee/rebase claims where some rewards have explicit pool association and others do not. Governance, Rewards, and Pools reconcile to the same reward identities; unassociated rewards remain visible and partial.

### Tests for User Story 3

- [X] T063 [P] [US3] Add governance reward reconciliation tests in apps/web/src/server/governance/governance.service.test.ts
- [X] T064 [P] [US3] Add Rewards source/link regression tests in apps/web/src/server/rewards/rewards.service.test.ts
- [X] T065 [P] [US3] Add Pools governance reward contribution tests in apps/web/src/server/analysis/pool-read-models.test.ts
- [X] T066 [P] [US3] Add Governance reward row mapper tests in apps/web/src/features/governance/governance.mappers.test.ts

### Implementation for User Story 3

- [X] T067 [US3] Materialize GovernanceReward rows with rewardEventId identity in apps/web/src/server/analysis/governance-read-models.ts
- [X] T068 [US3] Implement explicit pool association rules for governance rewards in apps/web/src/server/analysis/governance-read-models.ts
- [X] T069 [US3] Exclude unassociated governance rewards from pool contribution totals in apps/web/src/server/analysis/pool-read-models.ts
- [X] T070 [US3] Add Governance links and source filters to Rewards server responses in apps/web/src/server/rewards/rewards.repository.ts
- [X] T071 [US3] Add Governance cross-link behavior to Rewards UI mappers/navigation in apps/web/src/features/rewards/rewards.mappers.ts and apps/web/src/features/rewards/rewards.navigation.ts
- [X] T072 [US3] Add explicit governance reward links from Pools when pool association exists in apps/web/src/features/pools/PoolDetail.component.tsx and apps/web/src/features/pools/pools.mappers.ts
- [X] T073 [US3] Surface reward double-counting notes in Governance selected detail in apps/web/src/features/governance/components/SelectedGovernanceRail.tsx

**Checkpoint**: User Story 3 reconciles Governance rewards with Rewards/Pools without double counting.

---

## Phase 6: User Story 4 - Investigate Evidence And Gaps (Priority: P2)

**Goal**: Make every supported, partial, unresolved, unsupported, and excluded Governance row inspectable through selected-detail evidence.

**Independent Test**: Select supported, partial, unresolved, and unsupported governance rows. The detail panel updates without full page refresh and explains action, tx, protocol surface, token movement, value effect, context, evidence, links, and coverage gaps.

### Tests for User Story 4

- [X] T074 [P] [US4] Add selected Governance detail service tests in apps/web/src/server/governance/governance.service.test.ts
- [X] T075 [P] [US4] Add selected Governance detail mapper tests in apps/web/src/features/governance/governance.mappers.test.ts
- [X] T076 [P] [US4] Add Activity linked Governance entity tests in apps/web/src/server/activity/activity.repository.test.ts
- [X] T077 [P] [US4] Add partial/unsupported/excluded detail regression cases in apps/web/src/server/scripts/analysis-governance-regression.ts

### Implementation for User Story 4

- [X] T078 [US4] Materialize GovernanceSelectedDetail payloads in apps/web/src/server/analysis/governance-read-models.ts
- [X] T079 [US4] Add selected detail retrieval to Governance repository in apps/web/src/server/governance/governance.repository.ts
- [X] T080 [US4] Map evidence refs, missing evidence, and coverage notes in Governance service in apps/web/src/server/governance/governance.service.ts
- [X] T081 [US4] Implement selected-detail action summary and transaction sections in apps/web/src/features/governance/components/SelectedGovernanceRail.tsx
- [X] T082 [US4] Implement selected-detail token movement and value effect sections in apps/web/src/features/governance/components/SelectedGovernanceRail.tsx
- [X] T083 [US4] Implement selected-detail epoch/vote/pool context sections in apps/web/src/features/governance/components/SelectedGovernanceRail.tsx
- [X] T084 [US4] Implement selected-detail classification evidence and source evidence sections in apps/web/src/features/governance/components/SelectedGovernanceRail.tsx
- [X] T085 [US4] Implement Governance coverage notes component in apps/web/src/features/governance/components/GovernanceCoverageNotes.tsx
- [X] T086 [US4] Add Governance linked entity support to Activity repository/service responses in apps/web/src/server/activity/activity.repository.ts
- [X] T087 [US4] Add Activity navigation links for Governance context in apps/web/src/features/activity/activity.navigation.ts

**Checkpoint**: User Story 4 exposes evidence and uncertainty without hiding partial/unresolved rows.

---

## Phase 7: User Story 5 - Filter And Share Governance History (Priority: P3)

**Goal**: Support filterable, pageable, shareable Governance history without full-page reload behavior or broken empty states.

**Independent Test**: Apply filters that produce populated and empty results. The URL is shareable, active chips are visible, selected detail behaves predictably, and layout remains stable.

### Tests for User Story 5

- [ ] T088 [P] [US5] Add Governance URL state filter/share tests in apps/web/src/features/governance/governance.urlState.test.ts
- [ ] T089 [P] [US5] Add Governance service filter/pagination tests in apps/web/src/server/governance/governance.service.test.ts
- [ ] T090 [P] [US5] Add Governance route invalid filter tests in apps/web/src/server/governance/governance.route.test.ts
- [ ] T091 [P] [US5] Add no-results mapper tests in apps/web/src/features/governance/governance.mappers.test.ts

### Implementation for User Story 5

- [ ] T092 [US5] Implement Governance filters bar in apps/web/src/features/governance/components/GovernanceFiltersBar.tsx
- [ ] T093 [US5] Wire filter/search/sort/page/pageSize state into Governance container in apps/web/src/features/governance/Governance.container.tsx
- [ ] T094 [US5] Apply Governance filters and pagination in repository queries in apps/web/src/server/governance/governance.repository.ts
- [ ] T095 [US5] Preserve selected detail or fallback selection after filters in apps/web/src/server/governance/governance.service.ts
- [ ] T096 [US5] Add active filter chips and clear-all behavior in apps/web/src/features/governance/Governance.component.tsx
- [ ] T097 [US5] Add no-results and selected-unavailable states in apps/web/src/features/governance/components/GovernanceEmptyState.tsx
- [ ] T098 [US5] Add Governance inbound links from Activity/Rewards/Pools using explicit IDs in apps/web/src/features/activity/activity.navigation.ts, apps/web/src/features/rewards/rewards.navigation.ts, and apps/web/src/features/pools/PoolDetail.component.tsx

**Checkpoint**: User Story 5 makes Governance filterable/shareable while preserving layout and evidence boundaries.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Validate constitution gates, performance, copy, docs, and manual signoff.

- [ ] T099 [P] Add Governance quickstart validation notes after implementation in specs/015-governance-engine-dataview/quickstart.md
- [ ] T100 [P] Add product progress update for Governance implementation in docs/informe-avance-product-spec-gaps.md
- [ ] T101 Run unit suite and fix failures in affected files under apps/web/src
- [ ] T102 Run typecheck and fix failures in affected files under apps/web/src
- [ ] T103 Run i18n parity check and fix missing keys in apps/web/src/i18n/locales
- [ ] T104 Run design-system check and replace feature-local UI drift in apps/web/src/features/governance
- [ ] T105 Run governance regression and fix classification/reconciliation drift in apps/web/src/server/scripts/analysis-governance-regression.ts
- [ ] T106 Profile Governance repository queries against local DB and add SQL indexes in apps/web/src/server/db/schema.ts only if needed
- [ ] T107 Verify request-time Governance route has no Moralis/Alchemy/RPC/explorer calls in apps/web/src/server/governance and apps/web/src/app/api/governance/route.ts
- [ ] T108 Record manual auth-gated UI signoff against Governance mockup direction in specs/015-governance-engine-dataview/quickstart.md
- [ ] T109 Review for hardcoded user-facing Governance copy and replace with i18next keys in apps/web/src/features/governance
- [ ] T110 Review chain-aware identity usage across Governance API/query/link paths in apps/web/src/server/governance, apps/web/src/features/governance, and apps/web/src/queries

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup completion; blocks all user stories.
- **US1 Reconstruct Governance Activity (Phase 3)**: Depends on Foundational; MVP and prerequisite for trustworthy DataView data.
- **US2 Inspect Governance Metrics (Phase 4)**: Depends on Foundational and benefits from US1 engine output; can use deterministic fixtures while US1 stabilizes.
- **US3 Explain Governance Rewards Without Double Counting (Phase 5)**: Depends on US1 reward/event identity and US2 row contracts.
- **US4 Investigate Evidence And Gaps (Phase 6)**: Depends on US1 evidence materialization and US2 selected-detail shell.
- **US5 Filter And Share Governance History (Phase 7)**: Depends on US2 route/container structure and can proceed after base view model exists.
- **Polish (Phase 8)**: Depends on all desired stories being complete.

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational; MVP.
- **US2 (P1)**: Can start after Foundational, but final validation depends on US1 materialized data.
- **US3 (P2)**: Depends on US1 and US2 reward row contracts.
- **US4 (P2)**: Depends on US1 evidence and US2 rail shell.
- **US5 (P3)**: Depends on US2 API/UI shell.

### Within Each User Story

- Tests first and expected to fail before implementation.
- Data/materialization before repository/service.
- Repository/service before route.
- Route/query before container/component.
- Mappers before final UI composition.
- i18n keys before shipping user-facing copy.

---

## Parallel Execution Examples

### User Story 1

```text
Task: "T025 Add governance protocol surface detection tests in apps/web/src/server/analysis/governance-classification.test.ts"
Task: "T026 Add governance event materialization tests in apps/web/src/server/analysis/governance-read-models.test.ts"
Task: "T028 Add governance reward ownership regression tests in apps/web/src/server/analysis/rewardResolution.test.ts"
```

### User Story 2

```text
Task: "T042 Add Governance API route contract tests in apps/web/src/server/governance/governance.route.test.ts"
Task: "T043 Add Governance service summary/readiness tests in apps/web/src/server/governance/governance.service.test.ts"
Task: "T045 Add Governance feature mapper tests for KPI/lock/timeline/rewards/breakdown in apps/web/src/features/governance/governance.mappers.test.ts"
```

### User Story 3

```text
Task: "T064 Add Rewards source/link regression tests in apps/web/src/server/rewards/rewards.service.test.ts"
Task: "T065 Add Pools governance reward contribution tests in apps/web/src/server/analysis/pool-read-models.test.ts"
Task: "T066 Add Governance reward row mapper tests in apps/web/src/features/governance/governance.mappers.test.ts"
```

### User Story 4

```text
Task: "T074 Add selected Governance detail service tests in apps/web/src/server/governance/governance.service.test.ts"
Task: "T075 Add selected Governance detail mapper tests in apps/web/src/features/governance/governance.mappers.test.ts"
Task: "T076 Add Activity linked Governance entity tests in apps/web/src/server/activity/activity.repository.test.ts"
```

### User Story 5

```text
Task: "T088 Add Governance URL state filter/share tests in apps/web/src/features/governance/governance.urlState.test.ts"
Task: "T089 Add Governance service filter/pagination tests in apps/web/src/server/governance/governance.service.test.ts"
Task: "T090 Add Governance route invalid filter tests in apps/web/src/server/governance/governance.route.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 setup.
2. Complete Phase 2 foundational contracts/persistence/i18n/query identity.
3. Complete Phase 3 US1 engine classification and governance materialization.
4. Validate with governance classification/materializer tests and deterministic regression.
5. Stop before UI if Governance data is still untrustworthy.

### Incremental Delivery

1. US1: Governance engine/materialization produces evidence-backed rows.
2. US2: Governance first-screen DataView consumes DB-backed view model.
3. US3: Governance rewards reconcile with Rewards/Pools without double counting.
4. US4: Detail rail exposes evidence and gaps.
5. US5: Filters/shareability polish investigation workflow.
6. Polish: typecheck, unit, i18n, DS, regression, manual signoff.

### Parallel Team Strategy

After Phase 2:

- Engine/materialization owner: US1.
- UI/server read owner: US2.
- Reconciliation owner: US3.
- Evidence/detail owner: US4 after selected-detail shell exists.
- URL/filter owner: US5 after route/container shape exists.

## Notes

- Keep Governance read-only.
- Keep `/api/governance` DB-only.
- Do not create provider calls in request paths.
- Do not fabricate pool or epoch associations.
- Do not add browser automation tasks.
- Use DS primitives before creating feature-local UI.
- Preserve i18next and centralized formatter rules.
