# Tasks: Canonical Investment Ledger

**Input**: Design documents from `/specs/001-canonical-investment-ledger/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md, contracts/ledger-api.openapi.yaml

**Tests**: Replay, contract, integration, and end-to-end tests are included because deterministic reconstruction and contract validation are explicitly required by the plan and quickstart.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g. `US1`, `US2`, `US3`)
- Every task includes an exact file path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Bootstrap the Next.js and TypeScript application, development tooling, and environment structure required by the implementation plan.

- [x] T001 Create the Next.js 15 and TypeScript workspace scaffold in package.json
- [x] T002 Configure TypeScript, Next.js, and Node.js project settings in tsconfig.json
- [x] T003 [P] Configure Next.js runtime and environment handling in next.config.ts
- [x] T004 [P] Define required application and chain environment variables in .env.example
- [x] T005 [P] Create the base application shell and layout in app/layout.tsx
- [x] T006 [P] Configure Drizzle ORM and PostgreSQL connection bootstrap in src/infrastructure/db/client.ts
- [x] T007 [P] Configure Base RPC and trace-capable viem clients in src/infrastructure/chain/clients.ts
- [x] T008 Add test runner, contract test, replay test, and Playwright script entries in package.json

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the shared persistence, orchestration, contract, and ruleset foundations that block all user stories.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T009 Create the append-only ledger schema migration for analysis sessions, reconstruction runs, and raw observations in db/migrations/0001_ledger_foundation.sql
- [x] T010 Create the append-only ledger schema migration for canonical ledger records, ledger sources, asset movements, residual holdings, and discarded activity in db/migrations/0002_ledger_outputs.sql
- [x] T011 [P] Define Drizzle table mappings for the ledger persistence model in src/infrastructure/db/schema.ts
- [x] T012 [P] Implement deterministic ID builders for sessions, runs, pools, strategies, positions, ledger records, residual holdings, and discarded activity in src/domains/ledger/model/ids.ts
- [x] T013 [P] Implement classifier version and heuristics registry definitions in src/domains/ledger/heuristics/registry.ts
- [x] T014 [P] Implement wallet analysis session repository operations in src/domains/wallet-session/repositories/session-repository.ts
- [x] T015 [P] Implement reconstruction run repository operations in src/domains/ledger/repositories/reconstruction-run-repository.ts
- [x] T016 [P] Implement raw observation repository operations with append-only guarantees in src/domains/ledger/repositories/raw-observation-repository.ts
- [x] T017 [P] Implement canonical output repository operations for ledger records, asset movements, residual holdings, and discarded activity in src/domains/ledger/repositories/ledger-output-repository.ts
- [x] T018 Implement finalized-block checkpoint and candidate transaction discovery primitives in src/domains/ledger/services/ingestion-orchestrator.ts
- [x] T019 Implement immutable raw observation hydration for blocks, transactions, receipts, logs, and traces in src/domains/ledger/services/raw-observation-ingestor.ts
- [x] T020 Implement reconstruction run orchestration state transitions and acceptance rules in src/domains/ledger/services/reconstruction-run-service.ts
- [x] T021 Implement request and response Zod schemas aligned with the OpenAPI contract in src/domains/ledger/contracts/ledger-api-schemas.ts
- [x] T022 Implement API route handler for analysis session creation in app/api/analysis-sessions/route.ts
- [x] T023 Implement API route handler for session-scoped reconstruction requests in app/api/analysis-sessions/[sessionId]/reconstructions/route.ts

**Checkpoint**: Foundation ready. User story work can now proceed in priority order or in parallel.

---

## Phase 3: User Story 1 - Reconstruct Wallet Activity (Priority: P1) 🎯 MVP

**Goal**: Reconstruct one Base wallet into deterministic canonical ledger records with immutable provenance and versioned read access.

**Independent Test**: Start a wallet analysis session, run reconstruction against a known fixture wallet, and verify that canonical ledger records, source observation links, and API responses remain stable across replay runs.

### Tests for User Story 1

- [x] T024 [P] [US1] Add unit tests for analysis session, run orchestration, and deterministic ID generation in tests/unit/ledger-foundation.test.ts
- [x] T025 [P] [US1] Add replay tests for byte-stable reconstruction output from fixture raw observations in tests/replay/wallet-reconstruction.test.ts
- [x] T026 [P] [US1] Add contract tests for POST /api/analysis-sessions and POST /api/analysis-sessions/{sessionId}/reconstructions in tests/contract/analysis-sessions.contract.test.ts
- [x] T026A [P] [US1] Add contract tests for GET /api/analysis-sessions/{sessionId}/ledger/events/{ledgerRecordId} provenance and asset movement fields in tests/contract/ledger-record-detail.contract.test.ts
- [x] T026B [P] [US1] Add replay tests for external_deposit and external_withdrawal classification in tests/replay/external-transfer-classification.test.ts
- [x] T027 [P] [US1] Add end-to-end validation for wallet session creation and reconstruction kickoff in tests/integration/analysis-session-flow.test.ts

### Implementation for User Story 1

- [x] T028 [P] [US1] Define wallet analysis session domain model in src/domains/wallet-session/model/analysis-session.ts
- [x] T029 [P] [US1] Define reconstruction run and raw observation domain models in src/domains/ledger/model/reconstruction-run.ts
- [x] T030 [P] [US1] Define canonical ledger record, ledger source, and asset movement domain models in src/domains/ledger/model/canonical-ledger-record.ts
- [x] T031 [US1] Implement wallet analysis session creation and resume logic in src/domains/wallet-session/services/analysis-session-service.ts
- [x] T032 [US1] Implement wallet-scoped candidate transaction discovery for Base and allowlisted protocols in src/domains/ledger/services/candidate-transaction-service.ts
- [x] T033 [US1] Implement transaction normalization pipeline orchestration from raw observations to canonical ledger records in src/domains/ledger/services/ledger-normalization-service.ts
- [x] T033A [US1] Implement external wallet funding and withdrawal classification rules for canonical external_deposit and external_withdrawal events in src/domains/ledger/classifiers/external-transfer-classifier.ts
- [x] T033B [US1] Wire external transfer classification into canonical ledger normalization in src/domains/ledger/services/ledger-normalization-service.ts
- [x] T034 [US1] Implement token-level asset movement extraction from normalized events in src/domains/ledger/services/asset-movement-service.ts
- [x] T035 [US1] Implement canonical ledger projection read service for the latest accepted run in src/domains/ledger/projections/ledger-projection-service.ts
- [x] T036 [US1] Implement GET /api/analysis-sessions/{sessionId}/ledger contract route in app/api/analysis-sessions/[sessionId]/ledger/route.ts
- [x] T037 [US1] Implement GET /api/analysis-sessions/{sessionId}/ledger/events/{ledgerRecordId} contract route in app/api/analysis-sessions/[sessionId]/ledger/events/{ledgerRecordId}/route.ts
- [x] T038 [US1] Implement a minimal ledger inspection page for reconstruction verification in app/ledger/page.tsx
- [x] T039 [US1] Add fixture wallet metadata for deterministic reconstruction validation in tests/fixtures/wallets/us1-wallet.json
- [x] T040 [US1] Add raw observation fixture corpus for deterministic replay in tests/fixtures/raw-observations/us1-wallet-observations.json

**Checkpoint**: User Story 1 produces a deterministic, traceable canonical ledger for one wallet and is independently testable.

---

## Phase 4: User Story 2 - Understand Activity by Pool, Strategy, and Position Lifecycle (Priority: P2)

**Goal**: Structure the canonical ledger by pool, isolate manual and supported Mellow strategies, and enforce correct lifecycle continuity for manual positions and supported Mellow exposures.

**Independent Test**: Run reconstruction against a fixture wallet with manual Aerodrome and supported Mellow activity in the same pool, then verify one pool, two strategies, correct manual mint versus increaseLiquidity handling, and separate lifecycle records.

### Tests for User Story 2

- [x] T041 [P] [US2] Add unit tests for pool, strategy, and lifecycle identity rules in tests/unit/pool-strategy-lifecycle.test.ts
- [x] T042 [P] [US2] Add replay tests for manual mint versus increaseLiquidity continuity and supported Mellow separation in tests/replay/pool-strategy-lifecycle.test.ts
- [x] T043 [P] [US2] Add contract tests for pool and strategy fields in GET /api/analysis-sessions/{sessionId}/ledger in tests/contract/ledger-projection.contract.test.ts
- [x] T044 [P] [US2] Add end-to-end validation for pool and strategy inspection in tests/integration/pool-strategy-view.test.ts

### Implementation for User Story 2

- [x] T045 [P] [US2] Define pool and strategy domain models in src/domains/ledger/model/pool.ts
- [x] T046 [P] [US2] Define position lifecycle domain models for manual and supported Mellow exposure in src/domains/ledger/model/position-instance.ts
- [x] T047 [P] [US2] Implement Aerodrome contract definitions and decoded call helpers in src/domains/protocols/aerodrome/contracts.ts
- [x] T048 [P] [US2] Implement supported Mellow contract definitions and decoded call helpers in src/domains/protocols/mellow/contracts.ts
- [x] T049 [US2] Implement Aerodrome manual classifier rules that open new lifecycles on mint in src/domains/protocols/aerodrome/aerodrome-classifier.ts
- [x] T050 [US2] Implement Aerodrome lifecycle extension rules that keep increaseLiquidity on the same tokenId in src/domains/protocols/aerodrome/manual-position-lifecycle-service.ts
- [x] T051 [US2] Implement supported Mellow strategy classification and wrapper or staking exposure lifecycle rules in src/domains/protocols/mellow/mellow-classifier.ts
- [x] T052 [US2] Implement pool and strategy assignment service that groups manual and supported Mellow activity under the same pool without merging strategies in src/domains/ledger/services/pool-assignment-service.ts
- [x] T053 [US2] Implement position lifecycle projection service for manual and supported Mellow strategies in src/domains/ledger/projections/position-lifecycle-projection-service.ts
- [x] T054 [US2] Update ledger projection read service to include pool, strategy, and lifecycle detail in src/domains/ledger/projections/ledger-projection-service.ts
- [x] T055 [US2] Add fixture wallet metadata for parallel manual and supported Mellow strategy validation in tests/fixtures/wallets/us2-wallet.json
- [x] T056 [US2] Add raw observation fixture corpus for pool, strategy, and lifecycle validation in tests/fixtures/raw-observations/us2-wallet-observations.json

**Checkpoint**: User Story 2 keeps the ledger economically structured by pool, isolated by strategy, and correct on lifecycle continuity.

---

## Phase 5: User Story 3 - Preserve Residual Holdings and Isolate Untrusted Activity (Priority: P3)

**Goal**: Preserve residual and unallocated wallet-owned balances at portfolio level and store unsupported or unsafe activity as reviewable discarded records with stable reason metadata.

**Independent Test**: Run reconstruction against a fixture wallet with leftover balances and one ambiguous or unsupported transaction, then verify portfolio-level residual holdings, non-synthetic pool handling, and discarded activity isolation through the API.

### Tests for User Story 3

- [x] T057 [P] [US3] Add unit tests for residual holding attribution thresholds and discarded reason metadata in tests/unit/residual-and-discarded.test.ts
- [x] T058 [P] [US3] Add replay tests for residual visibility and discarded activity stability in tests/replay/residual-and-discarded.test.ts
- [x] T059 [P] [US3] Add contract tests for residual holdings and discarded activity endpoints in tests/contract/discarded-activity.contract.test.ts
- [x] T060 [P] [US3] Add end-to-end validation for residual and discarded record inspection in tests/integration/residual-and-discarded-flow.test.ts

### Implementation for User Story 3

- [x] T061 [P] [US3] Define residual holding and discarded activity domain models in src/domains/residual-holdings/model/residual-holding.ts
- [x] T062 [P] [US3] Define stable discarded reason codes and categories in src/domains/ledger/model/discarded-reasons.ts
- [x] T063 [US3] Implement residual holding projection service that preserves portfolio-level balances without forcing synthetic pools in src/domains/residual-holdings/services/residual-holding-service.ts
- [x] T064 [US3] Implement discarded activity classification and persistence workflow in src/domains/ledger/services/discarded-activity-service.ts
- [x] T065 [US3] Implement classifier fallback and deterministic heuristic application service in src/domains/ledger/classifiers/classification-engine.ts
- [x] T066 [US3] Update ledger normalization service to emit residual balance updates and discarded outputs with source traceability in src/domains/ledger/services/ledger-normalization-service.ts
- [x] T067 [US3] Implement GET /api/analysis-sessions/{sessionId}/discarded-activity contract route in app/api/analysis-sessions/[sessionId]/discarded-activity/route.ts
- [x] T068 [US3] Update the ledger inspection page to surface residual holdings and discarded activity details in app/ledger/page.tsx
- [x] T069 [US3] Add fixture wallet metadata for residual and discarded validation in tests/fixtures/wallets/us3-wallet.json
- [x] T070 [US3] Add raw observation fixture corpus for residual and discarded validation in tests/fixtures/raw-observations/us3-wallet-observations.json

**Checkpoint**: All three user stories are independently functional, and residual or untrusted cases no longer threaten portfolio completeness or future analytics integrity.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finish cross-story validation, developer ergonomics, and documentation needed to make the feature implementation reliable and immediately usable.

- [x] T071 [P] Add Drizzle migration runner and seed utilities in src/infrastructure/db/migrate.ts
- [x] T072 [P] Add request logging and reconstruction observability helpers in src/infrastructure/observability/logger.ts
- [x] T073 Update the OpenAPI contract examples to match implemented ledger responses in specs/001-canonical-investment-ledger/contracts/ledger-api.openapi.yaml
- [x] T074 Update developer setup, environment, and validation commands in README.md
- [x] T075 Add quickstart-aligned validation script documentation in package.json
- [x] T076 Run the quickstart validation scenarios and record implementation notes in specs/001-canonical-investment-ledger/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1: Setup**: No dependencies. Can start immediately.
- **Phase 2: Foundational**: Depends on Phase 1 completion. Blocks all user stories.
- **Phase 3: US1**: Depends on Phase 2 completion. This is the MVP slice.
- **Phase 4: US2**: Depends on Phase 2 completion and integrates with the canonical pipeline built in US1.
- **Phase 5: US3**: Depends on Phase 2 completion and extends the normalization and read pipeline built in US1.
- **Phase 6: Polish**: Depends on all desired user story phases being complete.

### User Story Dependencies

- **User Story 1 (P1)**: No dependency on other stories after Foundational completion.
- **User Story 2 (P2)**: Can start after Foundational completion but assumes the canonical reconstruction path from US1 exists before final integration tasks T052-T054.
- **User Story 3 (P3)**: Can start after Foundational completion but assumes the canonical reconstruction path from US1 exists before final integration tasks T063-T068.

### Within Each User Story

- Tests should be written before implementation and should fail before the corresponding implementation tasks are considered complete.
- Domain models and contract shapes should land before orchestration and API integration.
- Classification and projection services should land before route handlers and inspection UI changes.
- Fixture files should be added before replay and end-to-end validation is finalized.

### Parallel Opportunities

- Setup tasks marked `[P]` can run in parallel after T001-T002 establish the project baseline.
- Foundational repository and ruleset tasks T011-T017 can run in parallel once migrations are defined.
- US1 tests T024-T027, plus T026A and T026B, can run in parallel, and domain model tasks T028-T030 can run in parallel.
- US2 contract helpers T047-T048 and model tasks T045-T046 can run in parallel.
- US3 model tasks T061-T062 and tests T057-T060 can run in parallel.
- Fixture authoring tasks across stories can run in parallel once the expected scenarios are defined.

---

## Parallel Example: User Story 1

```bash
# Run the US1 verification work in parallel after foundations complete:
Task: "Add unit tests for analysis session, run orchestration, and deterministic ID generation in tests/unit/ledger-foundation.test.ts"
Task: "Add replay tests for byte-stable reconstruction output from fixture raw observations in tests/replay/wallet-reconstruction.test.ts"
Task: "Add contract tests for POST /api/analysis-sessions and POST /api/analysis-sessions/{sessionId}/reconstructions in tests/contract/analysis-sessions.contract.test.ts"
Task: "Add contract tests for GET /api/analysis-sessions/{sessionId}/ledger/events/{ledgerRecordId} provenance and asset movement fields in tests/contract/ledger-record-detail.contract.test.ts"

# Build the US1 domain model layer in parallel:
Task: "Define wallet analysis session domain model in src/domains/wallet-session/model/analysis-session.ts"
Task: "Define reconstruction run and raw observation domain models in src/domains/ledger/model/reconstruction-run.ts"
Task: "Define canonical ledger record, ledger source, and asset movement domain models in src/domains/ledger/model/canonical-ledger-record.ts"
```

---

## Parallel Example: User Story 2

```bash
# Build protocol-specific modeling work in parallel:
Task: "Define pool and strategy domain models in src/domains/ledger/model/pool.ts"
Task: "Define position lifecycle domain models for manual and supported Mellow exposure in src/domains/ledger/model/position-instance.ts"
Task: "Implement Aerodrome contract definitions and decoded call helpers in src/domains/protocols/aerodrome/contracts.ts"
Task: "Implement supported Mellow contract definitions and decoded call helpers in src/domains/protocols/mellow/contracts.ts"
```

---

## Parallel Example: User Story 3

```bash
# Build residual and discarded foundations in parallel:
Task: "Add unit tests for residual holding attribution thresholds and discarded reason metadata in tests/unit/residual-and-discarded.test.ts"
Task: "Define residual holding and discarded activity domain models in src/domains/residual-holdings/model/residual-holding.ts"
Task: "Define stable discarded reason codes and categories in src/domains/ledger/model/discarded-reasons.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Stop and validate deterministic reconstruction, traceability, and API contract behavior before adding pool-structure complexity.

### Incremental Delivery

1. Deliver Setup + Foundational to establish the app, persistence, and orchestration substrate.
2. Deliver US1 to create the canonical ledger MVP.
3. Deliver US2 to add economic structure through pools, strategies, and lifecycle rules.
4. Deliver US3 to complete portfolio-level residual visibility and untrusted-activity isolation.
5. Finish with Polish to align documentation, quickstart validation, and operational tooling.

### Parallel Team Strategy

1. One developer can own setup and database foundations while another prepares tests and fixture corpora.
2. After Foundational completion, US1 should remain the first delivery lane because all later stories build on its canonical pipeline.
3. Once US1 is stable, US2 and US3 can be implemented in parallel because they extend different domain slices of the same normalization flow.

---

## Notes

- `[P]` marks tasks that touch different files and can be executed independently.
- `US1`, `US2`, and `US3` map directly to the feature specification user stories.
- No tasks in this file extend into pricing, PnL, attribution, notifications, multi-wallet support, or transaction execution.
- Manual `mint()` versus `increaseLiquidity()` continuity, supported Mellow strategy isolation, append-only replayability, residual portfolio-level handling, and discarded reason stability are explicit implementation requirements in the story tasks above.
- External wallet funding and withdrawal classification is explicitly implemented in US1 so capital-in and capital-out records are part of the canonical ledger foundation.