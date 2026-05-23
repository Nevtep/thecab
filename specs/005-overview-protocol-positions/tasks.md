# Tasks: Overview Protocol Positions

**Input**: Design documents from `/specs/005-overview-protocol-positions/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: No explicit TDD or test-first requirement was requested for this stage. This task list focuses on implementation work plus the required validation and smoke checks.

**Organization**: Tasks are grouped by user story for independent delivery, with Setup and Foundational phases covering shared Stage 1 work.

**Stage Scope Note**: This task list delivers Stage 1 only for connected Overview. It extends `GET /api/wallet/overview` and the existing Overview vertical slice with a dedicated `protocolPositions` block for manual Aerodrome positions, Mellow strategy exposure, and governance locks. It does **not** include one-year reconstruction, detail pages, lifecycle analytics, reward attribution, annualized returns, generic NFT portfolio support, or any new browser-facing provider API.

## Phase 1: Setup (Shared Implementation Surface)

**Purpose**: Create the dedicated protocol-position module and reserve the existing Overview extension points.

- [X] T001 Create the backend protocol-position module file skeleton in apps/web/src/server/protocol-positions/protocolPositions.types.ts, apps/web/src/server/protocol-positions/detectProtocolPositions.ts, apps/web/src/server/protocol-positions/reconstructRecentPositionState.ts, and apps/web/src/server/protocol-positions/protocolMetadata.ts
- [X] T002 [P] Add empty `protocolPositions` block scaffolding to the recent Overview response in apps/web/src/server/overview/getRecentOverview.ts
- [X] T003 [P] Add `protocolPositions` cloning and sanitization scaffolding to the existing Overview route in apps/web/src/app/api/wallet/overview/route.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extend the shared contracts, identity model, and persistence helpers before user-story implementation begins.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [X] T004 Define protocol-position family, coverage, value-treatment, evidence, and identity primitives in apps/web/src/server/protocol-positions/protocolPositions.types.ts
- [X] T005 [P] Extend the server Overview response contract with `protocolPositions` and protocol-position coverage reason unions in apps/web/src/server/overview/overview.types.ts
- [X] T006 [P] Extend the feature-side Overview view-model with `protocolPositions`, row metadata, and summary fields in apps/web/src/features/overview/overview.types.ts
- [X] T007 [P] Preserve the Overview-scoped query contract while carrying `protocolPositions` through apps/web/src/queries/keys.ts and apps/web/src/features/overview/overview.queries.ts
- [X] T008 [P] Extend Overview response normalization and ordering for `protocolPositions` in apps/web/src/features/overview/overview.mappers.ts
- [X] T009 Define approved Aerodrome, Mellow, and governance surface helpers plus chain-scoped identity builders in apps/web/src/server/protocol-positions/protocolMetadata.ts
- [X] T010 Add repository helpers for protocol-position evidence pointers, coverage metadata, and snapshot metadata persistence in apps/web/src/server/overview/overview.repository.ts

**Checkpoint**: Shared contract and backend-owned protocol-position foundations are ready.

---

## Phase 3: User Story 1 - See Deployed And Locked Capital Immediately (Priority: P1) 🎯 MVP

**Goal**: Make manual Aerodrome positions, Mellow strategy exposure, and governance locks visible immediately in the connected Overview.

**Independent Test**: Load Overview for wallets with a manual Aerodrome position NFT, a Mellow position, or a governance lock and verify that `protocolPositions.rows` contains the visible position and the UI renders it before any deep analysis flow is required.

### Implementation for User Story 1

- [X] T011 [US1] Implement manual Aerodrome position detection from wallet ownership, NFT evidence, and approved current-state reads in apps/web/src/server/protocol-positions/detectProtocolPositions.ts
- [X] T012 [US1] Implement Mellow strategy exposure detection from official strategy metadata plus wrapper and staking evidence in apps/web/src/server/protocol-positions/detectProtocolPositions.ts
- [X] T013 [US1] Implement governance lock detection from approved governance surfaces in apps/web/src/server/protocol-positions/detectProtocolPositions.ts
- [X] T014 [US1] Assemble `protocolPositions.rows`, `protocolPositions.summary`, and block-level source metadata in apps/web/src/server/overview/getRecentOverview.ts
- [X] T015 [US1] Enforce approved-family-only protocol-position inclusion so unrelated wallet NFTs and generic NFT inventory never enter `protocolPositions.rows` unless positively classified in apps/web/src/server/protocol-positions/detectProtocolPositions.ts and apps/web/src/server/overview/getRecentOverview.ts
- [X] T016 [US1] Extend the `/api/wallet/overview` response sanitization to return `protocolPositions` without leaking raw provider fields in apps/web/src/app/api/wallet/overview/route.ts

**Checkpoint**: The backend can return visible protocol positions for the three Stage 1 families.

---

## Phase 4: User Story 2 - Keep Overview Classification Honest (Priority: P1)

**Goal**: Keep wallet assets and protocol positions visibly separate while driving the correct Overview metric groups from protocol-position evidence.

**Independent Test**: Load Overview for a wallet that has both liquid wallet assets and protocol positions and verify that the UI shows separate sections and separate metric attribution for manual deposits, strategies, and governance.

### Implementation for User Story 2

- [X] T017 [US2] Keep wallet-asset trust filtering separate while deriving manual-deposit, strategy, and governance metric groups from protocol-position evidence in apps/web/src/server/overview/getRecentOverview.ts
- [X] T018 [P] [US2] Normalize `protocolPositions` rows and summary for the feature view model in apps/web/src/features/overview/overview.mappers.ts
- [X] T019 [US2] Thread `protocolPositions` through Overview container state without changing the existing Overview query path in apps/web/src/features/overview/Overview.container.tsx
- [X] T020 [US2] Render a dedicated protocol-positions section separated from wallet assets in apps/web/src/features/overview/Overview.component.tsx
- [X] T021 [US2] Ensure protocol positions prevent misleading zero-only or empty-dashboard states while preserving the existing analysis CTA and recent-view posture in apps/web/src/features/overview/Overview.component.tsx

**Checkpoint**: Overview classification is honest at both the API and UI layer.

---

## Phase 5: User Story 3 - See Honest Partial Coverage Before Deep Analysis (Priority: P2)

**Goal**: Surface detected protocol positions with honest coverage and value treatment when current valuation or metadata is incomplete.

**Independent Test**: Load Overview for wallets where protocol positions are detectable but not fully valued and verify that the API and UI show `share_level`, `partial`, or `unknown` coverage instead of hiding the position or fabricating a USD value.

### Implementation for User Story 3

- [X] T022 [US3] Implement the bounded 30-day reconstruction helper and hard stop logic in apps/web/src/server/protocol-positions/reconstructRecentPositionState.ts
- [X] T023 [US3] Integrate bounded reconstruction into detection only when direct current-state reads are insufficient in apps/web/src/server/protocol-positions/detectProtocolPositions.ts
- [X] T024 [US3] Populate row-level `coverageStatus`, `coverageReasonCodes`, `valueStatus`, and non-fabricated metric degradation in apps/web/src/server/overview/getRecentOverview.ts
- [X] T025 [P] [US3] Extend protocol-position coverage and value-treatment normalization in apps/web/src/features/overview/overview.mappers.ts
- [X] T026 [P] [US3] Render share-level, partial, unknown, estimated, and unavailable value states plus explicit bounded-reconstruction messaging that distinguishes recent protocol evidence from full one-year reconstruction in apps/web/src/features/overview/Overview.component.tsx and apps/web/src/i18n/locales/en/overview.json and apps/web/src/i18n/locales/es/overview.json

**Checkpoint**: Partial protocol coverage is visible and explicit instead of hidden or overstated.

---

## Phase 6: User Story 4 - Prepare The Overview For Deeper Sections Later (Priority: P2)

**Goal**: Keep protocol-position identity, evidence, and family rules compatible with later Pools, Deposits, Strategies, and Governance work.

**Independent Test**: Review the `protocolPositions` response and persistence outputs to confirm every visible row has a chain-scoped deterministic identity, exactly one primary family, and persisted explainability evidence suitable for later analytics reuse.

### Implementation for User Story 4

- [X] T027 [US4] Finalize chain-scoped deterministic position keys for manual deposits, strategy exposure, and governance locks in apps/web/src/server/protocol-positions/protocolMetadata.ts and apps/web/src/server/protocol-positions/detectProtocolPositions.ts
- [X] T028 [US4] Deduplicate overlapping provider and protocol signals so each visible position resolves to exactly one primary family in apps/web/src/server/protocol-positions/detectProtocolPositions.ts
- [X] T029 [US4] Persist materially relevant provider or RPC artifacts to `raw_provider_records` and store bounded-reconstruction explainability metadata through existing persistence surfaces in apps/web/src/server/overview/overview.repository.ts and apps/web/src/server/overview/getRecentOverview.ts
- [X] T030 [US4] Preserve the `GET /api/wallet/overview` extension shape and chain-scoped identity fields for later reuse in apps/web/src/server/overview/overview.types.ts and apps/web/src/app/api/wallet/overview/route.ts

**Checkpoint**: Protocol-position identities and evidence are compatible with later analytics sections without widening Stage 1 scope.

---

## Phase 7: User Story 5 - Use Protocol Position States In English Or Spanish (Priority: P3)

**Goal**: Localize all new protocol-position labels, helper text, and coverage messaging with EN/ES parity.

**Independent Test**: Switch locale between English and Spanish and verify that protocol-position headings, family labels, helper text, coverage descriptions, and formatted values all render with parity and locale-aware formatting.

### Implementation for User Story 5

- [X] T031 [P] [US5] Add English protocol-position headings, family labels, helper descriptions, empty states, value-treatment copy, and bounded-reconstruction explanation copy in apps/web/src/i18n/locales/en/overview.json
- [X] T032 [P] [US5] Add Spanish parity for protocol-position headings, family labels, helper descriptions, empty states, value-treatment copy, and bounded-reconstruction explanation copy in apps/web/src/i18n/locales/es/overview.json
- [X] T033 [P] [US5] Add shared protocol-position coverage reason labels in apps/web/src/i18n/locales/en/coverage.json and apps/web/src/i18n/locales/es/coverage.json
- [X] T034 [US5] Wire translated protocol-position copy and locale-aware formatting into apps/web/src/features/overview/Overview.component.tsx

**Checkpoint**: Protocol-position UX is fully localized for Stage 1.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Run the required quality gates and feature-specific runtime validations.

- [X] T035 Run EN/ES parity validation for touched Overview and Coverage namespaces through apps/web/scripts/check-i18n-parity.ts using `cd apps/web && pnpm i18n:check`
- [X] T036 Run TypeScript validation for protocol-position changes through apps/web/tsconfig.json using `cd apps/web && pnpm typecheck`
- [X] T037 Run lint validation for protocol-position changes through apps/web/eslint.config.mjs using `cd apps/web && pnpm lint`
- [X] T038 Run production build validation for Overview protocol positions through apps/web/package.json using `cd apps/web && pnpm build`
- [X] T039 Validate browser-provider boundaries remain intact with `cd apps/web && rg "@/server/providers|moralis|alchemy" src/features src/app --glob '!**/api/**'`
- [X] T040 Validate bounded reconstruction stays within 30 days, unrelated NFTs stay excluded from `protocolPositions.rows`, and route sanitization strips raw provider fields in apps/web/src/server/protocol-positions/reconstructRecentPositionState.ts, apps/web/src/server/protocol-positions/detectProtocolPositions.ts, and apps/web/src/app/api/wallet/overview/route.ts
- [X] T041 Run a direct Overview smoke path with a syntactically valid wallet address against apps/web/src/server/overview/getRecentOverview.ts or apps/web/src/app/api/wallet/overview/route.ts using loaded local env from apps/web/.env.local

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Starts immediately and creates the dedicated protocol-position module plus the existing Overview extension points.
- **Foundational (Phase 2)**: Depends on Setup and blocks all user-story work.
- **User Story 1 (Phase 3)**: Depends on Foundational and delivers the backend-first MVP.
- **User Story 2 (Phase 4)**: Depends on User Story 1 because the UI needs the returned `protocolPositions` block before it can present the separation honestly.
- **User Story 3 (Phase 5)**: Depends on User Story 1 and can overlap with User Story 2 once the detection path exists.
- **User Story 4 (Phase 6)**: Depends on User Story 1 and User Story 3 because it finalizes identity, deduplication, and explainability for the already-visible protocol positions.
- **User Story 5 (Phase 7)**: Depends on User Stories 2 and 3 because localization follows the final UI and coverage vocabulary.
- **Polish (Phase 8)**: Depends on all desired story work being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational and is the MVP slice for Stage 1.
- **User Story 2 (P1)**: Depends on User Story 1 because the dedicated UI section needs backend protocol-position rows first.
- **User Story 3 (P2)**: Depends on User Story 1 because partial-coverage rules are applied to detected positions.
- **User Story 4 (P2)**: Depends on User Story 1 and User Story 3 because reusable identity and evidence rules need the actual detection and coverage model in place.
- **User Story 5 (P3)**: Depends on the final Stage 1 UI and coverage vocabulary from the earlier stories.

### Within Each User Story

- Detection and identity rules come before Overview aggregation.
- Overview aggregation comes before route sanitization and UI rendering.
- Coverage and value-treatment rules come before localized helper text.
- Persistence of evidence comes before final validation.
- Validation tasks run after the relevant implementation slice is in place.

### Parallel Opportunities

- In **Phase 1**, T002 and T003 can run in parallel.
- In **Phase 2**, T005, T006, T007, and T008 can run in parallel after T004 exists.
- In **User Story 1**, T011, T012, and T013 can run in parallel while targeting distinct detection branches in the same backend module.
- In **User Story 3**, T025 and T026 can run in parallel once T024 defines the backend payload shape.
- In **User Story 5**, T031, T032, and T033 can run in parallel.

---

## Parallel Example: User Story 1

```bash
# Parallel protocol-family detection work
Task: "Implement manual Aerodrome position detection in apps/web/src/server/protocol-positions/detectProtocolPositions.ts"
Task: "Implement Mellow strategy exposure detection in apps/web/src/server/protocol-positions/detectProtocolPositions.ts"
Task: "Implement governance lock detection in apps/web/src/server/protocol-positions/detectProtocolPositions.ts"
```

---

## Parallel Example: User Story 5

```bash
# Parallel EN/ES localization work
Task: "Add English protocol-position copy in apps/web/src/i18n/locales/en/overview.json"
Task: "Add Spanish protocol-position copy in apps/web/src/i18n/locales/es/overview.json"
Task: "Add shared coverage labels in apps/web/src/i18n/locales/en/coverage.json and apps/web/src/i18n/locales/es/coverage.json"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. **Stop and validate** the backend protocol-position block before moving to UI separation and partial-coverage refinement.

### Incremental Delivery

1. Deliver User Story 1 to make protocol positions visible in the API.
2. Add User Story 2 to make the separation honest in the UI.
3. Add User Story 3 to surface partial coverage and bounded reconstruction honestly.
4. Add User Story 4 to stabilize identity and explainability for later analytics reuse.
5. Add User Story 5 to complete EN/ES localization.
6. Finish with the Phase 8 quality gates and runtime smoke validation.

### Deferred Scope

1. One-year historical reconstruction.
2. Pools, Deposits, Strategies, Governance, Rewards, or Activity detail pages.
3. Lifecycle analytics, reward attribution, realized or unrealized performance, and annualized returns.
4. Generic NFT portfolio support.
5. Any new browser-facing provider API.

## Notes

- [P] tasks target separate files or can be split cleanly without blocking each other.
- Each user story is independently testable against the existing Overview route and vertical slice.
- The generated tasks intentionally preserve the existing Overview contract, asset-trust separation, and server-only provider ownership.