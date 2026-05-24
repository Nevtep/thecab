# Settings API Contract

**Feature**: `007-settings-screen`  
**Date**: 2026-05-24  
**Scope**: Defines `GET /api/settings` and `POST /api/settings`. These are the only browser-facing endpoints introduced by this feature.

---

## Overview

| Concern             | Decision                                                                                  |
|---------------------|-------------------------------------------------------------------------------------------|
| Auth                | Requires `cab_authenticated_address` cookie matching the requested `walletAddress`        |
| Chain               | Base mainnet only (`chainId = 8453`); other chains return `UNSUPPORTED_CHAIN`             |
| Persistence         | New `user_preferences` table; see [data-model.md](../data-model.md) §1                    |
| Derived diagnostics | Read-only, sourced from `/api/analysis/status` data and `wallet_contexts`                 |
| Providers           | None directly invoked from this route in Stage 1                                          |
| Error model         | Stable machine codes; frontend maps to localized copy in the `errors` namespace           |

The response shape is identical for `GET` and `POST` so the client can use a single mapper for both.

---

## GET /api/settings

### Request

```
GET /api/settings?walletAddress={0x...}&chainId=8453
```

| Param            | Required | Constraint                                |
|------------------|----------|-------------------------------------------|
| `walletAddress`  | yes      | `/^0x[0-9a-fA-F]{40}$/`, lowercased server-side |
| `chainId`        | yes      | integer, must equal `SUPPORTED_CHAIN_ID` (8453) |

### Response 200

```jsonc
{
  "walletAddress": "0xabc...",
  "chainId": 8453,
  "preferences": {
    "languagePreference": "en",                 // app-wide value, "en" | "es"
    "defaultOverviewRange": "30d"               // OverviewRange union value
  },
  "diagnostics": {
    "analysis": {
      "status": "not_analyzed",                 // canonical AnalysisStatus
      "runId": null,                            // string | null
      "lastSuccessfulRunAt": null,              // ISO 8601 | null
      "lastUpdatedAt": null,                    // ISO 8601 | null
      "lastError": null                          // stable code | null
    },
    "overviewFreshness": {
      "label": "recent_view",                   // "recent_view" | "analyzed_view"
      "lastAnalyzedAt": null                    // ISO 8601 | null
    },
    "coverage": {
      "reasonCodes": []                          // [] when none; pass-through from Overview
    }
  },
  "meta": {
    "fixedForMvp": {
      "currency": "USD",
      "theme": "cab-dark"
    },
    "supportedLanguages": ["en", "es"],
    "supportedOverviewRanges": ["7d", "30d", "90d", "all"],
    "supportedAnalysisModes": ["full_history", "incremental"]
  }
}
```

### Default-value semantics

- `languagePreference`: if no row exists, server returns the value resolved by the i18n detector hint (cookie/`Accept-Language`), defaulting to `"en"`. The first POST materializes a row.
- `defaultOverviewRange`: if no row exists for `(walletAddress, chainId)`, server returns the existing Overview default (single source of truth in code).

### Errors

| Status | Code                    | Reason                                                        |
|--------|-------------------------|---------------------------------------------------------------|
| 400    | `VALIDATION_FAILED`     | Malformed/missing query params                                |
| 401    | `SETTINGS_REQUEST_FAILED` | Missing cookie / cookie does not match `walletAddress`      |
| 409    | `UNSUPPORTED_CHAIN`     | `chainId !== SUPPORTED_CHAIN_ID`                              |
| 500    | `SETTINGS_REQUEST_FAILED` | Unexpected server failure (no raw message exposed)          |

All error bodies use:

```json
{ "error": { "code": "VALIDATION_FAILED", "details": null } }
```

`details` is omitted or `null` in production; never leaks raw provider/DB messages.

---

## POST /api/settings

### Request

```http
POST /api/settings
Content-Type: application/json

{
  "walletAddress": "0xabc...",
  "chainId": 8453,
  "preferences": {
    "languagePreference": "es",            // optional
    "defaultOverviewRange": "90d"          // optional
  }
}
```

Validation rules:

- Body is parsed by a Zod schema. Unknown top-level keys outside `walletAddress | chainId | preferences` are rejected.
- Unknown keys inside `preferences` (anything outside the allowlist in [data-model.md](../data-model.md) §1.2) are rejected with `VALIDATION_FAILED`.
- `languagePreference` must be in `supportedLanguages`.
- `defaultOverviewRange` must be in `supportedOverviewRanges`.
- Empty `preferences` is allowed and returns the current state without mutation.

### Persistence semantics

- `languagePreference` is upserted with `chainId = NULL` (app-wide).
- `defaultOverviewRange` is upserted with `chainId = req.chainId` (wallet- and chain-scoped).
- Upsert uses `(wallet_address, COALESCE(chain_id, -1), key)` as the conflict target.
- `updated_at` is set to `now()` on every upsert.

### Response 200

Identical shape to GET response, reflecting the post-write state.

### Errors

| Status | Code                    | Reason                                                        |
|--------|-------------------------|---------------------------------------------------------------|
| 400    | `VALIDATION_FAILED`     | Body schema invalid, disallowed key, or out-of-range value    |
| 401    | `SETTINGS_REQUEST_FAILED` | Missing cookie / cookie does not match `walletAddress`      |
| 409    | `UNSUPPORTED_CHAIN`     | `chainId !== SUPPORTED_CHAIN_ID`                              |
| 500    | `SETTINGS_REQUEST_FAILED` | Persistence failure                                         |

---

## Caching & invalidation

- The route declares `Cache-Control: no-store`.
- Client uses `queryKeys.settings({ chainId, walletAddress })` with `staleTime: 30_000`.
- On a successful POST, the client invalidates `queryKeys.settings(...)`. Additionally:
  - If `languagePreference` changed, the client calls `i18n.changeLanguage(next)`.
  - If `defaultOverviewRange` changed, the client invalidates `queryKeys.overview*`.

---

## Out of scope for Stage 1

- Theme switching (`theme` is a server-declared fixed-for-MVP constant).
- Currency switching (`currency` is fixed `USD`).
- Per-locale number-format customization.
- Deletion of stored analysis data.
- Notification preferences, CSV export, advanced diagnostics console.
- Any provider re-fetch — refresh goes through the existing `/api/wallet/overview/warmup` route, not through `/api/settings`.
