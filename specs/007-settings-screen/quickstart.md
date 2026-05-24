# Quickstart: Connected Settings Screen MVP

**Feature**: `007-settings-screen`  
**Date**: 2026-05-24  
**Audience**: Implementer picking up `/speckit.tasks` for this feature.

This quickstart sequences the implementation in dependency order and lists the local validation gates. Read [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md), [data-model.md](./data-model.md), and [contracts/settings-api-contract.md](./contracts/settings-api-contract.md) before starting.

---

## Prerequisites

- Workspace bootstrapped per `apps/web/AGENTS.md` and `apps/web/README.md`.
- Local Postgres available (see [docs/phase-0-local-postgres-runbook.md](../../docs/phase-0-local-postgres-runbook.md)).
- `.env.local` set with `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`, `DATABASE_URL`, and provider keys (for ambient Overview behavior).
- A connected wallet on Base mainnet for manual verification.

---

## Implementation order

1. **Canonical analysis vocabulary (no UI yet)**
   - Create `apps/web/src/analysis/analysisStatus.ts` exporting `AnalysisStatus`, `AnalysisMode`, and `mapToAnalysisStatus(raw)`.
   - Update `CabAnalysisStatusBadge` union from `"not_started"` to `"not_analyzed"`; add the matching tone entry.
   - Replace inline status unions in the Overview mapper(s) with imports from `@/analysis/analysisStatus`.
   - Validate: `pnpm typecheck` from `apps/web/` passes.

2. **Database: `user_preferences` table**
   - Add the Drizzle schema entry per [data-model.md](./data-model.md) §1.1.
   - Generate migration (`pnpm drizzle:generate`) and apply locally.
   - Validate: `pnpm drizzle:migrate` runs cleanly; verify table + unique index with `psql` or Drizzle Studio.

3. **Server: `src/server/settings/*`**
   - Implement `settings.repository.ts` (`readPreferences`, `upsertPreferences`).
   - Implement `settings.service.ts` (compose persisted + derived + meta, enforce allowlist).
   - Validate: unit-style sanity by running the service from a small `tsx` REPL or temporary test page.

4. **Route: `/api/settings`**
   - Implement `GET` and `POST` per [contracts/settings-api-contract.md](./contracts/settings-api-contract.md).
   - Cookie check: `cab_authenticated_address` must equal lowercased `walletAddress`.
   - Validate by hitting both routes with `curl`:
     ```bash
     curl -s -b "cab_authenticated_address=0xabc..." \
       "http://localhost:3000/api/settings?walletAddress=0xabc...&chainId=8453" | jq
     ```

5. **Frontend hooks**
   - Sharpen `useSettingsQuery` (`enabled` gating per plan) and `useUpdateSettingsMutation` (typed payload, invalidation on success).
   - Keep keys via existing `queryKeys.settings({ chainId, walletAddress })`.

6. **Feature module: `src/features/settings/*`**
   - `settings.types.ts` (view-model types).
   - `settings.mappers.ts` (server payload + analysis status + overview coverage → view model). Use locale-aware formatters from `src/i18n/formatters.ts`.
   - `Settings.container.tsx` (orchestrates `useCabWallet`, `useSettingsQuery`, `useUpdateSettingsMutation`, `useAnalysisStatusQuery`, `useStartAnalysisMutation`, `useWarmOverviewMutation`). Container is the only place that calls hooks.
   - `Settings.component.tsx` (presentational; receives the view model + handlers).
   - `settings.queries.ts` (optional thin wrappers if the container needs feature-local query composition).

7. **Route: `/settings`**
   - Add `src/app/settings/page.tsx` mirroring `/overview` auth gating:
     - Wait for `isAuthReady`.
     - Redirect to `/` if `status === "disconnected" || !isAuthenticated`.
     - Otherwise render `<SettingsContainer />`.

8. **Nav enablement**
   - In [apps/web/src/features/overview/overview.mappers.ts](../../apps/web/src/features/overview/overview.mappers.ts) flip the `settings` nav entry from `{ stateKey: "comingSoon", disabled: true }` to `{ stateKey: "active", disabled: false }` whenever `isAuthenticated && isSupportedChain`.
   - Deep sections remain analysis-gated.

9. **Localization**
   - Populate `apps/web/src/i18n/locales/en/settings.json` and `apps/web/src/i18n/locales/es/settings.json` with the keys required by the component (sections, actions, helper copy, fixed-for-MVP indicators).
   - Add only the necessary parity deltas in `navigation`, `analysis`, `coverage`, `wallet`, `common`, `errors`.
   - Validate: `pnpm i18n:check`.

10. **Wire ambient behaviors**
    - Language change: after POST success, call `i18n.changeLanguage(nextLocale)`.
    - Default range change: after POST success, invalidate `queryKeys.overview*`.
    - Refresh Overview action: invoke `useWarmOverviewMutation` with the current default range, then invalidate `queryKeys.overview*`.
    - Disconnect: call `useCabWallet().disconnect()`; the route guard handles redirect.

---

## Validation gates

Run from `apps/web/` unless noted:

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm i18n:check
```

Provider-boundary regression check:

```bash
rg "@/server/providers|moralis|alchemy|trigger" src/features/settings src/app/settings
```

(Expected: no matches. The Settings feature must not import server-only provider modules.)

API smoke (manual):

```bash
# GET — defaults when no row exists
curl -s -b "cab_authenticated_address=0xabc..." \
  "http://localhost:3000/api/settings?walletAddress=0xabc...&chainId=8453" | jq .preferences

# POST — write language and default range
curl -s -X POST -b "cab_authenticated_address=0xabc..." \
  -H 'content-type: application/json' \
  -d '{"walletAddress":"0xabc...","chainId":8453,"preferences":{"languagePreference":"es","defaultOverviewRange":"90d"}}' \
  http://localhost:3000/api/settings | jq .preferences
```

Manual UI checks:

- `/settings` is reachable after wallet connect + signature on Base.
- Refreshing the page in any of `not_analyzed | queued | running | ready | stale | failed` keeps the page usable.
- Switching language updates copy in-place without a hard reload.
- `Refresh Overview data` returns to baseline, and revisiting Overview reads fresh data.
- `Disconnect` clears the session and redirects to `/`.

---

## Out of scope (do NOT add)

- Theme switching.
- CSV/export.
- Notification center.
- Deletion of stored analysis data.
- New historical-analysis pipeline work.
- Browser-facing Moralis/Alchemy/Trigger calls.
- Per-locale number-format customization.
