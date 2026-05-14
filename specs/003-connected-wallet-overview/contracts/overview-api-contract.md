# Contract: Overview API

## Endpoint

`GET /api/wallet/overview`

## Purpose

Serve the full connected Overview payload to the frontend without exposing third-party providers to the browser.

**Current Stage Scope**: This contract is active for Stage 1 recent-view Overview delivery. `analyzed_history` responses and the `all_analyzed_history` request range remain deferred follow-up scope and are documented only for forward compatibility.

## Request Query Parameters

| Parameter | Type | Required | Rules |
|---|---|---|---|
| `walletAddress` | string | Yes | Must be a valid EVM address |
| `chainId` | integer | Yes | Must resolve to a supported chain |
| `range` | string | Yes | One of `24h`, `7d`, `30d` in the current stage |

## Block Provenance Rules

Each major Overview block must declare its own provenance.

| Field | Allowed Values | Notes |
|---|---|---|
| `source` | `recent_provider_data` \| `partial_fallback` in the current stage; `analyzed_history` reserved for follow-up scope | Declares the primary source used for that block |
| `coverageStatus` | `full` \| `partial` \| `recent` \| `analyzed` \| `unknown` | Declares the block-level coverage state |
| `coverageReasonCodes` | string[] | Optional block-specific reason codes such as `missingPrices`, `providerPartial`, `analysisPending`, `shareLevelStrategyCoverage` |

## Success Response

`200 OK`

```json
{
  "walletAddress": "0xabc...",
  "chainId": 8453,
  "mode": "recent_view",
  "selectedRange": "7d",
  "analysis": {
    "status": "not_analyzed",
    "runId": null,
    "stage": "idle",
    "progressPct": 0,
    "lastSuccessfulRunAt": null,
    "lastUpdatedAt": null,
    "lastError": null
  },
  "coverage": {
    "status": "recent",
    "confidence": "medium",
    "reasonCodes": ["analysisPending"],
    "details": null
  },
  "summary": {
    "source": "recent_provider_data",
    "coverageStatus": "recent",
    "coverageReasonCodes": ["analysisPending"],
    "walletAddress": "0xabc...",
    "chainId": 8453,
    "chainLabel": "Base",
    "lastRefreshedAt": "2026-05-14T12:00:00.000Z",
    "modeLabelKey": "overview.mode.recentView"
  },
  "metrics": {
    "source": "recent_provider_data",
    "coverageStatus": "partial",
    "coverageReasonCodes": ["missingPrices"],
    "netPortfolioValueUsd": 12345.67,
    "deployedValueUsd": 8901.23,
    "idleValueUsd": 3444.44,
    "changeOverSelectedPeriodPct": 0.042,
    "estimatedRealizedRewardsUsd": null,
    "manualDepositsValueUsd": null,
    "automatedStrategiesValueUsd": null,
    "residualAttributedValueUsd": null,
    "governanceValueUsd": null
  },
  "chart": {
    "source": "recent_provider_data",
    "coverageStatus": "recent",
    "coverageReasonCodes": ["analysisPending"],
    "range": "7d",
    "hasRewardMarkers": false,
    "points": []
  },
  "distribution": {
    "source": "partial_fallback",
    "coverageStatus": "partial",
    "coverageReasonCodes": ["providerPartial"],
    "slices": []
  },
  "assets": {
    "source": "recent_provider_data",
    "coverageStatus": "partial",
    "coverageReasonCodes": ["missingPrices"],
    "rows": []
  },
  "activity": {
    "source": "recent_provider_data",
    "coverageStatus": "recent",
    "coverageReasonCodes": ["analysisPending"],
    "items": []
  }
}
```

## Error Responses

### Validation failure

`400 Bad Request`

```json
{
  "code": "VALIDATION_FAILED",
  "details": []
}
```

### Unsupported chain

`400` or `422` depending on repo-wide convention

```json
{
  "code": "UNSUPPORTED_CHAIN"
}
```

### Overview failure

`500 Internal Server Error`

```json
{
  "code": "OVERVIEW_FAILED"
}
```

### Provider failure

`502` or `500` depending on route error policy

```json
{
  "code": "PROVIDER_REQUEST_FAILED"
}
```

## Rules

- The browser must never call Moralis or Alchemy directly.
- Provider-specific error bodies must not be returned to the client.
- Every response must be wallet-scoped and chain-scoped.
- `all_analyzed_history` is reserved for a deferred analyzed-history stage and is not a valid request value in the current implementation slice.
- The current stage should return `recent_provider_data` or `partial_fallback` provenance only; a future analyzed-history stage may add `analyzed_history` provenance while preserving the same block-level metadata shape.
- Page-level `coverage` is a screen summary and must not replace block-level provenance when blocks fall back differently.