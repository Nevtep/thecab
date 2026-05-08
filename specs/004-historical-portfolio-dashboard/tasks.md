# Tasks: Historical Portfolio Dashboard

**Input**: Design documents from /specs/004-historical-portfolio-dashboard/
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/dashboard-api.openapi.yaml, quickstart.md

**Tests**: Include contract, integration, and e2e validation derived from quickstart scenarios and the dashboard OpenAPI contract.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare dashboard contract alignment, route scaffolding, and test scaffolding.

- [X] T001 Align dashboard response schemas with OpenAPI in src/domains/accounting/contracts/accounting-api-schemas.ts
- [X] T002 [P] Create dashboard route scaffold for pool list in app/api/analysis-sessions/[sessionId]/dashboard/pools/route.ts
- [X] T003 [P] Create dashboard route scaffold for pool detail in app/api/analysis-sessions/[sessionId]/dashboard/pools/[poolId]/route.ts
- [X] T004 [P] Create dashboard route scaffold for timeline markers in app/api/analysis-sessions/[sessionId]/dashboard/timeline/route.ts
- [X] T005 [P] Add route test helpers for dashboard routes in tests/helpers/route-test-utils.ts
- [X] T006 Add dashboard contract test stubs for new endpoints in tests/contract/dashboard-pools.contract.test.ts
- [X] T007 [P] Add dashboard contract test stubs for timeline endpoint in tests/contract/dashboard-timeline.contract.test.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build shared read-model infrastructure required by all dashboard stories.

**Critical**: No user story work starts before this phase is complete.

- [X] T008 Implement accepted-run anchor lookup for dashboard reads in src/domains/ledger/repositories/wallet-discovery-checkpoint-repository.ts
- [X] T009 [P] Implement dashboard display-state resolver with loading/partial/empty/failure/ready mapping in src/domains/accounting/services/dashboard-state-resolver.ts
- [X] T010 [P] Implement dashboard session read-model composer for DashboardSessionView in src/domains/accounting/services/dashboard-session-view-service.ts
- [X] T011 [P] Implement reusable portfolio reconciliation utility for pool-first rollups in src/domains/accounting/services/dashboard-reconciliation-service.ts
- [X] T012 [P] Implement reusable discarded-activity separation helper for trusted totals in src/domains/accounting/services/dashboard-trust-boundary-service.ts
- [X] T013 Implement dashboard composition orchestrator anchored to accepted canonical/pricing/accounting outputs in src/domains/accounting/services/dashboard-composition-service.ts
- [X] T014 Wire shared dashboard composition service into existing accounting bootstrap route in app/api/analysis-sessions/[sessionId]/accounting/bootstrap/route.ts
- [X] T015 Add foundational unit tests for state resolver and composition determinism in tests/unit/dashboard-state-resolver.test.ts
- [X] T016 [P] Add foundational unit tests for reconciliation and trust-boundary helpers in tests/unit/dashboard-reconciliation-service.test.ts

**Checkpoint**: Foundation ready, user stories can proceed.

---

## Phase 3: User Story 1 - Immediate Portfolio Overview (Priority: P1) MVP

**Goal**: Deliver first meaningful dashboard load with explicit states and current portfolio overview cards.

**Independent Test**: Create or reuse a session, open dashboard, and verify overview values plus explicit state handling in one flow.

### Tests for User Story 1

- [X] T017 [P] [US1] Add contract assertions for bootstrap state transitions and overview payload in tests/contract/accounting-bootstrap.contract.test.ts
- [X] T018 [P] [US1] Add integration test for accepted-run anchored first view and warm-up fallback in tests/integration/accounting-portfolio-flow.test.ts
- [X] T019 [P] [US1] Add e2e test for first meaningful dashboard load and explicit display states in tests/e2e/accounting-portfolio.spec.ts

### Implementation for User Story 1

- [X] T020 [US1] Implement portfolio overview card mapper including idle/residual balances in src/domains/accounting/services/accounting-bootstrap-service.ts
- [X] T021 [US1] Implement explicit response-path state mapping for bootstrap route in app/api/analysis-sessions/[sessionId]/accounting/bootstrap/route.ts
- [X] T022 [US1] Enforce accepted-run-only read path for bootstrap composition in src/domains/accounting/services/dashboard-composition-service.ts
- [X] T023 [US1] Update connected wallet analysis query orchestration for progressive bootstrap enrichment in src/ui/wallet/use-connected-wallet-analysis.ts
- [X] T024 [US1] Render explicit loading/partial/empty/failure/ready dashboard states in src/ui/wallet/connected-wallet-analysis-view.tsx
- [X] T025 [US1] Add failure recovery and retry affordance wiring for dashboard bootstrap fetch in src/ui/wallet/connected-wallet-analysis-view.tsx

**Checkpoint**: US1 provides a meaningful and explicit first-view dashboard experience.

---

## Phase 4: User Story 2 - Historical Portfolio Evolution (Priority: P2)

**Goal**: Deliver historical portfolio value series and event markers with explicit partial-state handling.

**Independent Test**: Load a session with accepted data and verify ordered historical series and timeline markers.

### Tests for User Story 2

- [X] T026 [P] [US2] Add contract assertions for time-series payload shape and acceptedRunId anchoring in tests/contract/accounting-time-series.contract.test.ts
- [X] T027 [P] [US2] Add contract assertions for timeline marker payload in tests/contract/dashboard-timeline.contract.test.ts
- [X] T028 [P] [US2] Add integration test for partial historical coverage behavior in tests/integration/accounting-explainability-flow.test.ts
- [X] T029 [P] [US2] Add e2e historical chart and marker rendering scenario in tests/e2e/accounting-explainability.spec.ts

### Implementation for User Story 2

- [X] T030 [US2] Implement true portfolio historical value series builder (chartable series, not event list) in src/domains/accounting/services/accounting-time-series-service.ts
- [X] T031 [US2] Implement pool deployed-capital historical series builder with flow direction semantics in src/domains/accounting/services/accounting-time-series-service.ts
- [X] T032 [US2] Implement timeline marker extraction for claim/lock/vote/rebalance/close/reopen actions in src/domains/accounting/services/accounting-time-series-service.ts
- [X] T033 [US2] Enforce explicit partial-state signaling for sparse historical windows in app/api/analysis-sessions/[sessionId]/accounting/time-series/route.ts
- [X] T034 [US2] Implement timeline route using accepted-run anchored markers in app/api/analysis-sessions/[sessionId]/dashboard/timeline/route.ts
- [X] T035 [US2] Render historical portfolio and pool series plus markers in connected wallet dashboard view in src/ui/wallet/connected-wallet-analysis-view.tsx

**Checkpoint**: US2 provides trusted historical evolution with clear partial/freshness semantics.

---

## Phase 5: User Story 3 - Pool and Strategy Drilldowns (Priority: P3)

**Goal**: Deliver pool and strategy drilldowns with reconciliation and rebalance migration visibility.

**Independent Test**: Open pool list, pool detail, and strategy detail; verify reconciliation and rebalance visibility.

### Tests for User Story 3

- [X] T036 [P] [US3] Add contract assertions for pool list and pool detail payloads in tests/contract/dashboard-pools.contract.test.ts
- [X] T037 [P] [US3] Add contract assertions for rebalance flow response confidence and explanation fields in tests/contract/accounting-rebalance-flows.contract.test.ts
- [X] T038 [P] [US3] Add integration test for pool-first reconciliation and strategy separation in tests/integration/accounting-breakdown-flow.test.ts
- [X] T039 [P] [US3] Add e2e drilldown test for pool and strategy views with rebalance migration visibility in tests/e2e/accounting-portfolio.spec.ts

### Implementation for User Story 3

- [X] T040 [US3] Implement pool dashboard summary composition endpoint in app/api/analysis-sessions/[sessionId]/dashboard/pools/route.ts
- [X] T041 [US3] Implement pool detail composition endpoint with strategy breakdown in app/api/analysis-sessions/[sessionId]/dashboard/pools/[poolId]/route.ts
- [X] T042 [US3] Implement strategy summary mapper preserving manual vs mellow_auto isolation in src/domains/accounting/services/accounting-breakdown-service.ts
- [X] T043 [US3] Implement rebalance flow link mapper with heuristic confidence and explanation in src/domains/accounting/services/accounting-rebalance-flow-service.ts
- [X] T044 [US3] Enforce reconciliation checks from portfolio totals to pools/strategies plus idle-residual rows in src/domains/accounting/services/dashboard-reconciliation-service.ts
- [X] T045 [US3] Render pool list, pool detail, strategy rows, and rebalance-link explainability in src/ui/wallet/connected-wallet-analysis-view.tsx

**Checkpoint**: US3 provides pool-first drilldowns with explicit rebalance and reconciliation behavior.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final hardening across user stories.

- [X] T046 [P] Document dashboard API/state behavior and feature scope boundaries in README.md
- [X] T047 [P] Add regression unit tests for no-accepted-run, discarded-activity, and mixed-freshness edge cases in tests/unit/dashboard-composition-service.test.ts
- [X] T048 Run quickstart validation scenarios for historical dashboard in specs/004-historical-portfolio-dashboard/quickstart.md
- [X] T049 Execute full dashboard contract test pass and record updates in specs/004-historical-portfolio-dashboard/quickstart.md
- [X] T050 Execute dashboard integration/e2e validation pass and record outcomes in specs/004-historical-portfolio-dashboard/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1): can start immediately.
- Foundational (Phase 2): depends on Setup completion and blocks all user stories.
- User Story phases (Phase 3-5): depend on Foundational completion.
- Polish (Phase 6): depends on completion of selected user stories.

### User Story Dependencies

- US1 (P1): starts after Foundational and defines MVP.
- US2 (P2): starts after Foundational; can run in parallel with US3 if staffed.
- US3 (P3): starts after Foundational; relies on shared reconciliation utilities but remains independently testable.

### Within Each User Story

- Contract/integration/e2e tests first (expected to fail before implementation).
- Service composition before route finalization.
- Route outputs before UI wiring.
- Story-level validation before moving to next priority.

## Parallel Opportunities

- Phase 1 scaffolding tasks marked [P] can be executed in parallel.
- Phase 2 helper services and foundational tests marked [P] can be executed in parallel.
- In each user story, test tasks marked [P] can run in parallel.
- US2 and US3 can run in parallel after Foundational if team capacity allows.

## Parallel Example: User Story 1

- T017, T018, and T019 can run in parallel.
- T023 can run in parallel with T020-T022 once T013 is complete.

## Parallel Example: User Story 2

- T026, T027, T028, and T029 can run in parallel.
- T031 and T032 can run in parallel after T030 service baseline is in place.

## Parallel Example: User Story 3

- T036, T037, T038, and T039 can run in parallel.
- T040 and T042 can run in parallel, then T041 and T044 finalize reconciliation behavior.

## Implementation Strategy

### MVP First (US1)

1. Complete Phase 1 Setup.
2. Complete Phase 2 Foundational.
3. Complete Phase 3 US1.
4. Validate US1 independently before expanding scope.

### Incremental Delivery

1. Deliver US1 for first meaningful dashboard load.
2. Add US2 for historical charting and markers.
3. Add US3 for drilldowns and rebalance visibility.
4. Finish with Phase 6 polish and full validation.
