# Feature Specification: Connected Settings Screen MVP

**Feature Branch**: `007-settings-screen`  
**Created**: 2026-05-24  
**Status**: Draft  
**Input**: User description: "Connected Settings Screen MVP — a real `/settings` destination for connected wallets that gives users operational control over wallet and analysis actions, honest Stage-1 display preferences, and truthful diagnostics, without requiring the deeper historical-analysis pipeline to be complete."

**Current Delivery Stage**: The active implementation scope for this feature directory is Stage 1: a connected `/settings` route with Wallet, Analysis, Display, and Diagnostics sections that work before historical analysis is ready. This stage closes the connected-prototype gap left by the existing landing and Overview surfaces. It does not implement the real Trigger.dev historical analysis pipeline, does not unlock Pools, Deposits, Strategies, Rewards, Governance, or Activity, and does not introduce theme switching, CSV export, deletion of stored analysis data, advanced notifications, or a full diagnostics console.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reach Settings Immediately After Connecting A Wallet (Priority: P1)

As a connected user, I need Settings to be a real connected destination I can open as soon as my wallet is connected so the app feels complete and so I can manage my session without depending on completed historical analysis.

**Why this priority**: Settings is currently a placeholder in the connected navigation. Until Settings is a real screen, the connected shell looks unfinished and the user has no operational control surface beyond Overview.

**Independent Test**: Can be fully tested by connecting a supported wallet, clicking the Settings entry in the connected navigation, and verifying that a dedicated `/settings` route loads with usable sections before any historical analysis is started or completed.

**Acceptance Scenarios**:

1. **Given** a connected wallet on Base mainnet, **When** the user opens Settings from the connected navigation, **Then** the app navigates to a dedicated Settings route that renders Wallet, Analysis, Display, and Diagnostics sections.
2. **Given** a connected wallet with no analysis run started, **When** Settings loads, **Then** the screen is fully usable and does not block on analysis readiness.
3. **Given** a disconnected visitor or a wallet on an unsupported chain, **When** they attempt to reach the Settings route directly, **Then** they are redirected back to the disconnected experience or shown the existing unsupported-chain handling rather than a broken authenticated surface.

---

### User Story 2 - Manage Wallet And Analysis Actions From One Place (Priority: P1)

As a connected user, I need Settings to expose wallet identity controls and the analysis lifecycle controls in one place so I can disconnect, refresh Overview data, start a historical analysis, retry a failed analysis, or update an existing analysis without hunting across the connected shell.

**Why this priority**: These are the few operational actions a prototype-stage user actually needs. They are the difference between Settings feeling like a real product surface and feeling like a placeholder.

**Independent Test**: Can be fully tested by exercising each control on Settings for wallets in the relevant states (not analyzed, queued, running, ready, stale, failed) and verifying the action reaches the existing analysis or wallet contracts without inventing parallel APIs.

**Acceptance Scenarios**:

1. **Given** a connected wallet with no completed analysis, **When** the user starts a full analysis from Settings, **Then** the existing analysis-start flow is invoked and Settings reflects the new queued or running state without a page reload.
2. **Given** an analysis run is in `failed` state, **When** the user retries from Settings, **Then** a new run is requested through the existing analysis-start contract and Settings updates to the resulting queued or running state.
3. **Given** an existing analysis is `ready` or `stale`, **When** the user requests an update or incremental refresh from Settings, **Then** the action is dispatched through the canonical analysis-start contract using the agreed canonical mode naming and Settings reflects the new status.
4. **Given** the user clicks `Refresh Overview data` from the Wallet section, **When** the action runs, **Then** the connected Overview recent-view data is refreshed using the existing Overview refresh path without bypassing the internal API.
5. **Given** the user clicks `Disconnect` from the Wallet section, **When** the action completes, **Then** the wallet is disconnected, the connected app exits to the disconnected experience, and no authenticated calls continue.

---

### User Story 3 - Adjust Honest Stage-1 Display Preferences (Priority: P2)

As a connected user, I need Settings to expose only the display preferences the product can actually apply today so I can change behavior I can see, without being misled by toggles that have no effect.

**Why this priority**: Honest display preferences make Settings useful immediately, while preventing the prototype from advertising configurability that does not exist yet.

**Independent Test**: Can be fully tested by changing each Stage-1 display preference and verifying that the rest of the app reflects the new value where supported, and that no Stage-1 preference is exposed unless the product can honor it.

**Acceptance Scenarios**:

1. **Given** the user changes the active language preference, **When** they confirm the change, **Then** the app re-renders user-facing copy using the selected locale on the current screen and on Overview, using locale-aware formatting helpers.
2. **Given** the user changes the default Overview range, **When** they return to Overview, **Then** Overview opens at that range by default while still allowing per-session range changes.
3. **Given** Stage-1 scope locks currency to USD and theme to The Cab dark theme, **When** Settings renders the Display section, **Then** those values are shown as fixed for MVP rather than as configurable controls.
4. **Given** number-format customization is not supported by the current formatter architecture, **When** Settings renders, **Then** no number-format toggle is shown.

---

### User Story 4 - Inspect Truthful Diagnostics Without Misleading Detail (Priority: P2)

As a connected user, I need Settings to show truthful diagnostics about the current data state so I can understand whether I am looking at recent provider data, what the current analysis status is, and how fresh the Overview data is, without being shown developer internals that do not yet exist.

**Why this priority**: Diagnostics make the product feel auditable and honest. They also keep the prototype from over-claiming.

**Independent Test**: Can be fully tested by loading Settings for wallets across `not_analyzed`, `queued`, `running`, `ready`, `stale`, and `failed` analysis states, and verifying that Diagnostics reflects the same truthful state already exposed by Overview and the analysis status contract.

**Acceptance Scenarios**:

1. **Given** Overview is showing recent provider data with no completed analysis, **When** the user opens Diagnostics, **Then** Settings shows that the app is in recent-view mode, with the current Overview freshness and analysis status.
2. **Given** a previous analysis exists, **When** Diagnostics renders, **Then** it shows the last successful analysis timestamp, the last updated timestamp, the last run ID, and the canonical analysis status.
3. **Given** provider responses are partial or prices are missing, **When** Diagnostics renders, **Then** it surfaces an honest provider-partial or missing-price indicator only when the underlying coverage state already exposes that signal.
4. **Given** a diagnostic value cannot be produced truthfully (for example, unsupported-event counts or last processed block in Stage 1), **When** Diagnostics renders, **Then** that value is omitted rather than fabricated or shown as `0`.

---

### User Story 5 - Use Settings In English Or Spanish (Priority: P3)

As an English- or Spanish-speaking user, I need every Setting label, helper text, action button, status badge, and diagnostic value to be localized and to use locale-aware formatting so Settings is consistent with the rest of the product.

**Why this priority**: Localization and explainability are product-wide commitments; Settings is not acceptable if it relies on placeholder copy, mixed languages, or non-localized timestamps.

**Independent Test**: Can be fully tested by switching browser locale between EN and ES and verifying that every label, helper text, button, status badge, and formatted value renders in the active locale, with English fallback for unsupported locales.

**Acceptance Scenarios**:

1. **Given** browser locale is Spanish, **When** Settings loads, **Then** all section titles, control labels, action buttons, helper text, status badges, and diagnostic explanations render in Spanish.
2. **Given** browser locale is unsupported, **When** Settings loads, **Then** the screen falls back to English consistently.
3. **Given** Settings displays timestamps, counts, or other numeric values, **When** the locale changes, **Then** those values re-render using locale-aware formatting helpers.

### Edge Cases

- A user reaches `/settings` directly while disconnected or while connected on an unsupported chain.
- A wallet has never run analysis, so analysis fields such as last successful run, last run ID, and last updated timestamp are null.
- An analysis run is currently `queued` or `running`, so update and retry actions must be disabled or replaced by progress messaging.
- An analysis run is `failed`, so the canonical action becomes retry rather than start.
- An analysis is `stale` because the last successful run is older than the documented staleness threshold, and Settings must reflect the same stale read-model state as Overview without claiming an automatic incremental refresh exists yet.
- The user changes their language preference and the change must propagate to other connected surfaces and to subsequent visits without forcing a hard reload.
- The user changes the default Overview range while Overview is open in another tab or earlier in the session, and Settings must persist the preference without corrupting the active session range.
- The user disconnects from Settings; the connected shell must not continue to poll authenticated APIs for that wallet.
- Diagnostics cannot truthfully produce a value because the underlying signal does not exist yet, and Settings must omit rather than fabricate it.
- Settings is rendered before Overview has been visited, so derived diagnostics must still load from the canonical analysis status and overview freshness contracts.
- The user has a stored preference value that is no longer supported (for example, a removed range option), and Settings must fall back to the documented default without erroring.
- Stored preferences should remain wallet-scoped where they reasonably are, while truly app-wide preferences such as language may apply across wallets if the existing repo already treats them that way.

## Requirements *(mandatory)*

### Stage Scope Constraint *(mandatory)*

- The current implementation stage for this feature directory is limited to the connected Settings route and its Wallet, Analysis, Display, and Diagnostics sections.
- This stage MUST reuse existing analysis start and status contracts and existing wallet adapters instead of introducing parallel infrastructure.
- This stage MUST NOT implement the real Trigger.dev historical analysis pipeline, deletion of stored wallet analysis data, theme switching, CSV export, advanced notification center, or a full diagnostics console.
- This stage MUST NOT require Pools, Deposits, Strategies, Rewards, Governance, or Activity sections to be implemented.
- This stage MUST NOT expose diagnostics that the current system cannot truthfully produce.

### Functional Requirements

#### 1) Feature Summary And Stage Scope

- **FR-001**: The system MUST provide a dedicated connected Settings feature as a first-class destination in the connected shell.
- **FR-002**: Settings MUST be available immediately after wallet connection and MUST NOT require a completed historical analysis to load or to be usable.
- **FR-003**: Settings MUST be implemented as a real route at `/settings`, not as a modal, drawer, or Overview subsection.
- **FR-004**: Settings MUST be tightly scoped to prototype-completion value and MUST NOT expand into general configuration surface beyond Stage 1.

#### 2) Connected Routing And Shell

- **FR-005**: The connected Settings entry route MUST be implemented at `/settings` through `src/app/settings/page.tsx` or an equivalent single route-level file in the App Router.
- **FR-006**: The Settings feature MUST follow the existing repo feature pattern under `src/features/settings/` with `Settings.container.tsx`, `Settings.component.tsx`, `settings.queries.ts`, `settings.mappers.ts`, and `settings.types.ts`, unless planning identifies a repo-wide approved equivalent.
- **FR-007**: Settings MUST reuse the existing connected shell, sidebar, top navigation, section framing, and action primitives provided by The Cab design system.
- **FR-008**: Settings MUST NOT create duplicate connected-shell, sidebar, top-nav, status-badge, metric-card, or analysis-CTA primitives when existing design-system components already satisfy the need.
- **FR-009**: The connected navigation MUST mark Settings as enabled whenever the wallet is connected and authenticated, regardless of analysis readiness, and MUST keep deep sections governed by analysis status as already established.
- **FR-010**: A direct visit to `/settings` without a connected, authenticated, supported-chain wallet MUST resolve to the existing disconnected or unsupported-chain handling.

#### 3) Wallet Section Behavior

- **FR-011**: The Wallet section MUST show the connected wallet address using the existing technical address presentation.
- **FR-012**: The Wallet section MUST show the active chain and MUST preserve Base-mainnet-only product behavior for v1.
- **FR-013**: The Wallet section MUST show the authenticated wallet state where the connected experience already exposes one.
- **FR-014**: The Wallet section MUST expose a `Disconnect` action that cleanly exits the connected experience.
- **FR-015**: The Wallet section MUST expose a `Refresh Overview data` action that triggers the existing Overview recent-view refresh path through the internal API, not a parallel data path.
- **FR-016**: The Wallet section MUST NOT introduce browser-direct calls to Moralis, Alchemy, or any third-party provider.

#### 4) Analysis Section Behavior

- **FR-017**: The Analysis section MUST show the current canonical analysis status using the same enum already used by Overview and the analysis status endpoint.
- **FR-018**: The Analysis section MUST show the last successful run timestamp, the last updated timestamp, and the last run identifier when those values are available.
- **FR-019**: The Analysis section MUST expose actions for `Start full analysis`, `Retry analysis` when failed, and `Update analysis` when ready or stale, all routed through the existing analysis start contract.
- **FR-020**: The Analysis section MUST NOT introduce a new analysis API; it MUST consume the existing analysis start and status contracts.
- **FR-021**: This feature MUST resolve and document the canonical analysis mode naming when the existing product documentation and the existing analysis-start scaffolding disagree (for example, `full_history`, `incremental`, `incremental_update`), and MUST use that resolved naming consistently in Settings, hooks, API payloads, and UI copy.
- **FR-022**: The Analysis section MUST disable or hide actions that are not valid for the current status (for example, no `Update` action while a run is `queued` or `running`).
- **FR-023**: The Analysis section MUST NOT imply that historical analysis is complete or available just because Settings exposes lifecycle controls.
- **FR-024**: The Analysis section MUST NOT expose deletion of stored wallet analysis data in this stage.

#### 5) Display Section Behavior

- **FR-025**: The Display section MUST be limited to preferences the product can actually honor in Stage 1.
- **FR-026**: The Display section MUST include a language preference control with at least the supported product locales (English and Spanish) when language is treated as a user-controlled preference.
- **FR-027**: The Display section MUST include a default Overview range control whose value is honored when the user next opens Overview.
- **FR-028**: The Display section MUST present currency as fixed to USD for MVP rather than as a configurable control.
- **FR-029**: The Display section MUST present theme as locked to The Cab dark theme for MVP rather than as a configurable control.
- **FR-030**: The Display section MUST only expose number-format customization if the current formatter architecture can honor it cleanly; otherwise it MUST omit that control.
- **FR-031**: The Display section MUST clearly distinguish persisted user preferences from session-only UI state, and MUST NOT persist controls that are intended to be ephemeral.
- **FR-032**: When language preference is exposed as a user-controlled preference, the resolution priority MUST be: explicit user preference, then browser locale, then English fallback.
- **FR-033**: A persisted preference whose stored value is no longer supported MUST fall back to the documented default rather than producing an invalid UI state.

#### 6) Diagnostics Section Behavior

- **FR-034**: The Diagnostics section MUST surface a small, restrained set of truthful indicators about the current data state and MUST NOT expose developer internals by default.
- **FR-035**: The Diagnostics section MUST visually separate normal user-facing diagnostics from any optional advanced details when present.
- **FR-036**: Diagnostics MUST be allowed to include: current Overview freshness, current canonical analysis status, last successful analysis timestamp, last run identifier, current coverage posture, whether the app is showing recent-view data, and provider-partial or missing-price indicators when those signals are already truthfully exposed by Overview or analysis status.
- **FR-037**: Diagnostics MUST NOT include unsupported-event counts, last processed block, deep ingestion internals, or other values that the current Stage-1 system cannot produce truthfully.
- **FR-038**: Diagnostics values that cannot be produced truthfully MUST be omitted, not fabricated, defaulted to `0`, or shown as placeholders.

#### 7) Backend And API Surface

- **FR-039**: Persisted user preferences MUST be served through internal application endpoints, using `GET /api/settings` and `POST /api/settings` as defined in the product technical specification.
- **FR-040**: The Settings API MUST validate wallet address, supported chain, and connected-wallet authorization when the preference is wallet-scoped.
- **FR-041**: The Settings API MUST keep wallet-scoped preferences keyed by `walletAddress` and `chainId` where appropriate, and MUST clearly mark app-wide preferences such as language when they are not wallet-scoped.
- **FR-042**: Derived diagnostics in Settings MUST be sourced from existing internal contracts (Overview, analysis status, overview freshness) and MUST NOT be re-implemented through new endpoints.
- **FR-043**: The spec MUST treat persisted user preferences, derived backend status, and client-only ephemeral UI state as three distinct categories, and the planning artifact MUST be able to assign each Settings field to exactly one category.
- **FR-044**: Settings API responses MUST sanitize provider errors into safe user-facing and log-facing forms and MUST NOT return raw third-party response bodies to the browser.
- **FR-045**: The Settings API MUST return consistent validation and failure codes for unsupported chain, invalid wallet, and generic Settings failure scenarios.

#### 8) State Management And Frontend Architecture

- **FR-046**: TanStack Query MUST own Settings server state, including loading, mutating, and invalidating persisted preferences.
- **FR-047**: Existing analysis queries and mutations MUST remain the source of truth for analysis actions used from Settings.
- **FR-048**: Zustand MAY be used only for shared client UI state that already follows the repo pattern; new global stores MUST NOT be introduced just to back Settings.
- **FR-049**: Settings components MUST remain presentational and MUST NOT call TanStack Query, Zustand, wagmi, or raw `fetch` directly.
- **FR-050**: Settings containers MUST own orchestration, mutations, and view-model preparation, following the existing `*.container.tsx` and `*.component.tsx` separation.
- **FR-051**: Settings MUST reuse existing typed query and mutation hooks where they exist (for example, the Settings query and update hooks, the analysis start and status hooks, and the Overview refresh path) instead of duplicating them.

#### 9) Security And Provider Boundaries

- **FR-052**: Settings MUST NOT introduce `NEXT_PUBLIC` environment variables for Moralis, Alchemy, Trigger.dev, or any provider secret.
- **FR-053**: Browser code in the Settings feature MUST call only internal application routes or other server-owned interfaces.
- **FR-054**: Third-party provider calls triggered by Settings actions MUST execute only inside server modules, server routes, or equivalent server-owned boundaries.
- **FR-055**: Settings MUST NOT expose provider secrets, raw third-party payloads, or unsafe debug data in user-facing diagnostics.

#### 10) Localization And Formatting

- **FR-056**: All user-facing copy introduced or touched by Settings MUST be sourced from translation keys and MUST NOT be hardcoded in UI components, containers, or status panels.
- **FR-057**: The feature MUST complete English and Spanish copy in the `settings` namespace, plus any required additions to `navigation`, `analysis`, `coverage`, `wallet`, `common`, and `errors`.
- **FR-058**: Section titles, control labels, action buttons, status badges, helper text, empty states, loading states, and error states MUST be localized.
- **FR-059**: Settings MUST use locale-aware helpers for currency, balances, percentages, absolute dates, relative times, and counts.
- **FR-060**: English and Spanish translation resources MUST preserve the same key structure for all namespaces changed by this feature.
- **FR-061**: When language preference is exposed in Settings, changing it MUST update product-wide locale resolution per FR-032 without forcing a hard reload of the application.

#### 11) Explainability And Product Honesty

- **FR-062**: Settings MUST communicate which controls are configurable in this stage and which values are fixed for MVP, using localized helper text rather than implied conventions.
- **FR-063**: Settings MUST NOT imply that historical analysis is already complete or available just because Settings exists.
- **FR-064**: Settings MUST preserve The Cab control-tower brand tone and MUST avoid hype, casino, meme, or retail-trading product language.

#### 12) Quality And Scope Boundaries

- **FR-065**: Settings MUST be implementable independently of Pools, Deposits, Strategies, Rewards, Governance, and Activity sections.
- **FR-066**: Settings MUST reuse current repo infrastructure wherever it already exists instead of redesigning app providers, query plumbing, wallet state, or server provider modules.
- **FR-067**: Settings MUST NOT require landing or Overview work to be redone.
- **FR-068**: Settings MUST pass lint, typecheck, build, and i18n parity quality gates before being considered complete.

### Constitution Alignment Requirements *(mandatory)*

- **CA-001 Brand**: Feature MUST preserve The Cab control-tower brand tone and avoid hype, casino, meme, and retail-trading product language in user-facing surfaces.
- **CA-002 Localization**: Feature MUST define i18n namespace impact (primarily the `settings` namespace, with parity additions to `navigation`, `analysis`, `coverage`, `wallet`, `common`, and `errors`) and prohibit hardcoded user-facing copy in UI.
- **CA-003 Localization Formatting**: Feature MUST specify locale-aware formatting impact for timestamps, counts, percentages, currency where shown, and balances surfaced in diagnostics or summaries.
- **CA-004 Chain Awareness**: Feature MUST define `chainId` handling across the Settings route, the Settings API contract, persistence of wallet-scoped preferences, and derived diagnostics.
- **CA-005 Provider Boundaries**: Feature MUST keep all Moralis, Alchemy, and Trigger.dev access on the server, MUST consume only internal contracts from the browser, and MUST NOT introduce parallel data paths around existing analysis or Overview endpoints.
- **CA-006 Explainability**: Feature MUST describe coverage, status, freshness, and fallback behavior so diagnostics reflect actual system state rather than aspirational future state.

### Key Entities *(include if feature involves data)*

- **Settings View Model**: A composed view representation passed from the Settings container to the Settings component, including wallet summary, analysis summary, display preferences, diagnostics summary, and current locale.
- **Wallet Settings Summary**: A read-only summary of the connected wallet, including address, chain, and authentication state, plus the available wallet actions (`Disconnect`, `Refresh Overview data`).
- **Analysis Settings Summary**: A read-only summary of analysis lifecycle state, including canonical status, last successful run timestamp, last updated timestamp, and last run identifier, plus the actions available for the current status (`Start full analysis`, `Retry analysis`, `Update analysis`).
- **Display Preference**: A persisted, user-controllable preference such as language preference or default Overview range, with a documented default and a documented fallback when the stored value is unsupported.
- **Diagnostics Summary**: A restrained set of truthful indicators about current data state, sourced exclusively from existing Overview and analysis contracts, omitting any value the current system cannot produce honestly.
- **Persisted User Preference**: A backend-stored Settings field, scoped by `walletAddress` and `chainId` when relevant, served through `GET /api/settings` and updated through `POST /api/settings`.
- **Derived Settings Status**: A read-only value computed from existing internal contracts (Overview, analysis status, overview freshness) and exposed in Settings without re-implementation.
- **Settings Request**: A wallet- and chain-scoped request used to load or update Settings, including authentication context where required.
- **Settings Response**: A structured payload separating persisted user preferences, derived backend status, and metadata required for honest UI rendering (for example, supported locales, supported Overview ranges, and which controls are fixed for MVP).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A connected user reaches a dedicated `/settings` route from the connected navigation in 100% of validation sessions, with Wallet, Analysis, Display, and Diagnostics sections all visible on first load.
- **SC-002**: Settings is enabled and usable in 100% of validation wallets that have no completed historical analysis, including wallets in `not_analyzed`, `queued`, `running`, and `failed` analysis states.
- **SC-003**: Wallet actions (`Disconnect`, `Refresh Overview data`) and analysis actions (`Start full analysis`, `Retry analysis`, `Update analysis`) all reach the existing internal contracts and update Settings state without page reloads in 100% of validation runs for the applicable analysis status.
- **SC-004**: Every display preference exposed in Settings is actually honored elsewhere in the product in 100% of validation runs, and no Stage-1 display control is exposed if the product cannot apply it.
- **SC-005**: Every diagnostic value shown in Settings matches the same value exposed by Overview or the analysis status contract for the same wallet and chain, with zero fabricated, defaulted, or placeholder diagnostics.
- **SC-006**: English and Spanish parity is preserved for every key introduced in the `settings`, `navigation`, `analysis`, `coverage`, `wallet`, `common`, and `errors` namespaces touched by this feature.
- **SC-007**: The browser continues to consume only internal application APIs for this feature; no browser-direct calls to Moralis, Alchemy, or Trigger.dev are introduced.
- **SC-008**: Settings is shipped without introducing parallel analysis or Overview data paths; all wallet, analysis, and Overview-refresh actions reuse the existing contracts used by Overview.
- **SC-009**: The canonical analysis mode naming used by Settings, the analysis hooks, the analysis start API, and product documentation is the same string in 100% of code paths after this feature ships.
- **SC-010**: Settings passes lint, typecheck, build, and i18n parity quality gates before completion.

## Assumptions

- The existing connected Overview recent-view, including analysis start and status scaffolding and overview freshness metadata, is already in place and is the canonical source of truth for derived diagnostics.
- The existing `useCabWallet` adapter, design-system primitives, query hooks, and analysis API routes are sufficient and MUST be reused rather than redesigned.
- Product v1 remains Base mainnet only; future chain expansion stays compatible because Settings remains chain-aware.
- Full historical analysis reconstruction remains follow-up infrastructure work; Settings ships before that pipeline is real and MUST NOT pretend otherwise.
- The settings i18n namespace currently exists as scaffolding only and is expected to be populated by this feature in both English and Spanish with semantic keys.
- Wallet-scoped preferences belong in backend Settings storage; truly app-wide preferences such as language may live in app-wide storage if the repo already treats them that way, but the planning artifact will confirm this allocation.
- Language preference, default Overview range, currency (USD), and theme (The Cab dark theme) are the candidate Display fields for Stage 1, with currency and theme presented as fixed for MVP.
- Diagnostics are intentionally restrained in Stage 1; richer diagnostics depend on the deeper background-analysis phase and are explicitly deferred.
- This feature is intended to close the connected-prototype gap before the deeper Trigger.dev historical analysis phase begins, not to replace or pre-empt it.
