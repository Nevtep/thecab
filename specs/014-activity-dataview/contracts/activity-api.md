# Contract: Activity API

## Route

```text
GET /api/activity?chainId=8453
```

The route is wallet-scoped through the existing authenticated wallet context. It must reject unsupported chains and unauthenticated access with stable machine-readable error codes.

The route is DB-only. It must not call wallet history, pricing, RPC, chain explorer, or protocol contracts during request handling.

## Query Parameters

| Name | Required | Description |
|------|----------|-------------|
| `chainId` | Yes | Active chain. Product v1 supports Base mainnet `8453`. |
| `search` | No | Search across tx hash, action label, token, pool, linked entity, and protocol surface. |
| `datePreset` | No | `7d`, `30d`, `90d`, `1y`, `all`, or `custom`. Defaults to `30d` unless product settings override. |
| `dateStart` | No | ISO timestamp or date for custom range. |
| `dateEnd` | No | ISO timestamp or date for custom range. |
| `actionType` | No | One or more Activity action classifications. |
| `protocolSurface` | No | Router, pool, gauge, reward, voter, veAERO, Mellow wrapper, Mellow staking rewards, unknown, or other supported surface. |
| `poolId` | No | Pool context filter. |
| `depositId` | No | Deposit or position context filter. |
| `strategyId` | No | Strategy filter. |
| `strategyExposureId` | No | Strategy exposure filter. |
| `rewardEventId` | No | Reward context filter. |
| `governanceEventId` | No | Governance context filter. |
| `tokenAddress` | No | Chain-scoped token filter. |
| `coverage` | No | `full`, `partial`, `unresolved`, `excluded`, `unsupported`, `malicious`, `ambiguous`, `discarded`, or `unavailable`. |
| `confidence` | No | `high`, `medium`, `low`, or `none`. |
| `resolutionStatus` | No | `resolved`, `partial`, `unresolved`, `excluded`, or `unavailable`. |
| `selectedActivityEventId` | No | Activity row to load into selected detail rail. |
| `sort` | No | Sort key: `occurredAt`, `valueUsd`, `actionType`, `protocolSurface`, `coverage`, `confidence`, or `linkedEntity`. |
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
    "actionType": null,
    "protocolSurface": null,
    "poolId": null,
    "depositId": null,
    "strategyId": null,
    "strategyExposureId": null,
    "rewardEventId": null,
    "governanceEventId": null,
    "tokenAddress": null,
    "coverage": null,
    "confidence": null,
    "resolutionStatus": null,
    "selectedActivityEventId": "activity-uuid",
    "sort": { "key": "occurredAt", "direction": "desc" },
    "page": 1,
    "pageSize": 25,
    "activeChips": []
  },
  "summary": {
    "totalRows": 1287,
    "interpretedRows": 1132,
    "supportedRows": 1088,
    "partialOrUnresolvedRows": 144,
    "excludedOrMaliciousRows": 11,
    "valuationCoveragePercent": "91.5",
    "coverageState": "partial",
    "coverageReasonCodes": ["mixedValuationCoverage"],
    "confidenceBreakdown": {
      "high": 1000,
      "medium": 204,
      "low": 72,
      "none": 11
    }
  },
  "availableFilters": {
    "actionTypes": ["deposit", "claim", "swap", "strategy_claim", "ambiguous"],
    "protocolSurfaces": ["router", "pool", "gauge", "mellow_staking_rewards"],
    "tokens": [
      { "address": "0x...", "symbol": "AERO" }
    ],
    "coverageStates": ["full", "partial", "malicious"],
    "confidenceBands": ["high", "medium", "low"]
  },
  "events": {
    "rows": [
      {
        "activityEventId": "activity-uuid",
        "txHash": "0x8f31...",
        "occurredAt": "2026-05-16T14:32:18.000Z",
        "blockNumber": 30300111,
        "actionType": "strategy_claim",
        "actionLabelKey": "activity:actions.strategyClaim",
        "protocolSurface": "mellow_staking_rewards",
        "summaryLabelKey": "activity:rows.strategyClaimSummary",
        "valueUsd": "1245.18",
        "coverageState": "full",
        "confidence": "high",
        "affectsTotals": true,
        "linkedEntities": [
          {
            "kind": "strategyExposure",
            "entityId": "strategy-exposure-uuid",
            "label": "Strat-8f95...fcec",
            "route": "/strategies/strategy-uuid",
            "relationship": "claims",
            "confidence": "high"
          }
        ],
        "assetMovements": [
          {
            "direction": "in",
            "token": {
              "address": "0x...",
              "symbol": "AERO",
              "iconUrl": null
            },
            "tokenAmount": "1250.0000",
            "valueUsd": "1245.18",
            "valuationCoverageState": "full"
          }
        ],
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
  "selectedActivity": {
    "activityEventId": "activity-uuid",
    "transaction": {
      "txHash": "0x8f31...",
      "blockNumber": 30300111,
      "occurredAt": "2026-05-16T14:32:18.000Z",
      "externalTxUrl": "https://basescan.org/tx/0x8f31..."
    },
    "summary": {
      "actionType": "strategy_claim",
      "protocolSurface": "mellow_staking_rewards",
      "coverageState": "full",
      "confidence": "high",
      "valueUsd": "1245.18"
    },
    "classificationEvidence": {
      "basis": ["decoded_wallet_history", "protocol_contract_event"],
      "supplementalEvidenceUsed": false,
      "reasonCodes": ["strategyExposureResolved"],
      "missingEvidenceReasonCodes": []
    },
    "assetMovements": [],
    "linkedEntities": [],
    "rebalanceExplanation": null,
    "coverageNotes": {
      "coverageState": "full",
      "affectsTotals": true,
      "reasonCodes": []
    },
    "sourceEvidenceRefs": [
      {
        "provider": "moralis",
        "recordKind": "wallet_history",
        "referenceId": "provider-record-uuid"
      }
    ]
  }
}
```

## Locked Response

When analysis is not ready:

```json
{
  "code": "ANALYSIS_NOT_READY",
  "messageKey": "errors:analysis.notReady",
  "analysis": {
    "status": "idle",
    "isStale": false
  }
}
```

## Error Codes

| Code | Meaning |
|------|---------|
| `UNAUTHENTICATED` | No authenticated wallet context. |
| `WALLET_MISMATCH` | Requested wallet does not match authenticated wallet. |
| `UNSUPPORTED_CHAIN` | Chain is outside product v1 supported chains. |
| `ANALYSIS_NOT_READY` | Historical analysis has not unlocked Activity. |
| `INVALID_ACTIVITY_FILTER` | Query parameter is malformed or unsupported. |
| `ACTIVITY_EVENT_NOT_FOUND` | Selected activity event is not available for wallet/chain/filter context. |
| `INTERNAL_ERROR` | Unexpected server failure. |

## Invariants

- Response must be scoped by authenticated wallet and `chainId`.
- External transaction URLs must use chain config, not hardcoded explorer strings.
- Excluded, malicious, unsupported, ambiguous, discarded, unresolved, and unavailable rows must remain out of confident totals.
- Supplemental explorer evidence appears only as persisted evidence metadata, never as a live request-time provider call.
