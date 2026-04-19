# Tasks: Connected Wallet Live Reconstruction Entry Flow

**Input**: Design documents from `/specs/002-connected-wallet-entry-flow/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md, contracts/connected-wallet-entry.openapi.yaml

**Tests**: Contract, integration, and end-to-end browser tests are included because the specification and quickstart require clear connected-wallet, session-reuse, refresh, empty, and failure validation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this belongs to (e.g. `US1`, `US2`, `US3`)
- Every task includes an exact file path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare the browser wallet runtime, local environment, and browser-test scaffolding needed for the connected-wallet flow.

- [ ] T001 Define connected-wallet runtime environment variables in .env.example
- [ ] T002 Configure the Base-only WalletConnect-compatible wallet runtime in src/ui/providers/app-providers.tsx
- [ ] T003 [P] Add browser validation configuration for connected-wallet flows in playwright.config.ts
- [ ] T004 [P] Document local wallet-enabled setup and runtime prerequisites in README.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the shared contracts, session-status plumbing, discovery separation, and state model that block all user stories.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T005 Update connected-wallet API schemas for reused sessions, session status, and reconstruction summaries in src/domains/ledger/contracts/ledger-api-schemas.ts
- [ ] T006 [P] Define the session status read model in src/domains/wallet-session/model/session-status-snapshot.ts
- [ ] T007 [P] Extend session reuse metadata and session lookup helpers in src/domains/wallet-session/repositories/session-repository.ts
- [ ] T008 [P] Extend reconstruction run lookup helpers for latest-run and failure metadata in src/domains/ledger/repositories/reconstruction-run-repository.ts
- [ ] T009 Implement session status aggregation for latest accepted and latest live runs in src/domains/wallet-session/services/session-status-service.ts
- [ ] T010 Implement GET /api/analysis-sessions/{sessionId} session-status routing in app/api/analysis-sessions/[sessionId]/route.ts
- [ ] T011 [P] Implement replay-only candidate discovery for deterministic validation in src/domains/ledger/services/replay-candidate-transaction-service.ts
- [ ] T012 [P] Implement live-only candidate discovery for production runtime use in src/domains/ledger/services/live-candidate-transaction-service.ts
- [ ] T013 Refactor discovery orchestration so production reconstruction uses live discovery only and replay validation uses replay adapters only in src/domains/ledger/services/candidate-transaction-service.ts and src/domains/ledger/services/reconstruction-executor.ts
- [ ] T014 Persist failed reconstruction refresh runs for session polling in src/domains/ledger/services/reconstruction-executor.ts
- [ ] T015 Implement shared connected-wallet analysis state primitives in src/ui/wallet/use-connected-wallet-analysis.ts

**Checkpoint**: Foundation ready. User story work can now proceed in priority order or in parallel.

---

## Phase 3: User Story 1 - Start Analysis From The Connected Wallet (Priority: P1) 🎯 MVP

**Goal**: Let one browser-connected wallet on Base start analysis from its actual connected address with no manual wallet input or fixture-backed production fallback.

**Independent Test**: Open the browser app, connect one wallet, verify wrong-chain blocking on non-Base, switch to Base, start analysis, and confirm the created or resumed session matches the connected wallet address.

### Tests for User Story 1

- [ ] T016 [P] [US1] Add contract coverage for create-or-resume session bootstrap responses in tests/contract/analysis-sessions.contract.test.ts
- [ ] T017 [P] [US1] Add integration coverage for Base-only connected-wallet session bootstrap in tests/integration/connected-wallet-session-flow.test.ts
- [ ] T018 [P] [US1] Add browser-flow coverage for connect, wrong-chain handling, and start-analysis entry in tests/e2e/connected-wallet-entry.spec.ts

### Implementation for User Story 1

- [ ] T019 [US1] Update analysis session bootstrap service to distinguish created versus reused sessions in src/domains/wallet-session/services/analysis-session-service.ts
- [ ] T020 [US1] Update POST /api/analysis-sessions to enforce Base-only connected-wallet bootstrap responses in app/api/analysis-sessions/route.ts
- [ ] T021 [US1] Implement the not-connected, wrong-chain, ready, and session-loading entry flow in src/ui/wallet/connected-wallet-ledger.tsx
- [ ] T022 [US1] Wire the home page to the connected-wallet bootstrap flow in app/page.tsx

**Checkpoint**: User Story 1 should now let a real user connect one wallet, satisfy Base validation, and start analysis from the connected wallet context.

---

## Phase 4: User Story 2 - Reach A Meaningful Live Ledger View (Priority: P2)

**Goal**: Navigate users into a session-backed ledger view that reuses existing sessions, shows the latest accepted result immediately when available, refreshes live reconstruction in the background, and blocks stale wallet or chain mismatches before rendering trusted ledger results.

**Independent Test**: Start analysis for a wallet with supported live activity, land on the session-backed ledger view, re-run analysis for the same wallet, and verify the session is reused while the latest accepted result remains visible with an explicit refresh indicator; then switch to a different wallet or wrong chain and confirm the view guards against rendering the mismatched session as current truth.

### Tests for User Story 2

- [ ] T023 [P] [US2] Add contract coverage for GET /api/analysis-sessions/{sessionId} session-status summaries in tests/contract/analysis-session-status.contract.test.ts
- [ ] T024 [P] [US2] Add integration coverage for session reuse, refresh-with-latest ledger loading, and minimal stale-context guarding in tests/integration/session-refresh-flow.test.ts
- [ ] T025 [P] [US2] Add browser coverage for reused-session navigation, refresh-status banners, and minimal stale wallet or chain guarding in tests/e2e/connected-wallet-refresh.spec.ts

### Implementation for User Story 2

- [ ] T026 [US2] Update reconstruction refresh responses to expose run metadata needed by the ledger flow in app/api/analysis-sessions/[sessionId]/reconstructions/route.ts
- [ ] T027 [US2] Implement session polling, latest-accepted hydration, and refresh transitions in src/ui/wallet/use-connected-wallet-analysis.ts
- [ ] T028 [US2] Implement the session-aware connected-wallet ledger view with a minimal pre-render stale wallet or chain guard in src/ui/wallet/connected-wallet-analysis-view.tsx
- [ ] T029 [US2] Update the ledger route to render the session-aware connected-wallet analysis view and enforce guarded session rendering in app/ledger/page.tsx
- [ ] T030 [US2] Extend canonical projection lookup for reused sessions and latest accepted run hydration in src/domains/ledger/projections/ledger-projection-service.ts

**Checkpoint**: User Story 2 should now deliver a meaningful live ledger experience with session reuse, refresh-with-latest behavior, and minimal stale-context protection before trusted results render.

---

## Phase 5: User Story 3 - Understand Empty, Running, And Failure States (Priority: P3)

**Goal**: Surface running, empty, failure, stale-context, and discarded-safe outcomes clearly without breaking the main inspection flow.

**Independent Test**: Run the flow against wallets that are still reconstructing, have no in-scope activity, fail during live chain access, or no longer match the connected wallet context, and verify each state is clearly distinguished without fixture fallback.

### Tests for User Story 3

- [ ] T031 [P] [US3] Add contract coverage for non-blocking discarded-activity inspection in tests/contract/discarded-activity.contract.test.ts
- [ ] T032 [P] [US3] Add integration coverage for running, empty, failure, and rich stale-context recovery flows in tests/integration/connected-wallet-state-flow.test.ts
- [ ] T033 [P] [US3] Add browser coverage for stale wallet or chain recovery and retry flows in tests/e2e/connected-wallet-states.spec.ts

### Implementation for User Story 3

- [ ] T034 [US3] Implement rich stale-context recovery actions and final state derivation for running, empty, and failure outcomes in src/ui/wallet/use-connected-wallet-analysis.ts
- [ ] T035 [US3] Update the connected-wallet analysis view to render empty, failure, stale-context recovery, and discarded-safe states in src/ui/wallet/connected-wallet-analysis-view.tsx
- [ ] T036 [US3] Surface latest failure metadata without hiding earlier accepted results in src/domains/wallet-session/services/session-status-service.ts
- [ ] T037 [US3] Keep discarded activity reviewable without blocking the main flow in app/api/analysis-sessions/[sessionId]/discarded-activity/route.ts

**Checkpoint**: All three user stories should now be independently functional, including state-correct running, empty, failure, and guarded-stale behavior.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finalize documentation, contract examples, and full-flow validation across all stories.

- [ ] T038 [P] Align connected-wallet API examples with implemented status and refresh fields in specs/002-connected-wallet-entry-flow/contracts/connected-wallet-entry.openapi.yaml
- [ ] T039 [P] Update connected-wallet validation scenarios and execution notes in specs/002-connected-wallet-entry-flow/quickstart.md
- [ ] T040 [P] Update connected-wallet runtime and validation guidance in README.md
- [ ] T041 Record full connected-wallet validation results in specs/002-connected-wallet-entry-flow/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1: Setup**: No dependencies. Can start immediately.
- **Phase 2: Foundational**: Depends on Phase 1 completion. Blocks all user stories.
- **Phase 3: US1**: Depends on Phase 2 completion. This is the MVP slice.
- **Phase 4: US2**: Depends on Phase 2 completion and reuses the session and projection surfaces established by the foundational phase.
- **Phase 5: US3**: Depends on Phase 2 completion and extends the session-aware ledger flow from US2 with state-specific behavior.
- **Phase 6: Polish**: Depends on the user stories selected for delivery being complete.

### User Story Dependencies

- **User Story 1 (P1)**: No dependency on other stories after Foundational completion.
- **User Story 2 (P2)**: Can begin after Foundational completion and becomes meaningful once US1’s bootstrap flow is available.
- **User Story 3 (P3)**: Can begin after Foundational completion and integrates most cleanly once US2’s session-aware ledger view exists.

### Within Each User Story

- Tests should be written before implementation and should fail before the corresponding implementation tasks are considered complete.
- Contract and state-model tasks should land before route wiring and UI integration.
- Session services and repositories should be updated before polling and guarded rendering behavior.
- Route handlers should be updated before browser-flow validation is finalized.

### Parallel Opportunities

- Setup tasks `T003` and `T004` can run in parallel after the runtime direction in `T001` and `T002` is set.
- Foundational model and repository tasks `T006`, `T007`, `T008`, `T011`, and `T012` can run in parallel.
- US1 tests `T016`, `T017`, and `T018` can run in parallel.
- US2 tests `T023`, `T024`, and `T025` can run in parallel.
- US3 tests `T031`, `T032`, and `T033` can run in parallel.
- Polish tasks `T038`, `T039`, and `T040` can run in parallel before `T041` records the final validation result.

---

## Parallel Example: User Story 1

```bash
# Run the US1 validation work in parallel:
Task: "Add contract coverage for create-or-resume session bootstrap responses in tests/contract/analysis-sessions.contract.test.ts"
Task: "Add integration coverage for Base-only connected-wallet session bootstrap in tests/integration/connected-wallet-session-flow.test.ts"
Task: "Add browser-flow coverage for connect, wrong-chain handling, and start-analysis entry in tests/e2e/connected-wallet-entry.spec.ts"
```

---

## Parallel Example: User Story 2

```bash
# Run the US2 validation work in parallel:
Task: "Add contract coverage for GET /api/analysis-sessions/{sessionId} session-status summaries in tests/contract/analysis-session-status.contract.test.ts"
Task: "Add integration coverage for session reuse and refresh-with-latest ledger loading in tests/integration/session-refresh-flow.test.ts"
Task: "Add browser coverage for reused-session navigation and refresh-status banners in tests/e2e/connected-wallet-refresh.spec.ts"
```

---

## Parallel Example: User Story 3

```bash
# Run the US3 validation work in parallel:
Task: "Add contract coverage for non-blocking discarded-activity inspection in tests/contract/discarded-activity.contract.test.ts"
Task: "Add integration coverage for running, empty, failure, and stale-context flows in tests/integration/connected-wallet-state-flow.test.ts"
Task: "Add browser coverage for stale wallet or chain guards and retry flows in tests/e2e/connected-wallet-states.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Stop and validate one-wallet connection, Base enforcement, and connected-wallet session bootstrap before moving on.

### Incremental Delivery

1. Deliver Setup and Foundational work to establish the runtime, contracts, session-status route, and discovery separation.
2. Deliver US1 to make the browser flow usable from one connected wallet on Base.
3. Deliver US2 to make the resulting ledger view session-aware and meaningfully live.
4. Deliver US3 to complete the user-visible state model, stale-context guarding, and non-blocking discarded activity review.
5. Finish with Polish to align documentation, contract examples, and final validation notes.

### Parallel Team Strategy

1. One developer can own contract and repository groundwork while another prepares browser and integration test scaffolding during Foundational work.
2. After Foundational completion, US1 should remain the first delivery lane because it unlocks the first usable browser entry path.
3. Once US1 is stable, US2 and US3 can be developed in parallel because they extend the same session-aware ledger flow in different directions.

---

## Notes

- `[P]` marks tasks that touch different files and can be executed independently.
- `US1`, `US2`, and `US3` map directly to the feature specification user stories.
- The tasks stay strictly within wallet runtime, Base validation, session bootstrap, session-status polling, live refresh, stale guarding, and state correctness.
- No tasks in this file expand into pricing, PnL, attribution, multi-wallet support, notifications, transaction execution, or dashboard-heavy work.
- Fixture-backed replay remains explicitly test-only infrastructure; production runtime tasks route live analysis through live discovery only.