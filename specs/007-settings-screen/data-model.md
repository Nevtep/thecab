# Phase 1 Data Model: Connected Settings Screen MVP

**Feature**: `007-settings-screen`  
**Date**: 2026-05-24  
**Inputs**: [spec.md](./spec.md) Key Entities, [research.md](./research.md)

---

## 1. Persistence

### 1.1 New table: `user_preferences`

| Column            | Type               | Constraints                                  | Notes                                                                 |
|-------------------|--------------------|----------------------------------------------|-----------------------------------------------------------------------|
| `id`              | uuid               | PK, default `gen_random_uuid()`              | Surrogate key                                                         |
| `wallet_address`  | text               | NOT NULL, lowercased                         | Lowercased 0x-prefixed checksum-stripped address                      |
| `chain_id`        | integer            | NULLABLE                                     | NULL => app-wide preference; otherwise wallet-and-chain scoped         |
| `key`             | text               | NOT NULL                                     | Allowlisted, see § 1.2                                                |
| `value`           | jsonb              | NOT NULL                                     | Shape constrained per `key` via service-layer Zod schema              |
| `created_at`      | timestamptz        | NOT NULL, default `now()`                    |                                                                       |
| `updated_at`      | timestamptz        | NOT NULL, default `now()`                    | Updated on upsert                                                     |

**Uniqueness**: Unique index on `(wallet_address, COALESCE(chain_id, -1), key)` so app-wide preferences (NULL `chain_id`) and chain-scoped preferences with the same `key` can coexist without conflict.

**Indexes**: Btree on `(wallet_address, chain_id)` for read-by-wallet.

**Retention**: Permanent (consistent with constitution data-retention rule); no automatic expiry.

### 1.2 Preference key allowlist (Stage 1)

| Key                    | Scope                       | Value shape                                                     | Default                                          |
|------------------------|-----------------------------|-----------------------------------------------------------------|--------------------------------------------------|
| `languagePreference`   | App-wide (`chain_id = NULL`)| `{ "locale": "en" \| "es" }`                                    | Resolved by i18n detector (no row materialized)  |
| `defaultOverviewRange` | Wallet + chain              | `{ "range": OverviewRange }` (existing union)                   | Current Overview default                         |

Writes attempting any other key are rejected with `VALIDATION_FAILED`.

---

## 2. Server types

```ts
// src/server/settings/settings.types.ts
import type { AnalysisStatus, AnalysisMode } from "@/analysis/analysisStatus";
import type { OverviewRange } from "@/features/overview/overview.types";

export type SettingsLanguage = "en" | "es";

export interface SettingsPersistedPreferences {
  languagePreference: SettingsLanguage;
  defaultOverviewRange: OverviewRange;
}

export interface SettingsDerivedDiagnostics {
  analysis: {
    status: AnalysisStatus;
    runId: string | null;
    lastSuccessfulRunAt: string | null;   // ISO 8601
    lastUpdatedAt: string | null;          // ISO 8601
    lastError: string | null;              // stable code, never raw provider message
  };
  overviewFreshness: {
    label: "recent_view" | "analyzed_view"; // derived from analysis.status
    lastAnalyzedAt: string | null;          // ISO 8601
  };
  coverage: {
    reasonCodes: string[];                  // pass-through from Overview coverage
  };
}

export interface SettingsMeta {
  fixedForMvp: {
    currency: "USD";
    theme: "cab-dark";
  };
  supportedLanguages: ReadonlyArray<SettingsLanguage>;
  supportedOverviewRanges: ReadonlyArray<OverviewRange>;
  supportedAnalysisModes: ReadonlyArray<AnalysisMode>;
}

export interface SettingsResponse {
  walletAddress: string;
  chainId: number;
  preferences: SettingsPersistedPreferences;
  diagnostics: SettingsDerivedDiagnostics;
  meta: SettingsMeta;
}

export interface SettingsUpdateRequest {
  walletAddress: string;
  chainId: number;
  preferences: Partial<SettingsPersistedPreferences>;
}
```

`AnalysisStatus` and `AnalysisMode` are defined in the new shared module `src/analysis/analysisStatus.ts`:

```ts
export type AnalysisStatus =
  | "not_analyzed"
  | "queued"
  | "running"
  | "ready"
  | "stale"
  | "failed";

export type AnalysisMode = "full_history" | "incremental";
```

---

## 3. Client view model

```ts
// src/features/settings/settings.types.ts
import type { AnalysisStatus, AnalysisMode } from "@/analysis/analysisStatus";

export interface SettingsViewModel {
  walletSection: {
    address: string;             // lowercased
    addressDisplay: string;       // truncated 0xabc…1234
    chainLabel: string;           // localized
    chainId: number;
    actions: {
      refreshOverviewLabel: string;
      disconnectLabel: string;
      isRefreshing: boolean;
    };
  };
  analysisSection: {
    status: AnalysisStatus;
    statusLabel: string;          // localized
    runId: string | null;
    lastSuccessfulRunAt: string | null;  // formatted
    lastUpdatedAt: string | null;        // formatted (relative)
    primaryAction:
      | { kind: "start"; mode: "full_history"; label: string }
      | { kind: "retry"; mode: "full_history"; label: string }
      | { kind: "update"; mode: "incremental"; label: string }
      | { kind: "none"; progressLabel: string };
  };
  displaySection: {
    language: {
      value: "en" | "es";
      options: ReadonlyArray<{ value: "en" | "es"; label: string }>;
      isPending: boolean;
    };
    defaultOverviewRange: {
      value: string;             // OverviewRange
      options: ReadonlyArray<{ value: string; label: string }>;
      isPending: boolean;
    };
    fixed: {
      currencyLabel: string;     // "USD"
      currencyHelper: string;    // localized helper copy
      themeLabel: string;        // "Cab Dark"
      themeHelper: string;       // localized helper copy
    };
  };
  diagnosticsSection: {
    analysisStatusLabel: string;
    overviewFreshnessLabel: string;
    coverageReasonLabels: ReadonlyArray<string>; // localized, empty when none
    lastSuccessfulRunAt: string | null;
    lastUpdatedAt: string | null;
    runId: string | null;
  };
}
```

The mapper at `src/features/settings/settings.mappers.ts` is the only place that translates `SettingsResponse + AnalysisStatusResponse + OverviewResponse?` into `SettingsViewModel`. The presentational component receives the view model and renders.

---

## 4. State transitions

- **Analysis status** (consumed, not owned): canonical transitions are still owned by `/api/analysis/status` and the Trigger.dev worker. Settings only reads. The mapper enforces:
  - `not_analyzed` → primary action `start`
  - `failed` → primary action `retry`
  - `ready` or `stale` → primary action `update`
  - `queued` or `running` → primary action `none`, with progress label
- **Language preference**: persisted on POST; container calls `i18n.changeLanguage()` on mutation success. No reload required.
- **Default Overview range**: persisted on POST; on success the container invalidates `queryKeys.overview*` so next Overview visit reads the new default.
- **Wallet disconnect**: invokes `useCabWallet().disconnect()`. The `/settings` guard then redirects to `/` on the next render.
- **Overview refresh**: invokes `useWarmOverviewMutation` with `range = preferences.defaultOverviewRange`. On success, invalidates `queryKeys.overview*`. Settings itself does not change shape.

---

## 5. Validation rules

- `walletAddress`: must match `/^0x[0-9a-fA-F]{40}$/`, stored lowercased.
- `chainId`: must be `SUPPORTED_CHAIN_ID` (8453) for v1; otherwise `UNSUPPORTED_CHAIN`.
- `languagePreference`: must be in `supportedLanguages`; otherwise `VALIDATION_FAILED`.
- `defaultOverviewRange`: must be in `supportedOverviewRanges`; otherwise `VALIDATION_FAILED`.
- Unknown preference keys: rejected with `VALIDATION_FAILED`.
- Authentication: requests must originate from the authenticated session (cookie `cab_authenticated_address` matches `walletAddress`). Otherwise `SETTINGS_REQUEST_FAILED` with a stable code; the route does not leak whether the address exists.

---

## 6. Entity inventory (cross-reference with spec)

| Spec key entity                | Source of truth                          | Notes                                       |
|--------------------------------|------------------------------------------|---------------------------------------------|
| Connected Identity             | `useCabWallet`                           | Read-only in Settings                       |
| Wallet Action Surface          | `Settings.container` actions             | Composed in container, not server-owned     |
| Analysis State                 | `/api/analysis/status` + canonical map   | Status normalizer is canonical              |
| Analysis Action Intent         | `useStartAnalysisMutation`               | Modes per R2                                |
| Display Preference Set         | `user_preferences` (language + range)    | Persisted via Settings API                  |
| Fixed-for-MVP Display Settings | `SettingsMeta.fixedForMvp`               | Server-declared, locked                     |
| Diagnostics Snapshot           | `SettingsDerivedDiagnostics`             | Derived only; never fabricated              |
| Settings Persistence Contract  | `/api/settings`                          | See [contracts/settings-api-contract.md](./contracts/settings-api-contract.md) |
| Connected Shell Context        | Existing layout/nav                      | Settings nav enabled when authenticated     |
