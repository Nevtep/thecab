# Contract: Overview Asset Trust Extension

## Endpoint

`GET /api/wallet/overview`

## Purpose

Extend the existing connected Overview contract so Stage 1 can return trust-classified wallet assets, hidden-asset summary metadata, exclusion-aware totals, and trust-aware distribution without changing the route or exposing third-party providers to the browser.

This contract extends the `003-connected-wallet-overview` contract. It does not replace the Overview block structure.

## Request

Request parameters remain unchanged from the existing Overview contract:

| Parameter | Type | Required | Rules |
|---|---|---|---|
| `walletAddress` | string | Yes | Valid EVM address |
| `chainId` | integer | Yes | Supported chain |
| `range` | string | Yes | `24h`, `7d`, `30d` |

## Extended Types

### TokenTrustStatus

```ts
type TokenTrustStatus =
  | "trusted"
  | "verified"
  | "known_protocol"
  | "priced"
  | "low_confidence"
  | "possible_spam"
  | "blocked"
  | "unknown";
```

### TokenTrustReasonCode

```ts
type TokenTrustReasonCode =
  | "moralisPossibleSpam"
  | "moralisVerifiedContract"
  | "alchemyMissingPrice"
  | "missingLogo"
  | "missingMetadata"
  | "suspiciousSymbol"
  | "zeroOrDustValue"
  | "unrecognizedContract"
  | "knownAerodromeToken"
  | "knownProtocolContract"
  | "hasReliablePrice"
  | "userHidden"
  | "userAllowed";
```

### OverviewTrustCoverageReasonCode

Canonical trust-related coverage and exclusion vocabulary owned by this feature.

```ts
type OverviewTrustCoverageReasonCode =
  | "excludedSuspiciousAssets"
  | "lowConfidenceAssetsHidden"
  | "missingPrices"
  | "visibleUnpricedAssets"
  | "hiddenAssetsPresent"
  | "knownProtocolSignalConflict"
  | "providerTrustSignalsMissing"
  | "metadataIncomplete"
  | "dustAssetsHidden"
  | "valuationPartial";
```

### OverviewCoverageReasonCode

```ts
type OverviewCoverageReasonCode =
  | ExistingOverviewCoverageReasonCode
  | OverviewTrustCoverageReasonCode;
```

Notes:

- `ExistingOverviewCoverageReasonCode` refers to the pre-existing connected Overview contract vocabulary from feature `003-connected-wallet-overview`.
- Trust-owned coverage additions in `coverage.reasonCodes`, `metrics.coverageReasonCodes`, `distribution.coverageReasonCodes`, and `assets.coverageReasonCodes` must use `OverviewTrustCoverageReasonCode` values only.
- Each trust-related coverage reason code maps to a translation key in `coverage` or another approved trust-aware i18n namespace.

### OverviewAssetRow Extension

```ts
type OverviewAssetRow = {
  tokenAddress: string | null;
  chainId: number;
  symbol: string;
  name?: string | null;
  balance: string;
  priceUsd: number | null;
  valueUsd: number | null;
  movement24hPct: number | null;
  movement7dPct: number | null;
  classification:
    | "deployed"
    | "idle"
    | "residual"
    | "reward"
    | "governance"
    | "unknown";
  priceConfidence: "low" | "medium" | "high" | null;
  trustStatus: TokenTrustStatus;
  trustReasonCodes: TokenTrustReasonCode[];
  isHiddenByDefault: boolean;
  classifierVersion?: string;
};
```

### HiddenAssetSummary

```ts
type HiddenAssetSummary = {
  hiddenCount: number;
  hiddenValueUsd: number | null;
  reasonCodes: OverviewTrustCoverageReasonCode[];
  affectsTotals: boolean;
  allVisibleAssetsUnpricedOrZero: boolean;
};
```

### OverviewExclusionSummary

```ts
type OverviewExclusionSummary = {
  excludedAssetCount: number;
  excludedValueUsd: number | null;
  reasonCodes: OverviewTrustCoverageReasonCode[];
  includesUnpricedVisibleAssets: boolean;
};
```

## Success Response Extensions

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
    "reasonCodes": ["analysisPending", "excludedSuspiciousAssets", "missingPrices"],
    "details": null
  },
  "metrics": {
    "source": "recent_provider_data",
    "coverageStatus": "partial",
    "coverageReasonCodes": ["excludedSuspiciousAssets", "missingPrices"],
    "netPortfolioValueUsd": 1234.56,
    "deployedValueUsd": null,
    "idleValueUsd": 1234.56,
    "changeOverSelectedPeriodPct": 0.04,
    "estimatedRealizedRewardsUsd": null,
    "manualDepositsValueUsd": null,
    "automatedStrategiesValueUsd": null,
    "residualAttributedValueUsd": null,
    "governanceValueUsd": null,
    "exclusions": {
      "excludedAssetCount": 3,
      "excludedValueUsd": 0.12,
      "reasonCodes": ["excludedSuspiciousAssets", "lowConfidenceAssetsHidden"],
      "includesUnpricedVisibleAssets": true
    }
  },
  "distribution": {
    "source": "recent_provider_data",
    "coverageStatus": "partial",
    "coverageReasonCodes": ["excludedSuspiciousAssets", "missingPrices"],
    "slices": [],
    "exclusions": {
      "excludedAssetCount": 3,
      "excludedValueUsd": 0.12,
      "reasonCodes": ["excludedSuspiciousAssets"],
      "includesUnpricedVisibleAssets": true
    }
  },
  "assets": {
    "source": "recent_provider_data",
    "coverageStatus": "partial",
    "coverageReasonCodes": ["excludedSuspiciousAssets", "missingPrices"],
    "rows": [
      {
        "tokenAddress": "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
        "chainId": 8453,
        "symbol": "AERO",
        "name": "Aerodrome",
        "balance": "12.34",
        "priceUsd": 0.72,
        "valueUsd": 8.88,
        "movement24hPct": -0.03,
        "movement7dPct": 0.06,
        "classification": "idle",
        "priceConfidence": "high",
        "trustStatus": "known_protocol",
        "trustReasonCodes": ["knownAerodromeToken", "hasReliablePrice"],
        "isHiddenByDefault": false,
        "classifierVersion": "asset-trust-v1"
      },
      {
        "tokenAddress": "0xdead...",
        "chainId": 8453,
        "symbol": "USDC",
        "name": "Fake USDC",
        "balance": "999999",
        "priceUsd": null,
        "valueUsd": null,
        "movement24hPct": null,
        "movement7dPct": null,
        "classification": "idle",
        "priceConfidence": null,
        "trustStatus": "possible_spam",
        "trustReasonCodes": ["moralisPossibleSpam", "alchemyMissingPrice", "suspiciousSymbol"],
        "isHiddenByDefault": true,
        "classifierVersion": "asset-trust-v1"
      }
    ],
    "hiddenSummary": {
      "hiddenCount": 1,
      "hiddenValueUsd": null,
      "reasonCodes": ["excludedSuspiciousAssets"],
      "affectsTotals": true,
      "allVisibleAssetsUnpricedOrZero": false
    },
    "defaultVisibleCount": 1
  }
}
```

## Rules

1. `assets.rows` contains both visible and hidden rows; hidden rows are not removed from the payload.
2. The frontend may use `isHiddenByDefault` to control presentation only; it must not compute trust status, reason codes, or default totals itself.
3. `metrics` and `distribution` default values exclude rows hidden by policy and exclude rows without reliable priced value where valuation is required.
4. Missing Alchemy price degrades valuation confidence and coverage; it is not proof of spam.
5. Provider-specific field names such as `possible_spam` or `verified_contract` must not appear in frontend types or response keys.
6. All asset identity and trust output is chain-scoped.
7. The UI must not interpret `trustStatus` as a security guarantee.
8. Trust-related exclusion and coverage metadata owned by this feature must use canonical documented `OverviewTrustCoverageReasonCode` values rather than ad hoc strings.
9. Trust or coverage reason codes emitted by the API are machine-readable values that map to translation keys; the browser must not infer display copy from raw provider terminology.

## Error Handling

Error codes remain unchanged from the existing Overview contract:

- `VALIDATION_FAILED`
- `UNSUPPORTED_CHAIN`
- `PROVIDER_REQUEST_FAILED`
- `OVERVIEW_FAILED`

No raw provider error bodies, provider response payloads, or trust-internal scoring details are returned to the browser. Route-level validation must keep provider errors sanitized even when upstream requests fail.
