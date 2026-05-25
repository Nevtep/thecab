# Tasks: Connected Settings Screen MVP

**Input**: Design documents from `/specs/007-settings-screen/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: No explicit TDD or automated test-first requirement was requested for this stage. This task list focuses on implementation work plus the required validation and smoke checks.

**Organization**: Tasks are grouped by user story for independent delivery, with Setup and Foundational phases covering shared Stage 1 work.

**Stage Scope Note**: This task list delivers Stage 1 only for the connected `/settings` destination. It adds the Wallet, Analysis, Display, and Diagnostics sections, the wallet- and chain-scoped Settings API, canonical analysis status/mode normalization, and EN/ES localization required by the plan. It does **not** add theme switching, CSV export, analysis-data deletion, notification center work, deep diagnostics console work, or any new browser-facing provider API.

## Phase 1: Setup (Shared Implementation Surface)

**Purpose**: Reserve the route, feature-module, and server-module implementation surfaces defined by the plan.

- [X] T001 Create the Settings route and feature-module file skeleton in apps/web/src/app/settings/page.tsx, apps/web/src/features/settings/Settings.container.tsx, apps/web/src/features/settings/Settings.component.tsx, apps/web/src/features/settings/settings.queries.ts, apps/web/src/features/settings/settings.mappers.ts, and apps/web/src/features/settings/settings.types.ts
- [X] T002 [P] Create the Settings server-module file skeleton in apps/web/src/app/api/settings/route.ts, apps/web/src/server/settings/settings.types.ts, apps/web/src/server/settings/settings.repository.ts, and apps/web/src/server/settings/settings.service.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the shared contracts, persistence, and canonical vocabularies that every Settings story depends on.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [X] T003 Add the shared canonical analysis vocabulary module in apps/web/src/analysis/analysisStatus.ts
- [X] T004 [P] Align the shared status consumers with the canonical analysis vocabulary in apps/web/src/design-system/data-display/CabAnalysisStatusBadge.tsx and apps/web/src/features/overview/overview.mappers.ts
- [X] T005 [P] Add the `user_preferences` schema and migration in apps/web/src/server/db/schema.ts and apps/web/src/server/db/migrations/
- [X] T006 [P] Define typed Settings request, response, and preference contracts in apps/web/src/server/settings/settings.types.ts and apps/web/src/features/settings/settings.types.ts
- [X] T007 Implement `readPreferences()` and `upsertPreferences()` for `user_preferences` in apps/web/src/server/settings/settings.repository.ts
- [X] T008 Implement Settings service composition for defaults, fixed-for-MVP metadata, and sanitized error handling in apps/web/src/server/settings/settings.service.ts
- [X] T009 Implement `GET /api/settings` and `POST /api/settings` with wallet auth, chain validation, and stable error codes in apps/web/src/app/api/settings/route.ts
- [X] T010 Tighten the shared Settings query and mutation hook contracts in apps/web/src/queries/hooks.ts
- [X] T011 [P] Add or extend tests for `normalizeLocale()` and locale-formatting helpers used by Settings in apps/web/src/i18n/config.ts, apps/web/src/i18n/formatters.ts, and the relevant test files

**Checkpoint**: Shared Settings contracts, persistence, and status vocabulary are ready for story work.

---

## Phase 3: User Story 1 - Reach Settings Immediately After Connecting A Wallet (Priority: P1) 🎯 MVP

**Goal**: Make `/settings` a real connected destination that loads immediately after wallet connection and signature auth, without waiting for completed historical analysis.

**Independent Test**: Connect a supported wallet, open Settings from the connected navigation, and verify that `/settings` renders Wallet, Analysis, Display, and Diagnostics sections before any analysis run has completed.

### Implementation for User Story 1

- [X] T012 [P] [US1] Add feature-local Settings query wrappers and initial view-model scaffolding in apps/web/src/features/settings/settings.queries.ts and apps/web/src/features/settings/settings.mappers.ts
- [X] T013 [US1] Implement the auth-gated `/settings` App Router entry, including existing unsupported-chain handling for authenticated unsupported wallets, in apps/web/src/app/settings/page.tsx
- [X] T014 [US1] Implement the Settings container load path that waits for auth readiness but does not block on analysis readiness in apps/web/src/features/settings/Settings.container.tsx
- [X] T015 [US1] Implement the four-section connected Settings shell with existing design-system primitives in apps/web/src/features/settings/Settings.component.tsx
- [X] T016 [US1] Enable the connected Settings navigation item for authenticated supported wallets in apps/web/src/features/overview/overview.mappers.ts

**Checkpoint**: Connected users can reach a real `/settings` surface even when analysis is not ready.

---

## Phase 4: User Story 2 - Manage Wallet And Analysis Actions From One Place (Priority: P1)

**Goal**: Let connected users disconnect, refresh Overview data, and control the analysis lifecycle from Settings without introducing new browser-facing APIs.

**Independent Test**: Exercise Settings with wallets in `not_analyzed`, `queued`, `running`, `ready`, `stale`, and `failed` states and verify that each Wallet or Analysis action routes through the existing internal contracts and updates the UI without a page reload.

### Implementation for User Story 2

- [X] T017 [US2] Map wallet summary state, address display, chain display, and connected-wallet actions in apps/web/src/features/settings/settings.mappers.ts and apps/web/src/features/settings/Settings.container.tsx
- [X] T018 [US2] Map canonical analysis actions by status using the existing analysis start and status hooks in apps/web/src/features/settings/settings.mappers.ts and apps/web/src/features/settings/Settings.container.tsx
- [X] T019 [US2] Reuse the existing warm Overview refresh path and query invalidation flow for the Wallet section in apps/web/src/features/settings/Settings.container.tsx
- [X] T020 [US2] Render Wallet and Analysis action controls, invalid-state disabling, and progress messaging in apps/web/src/features/settings/Settings.component.tsx
- [X] T021 [US2] Ensure Disconnect exits the connected experience cleanly through apps/web/src/app/settings/page.tsx and apps/web/src/features/settings/Settings.container.tsx

**Checkpoint**: Settings drives wallet and analysis actions through the existing contracts without parallel infrastructure.

---

## Phase 5: User Story 3 - Adjust Honest Stage-1 Display Preferences (Priority: P2)

**Goal**: Expose only the Stage 1 display preferences the product can really honor: language and default Overview range, while showing USD and The Cab dark theme as fixed-for-MVP values.

**Independent Test**: Change language and default Overview range from Settings and verify that locale changes apply in-session, Overview picks up the saved default range on return, and no unsupported display toggles are shown.

### Implementation for User Story 3

- [X] T022 [US3] Implement server-side preference defaulting and unsupported-value fallback rules for `languagePreference` and `defaultOverviewRange` in apps/web/src/server/settings/settings.service.ts
- [X] T023 [US3] Map Display-section preference state, mutation payloads, and post-success invalidation behavior in apps/web/src/features/settings/settings.mappers.ts, apps/web/src/features/settings/settings.queries.ts, and apps/web/src/features/settings/Settings.container.tsx
- [X] T024 [US3] Render the Display section controls plus fixed USD and Cab-dark indicators in apps/web/src/features/settings/Settings.component.tsx
- [X] T025 [US3] Apply in-session locale switching and Overview default-range invalidation after successful preference updates in apps/web/src/features/settings/Settings.container.tsx

**Checkpoint**: Stage 1 display preferences are honest, persisted correctly, and visibly honored by the product.

---

## Phase 6: User Story 4 - Inspect Truthful Diagnostics Without Misleading Detail (Priority: P2)

**Goal**: Show only the diagnostics the current Stage 1 system can produce truthfully, using existing Overview and analysis contracts.

**Independent Test**: Load Settings for wallets across `not_analyzed`, `queued`, `running`, `ready`, `stale`, and `failed` states and verify that Diagnostics matches the existing analysis-status and Overview freshness signals without inventing unsupported values.

### Implementation for User Story 4

- [X] T026 [US4] Assemble derived diagnostics from analysis status, overview freshness, and coverage reason codes in apps/web/src/server/settings/settings.service.ts
- [X] T027 [US4] Map diagnostics freshness, run metadata, and coverage posture into the Settings view model in apps/web/src/features/settings/settings.mappers.ts
- [X] T028 [US4] Render the restrained Diagnostics section with omission of unsupported values in apps/web/src/features/settings/Settings.component.tsx
- [X] T029 [US4] Add explicit regression coverage for provider-partial, missing-price, and omitted-diagnostics rendering in the relevant Settings test files or validation harness

**Checkpoint**: Diagnostics are auditable and truthful without exposing developer-only internals.

---

## Phase 7: User Story 5 - Use Settings In English Or Spanish (Priority: P3)

**Goal**: Localize every Settings label, helper, action, status, and diagnostic value in English and Spanish with locale-aware formatting.

**Independent Test**: Switch locale between English and Spanish and verify that Settings section titles, controls, buttons, badges, helper text, and formatted timestamps all render with EN/ES parity and English fallback for unsupported locales.

### Implementation for User Story 5

- [X] T030 [P] [US5] Add English Settings copy and required namespace additions in apps/web/src/i18n/locales/en/settings.json, apps/web/src/i18n/locales/en/navigation.json, apps/web/src/i18n/locales/en/analysis.json, apps/web/src/i18n/locales/en/coverage.json, apps/web/src/i18n/locales/en/wallet.json, apps/web/src/i18n/locales/en/common.json, and apps/web/src/i18n/locales/en/errors.json
- [X] T031 [P] [US5] Add Spanish parity for Settings and required namespace additions in apps/web/src/i18n/locales/es/settings.json, apps/web/src/i18n/locales/es/navigation.json, apps/web/src/i18n/locales/es/analysis.json, apps/web/src/i18n/locales/es/coverage.json, apps/web/src/i18n/locales/es/wallet.json, apps/web/src/i18n/locales/es/common.json, and apps/web/src/i18n/locales/es/errors.json
- [X] T032 [US5] Wire localized labels, helper text, status badges, and locale-aware formatting into apps/web/src/features/settings/Settings.component.tsx and apps/web/src/features/settings/settings.mappers.ts

**Checkpoint**: Settings is fully localized for English and Spanish with no hardcoded product copy.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Run the required quality gates and final feature-specific validation for the Stage 1 Settings slice.

- [X] T033 Run EN/ES parity validation for Settings namespaces with apps/web/scripts/check-i18n-parity.ts using `cd apps/web && pnpm i18n:check`
- [X] T034 Run TypeScript validation for the Settings feature using `cd apps/web && pnpm typecheck`
- [X] T035 Run lint validation for the Settings feature using `cd apps/web && pnpm lint`
- [X] T036 Run production build validation for the connected Settings route using `cd apps/web && pnpm build`
- [X] T037 Validate browser-provider boundaries with `cd apps/web && rg "@/server/providers|moralis|alchemy|trigger" src/features/settings src/app/settings`
- [X] T038 Validate `GET /api/settings` and `POST /api/settings` against the contract in apps/web/src/app/api/settings/route.ts and specs/007-settings-screen/contracts/settings-api-contract.md
- [X] T039 Validate direct `/settings` visits on disconnected and unsupported-chain states through apps/web/src/app/settings/page.tsx and the existing unsupported-chain handling path
- [X] T040 Validate coverage-state rendering for provider-partial, missing-price, and omitted-diagnostics paths through apps/web/src/features/settings/Settings.component.tsx and apps/web/src/features/settings/settings.mappers.ts
- [X] T041 Validate direct-route gating, wallet actions, analysis actions, display preferences, and truthful diagnostics manually through apps/web/src/app/settings/page.tsx and apps/web/src/features/settings/Settings.container.tsx

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Starts immediately and reserves the route, feature-module, and server-module files.
- **Foundational (Phase 2)**: Depends on Setup and blocks all story work.
- **User Story 1 (Phase 3)**: Depends on Foundational and delivers the Stage 1 MVP route.
- **User Story 2 (Phase 4)**: Depends on User Story 1 because the action surface needs the connected route and view-model shell in place.
- **User Story 3 (Phase 5)**: Depends on Foundational and can proceed after the Settings route exists; it does not require Diagnostics localization to land first.
- **User Story 4 (Phase 6)**: Depends on Foundational and the Settings shell from User Story 1 so diagnostics have a rendered destination.
- **User Story 5 (Phase 7)**: Depends on the UI vocabulary from User Stories 1 through 4 so translation keys match the final Stage 1 interface.
- **Polish (Phase 8)**: Depends on all desired story work being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Can start once the foundational contracts and API are ready.
- **User Story 2 (P1)**: Depends on User Story 1.
- **User Story 3 (P2)**: Depends on Foundational plus the rendered Settings shell from User Story 1.
- **User Story 4 (P2)**: Depends on Foundational plus the rendered Settings shell from User Story 1.
- **User Story 5 (P3)**: Depends on the final UI vocabulary and diagnostics wording from User Stories 1 through 4.

### Within Each User Story

- Shared route and container wiring come before presentational rendering.
- API and persistence work come before preference and diagnostics mapping.
- Mapping and mutation orchestration come before final component rendering.
- Localization follows the stabilized UI vocabulary.
- Validation tasks run after the relevant implementation slice is complete.

### Parallel Opportunities

- In **Phase 1**, T001 and T002 can run in parallel.
- In **Phase 2**, T004, T005, T006, and T011 can run in parallel after T003 exists.
- In **User Story 1**, T012 can run in parallel with T013.
- In **User Story 5**, T030 and T031 can run in parallel.
- After **Phase 2** completes, User Stories 1, 3, and 4 can be staffed in parallel if the team coordinates the shared Settings feature files carefully.

---

## Parallel Example: User Story 1

```bash
# Parallel route-entry and view-model prep
Task: "Add feature-local Settings query wrappers and initial view-model scaffolding in apps/web/src/features/settings/settings.queries.ts and apps/web/src/features/settings/settings.mappers.ts"
Task: "Implement the auth-gated /settings App Router entry in apps/web/src/app/settings/page.tsx"
```

---

## Parallel Example: User Story 5

```bash
# Parallel EN/ES localization work
Task: "Add English Settings copy and required namespace additions in apps/web/src/i18n/locales/en/settings.json and related EN namespaces"
Task: "Add Spanish parity for Settings and required namespace additions in apps/web/src/i18n/locales/es/settings.json and related ES namespaces"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. **Stop and validate** the `/settings` route before adding actions, preferences, and diagnostics.

### Incremental Delivery

1. Deliver User Story 1 to make Settings reachable and usable immediately after connection.
2. Add User Story 2 to make Wallet and Analysis actions operational.
3. Add User Story 3 to make honest Stage 1 display preferences functional.
4. Add User Story 4 to expose truthful diagnostics.
5. Add User Story 5 to complete EN/ES localization and locale-aware formatting.
6. Finish with the Phase 8 quality gates and manual smoke validation.

### Deferred Scope

1. Theme switching.
2. CSV export.
3. Notification center work.
4. Analysis-data deletion.
5. Deep diagnostics console work.
6. Any new historical-analysis pipeline work.
7. Any browser-facing Moralis, Alchemy, or Trigger.dev API.

## Notes

- [P] tasks target different files or can be split cleanly without blocking each other.
- Each user story is independently testable against the connected Settings route and existing internal contracts.
- The generated tasks preserve server-only provider ownership, the existing analysis start/status contracts, and the Overview warmup path.