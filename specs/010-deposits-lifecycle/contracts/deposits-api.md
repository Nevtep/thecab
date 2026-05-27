# Contract: Deposits API

**Feature**: `010-deposits-lifecycle`
**Date**: 2026-05-27

All routes are DB-only, chain-aware, and require an authenticated wallet that matches the active session. Responses use `Cache-Control: no-store`.

## Common

### Authentication & gating

- Wallet address is inferred from the authenticated session (mirroring Pools).
- `chainId` is **required** and validated against `SUPPORTED_CHAINS`.
- Routes fail with `analysis_not_ready` while the wallet's `AnalysisRun` for the active chain is not `ready`. Stale `ready` data may continue serving during refresh.

### Error envelope

```json
{ "error": { "code": "<machine_code>", "details": { "...": "optional" } } }
```

Stable machine codes (mapped by the `errors` i18n namespace on the client):

| Code | HTTP | Meaning |
|---|---:|---|
| `wallet_not_authenticated` | 401 | No active session wallet. |
| `chain_unsupported` | 400 | `chainId` missing or not in `SUPPORTED_CHAINS`. |
| `analysis_not_ready` | 409 | Latest `AnalysisRun` for the wallet+chain is not `ready`. |
| `invalid_request` | 400 | Query validation failure; `details.fields` enumerates fields. |
| `deposit_not_found` | 404 | Deposit id not owned by the authenticated wallet on the chain. |
| `internal_error` | 500 | Unexpected server fault. |

## `GET /api/deposits`

Returns the wallet-scoped deposits list with filters applied server-side from the URL contract (FR-024).

### Query parameters

| Param | Type | Required | Default | Notes |
|---|---|---:|---|---|
| `chainId` | int | yes | — | Must be supported. |
| `status` | `open_active`\|`closed`\|`all` | no | `open_active` (FR-005a) | Status filter. |
| `pool` | uuid | no | — | Pool filter (FR-018 cross-link). |
| `from` | `YYYY-MM-DD` | no | covered start | Date range lower bound (FR-004). |
| `to` | `YYYY-MM-DD` | no | covered end | Upper bound; range capped at 365 days. |
| `returnSign` | `positive`\|`negative`\|`any` | no | `any` | |
| `sort` | enum | no | `opened_desc` | Stable named sorts: `opened_desc`, `opened_asc`, `return_desc`, `return_asc`, `apr_desc`, `apr_asc`. |
| `page` | int ≥ 1 | no | 1 | |
| `pageSize` | int in {10,25,50} | no | 10 | |

Unknown params are rejected with `invalid_request`.

### Response

```ts
type DepositsListResponse = {
  chainId: number;
  walletAddress: string;             // canonical lowercased
  coveredRange: { startDayUtc: string | null; endDayUtc: string | null };
  totals: {
    inFilterCount: number;           // matches summary KPI "N of M"
    coveredCount: number;            // M
    totalCapitalDeployedUsd: number; // net (FR-022)
    capitalDeployedPctOfManual: number | null; // (totals.totalCapitalDeployedUsd ÷ sum of GROSS capital_entered_usd across ALL the wallet's manual deposits in the covered range, regardless of in-filter state). Null when the denominator is 0 or unknown.
    currentValueUsd: number;
    currentValuePctOfCapital: number | null;
    totalRewardsUsd: number;
    totalRewardsPctOfCapital: number | null;
    realizedPnlUsd: number;
    realizedPnlPct: number | null;
    unrealizedPnlUsd: number;
    unrealizedPnlPct: number | null;
  };
  page: { page: number; pageSize: number; totalPages: number };
  deposits: DepositSummaryView[];    // see data-model.md §5
  sparklines: Record<string, { day: string; value: number }[]>; // by KPI key, optional, covered-range only
};
```

### Performance contract

- p95 ≤ 200ms from DB only.
- No provider/RPC calls.
- Indexed reads on `(chain_id, wallet_address, status)` and `(chain_id, wallet_address, opened_at DESC)`.

## `GET /api/deposits/:depositId`

Returns the full detail view for one deposit owned by the authenticated wallet on the active chain.

### Query parameters

| Param | Type | Required | Notes |
|---|---|---:|---|
| `chainId` | int | yes | |

### Response

```ts
type DepositDetailResponse = {
  chainId: number;
  walletAddress: string;
  coveredRange: { startDayUtc: string | null; endDayUtc: string | null };
  deposit: DepositDetailView;        // see data-model.md §5 (includes decomposition + lifecycle + movements)
  valueChart: {                      // FR-009 — event-anchored, no interpolation across uncovered ranges
    series: Array<{
      key: "openedValue" | "additionalCapital" | "rewards" | "currentValue" | "withdrawal" | "closedValue";
      points: Array<{ occurredAt: string; usd: number; lifecycleEventId: string | null }>;
    }>;
    gaps: Array<{ fromOccurredAt: string; toOccurredAt: string; reasonCode: ValueChartGapReasonCode }>;
  };
};

// Closed set bound to the `coverage` i18n namespace `reasonCodes.*` keys.
type ValueChartGapReasonCode =
  | "coverageGap"               // window between events spans an uncovered slice
  | "priceUnavailable"          // no historical price exists at all for an underlying token (no observation in `price_points` within the configured tolerance window)
  | "missingHistoricalPrice"    // a historical price exists for the token in general, but not at the specific day required by this event (narrower case than `priceUnavailable`)
  | "priceFallbackDca"          // nearest-price fallback within tolerance was used at one boundary (FR-011b)
  | "lowConfidenceClassification";
```

### Reconciliation invariant

The route MUST refuse to serve a row whose decomposition does not reconcile within `1e-9` of `total_return_usd`. This is enforced both at materialization (engine-side test) and at read time as a defensive assertion that maps to `internal_error` if violated.

### Performance contract

- p95 ≤ 300ms from DB only.
- Single read of `deposit_wallet_summaries`, `deposit_performance_decompositions`, plus an ordered scan of `deposit_lifecycle_events` for the deposit.

## TanStack Query keys

```ts
["deposits", chainId, walletAddress, normalizedFilters]
["deposit", chainId, depositId]
```

`normalizedFilters` is the deterministic, alphabetized object derived from `deposits.urlState.ts` so the cache hits across URL re-orderings.

## Live refresh after re-analysis (FR-L08, FR-020, SC-005)

The Deposits feature MUST react to a successful analysis transition without a manual reload:

- The client subscribes to the existing analysis-control surface event/status that Pools already uses.
- On a transition to `ready` for the active `(chainId, walletAddress)`, the client MUST invalidate both query keys above so any mounted list and detail view refetch within one user-perceived refresh cycle.
- URL-derived state (filters, sort, pagination, `selectedDepositId`) MUST be preserved across the refetch.
- If the previously selected `depositId` is no longer present in the new analyzed set, the detail query MUST surface `deposit_not_found` and the UI MUST render the not-found state without losing the rest of URL state.
