# Implementation Plan: Connected Settings Screen MVP

**Branch**: `007-settings-screen` | **Date**: 2026-05-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-settings-screen/spec.md`

## Summary

Deliver a Stage 1 connected Settings feature as a dedicated `/settings` route inside the existing connected shell. The route exposes four sections — Wallet, Analysis, Display, Diagnostics — that are usable immediately after wallet connection and signature authentication, without requiring a completed historical analysis. The plan reuses the existing `useCabWallet` auth model, Overview-era feature module pattern, typed TanStack Query hooks, design-system primitives, and i18n infrastructure. It normalizes the canonical analysis status vocabulary and mode naming at one boundary, ships a real wallet- and chain-scoped Settings API around persisted user preferences, sources every diagnostic value from already-truthful internal contracts (analysis status, overview freshness), and completes EN/ES copy in the `settings` namespace with required parity additions in adjacent namespaces. Theme switching, CSV/export, deletion of stored analysis data, advanced notifications, and any new historical-analysis pipeline work are explicitly out of scope.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19, Next.js 16 App Router  
**Primary Dependencies**: Next.js, TanStack Query 5.x, wagmi 3.x, WalletConnect connectors, i18next/react-i18next + browser language detector, Drizzle ORM, pg, Zod 4.x, Tamagui 2.0.0-rc.42, existing The Cab design-system primitives  
**Storage**: PostgreSQL via Drizzle. New `user_preferences` rows scoped by `(chainId, walletAddress)` for wallet-scoped preferences and by `(walletAddress)` with `chainId = null` for app-wide preferences such as language. Existing `analysis_runs` and `wallet_contexts` (overview freshness) remain the source of truth for derived diagnostics.  
**Testing**: ESLint 9, TypeScript `tsc --noEmit`, Next.js build, `pnpm i18n:check`, focused route/query validation for `/api/settings` and Settings container, explicit regression checks for unsupported-chain handling and coverage-state rendering, unit tests for `normalizeLocale()` and locale-formatting helpers, code search for provider-boundary regressions  
**Target Platform**: Next.js App Router web application inside `apps/web` running on Vercel-style request handling; server-only provider access  
**Project Type**: Feature module addition inside an existing full-stack web application  
**Performance Goals**: Settings first paint must not block on analysis polling; preference reads/writes complete within the existing connected-route budget; no new long-running requests; reuse existing query cache to avoid extra network traffic when Settings is opened after Overview.  
**Constraints**: Base mainnet only for product v1; no browser-direct Moralis/Alchemy/Trigger.dev calls; chain-aware API + query keys + persistence; no hardcoded user-facing copy; reuse existing connected shell, sidebar, top nav, status badge, and action primitives; no new historical-analysis pipeline; no theme switching; no CSV export; no deletion of stored analysis data; no diagnostics values that the current Stage 1 system cannot truthfully produce.  
**Scale/Scope**: One new App Router page (`/settings`), one new feature module (`src/features/settings/*`), one new wallet-scoped Settings API (`GET`/`POST /api/settings`), one new `user_preferences` table + repository, one canonical analysis-status normalizer used by Overview and Settings, expanded `settings` namespace plus targeted EN/ES key additions in `navigation`, `analysis`, `coverage`, `wallet`, `common`, and `errors`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Brand consistency gate: **PASS**. Settings reuses existing dark control-tower shell, status badge, metric/card, and action primitives. New copy is restrained, technical, and audit-friendly. No casino/meme/retail framing.
- Localization gate: **PASS**. The plan completes EN/ES copy in `settings` (currently a `{ "title": "TODO" }` scaffold at [apps/web/src/i18n/locales/en/settings.json](apps/web/src/i18n/locales/en/settings.json) and [apps/web/src/i18n/locales/es/settings.json](apps/web/src/i18n/locales/es/settings.json)) and adds only the keys actually required in adjacent namespaces. No hardcoded strings in components or container. Resource parity enforced by `pnpm i18n:check`.
- Chain-awareness gate: **PASS**. Wallet-scoped preferences carry `chainId`; app-wide preferences explicitly mark `chainId = null`. API accepts `chainId`. Query keys reuse `queryKeys.settings({ chainId, walletAddress })` already defined at [apps/web/src/queries/keys.ts](apps/web/src/queries/keys.ts#L40).
- Provider/API gate: **PASS**. No browser-direct provider access. Settings consumes only `/api/settings`, the existing analysis start/status routes, and the existing overview refresh path.
- Explainability gate: **PASS**. Diagnostics values are sourced exclusively from `analysis_runs` + `wallet_contexts` (overview freshness) + Overview response coverage metadata. Values that cannot be produced truthfully are omitted, not defaulted.

Post-Phase-1 re-check: all five gates still **PASS**. No exceptions tracked in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/007-settings-screen/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── settings-api-contract.md
└── tasks.md                # generated later by /speckit.tasks
```

### Source Code (repository root)

```text
apps/web/
├── src/
│   ├── app/
│   │   ├── settings/
│   │   │   └── page.tsx                              # new connected route, auth-gated like /overview
│   │   └── api/
│   │       └── settings/
│   │           └── route.ts                          # new GET + POST handlers
│   ├── features/
│   │   └── settings/
│   │       ├── Settings.container.tsx                # orchestration, hooks, view-model assembly
│   │       ├── Settings.component.tsx                # presentational, receives translated props
│   │       ├── settings.queries.ts                   # local query/mutation wrappers
│   │       ├── settings.mappers.ts                   # server payload + analysis status -> view model
│   │       └── settings.types.ts                     # feature-local types
│   ├── analysis/
│   │   └── analysisStatus.ts                         # NEW: canonical status + mode vocabulary, single adapter
│   ├── design-system/
│   │   └── data-display/
│   │       └── CabAnalysisStatusBadge.tsx            # updated: align status union with canonical vocab
│   ├── i18n/
│   │   └── locales/
│   │       ├── en/
│   │       │   ├── settings.json                     # populated EN copy (was TODO scaffold)
│   │       │   ├── navigation.json                   # add settings nav state strings if needed
│   │       │   ├── analysis.json                     # add settings-action labels
│   │       │   ├── coverage.json                     # reuse existing keys
│   │       │   ├── wallet.json                       # add disconnect/refresh helper copy
│   │       │   ├── common.json                       # add shared section/control labels
│   │       │   └── errors.json                       # add Settings API error code mappings
│   │       └── es/                                   # full parity with EN
│   ├── queries/
│   │   ├── hooks.ts                                  # tighten useSettingsQuery + useUpdateSettingsMutation
│   │   └── keys.ts                                   # already provides queryKeys.settings; unchanged
│   └── server/
│       ├── settings/
│       │   ├── settings.repository.ts                # Drizzle access to user_preferences
│       │   ├── settings.service.ts                   # read/write + sanitization + defaults
│       │   └── settings.types.ts                     # SettingsRequest/SettingsResponse types
│       └── db/
│           ├── schema.ts                             # add user_preferences table
│           └── migrations/                           # add migration for user_preferences
└── scripts/
    └── check-i18n-parity.ts                          # unchanged; runs against new settings keys
```

**Structure Decision**: Add a single new App Router entry (`src/app/settings/page.tsx`), a new feature module (`src/features/settings/*`) following the established Overview pattern, a new server module (`src/server/settings/*`) with its own Drizzle repository and a new `user_preferences` table, and a single shared `src/analysis/analysisStatus.ts` module that normalizes the analysis status vocabulary and mode naming so Overview, Settings, and the design-system badge converge on one truth. Do not introduce a new global store, a new browser-facing provider contract, or a parallel Overview-refresh route.

## Phase 0: Outline & Research

Research completed for the eight planning decisions called out in the user input:

1. **Canonical analysis status vocabulary and mode naming.** The Overview server, Overview client, and analysis status route already use `not_analyzed | queued | running | ready | stale | failed` (see [apps/web/src/app/api/analysis/status/route.ts](apps/web/src/app/api/analysis/status/route.ts)). The design-system badge still types `not_started` ([apps/web/src/design-system/data-display/CabAnalysisStatusBadge.tsx](apps/web/src/design-system/data-display/CabAnalysisStatusBadge.tsx#L5)). Decision: adopt `not_analyzed | queued | running | ready | stale | failed` as canonical; rename the badge union from `not_started` to `not_analyzed` and add a neutral tone mapping. For analysis mode, adopt the existing schema and route enum `full_history | incremental` ([apps/web/src/app/api/analysis/start/route.ts](apps/web/src/app/api/analysis/start/route.ts)). Settings uses `full_history` for `Start full analysis` and `Retry analysis`, and `incremental` for `Update analysis`. The previously documented `incremental_update` naming is not adopted.
2. **Auth and route gating.** Reuse the gating model already used by `/overview` and the landing redirect ([apps/web/src/app/overview/page.tsx](apps/web/src/app/overview/page.tsx), [apps/web/src/app/page.tsx](apps/web/src/app/page.tsx)). `/settings` waits for `isAuthReady`, then redirects to `/` when `status === "disconnected"` or `!isAuthenticated`. If the user is authenticated but `!isSupportedChain`, the route must resolve to the existing unsupported-chain handling rather than mounting the Settings surface. The nav `Settings` item flips from `comingSoon` to `active` based on `isAuthenticated && isSupportedChain`, independent of analysis readiness.
3. **Settings API contract and data ownership.** Replace the placeholder `useSettingsQuery` (currently `enabled: false` at [apps/web/src/queries/hooks.ts](apps/web/src/queries/hooks.ts#L202)) with a real GET/POST contract over a new `user_preferences` table. Three categories: persisted (`defaultOverviewRange` wallet+chain scoped; `languagePreference` app-wide), derived read-only (`analysis`, `overviewFreshness`, `coverage`), client-only ephemeral UI state (toast/visibility, never persisted). See `contracts/settings-api-contract.md` and `data-model.md`.
4. **Overview refresh behavior from Settings.** Reuse `useWarmOverviewMutation` ([apps/web/src/queries/hooks.ts](apps/web/src/queries/hooks.ts#L120)) which hits `/api/wallet/overview/warmup` and is already integrated by Overview ([apps/web/src/features/overview/Overview.container.tsx](apps/web/src/features/overview/Overview.container.tsx)). Settings invokes the warmup mutation with the user's current default range and on success invalidates the Overview query keys via the existing `queryKeys.overview*` family. No new browser-facing refresh API is introduced.
5. **Diagnostics scope.** Truthful signals only: canonical analysis status, last successful run at, last updated at, last run ID (all from `/api/analysis/status`), Overview freshness label (`recent_view` vs `analyzed_view` derived from analysis status, never invented), and provider-partial / missing-price coverage when present in the existing Overview response under `coverage.reasonCodes`. Omitted in Stage 1: unsupported-event counts, last processed block, deep ingestion internals.
6. **Display scope.** Stage 1 configurable: `languagePreference` (`en | es`) and `defaultOverviewRange` (existing `OverviewRange` union). Fixed for MVP: `currency = "USD"`, `theme = "cab-dark"`, both presented as locked indicators with localized helper copy, not as controls. Number-format customization is not exposed; the existing formatter API at [apps/web/src/i18n/formatters.ts](apps/web/src/i18n/formatters.ts) is locale-driven and would require a non-trivial signature change to accept a user override, which is out of scope here.
7. **Frontend/state architecture.** TanStack Query owns Settings server state via a sharpened `useSettingsQuery` (enabled when auth-ready, wallet known, supported chain) and `useUpdateSettingsMutation` (invalidates `queryKeys.settings(...)` on success, and on language change calls `i18n.changeLanguage`). Analysis actions reuse `useStartAnalysisMutation` and `useAnalysisStatusQuery`. No new Zustand store. Components stay presentational; container owns mutations and view-model shaping.
8. **Localization/formatting.** Populate the `settings` namespace in EN and ES. Add only the keys actually needed in `navigation`, `analysis`, `coverage`, `wallet`, `common`, and `errors`. Use existing `formatters.ts` helpers for absolute and relative timestamps in Diagnostics and for any numeric values. Locale resolution priority remains explicit preference → browser locale → English fallback; when the user updates `languagePreference`, the container calls `i18n.changeLanguage()` after mutation success to avoid a hard reload.

Output captured in [research.md](./research.md).

## Phase 1: Design & Contracts

Design outputs produced in this phase:

1. **Data model** for `user_preferences`, the Settings request/response, analysis/overview-derived diagnostics, and the canonical analysis status normalizer in [data-model.md](./data-model.md).
2. **Contract** for `GET /api/settings` and `POST /api/settings`, including auth/chain validation, error codes, default-value semantics, and the read-only diagnostics block, in [contracts/settings-api-contract.md](./contracts/settings-api-contract.md).
3. **Quickstart** for implementation sequencing, local validation, and quality gates in [quickstart.md](./quickstart.md).
4. **Agent context update** in `.github/copilot-instructions.md` pointed at this plan.

## Phase 2: Implementation Planning Approach

Execution sequence for `/speckit.tasks` (dependency-ordered, narrow Stage 1 scope):

1. **Canonical analysis status + mode normalization**
   - Add `src/analysis/analysisStatus.ts` exporting the `AnalysisStatus` union, the `AnalysisMode` union, and a single `mapToAnalysisStatus()` adapter.
   - Update `CabAnalysisStatusBadge` to use the canonical union (`not_analyzed` replaces `not_started`).
   - Reuse the module from Overview mapper, Settings mapper, and any other status surface; do not duplicate the enum across files.

2. **Backend: `user_preferences` table and repository**
   - Add Drizzle schema + migration for `user_preferences` keyed by `(walletAddress, chainId, key)` where `chainId` is nullable for app-wide preferences.
   - Implement `src/server/settings/settings.repository.ts` with `readPreferences()` and `upsertPreferences()`.
   - Implement `src/server/settings/settings.service.ts` to assemble the Settings response (persisted preferences + derived diagnostics + fixed-for-MVP metadata) and to validate writes against an allowlist of preference keys + values.

3. **Backend: `/api/settings` route**
   - Implement `GET /api/settings` (validates `walletAddress` + `chainId`, returns persisted preferences with documented defaults, derived diagnostics sourced from `analysis_runs` + `wallet_contexts`, and `meta` describing fixed-for-MVP and supported value sets).
   - Implement `POST /api/settings` (Zod-validated body, allowlisted keys, chain assertion, returns the same response shape as GET).
   - Use stable machine error codes: `VALIDATION_FAILED`, `UNSUPPORTED_CHAIN`, `SETTINGS_REQUEST_FAILED`. No raw provider payloads exposed.

4. **Frontend: sharpened query hooks**
   - Update `useSettingsQuery` to be `enabled` when `walletAddress && chainId && isAuthenticated && isSupportedChain`, with `staleTime: 30_000` matching the repo default.
   - Update `useUpdateSettingsMutation` to send a typed payload, invalidate `queryKeys.settings(...)` on success, and surface stable error codes for the container.

5. **Frontend: route, container, component**
   - Add `src/app/settings/page.tsx` mirroring `/overview` auth gating (waits for `isAuthReady`; redirects on disconnected or unauthenticated; resolves authenticated unsupported-chain visits through the existing unsupported-chain handling; renders nothing during the transient unauthenticated state).
   - Add `src/features/settings/Settings.container.tsx` orchestrating `useCabWallet`, `useSettingsQuery`, `useUpdateSettingsMutation`, `useAnalysisStatusQuery`, `useStartAnalysisMutation`, and `useWarmOverviewMutation`. Container assembles a typed view model via `settings.mappers.ts`.
   - Add `Settings.component.tsx` rendering four sections from props using existing DS primitives (`CabPageHeader`, card surfaces, `CabAnalysisStatusBadge`, action buttons, technical address/hash text style). Component is pure presentational.

6. **Nav enablement**
   - Update `getOverviewNavigationItems()` in [apps/web/src/features/overview/overview.mappers.ts](apps/web/src/features/overview/overview.mappers.ts) so the `settings` item resolves to `stateKey: "active"` and `disabled: false` whenever the connected user is authenticated on a supported chain, independent of analysis readiness. Deep sections (Pools/Deposits/Strategies/Rewards/Governance/Activity) keep current analysis-gated behavior.

7. **Diagnostics view model**
   - In `settings.mappers.ts`, derive the Diagnostics block strictly from: analysis status payload, overview freshness fields (`lastAnalyzedAt`, `lastSuccessfulRunId`), and any `coverage.reasonCodes` already returned by `/api/wallet/overview`. Omit any value not directly derivable.
   - Use existing locale-aware helpers from [apps/web/src/i18n/formatters.ts](apps/web/src/i18n/formatters.ts) for timestamps and relative times.

8. **Display section behavior**
   - Render `languagePreference` and `defaultOverviewRange` as controls bound to mutation handlers.
   - Render `currency: USD` and `theme: cab-dark` as fixed-for-MVP indicators using localized helper text, not toggles.
   - On `languagePreference` mutation success, call `i18n.changeLanguage(nextLocale)` so the locale switch is in-session and does not require a reload (FR-061).
   - On `defaultOverviewRange` mutation success, invalidate Overview query keys so a subsequent Overview visit reflects the new default.

9. **Wallet section behavior**
   - Wire `Disconnect` to `useCabWallet().disconnect()`. After disconnect, the existing `/overview`-style guard at `/settings` will trigger redirect to `/`.
   - Wire `Refresh Overview data` to `useWarmOverviewMutation` with the user's current default range. On success, invalidate `queryKeys.overview*` to refresh Overview shell + slice queries when next visited.

10. **Analysis section behavior**
    - Read status from `useAnalysisStatusQuery`. Map UI action visibility from canonical status:
      - `not_analyzed` → `Start full analysis` (`mode: "full_history"`)
      - `failed` → `Retry analysis` (`mode: "full_history"`)
      - `ready | stale` → `Update analysis` (`mode: "incremental"`)
      - `queued | running` → no action; show progress messaging only
    - Show `lastSuccessfulRunAt`, `lastUpdatedAt`, `runId` when available, formatted via locale helpers.

11. **Localization completion**
    - Populate `settings.json` EN/ES with semantic keys (`title`, `sections.wallet.*`, `sections.analysis.*`, `sections.display.*`, `sections.diagnostics.*`, `actions.*`, `helper.fixedForMvp.*`).
    - Add only the deltas required in `navigation`, `analysis`, `coverage`, `wallet`, `common`, and `errors`. Keys stay camelCase and semantic.
    - Run `pnpm i18n:check` to enforce EN/ES key-structure parity.

12. **Validation and hardening**
      - Add or extend focused tests for `normalizeLocale()` and locale-formatting helpers used by Settings timestamps and numeric displays.
      - Run `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm i18n:check` from `apps/web`.
    - Code search to confirm no new browser-facing third-party provider access:
      - `rg "@/server/providers|moralis|alchemy|trigger" src/features/settings src/app/settings`.
    - Direct route validation for `GET /api/settings` and `POST /api/settings` with a syntactically valid address.
      - Regression validation for direct `/settings` visits on an unsupported chain so the route resolves to the existing unsupported-chain handling rather than rendering an authenticated Settings surface.
      - Regression validation for coverage-state rendering so provider-partial, missing-price, and omitted diagnostics states match the documented truthful-diagnostics rules.
    - Manual verification that Settings remains usable in `not_analyzed`, `queued`, `running`, `ready`, `stale`, and `failed` states.

Delivery boundaries:

- Included: connected `/settings` route, Wallet/Analysis/Display/Diagnostics sections, new wallet- and chain-scoped Settings API, new `user_preferences` table, canonical analysis-status/mode normalization at one boundary, nav enablement for Settings, EN/ES copy completion in `settings` + targeted parity deltas elsewhere, Overview-refresh reuse via existing warmup mutation.
- Excluded: any work on the Trigger.dev historical reconstruction pipeline beyond what already exists, unlocking of Pools/Deposits/Strategies/Rewards/Governance/Activity, theme switching, CSV/export, deletion of stored analysis data, advanced notification center, full diagnostics console, number-format customization, currency switching, new browser-facing provider contracts, and any new Overview-refresh API.

## Complexity Tracking

No constitution violations requiring exception tracking. The one tightly-scoped cross-feature change — renaming the design-system status union from `not_started` to `not_analyzed` and centralizing the analysis vocabulary in `src/analysis/analysisStatus.ts` — is justified because the existing inconsistency between the badge primitive and the API/Overview vocabulary would otherwise force Settings to introduce a second adapter and re-fragment the status vocabulary.
