# Contract: Governance API

## Route

```text
GET /api/governance?chainId=8453
```

The route is wallet-scoped through the existing authenticated wallet context. It rejects unsupported chains and unauthenticated access with stable machine-readable error codes.

The route is DB-only. It must not call Moralis, Alchemy, RPC, protocol contracts, or explorer APIs during request handling.

## Query Parameters

| Name | Required | Description |
|------|----------|-------------|
| `chainId` | Yes | Active chain. Product v1 supports Base mainnet `8453`. |
| `search` | No | Search tx hash, reward token, pool label, epoch, action, lock id, or protocol surface. |
| `datePreset` | No | `7d`, `30d`, `90d`, `1y`, `all`, or `custom`. Defaults to `all` for governance history unless product settings override. |
| `dateStart` | No | ISO timestamp/date for custom range. |
| `dateEnd` | No | ISO timestamp/date for custom range. |
| `eventType` | No | Governance event/action family. |
| `rewardType` | No | `fee`, `bribe`, `rebase`, `relay_reward`, `unknown_governance`. |
| `protocolSurface` | No | `voting_escrow`, `veaero`, `voter`, `relay`, `bribe`, `fee_distributor`, `reward_distributor`, `aero_token`, `unknown`. |
| `epochId` | No | Epoch context filter. |
| `poolId` | No | Pool context filter, applied only to explicit pool-linked rows. |
| `tokenAddress` | No | Chain-scoped token filter. |
| `coverage` | No | `full`, `partial`, `unresolved`, `unsupported`, `excluded`, or `unavailable`. |
| `confidence` | No | `high`, `medium`, `low`, or `none`. |
| `selectedGovernanceId` | No | Selected event/reward/epoch/metric identity for detail rail. |
| `selectedKind` | No | `event`, `reward`, `epoch`, or `metric`. |
| `sort` | No | Sort key: `occurredAt`, `epoch`, `rewardValueUsd`, `rewardType`, `coverage`, or `confidence`. |
| `direction` | No | `asc` or `desc`. Defaults to descending date/epoch. |
| `page` | No | One-based rewards page. Defaults to `1`. |
| `pageSize` | No | Allowed values: `10`, `25`, `50`. Defaults to `10` for first-screen density. |

## Success Response

```json
{
  "walletAddress": "0xabc...",
  "chainId": 8453,
  "analysis": {
    "status": "ready",
    "runId": "run-uuid",
    "completedAt": "2026-05-31T12:00:00.000Z",
    "coveredRange": {
      "start": "2025-05-31T00:00:00.000Z",
      "end": "2026-05-31T00:00:00.000Z"
    },
    "isStale": false
  },
  "filters": {
    "search": "",
    "datePreset": "all",
    "eventType": null,
    "rewardType": null,
    "protocolSurface": null,
    "epochId": null,
    "poolId": null,
    "tokenAddress": null,
    "coverage": null,
    "confidence": null,
    "selectedKind": "reward",
    "selectedGovernanceId": "reward-uuid",
    "sort": { "key": "occurredAt", "direction": "desc" },
    "page": 1,
    "pageSize": 10,
    "activeChips": []
  },
  "summary": {
    "lockedAero": {
      "amount": "2203245.245",
      "valueUsd": "548264.31",
      "coverageState": "full",
      "confidence": "high"
    },
    "veAeroExposure": {
      "amount": "1845771.000",
      "valueUsd": "459180.88",
      "coverageState": "full",
      "confidence": "high"
    },
    "lockExpiry": {
      "expiresAt": "2027-01-30T00:00:00.000Z",
      "remainingDays": 243,
      "coverageState": "full",
      "confidence": "high"
    },
    "governanceRewardsClaimedUsd": {
      "valueUsd": "124783.24",
      "coverageState": "partial",
      "confidence": "medium"
    },
    "estimatedGovernanceReturn": {
      "percent": "12.34",
      "labelKey": "governance:kpis.estimatedReturn.context",
      "coverageState": "partial",
      "confidence": "medium"
    },
    "overallCoverage": {
      "coverageState": "partial",
      "confidence": "medium",
      "reasonCodes": ["partialRewardPoolAssociation"]
    }
  },
  "lockPanel": {
    "lockExposureId": "lock-exposure-uuid",
    "lockId": "0x4e96...e778",
    "status": "active",
    "createdAt": "2025-05-30T03:21:00.000Z",
    "expiresAt": "2027-01-30T00:00:00.000Z",
    "lockedAeroAmount": "2203245.245",
    "veAeroExposure": "1845771.000",
    "coverageState": "full",
    "confidence": "high",
    "lifecycle": [
      {
        "eventId": "event-uuid",
        "eventType": "lock_created",
        "occurredAt": "2025-05-30T03:21:00.000Z",
        "amountDelta": "2203245.245",
        "durationDeltaDays": null,
        "coverageState": "full",
        "confidence": "high"
      }
    ]
  },
  "epochTimeline": {
    "epochs": [
      {
        "epochId": "170",
        "epochLabel": "Epoch 170",
        "epochStartAt": "2026-05-26T00:00:00.000Z",
        "epochEndAt": "2026-06-02T00:00:00.000Z",
        "votedPools": [
          { "poolId": "pool-uuid", "label": "USDC / cbBTC", "weightPercent": "55.0" }
        ],
        "voteMode": "manual",
        "resetState": "not_reset",
        "rewardState": "claimed",
        "feesUsd": "1250.00",
        "bribesUsd": "3842.31",
        "rebasesUsd": "0",
        "coverageState": "full",
        "confidence": "high"
      }
    ]
  },
  "rewardBreakdown": {
    "totalValueUsd": "124783.24",
    "coverageState": "partial",
    "segments": [
      { "rewardType": "fees", "valueUsd": "35468.31", "percent": "28.42", "coverageState": "full" },
      { "rewardType": "bribes", "valueUsd": "70069.21", "percent": "56.17", "coverageState": "full" },
      { "rewardType": "rebases", "valueUsd": "9269.98", "percent": "7.43", "coverageState": "partial" }
    ]
  },
  "rewards": {
    "rows": [
      {
        "governanceRewardId": "reward-uuid",
        "rewardEventId": "reward-event-uuid",
        "claimedAt": "2026-05-26T22:37:00.000Z",
        "rewardType": "bribe",
        "token": { "address": "0x...", "symbol": "USDC", "iconUrl": null },
        "amount": "1250.00",
        "valueUsdAtClaim": "1250.00",
        "epochId": "170",
        "pool": { "poolId": "pool-uuid", "label": "USDC / cbBTC" },
        "coverageState": "full",
        "confidence": "high",
        "context": { "kind": "epoch", "label": "Epoch 170" }
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 10,
      "totalRows": 7,
      "totalPages": 1
    }
  },
  "selectedDetail": {
    "selectionKind": "reward",
    "selectionId": "reward-uuid",
    "actionSummary": {
      "labelKey": "governance:selected.actions.bribeClaim",
      "contextLabel": "Claimed USDC bribe"
    },
    "transaction": {
      "txHash": "0x703f...",
      "occurredAt": "2026-05-26T22:37:15.000Z",
      "externalTxUrl": "https://basescan.org/tx/0x703f..."
    },
    "protocolSurface": "bribe",
    "tokenMovements": [],
    "valueEffect": { "valueUsd": "1250.00", "coverageState": "full" },
    "epochContext": { "epochId": "170", "coverageState": "full" },
    "poolContext": { "poolId": "pool-uuid", "label": "USDC / cbBTC", "coverageState": "full" },
    "classificationEvidence": {
      "basis": ["protocol_contract_event", "wallet_transfer", "reward_event"],
      "reasonCodes": ["bribeClaim", "poolAssociationExplicit"],
      "missingEvidenceReasonCodes": []
    },
    "linkedContexts": [
      { "kind": "activity", "entityId": "activity-uuid", "route": "/activity?governanceEventId=event-uuid" },
      { "kind": "reward", "entityId": "reward-event-uuid", "route": "/rewards?rewardEventId=reward-event-uuid" },
      { "kind": "pool", "entityId": "pool-uuid", "route": "/pools/pool-uuid" }
    ],
    "coverageNotes": {
      "coverageState": "full",
      "confidence": "high",
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
  },
  "availableFilters": {
    "eventTypes": ["vote", "vote_reset", "bribe_claim"],
    "rewardTypes": ["fee", "bribe", "rebase"],
    "protocolSurfaces": ["voter", "bribe", "voting_escrow"],
    "epochs": ["170", "169"],
    "tokens": [{ "address": "0x...", "symbol": "USDC" }],
    "coverageStates": ["full", "partial"],
    "confidenceBands": ["high", "medium"]
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
| `ANALYSIS_NOT_READY` | Historical analysis has not unlocked Governance. |
| `INVALID_GOVERNANCE_FILTER` | Query parameter is malformed or unsupported. |
| `GOVERNANCE_SELECTION_NOT_FOUND` | Selected Governance object is not available for wallet/chain/filter context. |
| `INTERNAL_ERROR` | Unexpected server failure. |
