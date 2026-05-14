# Contract: Analysis Status And Start Endpoints

## Canonical Status Enum

Overview-facing machine states must use:

```text
not_analyzed | queued | running | ready | stale | failed
```

`stale` is a freshness-derived read-model state, not a persisted run lifecycle requirement.

**Current Stage Scope**: The current implementation stage uses this contract for canonical analysis start/status behavior and honest stale-state messaging. Automatic stale refresh and analyzed-history screen restoration remain deferred follow-up scope.

## Endpoint: `GET /api/analysis/status`

### Query Parameters

| Parameter | Type | Required |
|---|---|---|
| `walletAddress` | string | Yes |
| `chainId` | integer | Yes |

### Success Response

```json
{
  "walletAddress": "0xabc...",
  "chainId": 8453,
  "status": "stale",
  "runId": "uuid-or-null",
  "stage": "completed",
  "progressPct": 100,
  "lastSuccessfulRunAt": "2026-05-01T12:00:00.000Z",
  "lastUpdatedAt": "2026-05-14T12:00:00.000Z",
  "lastError": null
}
```

### Rules

- If there is no analysis history, return `not_analyzed`.
- If a run is active, return `queued` or `running` from the active run.
- If the last successful analysis is older than 7 days and no run is active, return `stale`.
- Returning `stale` or `failed` must not force the frontend into a blocking state; consumers should preserve the last safe screen state they already have.

## Endpoint: `POST /api/analysis/start`

### Request Body

```json
{
  "walletAddress": "0xabc...",
  "chainId": 8453,
  "mode": "full_history"
}
```

### Success Response

`202 Accepted`

```json
{
  "runId": "uuid",
  "walletAddress": "0xabc...",
  "chainId": 8453,
  "status": "queued",
  "stage": "queued",
  "progressPct": 0
}
```

## Frontend Contract Rules

- Overview must poll `GET /api/analysis/status` while status is `queued` or `running`.
- Overview may trigger `POST /api/analysis/start` manually when status is `not_analyzed`, `failed`, or `stale`.
- Automatic stale refresh is deferred follow-up scope. The current stage uses manual start actions plus canonical status polling through the same status endpoint.