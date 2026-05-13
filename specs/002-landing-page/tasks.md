# Tasks: Landing Page

**Input**: Design documents from `/specs/002-landing-page/`
**Prerequisites**: plan.md (required), spec.md (required for user stories)

**Tests**: No explicit TDD/test-first requirement was requested in the feature specification; this task list focuses on implementation and required quality gates.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish landing feature structure and asset workspace.

- [ ] T001 Create landing section component folder structure in apps/web/src/app/landing/components/
- [ ] T002 Create route-level section composition shell in apps/web/src/app/page.tsx
- [ ] T003 [P] Create landing section style modules in apps/web/src/app/landing/components/
- [ ] T004 [P] Create landing public asset directory and naming manifest in apps/web/public/landing/manifest.json
- [ ] T005 Create reusable section wrapper component for consistent IA spacing in apps/web/src/app/landing/components/LandingSectionShell.tsx

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Complete mandatory brand, i18n, wallet-state, and quality foundations before story implementation.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [ ] T006 Define canonical landing namespace structure and key groups in apps/web/src/i18n/locales/en/landing.json
- [ ] T007 [P] Mirror landing namespace key structure for ES parity in apps/web/src/i18n/locales/es/landing.json
- [ ] T008 [P] Add brand-locked typography and numeric utility classes for landing sections in apps/web/src/app/globals.css
- [ ] T009 Create landing wallet CTA state mapper utility using useCabWallet contracts in apps/web/src/app/landing/landingWalletState.ts
- [ ] T010 [P] Add landing asset typing/constants for semantic image usage in apps/web/src/app/landing/landingAssets.ts
- [ ] T011 Establish landing accessibility text key usage (skip link, alt text, decorative labels) in apps/web/src/i18n/locales/en/landing.json
- [ ] T012 [P] Add matching ES accessibility text keys in apps/web/src/i18n/locales/es/landing.json
- [ ] T013 Finalize curated section-to-asset map in apps/web/public/landing/manifest.json

**Checkpoint**: Foundation complete - user stories can now proceed.

---

## Phase 3: User Story 1 - Understand Value and Start Wallet Flow (Priority: P1) 🎯 MVP

**Goal**: Deliver a high-clarity hero/value experience and functional wallet-connect entry point aligned with brand and architecture.

**Independent Test**: Open landing on mobile and desktop, confirm value proposition is clear above the fold, and verify CTA behavior across disconnected/connected/unsupported states.

### Implementation for User Story 1

- [ ] T014 [P] [US1] Implement hero section component with DS-only composition in apps/web/src/app/landing/components/LandingHeroSection.tsx
- [ ] T015 [P] [US1] Implement value proposition blocks component in apps/web/src/app/landing/components/LandingValueBlocksSection.tsx
- [ ] T016 [US1] Implement wallet CTA component with disconnected/connected/unsupported handling in apps/web/src/app/landing/components/LandingWalletCta.tsx
- [ ] T017 [US1] Wire page route composition to include hero and value sections in apps/web/src/app/page.tsx
- [ ] T018 [US1] Apply first-fold mobile-first layout and CTA prominence styles in apps/web/src/app/page.module.css
- [ ] T019 [US1] Populate EN hero/value/CTA copy from copy guideline source keys in apps/web/src/i18n/locales/en/landing.json
- [ ] T020 [US1] Populate ES hero/value/CTA copy adapted from Spanish copy guideline in apps/web/src/i18n/locales/es/landing.json
- [ ] T021 [US1] Move and map curated hero/value assets per manifest from branding/landing/ to apps/web/public/landing/
- [ ] T022 [US1] Integrate selected hero/value assets into hero and value components in apps/web/src/app/landing/components/LandingHeroSection.tsx
- [ ] T023 [US1] Add Base-v1 scoped unsupported-chain guidance copy keys for wallet CTA states in apps/web/src/i18n/locales/en/wallet.json
- [ ] T024 [US1] Add ES parity for unsupported-chain guidance keys in apps/web/src/i18n/locales/es/wallet.json

**Checkpoint**: User Story 1 is complete and independently testable.

---

## Phase 4: User Story 2 - Understand Product Model and Trust Boundaries (Priority: P2)

**Goal**: Explain analysis flow and trust/privacy boundaries with clear, credible, operational content.

**Independent Test**: Scroll landing and verify how-it-works plus trust/privacy sections clearly communicate workflow, read-only posture, and execution boundaries.

### Implementation for User Story 2

- [ ] T025 [P] [US2] Implement how-it-works section component in apps/web/src/app/landing/components/LandingHowItWorksSection.tsx
- [ ] T026 [P] [US2] Implement trust/privacy section component in apps/web/src/app/landing/components/LandingTrustPrivacySection.tsx
- [ ] T027 [P] [US2] Implement final CTA section component in apps/web/src/app/landing/components/LandingFinalCtaSection.tsx
- [ ] T028 [US2] Wire how-it-works, trust/privacy, and final CTA sections into landing route in apps/web/src/app/page.tsx
- [ ] T029 [US2] Add EN how-it-works/trust/final CTA copy blocks from attached guideline map in apps/web/src/i18n/locales/en/landing.json
- [ ] T030 [US2] Add ES how-it-works/trust/final CTA copy blocks from attached guideline map in apps/web/src/i18n/locales/es/landing.json
- [ ] T031 [US2] Move and map curated workflow/trust/coverage assets per manifest from branding/landing/ to apps/web/public/landing/
- [ ] T032 [US2] Bind workflow/trust/coverage assets to section components with semantic alt-label usage in apps/web/src/app/landing/components/LandingHowItWorksSection.tsx
- [ ] T033 [US2] Enforce analysis-vs-execution and read-only trust statements via translation keys in apps/web/src/i18n/locales/en/landing.json
- [ ] T034 [US2] Add ES parity for trust statements and coverage messaging in apps/web/src/i18n/locales/es/landing.json

**Checkpoint**: User Story 2 is complete and independently testable.

---

## Phase 5: User Story 3 - Experience Localized, Accessible, Mobile-First Presentation (Priority: P3)

**Goal**: Ensure complete EN/ES localization parity, accessibility compliance, responsive behavior, and reduced-motion support.

**Independent Test**: Switch locale EN/ES, test keyboard-only navigation, test reduced-motion preference, and verify readability/responsiveness across breakpoints.

### Implementation for User Story 3

- [ ] T035 [P] [US3] Add skip-link and semantic landmark wrappers in landing route in apps/web/src/app/page.tsx
- [ ] T036 [P] [US3] Implement reduced-motion safe animation variants in landing styles in apps/web/src/app/page.module.css
- [ ] T037 [US3] Add focus-visible and keyboard traversal refinements for all interactive controls in apps/web/src/app/page.module.css
- [ ] T038 [US3] Add responsive breakpoint tuning for mobile/tablet/desktop section density in apps/web/src/app/page.module.css
- [ ] T039 [US3] Add EN accessibility and aria label keys used by landing components in apps/web/src/i18n/locales/en/landing.json
- [ ] T040 [US3] Add ES parity for accessibility and aria label keys in apps/web/src/i18n/locales/es/landing.json
- [ ] T041 [US3] Validate landing namespace key parity and fix mismatches in apps/web/src/i18n/locales/
- [ ] T042 [US3] Verify no hardcoded user-facing strings remain in landing components under apps/web/src/app/landing/components/

**Checkpoint**: User Story 3 is complete and independently testable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final hardening, quality validation, and release readiness.

- [ ] T043 [P] [Optional] Add minimal non-invasive landing interaction telemetry hooks in apps/web/src/app/landing/landingTelemetry.ts
- [ ] T044 [Optional] Integrate telemetry calls for hero/final CTA events in apps/web/src/app/landing/components/LandingWalletCta.tsx
- [ ] T045 [P] Optimize selected landing assets for web delivery in apps/web/public/landing/
- [ ] T046 Run localization parity checker and resolve issues using apps/web/scripts/check-i18n-parity.ts
- [ ] T047 Run lint and resolve findings for landing changes from apps/web/eslint.config.mjs
- [ ] T048 Run typecheck and resolve typing issues from apps/web/tsconfig.json
- [ ] T049 Run production build validation and resolve regressions from apps/web/package.json
- [ ] T050 Perform final acceptance review using pass/fail matrix in specs/002-landing-page/checklists/acceptance-matrix.md and feature checklist in specs/002-landing-page/spec.md
- [ ] T051 Validate SC-001 with a usability comprehension check and record results in specs/002-landing-page/checklists/requirements.md
- [ ] T052 Validate SC-002 with CTA discoverability timing checks on mobile/desktop and record results in specs/002-landing-page/checklists/requirements.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: starts immediately.
- **Phase 2 (Foundational)**: depends on Phase 1 and blocks all story phases.
- **Phase 3 (US1)**: depends on Phase 2 completion.
- **Phase 4 (US2)**: depends on Phase 2 completion; can run parallel with US1 if staffed.
- **Phase 5 (US3)**: depends on Phase 2 completion; can run parallel with US1/US2 after foundational i18n keys exist.
- **Phase 6 (Polish)**: depends on completion of all desired stories.

### User Story Dependencies

- **US1 (P1)**: no dependency on other stories; establishes MVP conversion path.
- **US2 (P2)**: independent from US1 logic, but shares route and i18n namespace.
- **US3 (P3)**: independent validation layer applied across the same route/components.

### Within Each User Story

- Section component creation before route composition wiring.
- Translation key additions before localization validation.
- Asset relocation before final image integration.
- Accessibility/reduced-motion refinements before final quality gates.

### Parallel Opportunities

- Setup tasks marked [P] can run together.
- Foundational i18n and style/token tasks marked [P] can run together.
- In each story, section components marked [P] can be implemented concurrently.
- EN and ES locale updates can be split across contributors and merged with parity checks.
- Polish validation tasks can run sequentially once implementation completes.
- Telemetry tasks are optional and should execute only if telemetry is included in v1 scope.

---

## Parallel Example: User Story 1

```bash
# Parallel section implementation
T014 LandingHeroSection.tsx
T015 LandingValueBlocksSection.tsx

# Parallel locale/copy updates
T019 apps/web/src/i18n/locales/en/landing.json
T020 apps/web/src/i18n/locales/es/landing.json
```

---

## Parallel Example: User Story 2

```bash
# Parallel section implementation
T025 LandingHowItWorksSection.tsx
T026 LandingTrustPrivacySection.tsx
T027 LandingFinalCtaSection.tsx

# Parallel guideline-based copy updates
T029 apps/web/src/i18n/locales/en/landing.json
T030 apps/web/src/i18n/locales/es/landing.json
```

---

## Parallel Example: User Story 3

```bash
# Parallel accessibility/localization work
T035 apps/web/src/app/page.tsx
T036 apps/web/src/app/page.module.css
T039 apps/web/src/i18n/locales/en/landing.json
T040 apps/web/src/i18n/locales/es/landing.json
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 (US1).
3. Validate MVP behavior:
   - value proposition clarity in hero
   - wallet CTA state handling
   - mobile-first first-fold layout

### Incremental Delivery

1. Ship US1 (conversion and value clarity).
2. Add US2 (workflow/trust comprehension).
3. Add US3 (localization/accessibility hardening).
4. Finish with polish/quality gates.

### Team Parallel Strategy

1. One engineer handles route/component composition.
2. One engineer handles EN/ES copy and parity.
3. One engineer handles asset curation/accessibility hardening.
4. Recombine for final quality and acceptance checks.

---

## Notes

- [P] tasks are safe parallel candidates due to separate files/concerns.
- All user-facing copy must follow attached EN/ES guideline documents through translation keys.
- Do not introduce provider or analytics logic drift in landing implementation.
- Keep DS-only UI composition and tokenized styling throughout.
