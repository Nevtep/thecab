# Contract: Strategies API

**Feature**: `012-strategies-lifecycle`  
**Date**: 2026-05-29

All routes are internal, authenticated, chain-aware, DB-backed, and read-only. They must not call Moralis, Alchemy, RPC, or Trigger.dev in request/response flow.

## Common

### Authentication And Gating

- Wallet address is inferred from the authenticated session cookie, matching Pools and Deposits.
- `chainId` is required and validated through the shared supported-chain layer.
- Routes fail with `analysis_not_ready` while no successful historical analysis exists for the wallet and chain. Stale ready data may continue serving during a refresh.
- Responses use `Cache-Control: no-store`.

### Error Envelope

```json
{ "error": { "code": "<machine_code>", "details": { "...": "optional" } } }
```

| Code | HTTP | Meaning |
|---|---:|---|
| `wallet_not_authenticated` | 401 | No active wallet session. |
| `chain_unsupported` | 400 | Missing or unsupported `chainId`. |
| `analysis_not_ready` | 409 | Strategy analytics require completed analysis. |
| `invalid_request` | 400 | Query validation failure. |
| `strategy_not_found` | 404 | Strategy exposure is not visible for this wallet and chain. |
| `internal_error` | 500 | Unexpected server fault. |

## `GET /api/strategies`

Returns the Strategies DataView list, selected panel bootstrap data, and KPI strip summary.

### Query Parameters

| Param | Type | Required | Default | Notes |
|---|---|---:|---|---|
| `chainId` | int | yes | - | Must be supported. |
| `status` | `active` \| `closed` \| `all` | no | `active` | Status filter. |
| `protocol` | `mellow` \| `all` | no | `mellow` | Initial feature only ships Mellow. |
| `pool` | uuid | no | - | Underlying pool filter, used by Pool/Deposit cross-links. |
| `coverage` | `full` \| `share_level` \| `partial` \| `unknown` \| `all` | no | `all` | Coverage filter. |
| `returnSign` | `positive` \| `negative` \| `any` | no | `any` | Return filter. |
| `search` | string | no | - | Bounded search, max 64 chars. |
| `sort` | enum | no | `current_value_desc` | `current_value_desc`, `current_value_asc`, `opened_desc`, `opened_asc`, `return_desc`, `return_asc`, `coverage_asc`, `coverage_desc`. |
| `selectedStrategyId` | uuid | no | first visible row | Preferred selected exposure for the DataView panel. |
| `page` | int >= 1 | no | 1 | Pagination. |
| `pageSize` | 10 \| 25 \| 50 | no | 10 | Pagination size. |

Unknown params are rejected with `invalid_request`.

### Response

```ts
type StrategiesListResponse = {
  chainId: number;
  walletAddress: string;
  coveredRange: { startDayUtc: string | null; endDayUtc: string | null };
  kpis: {
    currentStrategyValueUsd: number | null;
    activeStrategyCount: number;
    totalClaimedRewardsUsd: number;
    totalReturnUsd: number | null;
    protocolCoveragePct: number | null;
    coverageStatus: "full" | "share_level" | "partial" | "unknown";
    coverageReasonCodes: string[];
    trends: Record<string, Array<{ dayUtc: string; value: number | null }>>;
  };
  filters: {
    applied: Record<string, string | number | null>;
    availablePools: Array<{ poolId: string; label: string }>;
  };
  page: { page: number; pageSize: number; totalPages: number; totalItems: number };
  strategies: StrategySummaryView[];
  selectedStrategy: StrategyDetailView | null;
};
```

### Performance Contract

- p95 <= 200ms from DB only.
- No provider/RPC calls.
- Query must use wallet-scoped read-model indexes.
- Detail bootstrap should fetch only the selected strategy, not every lifecycle for every row.

## `GET /api/strategies/:strategyId`

Returns the full selected-strategy detail view for direct links and narrow-screen drill-in.

### Query Parameters

| Param | Type | Required | Notes |
|---|---|---:|---|
| `chainId` | int | yes | Must be supported. |

### Response

```ts
type StrategyDetailResponse = {
  chainId: number;
  walletAddress: string;
  coveredRange: { startDayUtc: string | null; endDayUtc: string | null };
  strategy: StrategyDetailView;
};
```

## TanStack Query Keys

```ts
["strategies", chainId, walletAddress, normalizedFilters]
["strategy", chainId, strategyExposureId]
```

`normalizedFilters` is a deterministic object produced by `strategies.urlState.ts` so URL query ordering does not break cache hits.

## Cross-Surface Links

- `/strategies?chainId=8453&pool=<poolId>` opens the Strategies list filtered to the underlying pool.
- `/strategies?chainId=8453&selectedStrategyId=<strategyExposureId>` opens the DataView with the selected exposure active.
- `/strategies/<strategyExposureId>?chainId=8453` opens direct detail.

## Refresh Behavior

When analysis status transitions to `ready` for the active wallet and chain, mounted Strategies queries must be invalidated with Pools and Deposits. URL-derived filters and selected strategy are preserved. If the selected strategy disappears after re-analysis, the list selects the highest-ranked visible row or renders a contextual empty detail state without clearing filters.
