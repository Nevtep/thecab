# Phase 0 Research: Connected Settings Screen MVP

**Feature**: `007-settings-screen`  
**Date**: 2026-05-24  
**Scope**: Resolve every NEEDS CLARIFICATION captured during planning so the implementation plan can proceed without open architectural questions.

---

## R1. Canonical analysis status vocabulary

**Decision**: Adopt `not_analyzed | queued | running | ready | stale | failed` as the single canonical analysis status vocabulary across server (`/api/analysis/status`, `/api/wallet/overview`), Overview feature, Settings feature, and the design-system status badge. Introduce `apps/web/src/analysis/analysisStatus.ts` as the one and only source of the `AnalysisStatus` union and the mapping helper.

**Rationale**:
- `/api/analysis/status` and the Overview server types already use `not_analyzed` (see [apps/web/src/app/api/analysis/status/route.ts](apps/web/src/app/api/analysis/status/route.ts) and [apps/web/src/server/overview/overview.types.ts](apps/web/src/server/overview/overview.types.ts)).
- Only the design-system primitive [apps/web/src/design-system/data-display/CabAnalysisStatusBadge.tsx](apps/web/src/design-system/data-display/CabAnalysisStatusBadge.tsx) deviates with `not_started`.
- Settings is a new consumer; aligning now prevents a second adapter and stops fragmentation.

**Alternatives considered**:
- Keep `not_started` in the DS and translate in every consumer — rejected: forces every feature to own a parallel adapter; constitution explainability gate prefers one truth.
- Rename API → `not_started` — rejected: API response is observable and shipped; renaming would force breaking changes in Overview without benefit.

---

## R2. Canonical analysis mode naming

**Decision**: Use `full_history | incremental` (the values already accepted by the Zod schema in `/api/analysis/start` and by `useStartAnalysisMutation`). Do not introduce `incremental_update`.

**Rationale**:
- The server enum at [apps/web/src/app/api/analysis/start/route.ts](apps/web/src/app/api/analysis/start/route.ts) and the related `analysisMode` enum in [apps/web/src/server/env.ts](apps/web/src/server/env.ts) already use these values.
- Settings is a consumer of an existing route; coining a third name would be churn without payoff.

**Settings → mode mapping**:
- `Start full analysis` → `full_history`
- `Retry analysis` → `full_history`
- `Update analysis` → `incremental`

---

## R3. Settings authentication and route gating

**Decision**: `/settings` reuses the exact gating sequence already used by `/overview`: wait for `useCabWallet().isAuthReady`; if `status === "disconnected"` or `!isAuthenticated`, redirect to `/`; otherwise render. The Settings nav item flips from `stateKey: "comingSoon"` to `stateKey: "active"` when `isConnected && isAuthenticated && isSupportedChain` — it does NOT require analysis to be `ready`.

**Rationale**:
- This pattern is already battle-tested by Overview (see [apps/web/src/app/overview/page.tsx](apps/web/src/app/overview/page.tsx)) and the landing redirect (see [apps/web/src/app/page.tsx](apps/web/src/app/page.tsx)).
- Settings is intentionally usable in `not_analyzed`, `queued`, `running`, `failed`, and `stale` states (see FR-006 and the four-section design).

**Alternatives considered**:
- Allow `/settings` without a signature — rejected: violates the Stage 1 connected-mode contract documented in repo memory and the auth gate principle.
- Gate Settings nav on `ready` — rejected: the whole point of Stage 1 Settings is to expose the entry point that lets the user start the analysis.

---

## R4. Settings API contract and data ownership

**Decision**: Implement a real `GET /api/settings?walletAddress=&chainId=` and `POST /api/settings` backed by a new `user_preferences` table. The response carries three concerns:

- `preferences`: persisted (writable). For Stage 1 only `languagePreference` (app-wide; `chainId = null` row) and `defaultOverviewRange` (wallet- and chain-scoped).
- `diagnostics`: derived read-only. Canonical analysis status, `lastSuccessfulRunAt`, `lastUpdatedAt`, `runId`, Overview freshness label, coverage reason codes from the existing Overview response.
- `meta`: server-declared fixed-for-MVP values (`currency: "USD"`, `theme: "cab-dark"`) and supported value sets (`supportedLanguages`, `supportedOverviewRanges`).

Replace the placeholder `useSettingsQuery` (currently `enabled: false`) and `useUpdateSettingsMutation` (currently `Record<string, unknown>`) with typed wrappers around this contract.

**Rationale**:
- The existing hooks are scaffolds — typing them now formalizes the boundary.
- Splitting persisted, derived, and meta in the response keeps the client mapper unambiguous about what is editable.

**Alternatives considered**:
- Use the existing `wallet_contexts.metadataJson` to store preferences — rejected: misuses a table whose purpose is overview freshness and would conflate concerns.
- A per-key set of routes (`/api/settings/language`, etc.) — rejected: needless surface area for Stage 1.

---

## R5. Overview refresh behavior

**Decision**: Settings’ `Refresh Overview data` action calls the existing `useWarmOverviewMutation` (which posts to `/api/wallet/overview/warmup`) and on success invalidates `queryKeys.overview*` so the next Overview visit reads fresh data. No new browser-facing refresh API is introduced.

**Rationale**:
- Overview already integrates this mutation (see [apps/web/src/features/overview/Overview.container.tsx](apps/web/src/features/overview/Overview.container.tsx)).
- The warmup endpoint is the existing, server-side, provider-disciplined refresh boundary; reusing it satisfies the provider/API constitution gate without proliferation.

**Alternatives considered**:
- A `/api/settings/refresh` route — rejected: redundant; would duplicate warmup behavior.
- Triggering analysis from the Refresh button — rejected: refresh is a fast-path Moralis re-read, not a historical analysis run.

---

## R6. Diagnostics scope (truthful signals only)

**Decision**: Diagnostics in Stage 1 surfaces strictly values already produced by the current system:

- Canonical analysis status (`AnalysisStatus`).
- `lastSuccessfulRunAt`, `lastUpdatedAt`, `runId` from `/api/analysis/status`.
- Overview freshness label (`recent_view` vs `analyzed_view`) derived from analysis status, via the canonical normalizer.
- Coverage reason codes already attached to `/api/wallet/overview` responses (e.g. `provider_partial`, `missing_prices`).

Omitted in Stage 1: unsupported-event counts, last-processed block height, raw ingestion error logs, full provider attribution console.

**Rationale**:
- Constitution V (explainability) prohibits invented diagnostics.
- Spec FR-037/FR-038 forbid fabricated values.

---

## R7. Display scope

**Decision**: Stage 1 exposes two preferences:

- `languagePreference` — app-wide (`chainId = null`), values `en | es`. Default = resolved by current i18n detector (explicit → browser → English).
- `defaultOverviewRange` — wallet- and chain-scoped, values from the existing `OverviewRange` union. Default = the existing Overview default.

The Display section also shows `currency: USD` and `theme: cab-dark` as fixed-for-MVP indicators with localized helper copy (`helper.fixedForMvp.currency`, `helper.fixedForMvp.theme`). No theme switching, no per-locale number format override, no alternate currency.

**Rationale**:
- The current formatter API at [apps/web/src/i18n/formatters.ts](apps/web/src/i18n/formatters.ts) is locale-driven; adding per-user overrides would require changing every formatter signature and Tamagui theme integration, which is out of scope.
- Theme switching is explicitly out-of-scope per spec.

---

## R8. Frontend/state architecture and localization

**Decision**:

- TanStack Query owns Settings server state. `useSettingsQuery` is `enabled` when `walletAddress && chainId && isAuthenticated && isSupportedChain`. `useUpdateSettingsMutation` invalidates `queryKeys.settings(...)` on success. On language change, the container calls `i18n.changeLanguage()` after mutation success.
- Analysis actions reuse `useStartAnalysisMutation` and `useAnalysisStatusQuery`.
- Wallet/refresh actions reuse `useCabWallet().disconnect()` and `useWarmOverviewMutation`.
- No new Zustand store. Container holds local UI state (selected pending value, mutation pending flags). Component is pure presentational, receives translated strings.
- Localization: populate `settings` EN/ES. Add only required deltas in `navigation`, `analysis`, `coverage`, `wallet`, `common`, `errors`. Verify via `pnpm i18n:check`.

**Rationale**:
- The container/component split is the established repo pattern (see Overview).
- Constitution II requires i18n-first copy; reusing existing namespaces minimizes parity risk.

**Alternatives considered**:
- Introduce a `useSettingsStore` in Zustand — rejected: server state is the single source of truth; client UI state is local.

---

## Summary of resolved unknowns

| ID | Topic | Status |
|----|-------|--------|
| R1 | Canonical analysis status vocabulary | Resolved |
| R2 | Canonical analysis mode naming | Resolved |
| R3 | Auth/route gating | Resolved |
| R4 | Settings API contract | Resolved |
| R5 | Overview refresh behavior | Resolved |
| R6 | Diagnostics scope | Resolved |
| R7 | Display scope | Resolved |
| R8 | Frontend/state + i18n | Resolved |

No remaining `NEEDS CLARIFICATION` items.
