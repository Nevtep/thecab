# Tasks: Connected Wallet Overview

**Input**: Design documents from `/specs/003-connected-wallet-overview/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: No explicit TDD/test-first requirement was requested in the feature specification or by the current stage request; this task list focuses on implementation and required quality gates.

**Organization**: Tasks are grouped by user story for independent delivery, but this stage is intentionally scoped to backend-first recent Overview delivery. User Story 4 historical analyzed-mode implementation is explicitly deferred.

**Stage Scope Note**: This task list delivers the connected Overview route, a server-owned recent-data Overview API, a 24h/7d/30d recent chart with at least 7d coverage from Moralis and Alchemy data, and analysis start/status scaffolding. It does **not** include historical analysis reconstruction or analyzed-history mode delivery in this stage.

## Phase 0: Constitution Check

**Purpose**: Confirm the staged task plan still satisfies the repository constitution before implementation begins.

- [x] T000 Verify brand, localization, chain-awareness, provider-boundary, and explainability compliance for this stage in specs/003-connected-wallet-overview/plan.md and specs/003-connected-wallet-overview/tasks.md

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the Overview feature and server module structure for backend-first delivery.

- [x] T001 Create Overview feature module folder and file skeleton in apps/web/src/features/overview/
- [x] T002 Create server Overview module folder and file skeleton in apps/web/src/server/overview/
- [x] T003 [P] Create connected Overview route entry file in apps/web/src/app/overview/page.tsx
- [x] T004 [P] Create Overview query module stub in apps/web/src/features/overview/overview.queries.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Complete the backend contracts, request/response models, and chain-aware recent-range foundations before story work begins.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [x] T005 Define Overview request, response, and block-provenance server types in apps/web/src/server/overview/overview.types.ts
- [x] T006 [P] Define feature-side Overview view-model types in apps/web/src/features/overview/overview.types.ts
- [x] T007 Create Overview repository helpers for snapshots, coverage, and freshness reads/writes in apps/web/src/server/overview/overview.repository.ts
- [x] T008 [P] Update wallet-scoped and range-scoped request validation for Overview in apps/web/src/app/api/wallet/overview/route.ts
- [x] T009 [P] Normalize Overview query keys to include walletAddress, chainId, and range in apps/web/src/queries/keys.ts
- [x] T010 [P] Normalize Overview and analysis hook inputs around walletAddress, chainId, and range in apps/web/src/queries/hooks.ts
- [x] T011 Create recent-range normalization and 7d-default chart bucket utilities in apps/web/src/server/overview/getRecentOverview.ts
- [x] T012 [P] Add EN Overview namespace key scaffold for recent-view delivery in apps/web/src/i18n/locales/en/overview.json
- [x] T013 [P] Mirror ES Overview namespace key scaffold for parity in apps/web/src/i18n/locales/es/overview.json

**Checkpoint**: Backend contract and range foundations are ready; story work can now proceed.

---

## Phase 3: User Story 2 - See A Fast Recent Portfolio View Before Analysis (Priority: P1) 🎯 MVP

**Goal**: Deliver a backend-first recent Overview that uses Moralis and Alchemy data to render the required Overview widgets, with at least 7d chart coverage and honest partial-data handling.

**Independent Test**: Call the internal Overview API for a Base wallet with no prior historical analysis and verify it returns a wallet-scoped recent-view payload with summary, metrics, a 7d-capable chart, distribution, assets, activity, and explainable coverage states.

### Implementation for User Story 2

- [x] T014 [US2] Implement Moralis and Alchemy recent-data aggregation for Overview in apps/web/src/server/overview/getRecentOverview.ts
- [x] T015 [P] [US2] Persist RawProviderRecord, PricePoint, CoverageReport, and PortfolioSnapshot artifacts for recent Overview fetches in apps/web/src/server/overview/overview.repository.ts
- [x] T016 [US2] Wire the Overview API route to the recent aggregation service with safe provider-error handling in apps/web/src/app/api/wallet/overview/route.ts
- [x] T017 [P] [US2] Map recent Overview API payloads into UI-ready summary, metrics, chart, distribution, assets, and activity models in apps/web/src/features/overview/overview.mappers.ts
- [x] T018 [P] [US2] Implement typed Overview query functions with range support in apps/web/src/features/overview/overview.queries.ts
- [x] T019 [US2] Implement recent Overview query orchestration, default 7d range behavior, and manual refresh control in apps/web/src/features/overview/Overview.container.tsx
- [x] T020 [US2] Render wallet summary, metrics, chart, capital distribution, assets table, and recent activity panels in apps/web/src/features/overview/Overview.component.tsx
- [x] T021 [US2] Implement recent-view range switching for 24h, 7d, and 30d chart and metrics refresh in apps/web/src/features/overview/Overview.container.tsx
- [x] T022 [US2] Render no-activity, missing-price, partial-coverage, and provider-failure states for recent Overview in apps/web/src/features/overview/Overview.component.tsx
- [x] T023 [US2] Surface block-level provenance and page-level coverage messaging for recent Overview blocks in apps/web/src/features/overview/Overview.component.tsx

**Checkpoint**: User Story 2 is complete and independently testable as a backend-first MVP.

---

## Phase 4: User Story 1 - Reach The Connected Cockpit Immediately (Priority: P1)

**Goal**: Route supported connected wallets into the connected shell with Overview active, while keeping landing intact for disconnected users.

**Independent Test**: Connect a supported Base wallet from the landing route and verify the app redirects to `/overview`, renders the connected shell, and blocks unsupported or disconnected access appropriately.

### Implementation for User Story 1

- [x] T024 [P] [US1] Implement Overview page composition entry in apps/web/src/app/overview/page.tsx
- [x] T025 [P] [US1] Create connected-shell Overview container composition in apps/web/src/features/overview/Overview.container.tsx
- [x] T026 [P] [US1] Create connected-shell Overview presentational layout in apps/web/src/features/overview/Overview.component.tsx
- [x] T027 [US1] Redirect successful supported wallet connect flows from landing into `/overview` in apps/web/src/app/page.tsx
- [x] T028 [US1] Add connected navigation state and lock-state mapping for Overview-first entry in apps/web/src/features/overview/overview.mappers.ts
- [x] T029 [US1] Implement disconnected and unsupported-chain entry handling for `/overview` in apps/web/src/app/overview/page.tsx

**Checkpoint**: User Story 1 is complete and independently testable.

---

## Phase 5: User Story 3 - Start Analysis And Understand Progress (Priority: P2)

**Goal**: Provide the Overview analysis CTA, canonical status polling, and progress/error handling without planning historical analysis reconstruction in this stage.

**Independent Test**: Start analysis from Overview, verify queued/running states update through the canonical status endpoint, and confirm the recent Overview remains usable during progress and failure states.

### Implementation for User Story 3

- [x] T030 [US3] Normalize canonical analysis status payload fields in apps/web/src/app/api/analysis/status/route.ts
- [x] T031 [P] [US3] Normalize analysis start payload fields for immediate UI updates in apps/web/src/app/api/analysis/start/route.ts
- [x] T032 [P] [US3] Align analysis hooks with canonical start and status contracts in apps/web/src/queries/hooks.ts
- [x] T033 [US3] Wire analysis CTA actions and status polling into Overview orchestration in apps/web/src/features/overview/Overview.container.tsx
- [x] T034 [US3] Render queued, running, failed, and stale analysis messaging without hiding recent Overview data in apps/web/src/features/overview/Overview.component.tsx
- [x] T035 [US3] Add analysis prompt panel behavior for not-analyzed and stale recent-view states in apps/web/src/features/overview/Overview.component.tsx

**Checkpoint**: User Story 3 is complete and independently testable without historical analyzed-mode delivery.

---

## Phase 6: User Story 5 - Use Overview In English Or Spanish With Honest States (Priority: P3)

**Goal**: Complete EN/ES Overview localization and locale-aware formatting for the recent Overview and analysis-status surfaces.

**Independent Test**: Switch locale between EN and ES and verify full parity for Overview labels, coverage states, chart text, navigation, and analysis messaging, with locale-aware formatting for values and timestamps.

### Implementation for User Story 5

- [x] T036 [P] [US5] Populate EN recent Overview strings for labels, ranges, coverage, empty states, and errors in apps/web/src/i18n/locales/en/overview.json
- [x] T037 [P] [US5] Populate ES recent Overview strings with key parity in apps/web/src/i18n/locales/es/overview.json
- [x] T038 [P] [US5] Add connected navigation label parity for Overview-first delivery in apps/web/src/i18n/locales/en/navigation.json and apps/web/src/i18n/locales/es/navigation.json
- [x] T039 [P] [US5] Add analysis and coverage copy for status, CTA, helper, and fallback states in apps/web/src/i18n/locales/en/analysis.json and apps/web/src/i18n/locales/es/analysis.json
- [x] T040 [P] [US5] Add chart legend parity in apps/web/src/i18n/locales/en/charts.json and apps/web/src/i18n/locales/es/charts.json plus coverage state/reason parity in apps/web/src/i18n/locales/en/coverage.json and apps/web/src/i18n/locales/es/coverage.json
- [x] T041 [US5] Apply locale-aware formatting helpers and translated strings across Overview rendering in apps/web/src/features/overview/Overview.component.tsx

**Checkpoint**: User Story 5 is complete and independently testable.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validate the backend-first recent Overview stage and enforce provider-boundary, i18n, and build quality gates.

- [x] T042 Verify Moralis and Alchemy smoke scripts still pass for Overview dependencies in apps/web/package.json
- [x] T043 Run i18n parity validation for touched namespaces in apps/web/scripts/check-i18n-parity.ts
- [x] T044 Run lint and resolve Overview-related findings through apps/web/eslint.config.mjs
- [x] T045 Run typecheck and resolve Overview typing regressions through apps/web/tsconfig.json
- [x] T046 Run production build validation for the recent Overview stage in apps/web/package.json
- [x] T047 Verify no browser-direct provider calls or public secret exposure were introduced in apps/web/src/features/overview/ and apps/web/src/server/
- [x] T048 Document stage-scope completion and deferred historical analyzed-mode work in specs/003-connected-wallet-overview/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 0 (Constitution Check)**: starts immediately and blocks implementation until the staged scope is explicitly confirmed.
- **Phase 1 (Setup)**: depends on Phase 0.
- **Phase 2 (Foundational)**: depends on Phase 1 and blocks all story work.
- **Phase 3 (US2)**: depends on Phase 2 and delivers the backend-first MVP.
- **Phase 4 (US1)**: depends on Phase 2 and should land after the recent Overview backend contract is stable.
- **Phase 5 (US3)**: depends on Phase 3 because it reuses the recent Overview surface and canonical analysis hooks.
- **Phase 6 (US5)**: depends on Phases 3-5 touching the user-facing strings that need parity.
- **Phase 7 (Polish)**: depends on all desired stories in this stage being complete.

### User Story Dependencies

- **US2 (P1)**: backend-first MVP; no dependency on later stories.
- **US1 (P1)**: depends on foundational contracts and benefits from US2 backend readiness, but remains independently testable once the route and shell are wired.
- **US3 (P2)**: depends on the recent Overview screen and canonical status/start routes, but does not include historical analysis reconstruction.
- **US5 (P3)**: depends on the user-facing Overview, navigation, and analysis states introduced earlier.
- **US4 (Deferred)**: intentionally excluded from this stage by user instruction; historical analyzed-mode delivery is not planned in this task file.

### Within Each User Story

- For **US2**, backend aggregation and persistence tasks come before route wiring, and route wiring comes before frontend rendering.
- For **US1**, route entry and wallet redirect behavior come before lock-state polish.
- For **US3**, API normalization comes before container polling and UI-state rendering.
- For **US5**, translation resources come before final formatting and parity validation.

### Parallel Opportunities

- Setup tasks marked [P] can run together.
- Foundational type, key, hook, and locale scaffold tasks marked [P] can run together.
- In **US2**, mapping and query-module tasks marked [P] can run while the API route integration is stabilizing.
- In **US5**, EN/ES locale-file work can be split across contributors and merged with parity checks.

---

## Parallel Example: User Story 2

```bash
# Parallel recent Overview backend support work
T015 apps/web/src/server/overview/overview.repository.ts
T017 apps/web/src/features/overview/overview.mappers.ts
T018 apps/web/src/features/overview/overview.queries.ts
```

---

## Parallel Example: User Story 5

```bash
# Parallel EN/ES localization work
T036 apps/web/src/i18n/locales/en/overview.json
T037 apps/web/src/i18n/locales/es/overview.json
T038 apps/web/src/i18n/locales/en/navigation.json
T039 apps/web/src/i18n/locales/en/analysis.json
T040 apps/web/src/i18n/locales/en/charts.json
```

---

## Implementation Strategy

### Backend-First MVP

1. Complete Phase 0, Phase 1, and Phase 2.
2. Complete Phase 3 (US2) to establish the recent-data backend and required Overview payload.
3. Add Phase 4 (US1) so the connected route and shell consume the stable backend contract.
4. Validate the MVP before progressing further.

### Incremental Delivery For This Stage

1. Ship the recent Overview backend and UI with 24h/7d/30d recent ranges and at least 7d chart coverage.
2. Add connected-entry and shell routing.
3. Add analysis start/status scaffolding without historical reconstruction.
4. Complete localization and quality gates.

### Deferred Scope

1. Historical analysis reconstruction for analyzed-history mode.
2. Automatic transition into fully analyzed Overview widgets.
3. Standalone Pools, Deposits, Strategies, Rewards, Governance, and Activity feature delivery.

---

## Notes

- [P] tasks are safe parallel candidates due to separate files or non-overlapping concerns.
- This stage intentionally stops at recent Overview plus analysis status/start scaffolding; do not add historical analyzed-mode tasks here.
- All provider access must remain server-side, and no `NEXT_PUBLIC` provider secrets may be introduced.
- All user-facing copy must remain localized and use the existing i18n formatter helpers.