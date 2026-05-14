# Data Model: Connected Wallet Overview

## Overview

The Overview feature combines request-time read models with persisted wallet-scoped entities. The feature does not invent a new protocol domain; it composes existing wallet, snapshot, coverage, and analysis-run data into a single connected dashboard response.

**Current Stage Scope**: The active implementation stage uses this model for recent-view Overview delivery, canonical analysis start/status scaffolding, manual refresh, and honest stale-state messaging. `analyzed_history`, `all_analyzed_history`, `PerformanceSnapshot`-backed rendering, and automatic stale-refresh behavior remain deferred follow-up scope.

## Entities

### 1. OverviewRequest

Represents a frontend request for the connected Overview screen.

| Field | Type | Rules |
|---|---|---|
| `walletAddress` | `0x...` string | Required, EVM address, lowercase-normalized server-side |
| `chainId` | integer | Required, must resolve through `assertSupportedChain` |
| `range` | enum | Required, one of `24h`, `7d`, `30d` in the current stage |

Validation rules:

- `walletAddress` must match the EVM address format.
- `chainId` must be a supported product chain.
- `all_analyzed_history` is reserved for a deferred analyzed-history stage and is not a valid request value in the current implementation slice.

### 2. OverviewResponse

Represents the full HTTP payload returned to the frontend for `/api/wallet/overview`.

| Field | Type | Notes |
|---|---|---|
| `walletAddress` | string | Wallet scope echoed in response |
| `chainId` | integer | Chain scope echoed in response |
| `mode` | enum | `recent_view` in the current stage; `analyzed_history` reserved for follow-up scope |
| `selectedRange` | enum | Active range used by chart and period metrics |
| `analysis` | `OverviewAnalysisState` | Canonical analysis run/freshness block |
| `coverage` | `OverviewCoverage` | Page-level coverage block |
| `summary` | `OverviewSummary` | Wallet/chain/refresh summary block with block provenance |
| `metrics` | `OverviewMetrics` | Top-level portfolio values and period delta with block provenance |
| `chart` | `OverviewChartSeries` | Historical value series and source info |
| `distribution` | `OverviewDistributionBlock` | Allocation views with block provenance |
| `assets` | `OverviewAssetsBlock` | Asset market values table with block provenance |
| `activity` | `OverviewActivityBlock` | Recent preview items in the current stage; analyzed preview items are deferred |

### 3. OverviewBlockProvenance

Shared provenance metadata embedded in every major Overview block.

| Field | Type | Notes |
|---|---|---|
| `source` | enum | `recent_provider_data` or `partial_fallback` in the current stage; `analyzed_history` reserved for follow-up scope |
| `coverageStatus` | enum | `full`, `partial`, `recent`, `analyzed`, or `unknown` |
| `coverageReasonCodes` | string[] nullable | Block-specific reason codes such as `missingPrices`, `providerPartial`, `analysisPending`, `shareLevelStrategyCoverage` |

### 4. OverviewAnalysisState

Canonical machine state for the analysis module as consumed by Overview.

| Field | Type | Notes |
|---|---|---|
| `status` | enum | `not_analyzed`, `queued`, `running`, `ready`, `stale`, `failed` |
| `runId` | string nullable | Present for active or completed runs when available |
| `stage` | string | UI-visible stage label key source |
| `progressPct` | integer | 0-100 |
| `lastSuccessfulRunAt` | datetime nullable | Used for freshness/stale messaging when prior analysis metadata exists |
| `lastUpdatedAt` | datetime nullable | Used for polling freshness |
| `lastError` | string nullable | Sanitized error code or summary |

State transitions:

```text
not_analyzed -> queued -> running -> ready
ready -> stale
stale -> queued -> running -> ready
queued -> failed
running -> failed
failed -> queued
```

### 5. OverviewSummary

User-visible top summary block.

| Field | Type | Notes |
|---|---|---|
| `source` | enum | Embedded `OverviewBlockProvenance.source` |
| `coverageStatus` | enum | Embedded `OverviewBlockProvenance.coverageStatus` |
| `coverageReasonCodes` | string[] nullable | Embedded `OverviewBlockProvenance.coverageReasonCodes` |
| `walletAddress` | string | Display/address component input |
| `chainId` | integer | For chain label and explorer context |
| `chainLabel` | string | Derived from chain config |
| `lastRefreshedAt` | datetime nullable | Last data refresh timestamp for current mode |
| `modeLabelKey` | string | `overview.mode.recentView` in the current stage; `overview.mode.analyzedHistory` reserved for follow-up scope |

### 6. OverviewMetrics

Top-level value block.

| Field | Type | Notes |
|---|---|---|
| `source` | enum | Embedded `OverviewBlockProvenance.source` |
| `coverageStatus` | enum | Embedded `OverviewBlockProvenance.coverageStatus` |
| `coverageReasonCodes` | string[] nullable | Embedded `OverviewBlockProvenance.coverageReasonCodes` |
| `netPortfolioValueUsd` | decimal nullable | Primary KPI |
| `deployedValueUsd` | decimal nullable | Current deployed exposure |
| `idleValueUsd` | decimal nullable | Current idle wallet exposure |
| `changeOverSelectedPeriodPct` | decimal nullable | Period delta |
| `estimatedRealizedRewardsUsd` | decimal nullable | Optional if reconstructable |
| `manualDepositsValueUsd` | decimal nullable | Optional by coverage |
| `automatedStrategiesValueUsd` | decimal nullable | Optional by coverage |
| `residualAttributedValueUsd` | decimal nullable | Optional by coverage |
| `governanceValueUsd` | decimal nullable | Optional by coverage |

### 7. OverviewChartSeries

Historical chart data for Overview.

| Field | Type | Notes |
|---|---|---|
| `source` | enum | `recent_provider_data` in the current stage; `analyzed_history` reserved for follow-up scope |
| `coverageStatus` | enum | Embedded `OverviewBlockProvenance.coverageStatus` |
| `coverageReasonCodes` | string[] nullable | Embedded `OverviewBlockProvenance.coverageReasonCodes` |
| `range` | enum | Active range used to build the series |
| `points` | array of `OverviewChartPoint` | Ordered time series |
| `hasRewardMarkers` | boolean | Whether reward markers are included |

### 8. OverviewChartPoint

| Field | Type | Notes |
|---|---|---|
| `capturedAt` | datetime | X-axis timestamp |
| `totalValueUsd` | decimal nullable | Total wallet value |
| `deployedValueUsd` | decimal nullable | Deployed series |
| `idleValueUsd` | decimal nullable | Idle series |
| `rewardValueUsd` | decimal nullable | Optional overlay/marker value |

### 9. OverviewDistributionBlock

Represents the distribution block plus its provenance metadata.

| Field | Type | Notes |
|---|---|---|
| `source` | enum | Embedded `OverviewBlockProvenance.source` |
| `coverageStatus` | enum | Embedded `OverviewBlockProvenance.coverageStatus` |
| `coverageReasonCodes` | string[] nullable | Embedded `OverviewBlockProvenance.coverageReasonCodes` |
| `slices` | array of `OverviewDistributionSlice` | Distribution entries |

### 10. OverviewDistributionSlice

Represents a capital-allocation slice for a chosen distribution view.

| Field | Type | Notes |
|---|---|---|
| `dimension` | enum | `pool`, `token`, `strategy`, `idle`, `governance` |
| `label` | string | User-visible slice label |
| `valueUsd` | decimal | Slice value |
| `coverageStatus` | enum nullable | Slice-level confidence if needed |

### 11. OverviewAssetsBlock

Represents the asset-table block plus its provenance metadata.

| Field | Type | Notes |
|---|---|---|
| `source` | enum | Embedded `OverviewBlockProvenance.source` |
| `coverageStatus` | enum | Embedded `OverviewBlockProvenance.coverageStatus` |
| `coverageReasonCodes` | string[] nullable | Embedded `OverviewBlockProvenance.coverageReasonCodes` |
| `rows` | array of `OverviewAssetRow` | Asset table rows |

### 12. OverviewAssetRow

Current-asset table row.

| Field | Type | Notes |
|---|---|---|
| `tokenAddress` | string nullable | Chain-scoped token identity |
| `symbol` | string | Display symbol |
| `balance` | decimal/string | Human-readable balance |
| `priceUsd` | decimal nullable | Current price |
| `valueUsd` | decimal nullable | Current USD value |
| `movement24hPct` | decimal nullable | Optional movement metric |
| `movement7dPct` | decimal nullable | Optional movement metric |
| `classification` | enum | `deployed`, `idle`, `residual`, `reward`, `governance`, `unknown` |
| `priceConfidence` | enum nullable | Useful when fallback valuation is used |

### 13. OverviewActivityBlock

Represents the activity-preview block plus its provenance metadata.

| Field | Type | Notes |
|---|---|---|
| `source` | enum | Embedded `OverviewBlockProvenance.source` |
| `coverageStatus` | enum | Embedded `OverviewBlockProvenance.coverageStatus` |
| `coverageReasonCodes` | string[] nullable | Embedded `OverviewBlockProvenance.coverageReasonCodes` |
| `items` | array of `OverviewActivityPreviewItem` | Recent preview items in the current stage |

### 14. OverviewActivityPreviewItem

Recent activity row for the current Overview preview panel. Analyzed activity rows remain deferred follow-up scope.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable frontend key |
| `occurredAt` | datetime | Activity timestamp |
| `eventType` | string | Canonical or provisional type |
| `labelKey` | string | Translation key for display label |
| `txHash` | string nullable | Optional technical reference |
| `confidence` | enum nullable | Useful for pre-analysis labeling |
| `isUnclassified` | boolean | Explicit pre-analysis fallback |

### 15. OverviewCoverage

Page-level coverage and explainability block.

| Field | Type | Notes |
|---|---|---|
| `status` | enum | `full`, `partial`, `recent`, `analyzed`, `unknown` |
| `confidence` | enum nullable | Optional confidence descriptor |
| `reasonCodes` | array of string | e.g. `missingPrices`, `analysisPending`, `providerPartial` |
| `details` | string nullable | Sanitized explainability summary |

## Persistent Entities Reused By Overview

### PortfolioSnapshot

- Wallet + chain + capture time identity
- Source for current total/deployed/idle values
- Written by recent view and historical analysis

### PerformanceSnapshot

- Wallet + chain + scope + capture time identity
- Reserved source for analyzed chart series and period deltas in a deferred follow-up stage
- Not consumed by the current recent-view implementation slice

### CoverageReport

- Wallet + chain + scope + status + confidence
- Used to explain missing prices, partial provider data, or incomplete analysis

### WalletContext

- Wallet + chain identity
- Stores freshness metadata such as `lastAnalyzedAt` and `lastSuccessfulRunId`
- Used to derive `stale`

## Relationships

```text
OverviewRequest
  -> OverviewResponse
       -> OverviewAnalysisState
       -> OverviewCoverage
       -> OverviewSummary
       -> OverviewMetrics
       -> OverviewChartSeries
      -> OverviewDistributionBlock
      -> OverviewAssetsBlock
      -> OverviewActivityBlock

OverviewResponse
  -> PortfolioSnapshot (recent and analyzed source)
  -> PerformanceSnapshot (deferred analyzed source)
  -> CoverageReport
  -> WalletContext
  -> AnalysisRun
```

## Source-Selection Rules

### Recent View

- Use Moralis balances/history and optional DeFi hints.
- Use Alchemy current and recent historical prices.
- Persist `RawProviderRecord`, `PricePoint`, `CoverageReport`, and `PortfolioSnapshot` when data is sufficient.

### Deferred Analyzed History

- A later stage may use persisted `PortfolioSnapshot`, `PerformanceSnapshot`, `CoverageReport`, and normalized activity data.
- A later stage may derive analyzed-history rendering from `WalletContext.lastAnalyzedAt` and related freshness metadata.

## Open Modeling Notes

- `all_analyzed_history` remains reserved for the deferred analyzed-history stage.
- `estimatedRealizedRewardsUsd` remains nullable because coverage may not support it in every mode.
- Movement columns on asset rows remain optional because not every provider path will yield them reliably for every token.