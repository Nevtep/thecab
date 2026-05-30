# Contract: Rewards API

## Route

```text
GET /api/rewards?chainId=8453
```

The route is wallet-scoped through the existing authenticated wallet context. It must reject unsupported chains and unauthenticated wallet access with stable machine-readable error codes.

## Query Parameters

| Name | Required | Description |
|------|----------|-------------|
| `chainId` | Yes | Active chain. Product v1 supports Base mainnet `8453`. |
| `search` | No | Search across reward text, transaction hash, pools, tokens, and linked entities. |
| `datePreset` | No | `7d`, `30d`, `90d`, `1y`, `all`, or `custom`. Defaults to `30d` if omitted. |
| `dateStart` | No | ISO timestamp or date for custom range. |
| `dateEnd` | No | ISO timestamp or date for custom range. |
| `source` | No | `all`, `deposits`, `strategies`, `governance`, `unresolved`, `excluded`, or `unavailable`. |
| `tokenAddress` | No | Chain-scoped reward token filter. |
| `poolId` | No | Pool filter. |
| `depositId` | No | Manual deposit filter. |
| `strategyExposureId` | No | Strategy exposure filter. |
| `rewardType` | No | Reward type filter. |
| `coverage` | No | `full`, `partial`, `unresolved`, `excluded`, or `unavailable`. |
| `resolutionStatus` | No | `resolved`, `unresolved`, `excluded`, or `unavailable`. |
| `selectedRewardEventId` | No | Reward row to load into selected reward rail. |
| `sort` | No | Sort key: `occurredAt`, `valueUsd`, `tokenAmount`, `source`, `owner`, or `coverage`. |
| `direction` | No | `asc` or `desc`. Defaults to descending date. |
| `page` | No | One-based page. Defaults to `1`. |
| `pageSize` | No | Allowed values: `10`, `25`, `50`, `100`. Defaults to `25`. |

## Success Response

```json
{
  "walletAddress": "0xabc...",
  "chainId": 8453,
  "analysis": {
    "status": "ready",
    "runId": "run-uuid",
    "completedAt": "2026-05-30T12:00:00.000Z",
    "coveredRange": {
      "start": "2025-05-30T00:00:00.000Z",
      "end": "2026-05-30T00:00:00.000Z"
    },
    "isStale": false
  },
  "filters": {
    "search": "",
    "datePreset": "30d",
    "dateRange": {
      "start": "2026-04-30T00:00:00.000Z",
      "end": "2026-05-30T00:00:00.000Z"
    },
    "source": "all",
    "tokenAddress": null,
    "poolId": null,
    "depositId": null,
    "strategyExposureId": null,
    "rewardType": null,
    "coverage": null,
    "resolutionStatus": null,
    "selectedRewardEventId": "reward-uuid",
    "sort": { "key": "occurredAt", "direction": "desc" },
    "page": 1,
    "pageSize": 25,
    "activeChips": []
  },
  "summary": {
    "totalClaimedRewardsUsd": "1248721.34",
    "rewardEventCount": 1287,
    "estimatedRewardReturnPct": "8.42",
    "estimatedRewardReturnCoverage": "estimated",
    "resolvedRewardsUsd": "1142336.90",
    "resolvedRewardsSharePct": "91.5",
    "unresolvedExcludedUsd": "106384.44",
    "unresolvedExcludedSharePct": "8.5",
    "coverageState": "partial",
    "coveragePercent": "91.5",
    "coverageReasonCodes": ["mixedValuationCoverage"]
  },
  "kpis": [
    {
      "id": "totalClaimedRewards",
      "labelKey": "rewards:kpis.totalClaimedRewards",
      "value": "1248721.34",
      "valueKind": "currency",
      "context": { "kind": "deltaPct", "value": "18.7", "labelKey": "rewards:kpis.vs30d" },
      "trend": { "kind": "sparkline", "points": ["..."] },
      "coverageState": "partial"
    }
  ],
  "overTime": {
    "grouping": "daily",
    "coveragePercent": "91.5",
    "coverageState": "partial",
    "coverageReasonCodes": ["coverageGap"],
    "buckets": [
      {
        "bucketStart": "2026-05-16",
        "claimedValueUsd": "1245.18",
        "estimatedRewardReturnPct": "0.03",
        "rewardEventCount": 1,
        "claimMarkers": [{ "rewardEventId": "reward-uuid", "tokenSymbol": "AERO" }],
        "coverageState": "full"
      }
    ]
  },
  "distributions": {
    "source": {
      "totalUsd": "1248721.34",
      "items": [
        {
          "id": "manual_deposits",
          "labelKey": "rewards:sources.manualDeposits",
          "valueUsd": "562100.00",
          "sharePct": "45.0",
          "count": 612,
          "coverageState": "full",
          "filterTarget": { "source": "deposits" }
        }
      ]
    },
    "pool": { "totalUsd": "1248721.34", "items": [] },
    "token": { "totalUsd": "1248721.34", "items": [] }
  },
  "events": {
    "rows": [
      {
        "rewardEventId": "reward-uuid",
        "occurredAt": "2026-05-16T14:32:18.000Z",
        "token": {
          "address": "0x...",
          "symbol": "AERO",
          "iconUrl": null
        },
        "tokenAmount": "1250.0000",
        "usdValueAtClaim": "1245.18",
        "owner": {
          "status": "manual_deposit",
          "label": "Manual Deposit",
          "entityId": "deposit-uuid",
          "entityLabel": "Dep-8f31...7a2c",
          "route": "/deposits/deposit-uuid"
        },
        "sourceSurface": "manual_deposit_gauge_claim",
        "poolContribution": {
          "status": "contributes",
          "poolId": "pool-uuid",
          "poolLabel": "WETH / cbBTC-100",
          "countingRule": "owner_resolved_pool"
        },
        "rewardType": "gauge_emissions",
        "coverageState": "full",
        "confidence": "high",
        "confidenceDots": 5,
        "resolutionReasonCodes": [],
        "txHash": "0x8f31...",
        "externalTxUrl": "https://basescan.org/tx/0x8f31..."
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 25,
      "totalRows": 1287,
      "totalPages": 52
    }
  },
  "selectedReward": {
    "rewardEventId": "reward-uuid",
    "summary": {
      "tokenSymbol": "AERO",
      "rewardTypeLabelKey": "rewards:rewardTypes.gaugeEmissions",
      "tokenAmount": "1250.0000",
      "usdValueAtClaim": "1245.18",
      "ownerStatus": "manual_deposit",
      "coverageState": "full",
      "confidence": "high"
    },
    "ownershipTrace": {
      "ownerStatus": "manual_deposit",
      "linkedEntityLabel": "Dep-8f31...7a2c",
      "linkedEntityRoute": "/deposits/deposit-uuid",
      "sourceSurface": "manual_deposit_gauge_claim",
      "evidenceKey": "rewards:evidence.depositOwnerClaim"
    },
    "poolContribution": {
      "status": "contributes",
      "linkedPoolLabel": "WETH / cbBTC-100",
      "linkedPoolRoute": "/pools/pool-uuid",
      "countingRuleKey": "rewards:countingRules.ownerResolvedPool",
      "noteKey": "rewards:notes.noDoubleCount"
    },
    "claimDetails": {
      "txHash": "0x8f31...",
      "claimTime": "2026-05-16T14:32:18.000Z",
      "rewardType": "gauge_emissions",
      "sourceContract": "0xAERO...",
      "externalTxUrl": "https://basescan.org/tx/0x8f31..."
    },
    "coverageNotes": {
      "coverageState": "full",
      "includedInAggregates": true,
      "reasonCodes": []
    },
    "unresolvedExcludedActivity": [
      {
        "rewardEventId": "unresolved-reward-uuid",
        "tokenSymbol": "AERO",
        "occurredAt": "2026-05-10T22:33:00.000Z",
        "tokenAmount": "500.0000",
        "usdValueAtClaim": "515.00",
        "reasonCode": "missingOwnerEvidence"
      }
    ]
  },
  "availableFilters": {
    "sources": ["deposits", "strategies", "governance"],
    "tokens": [],
    "pools": [],
    "rewardTypes": [],
    "coverageStates": ["full", "partial", "unresolved", "excluded", "unavailable"]
  }
}
```

## Locked Response

If analysis is not ready, the route returns success with a locked status rather than an empty reward set.

```json
{
  "walletAddress": "0xabc...",
  "chainId": 8453,
  "analysis": {
    "status": "locked",
    "reasonCode": "analysisNotReady"
  },
  "summary": null,
  "events": { "rows": [], "pagination": { "page": 1, "pageSize": 25, "totalRows": 0, "totalPages": 0 } }
}
```

## Error Codes

| Code | Meaning |
|------|---------|
| `UNAUTHENTICATED_WALLET` | No connected/authenticated wallet context. |
| `UNSUPPORTED_CHAIN` | Chain is not supported by product configuration. |
| `INVALID_REWARDS_FILTERS` | Query filters cannot be parsed or validated. |
| `ANALYSIS_NOT_FOUND` | No analysis run exists for the connected wallet/chain. |
| `REWARDS_READ_FAILED` | Unexpected DB/read-model failure. |

## Contract Rules

- The route must not call Moralis, Alchemy, RPC, or contract providers.
- All IDs and filters must be chain-scoped.
- Summary, chart, distribution, table, and selected reward data must be derived from the same filter state.
- Unresolved/excluded values must remain separate from resolved rewards value.
- Missing valuation must not be replaced by current price.
- The route must return stable reason codes, not localized copy.
