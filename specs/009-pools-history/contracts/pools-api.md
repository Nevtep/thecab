# Contract: Pools API

**Feature**: `009-pools-history`  
**Date**: 2026-05-25  
**Scope**: Internal authenticated APIs for the routed Pools screens. These routes are DB-backed only and must not call Moralis, Alchemy, RPC, or Trigger.dev.

## Conventions

- **Base path**: `/api/pools`
- **Auth**: Wallet-auth gated. Routes infer the wallet from the authenticated session; callers do not supply arbitrary wallet addresses.
- **Chain**: `chainId` is required and validated through the shared chain configuration layer. Product v1 accepts only `8453`.
- **Analysis gate**: If canonical analysis status is not `ready` or `stale`, routes return `423 analysis_required` instead of partial recent-view pool data.
- **Data source**: Postgres read models only.
- **Error shape**:
  ```json
  {
    "error": {
      "code": "snake_case_machine_code",
      "details": {}
    }
  }
  ```
- **No provider leakage**: Raw provider bodies, request payloads, and provider-derived internal confidence fields never reach the browser.

## 1. `GET /api/pools`

Return the wallet-scoped Pools list view.

### Query Params

| Param | Type | Required | Notes |
|---|---|---|---|
| `chainId` | integer | yes | Supported-chain validation required. |
| `status` | enum | no | `active | inactive | closed | all`; defaults to `all`. |
| `exposure` | enum | no | `manual | automated | mixed | residual_only | all`; defaults to `all`. |
| `coverage` | enum | no | `full | share_level | partial | unknown | all`; defaults to `all`. |
| `returnBand` | enum | no | `positive | negative | all`; defaults to `all`. |
| `search` | string | no | Optional bounded search string, max 64 chars. |
| `sort` | enum | no | `currentValue | rewards | return | recentActivity`; defaults to `currentValue`. |
| `direction` | enum | no | `asc | desc`; defaults to `desc`. |
| `cursor` | string | no | Opaque pagination cursor for larger lists. |
| `limit` | integer | no | Max 50; default 20. |

### Response

```json
{
  "walletAddress": "0x...",
  "chainId": 8453,
  "analysisStatus": "ready",
  "coveredRange": {
    "startDayUtc": "2025-05-25",
    "endDayUtc": "2026-05-25"
  },
  "summary": {
    "poolCount": 8,
    "activePoolCount": 6,
    "currentAttributedValueUsd": 186738.07,
    "totalRewardsUsd": 4591.23,
    "weightedAnnualizedReturnPct": 18.42,
    "coverageStatus": "partial",
    "coverageReasonCodes": ["pricingPartial"]
  },
  "items": [
    {
      "poolId": "uuid",
      "label": "WETH / USDC",
      "poolAddress": "0x...",
      "tokenSymbols": ["WETH", "USDC"],
      "feeTierLabel": "0.05%",
      "protocolFamily": "aerodrome_cl",
      "status": "active",
      "exposureMix": "mixed",
      "currentAttributedValueUsd": 82451.32,
      "capitalEnteredUsd": 90210.11,
      "capitalWithdrawnUsd": 14120.82,
      "realizedPnlUsd": 321.55,
      "unrealizedPnlUsd": 1744.55,
      "totalRewardsUsd": 2156.78,
      "annualizedReturnPct": 24.31,
      "coverageStatus": "full",
      "coverageReasonCodes": [],
      "latestActivityAt": "2026-05-23T10:12:00.000Z"
    }
  ],
  "page": {
    "nextCursor": null,
    "hasMore": false
  }
}
```

### Anti-abuse rules

- Filter and sort params must be enum-backed, not free-form column names.
- `search` must be normalized and length-limited.
- Pagination is required above the default limit.
- The route must only read from indexed wallet-scoped read models.

## 2. `GET /api/pools/:poolId`

Return a detailed wallet-scoped pool view.

### Query Params

| Param | Type | Required | Notes |
|---|---|---|---|
| `chainId` | integer | yes | Supported-chain validation required. |
| `range` | enum | no | `30d | 90d | 180d | 1y | covered`; defaults to `90d`. |
| `timelineCursor` | string | no | Opaque cursor for older timeline rows. |
| `timelineLimit` | integer | no | Max 100; default 30. |

### Response

```json
{
  "walletAddress": "0x...",
  "chainId": 8453,
  "analysisStatus": "ready",
  "coveredRange": {
    "startDayUtc": "2025-05-25",
    "endDayUtc": "2026-05-25"
  },
  "selectedRange": "1y",
  "header": {
    "poolId": "uuid",
    "label": "WETH / USDC",
    "poolAddress": "0x...",
    "tokenSymbols": ["WETH", "USDC"],
    "feeTierLabel": "0.05%",
    "status": "active",
    "currentAttributedValueUsd": 82451.32,
    "capitalEnteredUsd": 90210.11,
    "capitalWithdrawnUsd": 14120.82,
    "totalRewardsUsd": 2156.78,
    "realizedPnlUsd": 321.55,
    "unrealizedPnlUsd": 1744.55,
    "annualizedReturnPct": 24.31,
    "coverageStatus": "partial",
    "coverageReasonCodes": ["pricingPartial"]
  },
  "segments": {
    "manual": { "currentValueUsd": 40173.21, "coverageStatus": "full" },
    "strategy": { "currentValueUsd": 42278.11, "coverageStatus": "share_level" },
    "residual": { "currentValueUsd": 0, "coverageStatus": "full" }
  },
  "currentComposition": [
    { "tokenSymbol": "WETH", "amount": 1.2345, "valueUsd": 40173.21 },
    { "tokenSymbol": "USDC", "amount": 41278.11, "valueUsd": 42278.11 }
  ],
  "history": {
    "points": [],
    "coverageStatus": "partial",
    "coverageReasonCodes": ["pricingPartial"]
  },
  "timeline": {
    "items": [],
    "nextCursor": null,
    "hasMore": false
  },
  "related": {
    "deposits": [],
    "strategies": []
  }
}
```

### Anti-abuse rules

- `range` is a bounded enum and cannot exceed the covered one-year window.
- Timeline pagination is required once the default page size is exceeded.
- The route must validate that the requested pool belongs to the authenticated wallet's read models for the supplied chain.

## 3. Errors

| HTTP | Code | When |
|---|---|---|
| 400 | `invalid_payload` | Invalid query params. |
| 400 | `unsupported_chain` | Unsupported `chainId`. |
| 401 | `unauthorized` | Missing or invalid session. |
| 403 | `wallet_mismatch` | Session wallet cannot access requested scope. |
| 404 | `pool_not_found` | Pool is not present in the authenticated wallet's read models. |
| 423 | `analysis_required` | Canonical analysis status is not `ready` or `stale`. |
| 500 | `internal_error` | Unexpected server failure. |

## 4. Non-goals

- No direct browser DB access.
- No provider-backed fallback within these routes.
- No mutation endpoints in this feature slice.