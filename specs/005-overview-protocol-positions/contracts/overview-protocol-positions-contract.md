# Contract: Overview Protocol Positions Extension

## Endpoint

`GET /api/wallet/overview`

## Purpose

Extend the existing connected Overview contract so Stage 1 can return a dedicated protocol-positions block for manual Aerodrome deposits, Mellow strategy exposure, and governance locks without introducing a new browser-facing route. This contract preserves the current Overview API shape and adds current-state protocol-position visibility, coverage semantics, and honest value treatment for positions that may require bounded recent reconstruction.

## Request

Request parameters remain unchanged:

| Parameter | Type | Required | Rules |
|---|---|---|---|
| `walletAddress` | string | Yes | Valid EVM address |
| `chainId` | integer | Yes | Supported chain |
| `range` | string | Yes | `24h`, `7d`, `30d` |

## Extended Types

### ProtocolPositionFamily

```ts
type ProtocolPositionFamily =
  | "manual_deposit"
  | "strategy_exposure"
  | "governance_lock"
  | "staked_lp";
```

### ProtocolPositionCoverageStatus

```ts
type ProtocolPositionCoverageStatus =
  | "full"
  | "share_level"
  | "partial"
  | "unknown";
```

### ProtocolPositionValueStatus

```ts
type ProtocolPositionValueStatus =
  | "current"
  | "estimated"
  | "unavailable";
```

### ProtocolPositionCoverageReasonCode

Canonical protocol-position coverage vocabulary for Stage 1.

```ts
type ProtocolPositionCoverageReasonCode =
  | "protocolPositionsPresent"
  | "recentProtocolReconstruction"
  | "protocolValuationPartial"
  | "strategyShareLevelOnly"
  | "governanceValueUnavailable"
  | "positionMetadataIncomplete";
```

### OverviewCoverageReasonCode

```ts
type OverviewCoverageReasonCode =
  | ExistingOverviewCoverageReasonCode
  | OverviewTrustCoverageReasonCode
  | ProtocolPositionCoverageReasonCode;
```

### OverviewProtocolPosition

```ts
type OverviewProtocolPosition = {
  positionKey: string;
  chainId: number;
  walletAddress: string;
  family: ProtocolPositionFamily;
  protocol: "aerodrome" | "mellow" | string;
  label: string;
  status: "active" | "locked" | "staked" | "unknown";
  coverageStatus: ProtocolPositionCoverageStatus;
  coverageReasonCodes: ProtocolPositionCoverageReasonCode[];
  valueUsd: number | null;
  valueStatus: ProtocolPositionValueStatus;
  valueUpdatedAt: string | null;
  primaryTokenSymbol: string | null;
  secondaryTokenSymbol: string | null;
  poolLabel: string | null;
  strategyLabel: string | null;
  governanceLabel: string | null;
  tokenId: string | null;
  metadata: {
    protocolSurface: string | null;
    wrapperAddress: string | null;
    positionContractAddress: string | null;
    lockEndAt: string | null;
    feeTierLabel: string | null;
  };
};
```

### OverviewProtocolPositionsSummary

```ts
type OverviewProtocolPositionsSummary = {
  totalCount: number;
  familyCounts: {
    manualDeposit: number;
    strategyExposure: number;
    governanceLock: number;
    stakedLp: number;
  };
  hasPartialValuation: boolean;
  hasShareLevelPositions: boolean;
  lastRefreshedAt: string | null;
};
```

### OverviewProtocolPositionsBlock

```ts
type OverviewProtocolPositionsBlock = {
  source: "recent_provider_data" | "partial_fallback";
  coverageStatus: "full" | "partial" | "unknown";
  coverageReasonCodes: ProtocolPositionCoverageReasonCode[] | null;
  rows: OverviewProtocolPosition[];
  summary: OverviewProtocolPositionsSummary;
};
```

## Success Response Extension

`200 OK`

```json
{
  "walletAddress": "0xabc...",
  "chainId": 8453,
  "mode": "recent_view",
  "selectedRange": "7d",
  "coverage": {
    "status": "partial",
    "confidence": "medium",
    "reasonCodes": [
      "analysisPending",
      "protocolPositionsPresent",
      "recentProtocolReconstruction",
      "protocolValuationPartial"
    ],
    "details": null
  },
  "metrics": {
    "source": "recent_provider_data",
    "coverageStatus": "partial",
    "coverageReasonCodes": [
      "protocolPositionsPresent",
      "protocolValuationPartial"
    ],
    "netPortfolioValueUsd": 3210.12,
    "deployedValueUsd": 2450.55,
    "idleValueUsd": 759.57,
    "changeOverSelectedPeriodPct": null,
    "estimatedRealizedRewardsUsd": null,
    "manualDepositsValueUsd": 1200.11,
    "automatedStrategiesValueUsd": 900.22,
    "residualAttributedValueUsd": null,
    "governanceValueUsd": null,
    "exclusions": null
  },
  "protocolPositions": {
    "source": "recent_provider_data",
    "coverageStatus": "partial",
    "coverageReasonCodes": [
      "recentProtocolReconstruction",
      "protocolValuationPartial"
    ],
    "rows": [
      {
        "positionKey": "8453:aerodrome:manual:0x827922686190790b37229fd06084350e74485b72:12345",
        "chainId": 8453,
        "walletAddress": "0xabc...",
        "family": "manual_deposit",
        "protocol": "aerodrome",
        "label": "WETH / USDC manual position",
        "status": "active",
        "coverageStatus": "full",
        "coverageReasonCodes": [],
        "valueUsd": 1200.11,
        "valueStatus": "current",
        "valueUpdatedAt": "2026-05-15T12:00:00.000Z",
        "primaryTokenSymbol": "WETH",
        "secondaryTokenSymbol": "USDC",
        "poolLabel": "WETH / USDC",
        "strategyLabel": null,
        "governanceLabel": null,
        "tokenId": "12345",
        "metadata": {
          "protocolSurface": "aerodrome_cl_nft",
          "wrapperAddress": null,
          "positionContractAddress": "0x827922686190790b37229fd06084350e74485b72",
          "lockEndAt": null,
          "feeTierLabel": "0.05%"
        }
      },
      {
        "positionKey": "8453:mellow:strategy:0xstrategy:0xabc...",
        "chainId": 8453,
        "walletAddress": "0xabc...",
        "family": "strategy_exposure",
        "protocol": "mellow",
        "label": "Mellow strategy exposure",
        "status": "active",
        "coverageStatus": "share_level",
        "coverageReasonCodes": ["strategyShareLevelOnly"],
        "valueUsd": 900.22,
        "valueStatus": "estimated",
        "valueUpdatedAt": "2026-05-15T12:00:00.000Z",
        "primaryTokenSymbol": null,
        "secondaryTokenSymbol": null,
        "poolLabel": null,
        "strategyLabel": "Mellow Base strategy",
        "governanceLabel": null,
        "tokenId": null,
        "metadata": {
          "protocolSurface": "mellow_wrapper",
          "wrapperAddress": "0xwrapper",
          "positionContractAddress": "0xstrategy",
          "lockEndAt": null,
          "feeTierLabel": null
        }
      },
      {
        "positionKey": "8453:aerodrome:governance:0xlock:0xabc...",
        "chainId": 8453,
        "walletAddress": "0xabc...",
        "family": "governance_lock",
        "protocol": "aerodrome",
        "label": "Aerodrome governance lock",
        "status": "locked",
        "coverageStatus": "partial",
        "coverageReasonCodes": ["governanceValueUnavailable"],
        "valueUsd": null,
        "valueStatus": "unavailable",
        "valueUpdatedAt": null,
        "primaryTokenSymbol": "AERO",
        "secondaryTokenSymbol": null,
        "poolLabel": null,
        "strategyLabel": null,
        "governanceLabel": "veAERO lock",
        "tokenId": null,
        "metadata": {
          "protocolSurface": "aerodrome_governance",
          "wrapperAddress": null,
          "positionContractAddress": "0xlock",
          "lockEndAt": "2026-11-01T00:00:00.000Z",
          "feeTierLabel": null
        }
      }
    ],
    "summary": {
      "totalCount": 3,
      "familyCounts": {
        "manualDeposit": 1,
        "strategyExposure": 1,
        "governanceLock": 1,
        "stakedLp": 0
      },
      "hasPartialValuation": true,
      "hasShareLevelPositions": true,
      "lastRefreshedAt": "2026-05-15T12:00:00.000Z"
    }
  }
}
```

## Rules

1. `protocolPositions.rows` contains only approved protocol-position families and never generic NFT inventory.
2. `assets.rows` and `protocolPositions.rows` are separate surfaces; the frontend must not merge them into a single list.
3. `manualDepositsValueUsd`, `automatedStrategiesValueUsd`, and `governanceValueUsd` are driven by protocol-position evidence, not synthetic asset-row transformations.
4. `valueUsd` must be null when the backend cannot defend a current or estimated value. The API must not fabricate zeros or fake spot-price arithmetic for protocol-position rows.
5. `coverageStatus` communicates completeness of classification or valuation and must not imply that Stage 1 is a full one-year reconstruction.
6. When bounded recent reconstruction is used, `recentProtocolReconstruction` must appear in block-level or page-level coverage metadata.
7. All protocol-position identities are chain-scoped. The same token ID, contract address, or governance surface on another chain is a different entity.
8. Browser code must never receive raw provider payloads, RPC responses, or internal scoring details. Only canonical sanitized fields documented here may appear.
9. Query keys remain Overview-scoped and continue to include `chainId` and `walletAddress`.

## Error Handling

Error codes remain unchanged from the existing Overview contract:

- `VALIDATION_FAILED`
- `UNSUPPORTED_CHAIN`
- `PROVIDER_REQUEST_FAILED`
- `OVERVIEW_FAILED`