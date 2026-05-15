# Tasks: Wallet Asset Trust Filtering

**Input**: Design documents from `/specs/004-asset-trust-filtering/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: No explicit TDD or test-first requirement was requested for this stage. This task list includes focused validation and quality-gate tasks instead of test-first implementation tasks.

**Organization**: Tasks are grouped by user story for independent delivery, while Setup, Foundational, Localization, and Polish phases handle shared Stage 1 work.

**Stage Scope Note**: This task list delivers Stage 1 only for the connected Overview recent view. It includes backend trust classification, trust-aware asset rows, hidden-asset summary, filtered default totals and distribution, session-only hidden-asset reveal behavior, localization, and validation gates. It does **not** include persistent user visibility overrides, NFT spam filtering, request-time RPC token verification, or integration into Pools, Deposits, Strategies, Rewards, Governance, Activity, or Settings.

## Phase 0: Constitution / Scope Check

**Purpose**: Confirm the implementation stays inside the approved Stage 1 boundary before code changes begin.

- [X] T001 Verify Stage 1 scope, deferred user overrides, normalized-persistence provider flow, provider-boundary rules, and no-hardcoded-copy constraints in specs/004-asset-trust-filtering/plan.md and specs/004-asset-trust-filtering/tasks.md
- [X] T002 Verify the implementation surface remains Overview-only and does not introduce browser provider calls or raw provider trust-field leakage across apps/web/src/features/overview/ and apps/web/src/app/api/wallet/overview/route.ts

---

## Phase 1: Setup (Server Trust Model Foundation)

**Purpose**: Create the shared server-side trust-classification module that every Stage 1 story depends on.

- [X] T003 Create the asset-trust module file skeleton in apps/web/src/server/asset-trust/assetTrust.types.ts, apps/web/src/server/asset-trust/assetTrust.reasonCodes.ts, apps/web/src/server/asset-trust/knownProtocolAssets.ts, and apps/web/src/server/asset-trust/classifyWalletAssetTrust.ts
- [X] T004 Define `TokenTrustStatus`, `TokenTrustReasonCode`, `AssetTrustClassifierInput`, `TokenTrustClassification`, and `classifierVersion` support in apps/web/src/server/asset-trust/assetTrust.types.ts
- [X] T005 [P] Define normalized trust reason-code constants, canonical `OverviewTrustCoverageReasonCode` constants, and trust-or-coverage reason to translation-key mapping expectations in apps/web/src/server/asset-trust/assetTrust.reasonCodes.ts
- [X] T006 [P] Add chain-scoped known protocol asset bootstrap and metadata lookup helpers in apps/web/src/server/asset-trust/knownProtocolAssets.ts
- [X] T007 Implement deterministic trust precedence and conflict handling in apps/web/src/server/asset-trust/classifyWalletAssetTrust.ts
- [X] T008 Implement low-confidence heuristics for dust value, missing metadata, missing logo, suspicious symbols, and missing reliable price in apps/web/src/server/asset-trust/classifyWalletAssetTrust.ts

**Checkpoint**: The server trust model exists and can classify normalized wallet-asset inputs without involving the frontend.

---

## Phase 2: Foundational (Overview Contract And Types Extension)

**Purpose**: Extend the existing Overview contract and types without replacing the current route, query, or block structure.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [X] T009 Extend the server Overview response types with trust fields, hidden summary, default visible count, and exclusion summaries in apps/web/src/server/overview/overview.types.ts
- [X] T010 [P] Extend the feature-side Overview view-model types with trust fields, hidden summary, default visible count, exclusion summaries, and canonical trust-related coverage reason types in apps/web/src/features/overview/overview.types.ts
- [X] T011 [P] Update Overview response mapping to preserve trust fields, canonical trust-related coverage reason codes, and exclusion metadata in apps/web/src/features/overview/overview.mappers.ts
- [X] T012 Normalize the trust-aware `/api/wallet/overview` response contract without changing route semantics in apps/web/src/app/api/wallet/overview/route.ts
- [X] T013 [P] Preserve the existing Overview query and hook contract while carrying the extended trust-aware payload in apps/web/src/features/overview/overview.queries.ts and apps/web/src/queries/hooks.ts
- [X] T051 [P] Verify that existing persistence captures every input required for deterministic trust recomputation; if any `AssetTrustClassifierInput` field is not recoverable from `RawProviderRecord.payloadJson`, `PricePoint`, protocol metadata, `CoverageReport.metadataJson`, or `PortfolioSnapshot.metadataJson`, add a narrow normalized trust-input persistence change in apps/web/src/server/overview/overview.repository.ts and apps/web/src/server/db/schema.ts

**Checkpoint**: The Overview response contract is extended in place and ready for backend integration.

---

## Phase 3: User Story 1 - Hide Suspicious Assets By Default (Priority: P1) 🎯 MVP

**Goal**: Hide suspicious and blocked assets by default in Overview while keeping them in the API payload and excluding them from default server-side totals.

**Independent Test**: Call the internal Overview API for a wallet containing provider-flagged spam or blocked assets and verify that those rows remain in `assets.rows`, are marked `isHiddenByDefault`, and are excluded from default metrics and distribution.

### Implementation for User Story 1

- [X] T014 [US1] Build normalized classifier inputs from persisted or recomputable internal trust metadata derived from `RawProviderRecord.payloadJson`, `PricePoint`, `CoverageReport.metadataJson`, `PortfolioSnapshot.metadataJson`, and known-protocol lookup in apps/web/src/server/overview/getRecentOverview.ts
- [X] T015 [US1] Classify every Overview asset row on the backend and attach trust fields to `assets.rows` in apps/web/src/server/overview/getRecentOverview.ts
- [X] T016 [US1] Keep hidden rows in `assets.rows` while computing `assets.hiddenSummary` and `assets.defaultVisibleCount` in apps/web/src/server/overview/getRecentOverview.ts
- [X] T017 [US1] Exclude hidden spam/blocked assets and unpriced assets from default net portfolio value and default distribution on the server in apps/web/src/server/overview/getRecentOverview.ts
- [X] T018 [P] [US1] Record classifier version, normalized trust-input hydration metadata, and exclusion-summary metadata through apps/web/src/server/overview/overview.repository.ts and apps/web/src/server/overview/getRecentOverview.ts
- [X] T019 [US1] Validate that provider-flagged spam tokens remain in `assets.rows` but are hidden by default and excluded from server totals in apps/web/src/server/overview/getRecentOverview.ts and apps/web/src/app/api/wallet/overview/route.ts

**Checkpoint**: User Story 1 is complete and independently testable as the backend-first MVP.

---

## Phase 4: User Story 2 - Inspect And Understand Hidden Assets (Priority: P1)

**Goal**: Let users reveal hidden assets in-session and understand trust labels and reasons without turning the feature into a security guarantee.

**Independent Test**: Load Overview with hidden assets, reveal them through the UI, and verify that trust badges, reason explanations, and the no-security-guarantee helper all render from server-provided trust fields.

### Implementation for User Story 2

- [X] T020 [P] [US2] Add trust-label and trust-reason mapping helpers for Overview rows in apps/web/src/features/overview/overview.mappers.ts
- [X] T021 [US2] Add session-only `showHiddenAssets` state and derive `visibleRows` and `hiddenRows` in apps/web/src/features/overview/Overview.container.tsx
- [X] T022 [US2] Render the hidden-assets notice and explicit reveal/hide control from `assets.hiddenSummary` in apps/web/src/features/overview/Overview.component.tsx
- [X] T023 [US2] Render trust badges and trust-reason helper text with existing `CabBadge` and `CabTooltip` primitives in apps/web/src/features/overview/Overview.component.tsx
- [X] T024 [US2] Render a separated hidden-asset inspection group and no-security-guarantee helper copy in apps/web/src/features/overview/Overview.component.tsx
- [X] T025 [US2] Validate that session reveal shows hidden rows without recomputing trust or recalculating totals in apps/web/src/features/overview/Overview.container.tsx and apps/web/src/features/overview/Overview.component.tsx

**Checkpoint**: User Story 2 is complete and independently testable.

---

## Phase 5: User Story 3 - Keep Known Protocol Assets Visible And Honest (Priority: P2)

**Goal**: Preserve relevant Aerodrome and related assets in the default view even when generic heuristics are incomplete, while keeping conflicts explainable.

**Independent Test**: Load Overview with known protocol assets that lack a logo or price and verify they remain visible by default, with honest coverage degradation and preserved conflict reasons when suspicious provider signals also exist.

### Implementation for User Story 3

- [X] T026 [P] [US3] Extend chain-scoped known protocol asset sources for Base bootstrap and synced protocol metadata in apps/web/src/server/asset-trust/knownProtocolAssets.ts
- [X] T027 [US3] Apply known-protocol precedence and conflict-preservation rules in apps/web/src/server/asset-trust/classifyWalletAssetTrust.ts
- [X] T028 [US3] Feed known protocol recognition into normalized classifier input assembly in apps/web/src/server/overview/getRecentOverview.ts
- [X] T029 [US3] Validate that known protocol assets remain visible without logo and remain visible but unpriced when Alchemy has no price in apps/web/src/server/overview/getRecentOverview.ts and apps/web/src/server/asset-trust/classifyWalletAssetTrust.ts

**Checkpoint**: User Story 3 is complete and independently testable.

---

## Phase 6: User Story 4 - Keep Portfolio Totals Honest (Priority: P2)

**Goal**: Ensure default Overview totals and distribution stay confidence-aware when suspicious assets are hidden or visible assets are unpriced.

**Independent Test**: Load Overview with a mix of hidden suspicious assets, visible unpriced assets, and priced assets and verify that exclusion summaries and coverage reasons explain exactly why totals are partial or reduced.

### Implementation for User Story 4

- [X] T030 [US4] Add `metrics.exclusions` and `distribution.exclusions` from the server-side visible asset subset in apps/web/src/server/overview/getRecentOverview.ts
- [X] T031 [US4] Extend page-level and block-level coverage reason generation for canonical trust-related reason codes including excluded suspicious assets, low-confidence hidden assets, missing prices, visible unpriced assets, hidden-asset presence, signal conflicts, missing provider trust signals, metadata incompleteness, dust-hidden assets, and valuation partial states in apps/web/src/server/overview/getRecentOverview.ts
- [X] T032 [P] [US4] Map exclusion summaries and trust-aware coverage reasons into the Overview view model in apps/web/src/features/overview/overview.mappers.ts
- [X] T033 [US4] Render exclusion-aware coverage messaging for metrics, distribution, and asset sections in apps/web/src/features/overview/Overview.component.tsx
- [X] T034 [US4] Validate that missing Alchemy price degrades valuation confidence without becoming spam proof and that 100% of returned asset rows carry `trustStatus`, `trustReasonCodes`, and `isHiddenByDefault` in apps/web/src/server/overview/getRecentOverview.ts, apps/web/src/server/overview/overview.types.ts, and apps/web/src/features/overview/overview.types.ts

**Checkpoint**: User Story 4 is complete and independently testable.

---

## Phase 7: User Story 5 - Prepare For User Visibility Overrides (Priority: P3)

**Goal**: Preserve model compatibility for future wallet-scoped visibility overrides without implementing persistence in Stage 1.

**Independent Test**: Inspect the trust types and Overview state flow to verify that future override reason codes and classifier versioning remain available, while no database or API persistence for overrides is introduced.

### Implementation for User Story 5

- [X] T035 [US5] Preserve `userHidden` and `userAllowed` reason codes plus `classifierVersion` support for future override compatibility in apps/web/src/server/asset-trust/assetTrust.types.ts and apps/web/src/features/overview/overview.types.ts
- [X] T036 [US5] Keep hidden-asset reveal behavior session-only and avoid adding preference persistence in apps/web/src/features/overview/Overview.container.tsx and apps/web/src/server/db/schema.ts
- [X] T037 [US5] Validate that no persistent user visibility override flow or new override API is introduced across apps/web/src/server/db/schema.ts, apps/web/src/app/api/, and apps/web/src/features/overview/

**Checkpoint**: User Story 5 compatibility is preserved without expanding Stage 1 scope.

---

## Phase 8: Localization And Coverage Copy

**Purpose**: Add EN/ES parity for trust labels, reasons, reveal controls, and exclusion messaging.

- [X] T038 [P] Add English trust status, trust reason, and helper copy keys in apps/web/src/i18n/locales/en/trust.json
- [X] T039 [P] Add Spanish trust status, trust reason, and helper copy parity in apps/web/src/i18n/locales/es/trust.json
- [X] T040 [P] Register the `trust` namespace and resource wiring in apps/web/src/i18n/config.ts
- [X] T041 [P] Add hidden-asset notice, reveal/hide controls, inspection title, and no-security-guarantee copy in apps/web/src/i18n/locales/en/overview.json and apps/web/src/i18n/locales/es/overview.json
- [X] T042 [P] Add coverage reason text for excluded suspicious assets, low-confidence hidden assets, missing prices, and visible unpriced assets in apps/web/src/i18n/locales/en/coverage.json and apps/web/src/i18n/locales/es/coverage.json
- [X] T043 Add localized trust/filtering copy wiring to Overview rendering without hardcoded strings in apps/web/src/features/overview/Overview.component.tsx

---

## Phase 9: Validation / Polish

**Purpose**: Run the required Stage 1 quality gates and focused trust-filtering validations.

- [X] T044 Run EN/ES parity validation for trust and touched namespaces through apps/web/scripts/check-i18n-parity.ts using `cd apps/web && pnpm i18n:check`
- [X] T045 Run TypeScript validation for trust-filtering changes through apps/web/tsconfig.json using `cd apps/web && pnpm typecheck`
- [X] T046 Run lint validation for trust-filtering changes through apps/web/eslint.config.mjs using `cd apps/web && pnpm lint`
- [X] T047 Run production build validation for Stage 1 trust filtering through apps/web/package.json using `cd apps/web && pnpm build`
- [X] T048 Validate that browser code consumes only internal Overview APIs and never imports or calls Moralis or Alchemy provider modules in apps/web/src/features/overview/ and apps/web/src/app/ with `rg "@/server/providers|moralis|alchemy" apps/web/src/features apps/web/src/app --glob '!**/api/**'`
- [X] T049 Validate raw provider trust fields and normalized reason-code usage stay limited to approved mapping surfaces in apps/web/src/features/overview/ with `rg "possible_spam|verified_contract|moralisPossibleSpam|alchemyMissingPrice" apps/web/src/features`
- [X] T050 Run focused trust-filtering acceptance checks against apps/web/src/server/overview/getRecentOverview.ts and apps/web/src/app/api/wallet/overview/route.ts for spam hiding, `assets.rows` preservation, hidden-row reveal, known protocol visibility, suspicious-symbol handling, visible-unpriced coverage degradation, and zero-visible-total edge cases
- [X] T052 Add route-level validation for `/api/wallet/overview` ensuring provider errors, raw provider response bodies, and trust-internal scoring details are sanitized and never returned to the browser in apps/web/src/app/api/wallet/overview/route.ts

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 0 (Constitution / Scope Check)**: starts immediately and blocks implementation until Stage 1 boundaries are re-confirmed.
- **Phase 1 (Setup)**: depends on Phase 0 and creates the shared server trust model.
- **Phase 2 (Foundational)**: depends on Phase 1 and blocks all user-story work.
- **Phase 3 (US1)**: depends on Phase 2 and delivers the backend-first MVP.
- **Phase 4 (US2)**: depends on Phase 3 because it consumes `assets.hiddenSummary`, trust fields, and server-owned visibility outcomes.
- **Phase 5 (US3)**: depends on Phase 2 and can begin once the classifier skeleton exists, but must land before final validation of the trust model.
- **Phase 6 (US4)**: depends on Phase 3 because exclusion-aware totals build on the server-side visible subset and hidden-summary behavior.
- **Phase 7 (US5)**: depends on Phase 2 and validates future compatibility without adding persistence.
- **Phase 8 (Localization And Coverage Copy)**: depends on Phases 3-7 touching the user-facing trust and coverage surfaces.
- **Phase 9 (Validation / Polish)**: depends on all desired story work being complete.

### User Story Dependencies

- **User Story 1 (P1)**: can start after the foundational phases and is the MVP slice for Stage 1.
- **User Story 2 (P1)**: depends on User Story 1 because it reveals and explains server-classified hidden rows.
- **User Story 3 (P2)**: depends on the classifier foundation and integrates with the backend trust pipeline; it can overlap with User Story 1 but should complete before final backend validation.
- **User Story 4 (P2)**: depends on User Story 1 because filtered totals and distribution require the backend visible subset first.
- **User Story 5 (P3)**: depends on the foundational trust enums and should remain scope-limited to compatibility, not persistence.

### Within Each User Story

- Backend trust input construction comes before trust classification.
- Deterministic trust-input recoverability must be verified before relying on classifier outputs.
- Trust classification comes before hidden-summary and filtered-total computation.
- Server response changes come before container/component reveal behavior.
- Localization resources come before final UI copy wiring.
- Validation tasks run after the relevant server or UI slice is implemented.

### Parallel Opportunities

- In **Phase 1**, T005 and T006 can run in parallel once the trust types exist.
- In **Phase 2**, T010, T011, and T013 can run in parallel after the server response fields are defined.
- In **User Story 2**, T020 can run in parallel with T021 because mapping helpers and session state touch different files.
- In **User Story 3**, T026 can run in parallel with T027 because metadata lookup and precedence logic are separate files.
- In **Phase 8**, EN and ES locale-file work can run in parallel.

---

## Parallel Example: User Story 2

```bash
# Parallel trust-presentation preparation
Task: "Add trust-label and trust-reason mapping helpers in apps/web/src/features/overview/overview.mappers.ts"
Task: "Add session-only showHiddenAssets state in apps/web/src/features/overview/Overview.container.tsx"
```

---

## Parallel Example: Localization

```bash
# Parallel EN/ES localization work
Task: "Add English trust keys in apps/web/src/i18n/locales/en/trust.json"
Task: "Add Spanish trust keys in apps/web/src/i18n/locales/es/trust.json"
Task: "Add coverage reason text in apps/web/src/i18n/locales/en/coverage.json and apps/web/src/i18n/locales/es/coverage.json"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 0, Phase 1, and Phase 2.
2. Complete Phase 3 (User Story 1).
3. **STOP and VALIDATE**: confirm backend-owned trust classification, hidden-row preservation, and filtered server totals work independently.
4. Demo or ship the backend-first MVP if needed.

### Incremental Delivery

1. Add User Story 1 to establish backend trust classification and default filtering.
2. Add User Story 2 to reveal and explain hidden assets.
3. Add User Story 3 to preserve known protocol assets honestly.
4. Add User Story 4 to refine exclusion-aware totals and coverage behavior.
5. Add User Story 5 compatibility guardrails without adding persistence.
6. Finish localization and quality gates.

### Deferred Scope

1. Persistent `always_show` / `always_hide` user visibility overrides.
2. Pools, Deposits, Strategies, Rewards, Governance, Activity, and Settings trust integration.
3. NFT spam filtering unless NFT rows become part of the existing Overview asset table.
4. Request-time RPC token verification or new pricing providers.

---

## Notes

- [P] tasks are safe parallel candidates because they touch separate files or isolated concerns.
- Hidden assets must remain in `assets.rows`; only server-owned default totals and default visible rendering should exclude them.
- Stage 1 trust classification may run in the Overview request path only after normalized trust inputs have been hydrated from persisted or recomputable internal metadata.
- Frontend code must not compute trust status, reason codes, or filtered totals.
- Normalized reason codes may appear in typed mapping or translation-key mapping logic, but raw provider fields must not leak into frontend components.
- All asset identity remains chain-scoped as `walletAddress + chainId + tokenAddress`.
