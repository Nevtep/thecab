# Contract: Analysis API (008-analysis-jobs)

**Feature**: `008-analysis-jobs`  
**Date**: 2026-05-24  
**Scope**: HTTP contracts for the three analysis routes under `apps/web/src/app/api/analysis/*`. The status route uses ONLY the canonical analysis status vocabulary owned by [specs/007-settings-screen](../../007-settings-screen/spec.md) R1. All responses return machine codes only; the browser resolves text through the `analysis`, `coverage`, and `errors` i18n namespaces (see `contracts/i18n-namespaces.md`). Citations: `spec.md` FR-001..FR-066, `research.md` §R1..§R14.

## Conventions

- **Base path**: `/api/analysis`. All routes are server-only (Next.js App Router route handlers).
- **Auth**: Inherited wallet-auth gate per `/memories/repo/wallet-auth-gate.md`. Anonymous callers receive `401 unauthorized`.
- **Chain**: Every request MUST include `chainId` as a query param (status) or body field (start, cancel). v1 accepts only `chainId = 8453`; other chains return `400 unsupported_chain` (CA-004, FR-006).
- **Wallet address**: Always lowercase 0x-prefixed `0x[0-9a-f]{40}`. The route lowercases server-side before validation.
- **Idempotency**: All write routes are idempotent on `(chainId, walletAddress, utcDayBucket)` for `start`, and on `runId` for `cancel`. Repeated calls return `200` with the existing row's projection.
- **Errors**: Stable machine codes only, never English (FR-042, FR-043). Shape:
  ```json
  { "error": { "code": "snake_case_machine_code", "details": { /* optional, never user-facing */ } } }
  ```
- **No raw provider bodies** ever returned (FR-061, SC-009).

---

## 1. `POST /api/analysis/start`

Trigger an analysis run for the connected wallet on a chain. Idempotent within a UTC day (FR-002, FR-003).

### Request

```http
POST /api/analysis/start
Content-Type: application/json
```

```json
{
  "walletAddress": "0xabc...",
  "chainId": 8453,
  "mode": "incremental"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `walletAddress` | string | yes | Validated against connected session wallet; mismatch → `403 wallet_mismatch`. |
| `chainId` | integer | yes | Only `8453` accepted in v1. |
| `mode` | enum `"full_history" | "incremental"` | no | Defaults to `incremental` if a prior `complete` `analysis_runs` row exists for `(chainId, walletAddress)`; otherwise defaults to `full_history` (FR-004). |

### Behavior

1. **UTC-day cap** (FR-002, FR-003): Look up an existing `analysis_runs` row matching `(chainId, walletAddress, utc_day_bucket = today_utc)`. If one exists, return `200` with its projected status; do not enqueue a new run.
2. **Trigger.dev enqueue**: Otherwise insert a new `analysis_runs` row (`status = 'queued'`, `triggered_at_utc = now()`, `utc_day_bucket = today_utc`, `mode = ...`), then call `analysisRun.trigger(...)` with `idempotencyKey = run:{chainId}:{walletAddress}:{YYYY-MM-DD}` (research.md §R10).
3. **Concurrency** (FR-005, FR-007): If a `queued` or `running` row already exists for `(chainId, walletAddress)` regardless of `utc_day_bucket`, return `409 run_already_in_progress` with that run's projection in `details.run`.

### Response

**`200 OK`**

```json
{
  "runId": "uuid",
  "status": "queued",
  "mode": "incremental",
  "chainId": 8453,
  "walletAddress": "0xabc...",
  "utcDayBucket": "2026-05-24",
  "triggeredAtUtc": "2026-05-24T07:14:09.001Z",
  "isExistingRun": false
}
```

`isExistingRun = true` if the route short-circuited on a same-UTC-day row (FR-003).

### Errors

| HTTP | Code | When |
|---|---|---|
| 400 | `invalid_payload` | Zod validation failure. |
| 400 | `unsupported_chain` | `chainId` not in supported set. |
| 400 | `unsupported_mode` | `mode` not in enum. |
| 401 | `unauthorized` | No session. |
| 403 | `wallet_mismatch` | Body `walletAddress` ≠ session wallet. |
| 409 | `run_already_in_progress` | Active `queued`/`running` row exists. |
| 500 | `internal_error` | Anything else. |

---

## 2. `GET /api/analysis/status`

Read-only projection from Postgres. p95 ≤ 200ms (FR-038).

### Request

```http
GET /api/analysis/status?walletAddress=0xabc...&chainId=8453
```

| Param | Required | Notes |
|---|---|---|
| `walletAddress` | yes | |
| `chainId` | yes | |
| `runId` | no | If provided, returns that specific run's projection instead of the latest. |

### Response

**`200 OK`** — Canonical status projection.

```json
{
  "walletAddress": "0xabc...",
  "chainId": 8453,
  "status": "ready",
  "runId": "uuid-or-null",
  "mode": "incremental",
  "triggeredAtUtc": "2026-05-24T07:14:09.001Z",
  "completedAtUtc": "2026-05-24T07:21:33.450Z",
  "lastSuccessfulRunAt": "2026-05-24T07:21:33.450Z",
  "coverage": "full",
  "coverageReasons": [],
  "phases": {
    "deposits":  { "status": "complete", "completedSlices": 5, "totalSlices": 5 },
    "rewards":   { "status": "complete", "completedSlices": 5, "totalSlices": 5 },
    "activity":  { "status": "complete" },
    "pools":     { "status": "complete" },
    "finalize":  { "status": "complete" }
  },
  "slices": [
    {
      "sliceIndex": 0,
      "sliceStartUtc": "2026-02-24",
      "sliceEndUtc":   "2026-05-24",
      "status": "complete",
      "txCountSeen": 18,
      "txCountProcessed": 18,
      "coverageReasons": []
    }
  ]
}
```

**Field rules**:

- `status` (FR-039, FR-040): One of the **canonical 007 vocabulary only** — `not_analyzed | queued | running | ready | stale | failed`. The engine NEVER returns `complete` or `cancelled`. Mapping is per `data-model.md §3.3`.
- `runId`: `null` if `status = not_analyzed`.
- `lastSuccessfulRunAt`: timestamp of most recent `complete` run for `(chainId, walletAddress)`, regardless of latest status (FR-041). Used by Overview to decide `ready` vs `stale`.
- `coverage`: `full | partial | unknown` from the projected run.
- `coverageReasons[]`: Array of strings from the controlled vocabulary (`missingPrices | partialDecoded | providerError | providerThrottled | reorgSuspect | decodeError | pricingPartial | unknownError`). Empty when `coverage = full` (FR-031).
- `phases` (FR-046): Five phase entries `deposits | rewards | activity | pools | finalize`. Each phase status uses `queued | running | complete | failed`. `deposits` and `rewards` carry slice counts; `activity`/`pools`/`finalize` are singleton (research.md §R6).
- `slices[]` (FR-047): Per-slice progress, ordered by `sliceIndex` ascending. Always present for the projected run (may be empty for `not_analyzed`).

### Errors

| HTTP | Code | When |
|---|---|---|
| 400 | `invalid_payload` | Missing or malformed query params. |
| 400 | `unsupported_chain` | |
| 401 | `unauthorized` | |
| 403 | `wallet_mismatch` | |
| 404 | `run_not_found` | `runId` provided but no matching row. |
| 500 | `internal_error` | |

---

## 3. `POST /api/analysis/cancel`

Cancel a `queued` or `running` run for the connected wallet (FR-036).

### Request

```http
POST /api/analysis/cancel
Content-Type: application/json
```

```json
{
  "runId": "uuid",
  "chainId": 8453,
  "walletAddress": "0xabc..."
}
```

### Behavior

1. Verify the `analysis_runs` row belongs to the session wallet on `chainId`.
2. If `status ∈ {complete, failed, cancelled}`: return `200` with current projection; do not call Trigger.dev.
3. Otherwise:
   - Call Trigger.dev cancel API for the run handle.
   - Update `analysis_runs.status = 'cancelled'`, `cancelled_at = now()`, `cancelled_reason = 'user_requested'`.
   - Do NOT advance `processing_cursors` (FR-036).
   - Do NOT mutate `processed_txs` rows that were written before cancel; they remain valid for future incremental runs.

### Response

**`200 OK`**

```json
{
  "runId": "uuid",
  "status": "not_analyzed",
  "cancelledAtUtc": "2026-05-24T07:18:02.110Z"
}
```

The canonical `status` returned reflects the projection rules from `data-model.md §3.3`. If a prior `complete` run exists for the wallet, the projected status is `ready` or `stale`; if not, it is `not_analyzed`. The engine NEVER returns the internal `cancelled` status over the API.

### Errors

| HTTP | Code | When |
|---|---|---|
| 400 | `invalid_payload` | |
| 400 | `unsupported_chain` | |
| 401 | `unauthorized` | |
| 403 | `wallet_mismatch` | |
| 404 | `run_not_found` | |
| 409 | `not_cancellable` | Run is already in a terminal state and policy disallows the operation (used only if the orchestrator adds a stricter rule later; current default is "noop on terminal"). |
| 500 | `internal_error` | |

---

## 4. Status-Projection Examples (Sanity Table)

| Internal state of latest run | `lastSuccessfulRunAt` | Returned `status` | Returned `coverage` |
|---|---|---|---|
| (no row) | (none) | `not_analyzed` | `unknown` |
| `queued` | (none) | `queued` | `unknown` |
| `running` | (none) | `running` | `unknown` |
| `cancelled` | (none) | `not_analyzed` | `unknown` |
| `cancelled` | 3 days ago | `ready` | (from prior complete run) |
| `failed` | (none) | `failed` | (from failed run) |
| `failed` | 3 days ago | `ready` | (from prior complete run) |
| `complete` (full) | now | `ready` | `full` |
| `complete` (partial) | now | `ready` | `partial` |
| `complete` | 8 days ago | `stale` | (from that run) |

Staleness threshold (7 days) is owned by 007-settings-screen R1 and consumed verbatim here; no new constant is introduced.

---

## 5. Browser Surface Rules

- Routes return JSON only. No HTML, no streaming.
- No field in any response is a localized string; everything user-visible is a machine code resolved client-side via i18next (FR-054, FR-055, FR-058).
- `raw_provider_records` rows MUST NEVER be embedded in any response (FR-061).
- `triggeredAtUtc`, `completedAtUtc`, `lastSuccessfulRunAt`, `cancelledAtUtc` are ISO-8601 with millisecond precision and explicit `Z` suffix.
