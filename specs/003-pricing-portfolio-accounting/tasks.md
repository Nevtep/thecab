# Tasks: Pricing and Portfolio Accounting Engine

**Input**: Design documents from `/specs/003-pricing-portfolio-accounting/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md, contracts/accounting-api.openapi.yaml

**Tests**: Unit, replay, contract, integration, and explicit Playwright end-to-end validation tasks are included because the specification and quickstart explicitly require independently testable accounting outputs, traceability, partial-coverage behavior, and browser validation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g. `US1`, `US2`, `US3`)
- Every task includes an exact file path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the shared project configuration required for pricing-provider access and accounting development.

- [ ] T001 Define pricing-provider and accounting environment variables in .env.example
- [ ] T002 Add pricing-provider runtime dependency and accounting validation script updates in package.json
- [ ] T003 [P] Create pricing domain barrel exports in src/domains/pricing/contracts/index.ts
- [ ] T004 [P] Create accounting domain barrel exports in src/domains/accounting/contracts/index.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the shared pricing persistence, contracts, and orchestration foundations that block all user stories.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T005 Create the pricing and accounting foundation migration in db/migrations/0003_pricing_accounting_foundation.sql
- [ ] T006 [P] Map price asset, price point, and accounting support tables in src/infrastructure/db/schema.ts
- [ ] T007 [P] Define PriceAsset, PricePoint, and PriceCoverageDecision domain models in src/domains/pricing/model/price-point.ts
- [ ] T008 [P] Define portfolio accounting snapshot and coverage models in src/domains/accounting/model/accounting-snapshot.ts
- [ ] T009 [P] Implement normalized price point persistence and lookup operations in src/domains/pricing/repositories/price-point-repository.ts
- [ ] T010 [P] Define provider request and response contracts in src/domains/pricing/contracts/price-provider.ts
- [ ] T011 [P] Implement accounting API Zod schemas aligned to the contract in src/domains/accounting/contracts/accounting-api-schemas.ts
- [ ] T012 Implement direct-price, wrapped-asset, and stable-alias normalization rules in src/domains/pricing/services/price-normalization-service.ts
- [ ] T013 Implement event-time price selection and confidence windows in src/domains/pricing/services/price-selection-service.ts
- [ ] T014 Implement session-scoped accounting snapshot orchestration over accepted ledger runs in src/domains/accounting/services/accounting-snapshot-service.ts
- [ ] T014A Implement discarded-activity exclusion ingestion and reason-code propagation into accounting coverage summaries in src/domains/accounting/services/accounting-exclusion-service.ts

**Checkpoint**: Shared pricing and accounting foundations are ready. User story work can now proceed in priority order or in parallel.

---

## Phase 3: User Story 1 - See True Portfolio Economics (Priority: P1) 🎯 MVP

**Goal**: Deliver current total portfolio value, capital entered, capital withdrawn, realized PnL, unrealized PnL, and idle-balance inclusion for one connected wallet.

**Independent Test**: Reconstruct a supported wallet session, request the accounting snapshot, and verify current total value, capital in, capital out, realized PnL, unrealized PnL, and idle balances in USD/USDC-normalized terms.

### Tests for User Story 1

- [ ] T015 [P] [US1] Add unit tests for price selection, capital-flow classification, and portfolio totals in tests/unit/portfolio-accounting.test.ts
- [ ] T016 [P] [US1] Add replay tests for event-time valuation and current portfolio totals in tests/replay/portfolio-accounting.test.ts
- [ ] T017 [P] [US1] Add contract tests for GET /api/analysis-sessions/{sessionId}/accounting portfolio fields in tests/contract/accounting.contract.test.ts
- [ ] T018 [P] [US1] Add integration test for portfolio totals and idle-balance visibility in tests/integration/accounting-portfolio-flow.test.ts
- [ ] T018A [P] [US1] Add Playwright validation for connected-wallet portfolio totals and idle-balance visibility in tests/e2e/accounting-portfolio.spec.ts

### Implementation for User Story 1

- [ ] T019 [P] [US1] Define valued movement and current holding valuation models in src/domains/accounting/model/valued-movement.ts
- [ ] T020 [P] [US1] Implement the external historical and current price provider adapter in src/domains/pricing/providers/http-price-provider.ts
- [ ] T021 [US1] Implement event-time valued movement generation from canonical asset movements in src/domains/accounting/services/valued-movement-service.ts
- [ ] T022 [US1] Implement current holdings and idle-balance valuation in src/domains/accounting/services/current-holdings-valuation-service.ts
- [ ] T023 [US1] Implement portfolio-level capital-in, capital-out, realized, and unrealized PnL calculation in src/domains/accounting/services/portfolio-accounting-service.ts
- [ ] T024 [US1] Implement GET /api/analysis-sessions/{sessionId}/accounting route for portfolio snapshot delivery in app/api/analysis-sessions/[sessionId]/accounting/route.ts
- [ ] T025 [US1] Surface portfolio totals and idle-balance value in src/ui/wallet/connected-wallet-ledger.tsx
- [ ] T026 [US1] Extend baseline valuation expectations in tests/fixtures/wallets/us1-wallet.json

**Checkpoint**: User Story 1 delivers an independently testable portfolio accounting snapshot for one wallet.

---

## Phase 4: User Story 2 - Understand Value By Pool And Strategy (Priority: P2)

**Goal**: Break portfolio accounting down by pool, strategy, and reliable position scope while preserving manual-versus-Mellow separation.

**Independent Test**: Run accounting for a wallet with multiple pools and mixed manual and supported Mellow activity, then verify pool and strategy totals reconcile from the portfolio output and preserve strategy isolation.

### Tests for User Story 2

- [ ] T027 [P] [US2] Add unit tests for pool and strategy rollups plus weighted-average scope inventory in tests/unit/pool-strategy-accounting.test.ts
- [ ] T028 [P] [US2] Add replay tests for multi-pool and mixed manual/Mellow accounting rollups in tests/replay/pool-strategy-accounting.test.ts
- [ ] T029 [P] [US2] Add contract tests for pool, strategy, and position summaries in tests/contract/accounting-breakdown.contract.test.ts
- [ ] T030 [P] [US2] Add integration test for hierarchical accounting display in tests/integration/accounting-breakdown-flow.test.ts

### Implementation for User Story 2

- [ ] T031 [P] [US2] Define pool, strategy, and position accounting summary models in src/domains/accounting/model/scope-accounting-summary.ts
- [ ] T032 [US2] Implement weighted-average inventory propagation and rollups by portfolio, pool, and strategy in src/domains/accounting/services/scope-accounting-service.ts
- [ ] T033 [US2] Implement deterministic position-level precision gating and rolled-up fallback handling based on stable positionInstance linkage, unambiguous lifecycle ordering, and non-overlapping residual inventory in src/domains/accounting/services/position-accounting-service.ts
- [ ] T034 [US2] Extend accounting snapshot assembly with pool, strategy, and position summaries in src/domains/accounting/services/accounting-snapshot-service.ts
- [ ] T035 [US2] Extend accounting route serialization with hierarchical breakdowns in app/api/analysis-sessions/[sessionId]/accounting/route.ts
- [ ] T036 [US2] Render pool, strategy, and position breakdowns in src/ui/wallet/connected-wallet-ledger.tsx
- [ ] T037 [US2] Extend multi-strategy accounting expectations in tests/fixtures/wallets/us2-wallet.json

**Checkpoint**: User Story 2 adds independently testable pool and strategy accounting without breaking portfolio totals.

---

## Phase 5: User Story 3 - Trust Pricing Quality And Explainability (Priority: P3)

**Goal**: Make pricing fallbacks, partial coverage, confidence, and traceability explicit so accounting outputs remain explainable and trustworthy.

**Independent Test**: Run accounting for priced, indirectly normalized, and unpriced components, then verify coverage summaries, fallback reasons, confidence signals, and trace references are exposed in the output.

### Tests for User Story 3

- [ ] T038 [P] [US3] Add unit tests for coverage summaries, fallback reasons, and trace references in tests/unit/accounting-explainability.test.ts
- [ ] T039 [P] [US3] Add replay tests for indirect pricing paths and partial-coverage outputs in tests/replay/accounting-coverage.test.ts
- [ ] T040 [P] [US3] Add contract tests for coverage metadata and trace refs in tests/contract/accounting-explainability.contract.test.ts
- [ ] T041 [P] [US3] Add integration test for partial coverage and explainability display in tests/integration/accounting-explainability-flow.test.ts
- [ ] T041A [P] [US3] Add Playwright validation for partial coverage, fallback disclosure, and traceability states in tests/e2e/accounting-explainability.spec.ts

### Implementation for User Story 3

- [ ] T042 [P] [US3] Define accounting trace and explainability models in src/domains/accounting/model/accounting-trace.ts
- [ ] T043 [US3] Implement coverage summary and excluded-value assembly in src/domains/accounting/services/accounting-coverage-service.ts
- [ ] T044 [US3] Implement ledger-record and price-point trace reference assembly in src/domains/accounting/services/accounting-trace-service.ts
- [ ] T045 [US3] Extend normalization fallback reasoning and confidence metadata in src/domains/pricing/services/price-normalization-service.ts
- [ ] T046 [US3] Extend accounting snapshot assembly with confidence, fallback, and partial-coverage disclosures in src/domains/accounting/services/accounting-snapshot-service.ts
- [ ] T047 [US3] Render coverage status, fallback basis, and traceability metadata in src/ui/wallet/connected-wallet-ledger.tsx
- [ ] T048 [US3] Extend partial-coverage expectations in tests/fixtures/wallets/us3-wallet.json
- [ ] T048A [US3] Add replay coverage for discarded-activity exclusion reasons and excluded-portion disclosure in tests/replay/accounting-coverage.test.ts

**Checkpoint**: User Story 3 makes accounting outputs independently testable for pricing quality, confidence, and traceability.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finish cross-story documentation, observability, and final validation.

- [ ] T049 [P] Update accounting contract examples and response notes in specs/003-pricing-portfolio-accounting/contracts/accounting-api.openapi.yaml
- [ ] T050 [P] Update pricing-provider setup, environment, and validation commands in README.md
- [ ] T051 [P] Add pricing-cache miss and coverage observability helpers in src/infrastructure/observability/logger.ts
- [ ] T052 Run quickstart validation scenarios, including `pnpm test:e2e`, and record implementation notes in specs/003-pricing-portfolio-accounting/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1: Setup**: No dependencies. Can start immediately.
- **Phase 2: Foundational**: Depends on Phase 1 completion. Blocks all user stories.
- **Phase 3: US1**: Depends on Phase 2 completion. This is the MVP slice.
- **Phase 4: US2**: Depends on Phase 2 completion and integrates into the accounting route and UI first delivered in US1.
- **Phase 5: US3**: Depends on Phase 2 completion and extends the pricing and accounting pipeline delivered in US1.
- **Phase 6: Polish**: Depends on all desired user story phases being complete.

### User Story Dependencies

- **User Story 1 (P1)**: No dependency on other stories after Foundational completion.
- **User Story 2 (P2)**: Can start after Foundational completion, but final route and UI integration tasks T034-T036 assume the US1 portfolio snapshot path exists.
- **User Story 3 (P3)**: Can start after Foundational completion, but final disclosure and UI integration tasks T043-T047 assume the US1 accounting path exists.

### Within Each User Story

- Tests should be written before implementation and should fail before the corresponding implementation tasks are considered complete.
- Domain models and contracts should land before orchestration and route integration.
- Pricing provider and valuation services should land before accounting rollups and UI exposure.
- Fixture expectation updates should land before replay and integration validation is finalized.

### Parallel Opportunities

- Setup tasks T003-T004 can run in parallel after T001-T002 establish configuration expectations.
- Foundational tasks T006-T011 plus T014A can run in parallel once the migration shape in T005 is defined.
- US1 tests T015-T018 plus T018A can run in parallel, and model or provider tasks T019-T020 can run in parallel.
- US2 tests T027-T030 can run in parallel, and summary model task T031 can run in parallel with early service scaffolding.
- US3 tests T038-T041 plus T041A can run in parallel, and trace model task T042 can run in parallel with coverage service scaffolding.
- Polish tasks T049-T051 can run in parallel before the final validation task T052.

---

## Parallel Example: User Story 1

```bash
# Run the US1 validation work in parallel after foundations complete:
Task: "Add unit tests for price selection, capital-flow classification, and portfolio totals in tests/unit/portfolio-accounting.test.ts"
Task: "Add replay tests for event-time valuation and current portfolio totals in tests/replay/portfolio-accounting.test.ts"
Task: "Add contract tests for GET /api/analysis-sessions/{sessionId}/accounting portfolio fields in tests/contract/accounting.contract.test.ts"
Task: "Add integration test for portfolio totals and idle-balance visibility in tests/integration/accounting-portfolio-flow.test.ts"
Task: "Add Playwright validation for connected-wallet portfolio totals and idle-balance visibility in tests/e2e/accounting-portfolio.spec.ts"

# Build the US1 model and provider layer in parallel:
Task: "Define valued movement and current holding valuation models in src/domains/accounting/model/valued-movement.ts"
Task: "Implement the external historical and current price provider adapter in src/domains/pricing/providers/http-price-provider.ts"
```

---

## Parallel Example: User Story 2

```bash
# Prepare hierarchical accounting coverage in parallel:
Task: "Add unit tests for pool and strategy rollups plus weighted-average scope inventory in tests/unit/pool-strategy-accounting.test.ts"
Task: "Add replay tests for multi-pool and mixed manual/Mellow accounting rollups in tests/replay/pool-strategy-accounting.test.ts"
Task: "Define pool, strategy, and position accounting summary models in src/domains/accounting/model/scope-accounting-summary.ts"
```

---

## Parallel Example: User Story 3

```bash
# Build explainability coverage in parallel:
Task: "Add unit tests for coverage summaries, fallback reasons, and trace references in tests/unit/accounting-explainability.test.ts"
Task: "Add replay tests for indirect pricing paths and partial-coverage outputs in tests/replay/accounting-coverage.test.ts"
Task: "Add Playwright validation for partial coverage, fallback disclosure, and traceability states in tests/e2e/accounting-explainability.spec.ts"
Task: "Define accounting trace and explainability models in src/domains/accounting/model/accounting-trace.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Stop and validate current portfolio value, capital flows, PnL, and idle-balance inclusion before expanding into hierarchical accounting.

### Incremental Delivery

1. Deliver Setup + Foundational to establish pricing persistence, contracts, and orchestration.
2. Deliver US1 to ship the first usable accounting snapshot.
3. Deliver US2 to add pool, strategy, and position breakdowns.
4. Deliver US3 to add explainability, fallback disclosure, and partial-coverage trust signals.
5. Finish with Polish to align docs, observability, and quickstart validation.

### Parallel Team Strategy

1. One developer can own migrations, schema, and repositories while another prepares test files and contract schemas.
2. After Foundational completion, US1 should remain the first delivery lane because later stories extend the same accounting API surface.
3. Once US1 is stable, US2 and US3 can progress in parallel, with route and UI integration merged after their domain services are complete.

---

## Notes

- `[P]` marks tasks that touch different files and can be implemented independently.
- `US1`, `US2`, and `US3` map directly to the feature specification user stories.
- Every task names a concrete file so an implementation agent can execute it without additional planning context.
- The MVP scope is Phase 3 only: portfolio accounting totals, capital flows, PnL, and idle-balance inclusion.
- Pool and strategy breakdowns, explainability, discarded-activity exclusion handling, and partial-coverage disclosures remain additive slices after the MVP path is stable.