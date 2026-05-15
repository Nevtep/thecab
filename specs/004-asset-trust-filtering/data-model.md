# Data Model: Wallet Asset Trust Filtering

## Overview

Wallet Asset Trust Filtering extends the existing Overview recent-view model without replacing it. Stage 1 adds server-side trust classification, hidden-asset summary data, exclusion-aware totals, reusable trust enums, and canonical trust-related coverage or exclusion reason codes that can later be adopted by Pools, Activity, Rewards, and Settings.

The current implementation slice remains Overview-only. Persistent user visibility overrides and standalone trust persistence are deferred unless later implementation proves they are necessary. Stage 1 classification may still execute during the Overview request path, but only from normalized internal trust inputs that are persisted already or deterministically recoverable from existing persistence surfaces.

## Entities

### 1. AssetTrustClassifierInput

Normalized server-side input passed to the trust classifier for one wallet asset.

| Field | Type | Rules |
|---|---|---|
| `walletAddress` | `0x...` string | Required, lowercase-normalized |
| `chainId` | integer | Required, supported chain |
| `tokenAddress` | string nullable | Lowercase contract address, or `null` for native/sentinel representations |
| `symbol` | string nullable | Provider/display metadata input |
| `name` | string nullable | Provider/display metadata input |
| `balanceRaw` | string | Required raw balance |
| `balanceFormatted` | string | Required human-readable balance |
| `valueUsd` | number nullable | Current computed USD value if available |
| `hasReliableAlchemyPrice` | boolean | True only when address-based Alchemy pricing resolved confidently |
| `moralisPossibleSpam` | boolean nullable | Primary provider spam signal |
| `moralisVerifiedContract` | boolean nullable | Provider verification signal |
| `hasLogo` | boolean | Metadata completeness signal |
| `hasMetadata` | boolean | True when the row has sufficient symbol/name/decimals metadata |
| `isKnownProtocolAsset` | boolean | Result of chain-scoped known-asset recognition |
| `isNativeAsset` | boolean | True when the asset represents the chain-native asset |
| `isDustValue` | boolean | Derived dust/near-zero heuristic |
| `classifierVersion` | string | Required deterministic classifier version |

Validation rules:

- Provider field names do not pass to the frontend directly.
- `chainId` and `tokenAddress` stay chain-scoped.
- Missing price can coexist with `isKnownProtocolAsset = true`.
- In Stage 1, every field in `AssetTrustClassifierInput` must be recoverable from `RawProviderRecord.payloadJson`, `PricePoint`, `CoverageReport.metadataJson`, `PortfolioSnapshot.metadataJson`, and chain-scoped protocol metadata or known-protocol lookup, or else a narrow normalized trust-input persistence addition is required.

### 2. TokenTrustClassification

Canonical trust outcome returned by the classifier.

| Field | Type | Notes |
|---|---|---|
| `trustStatus` | enum | `trusted`, `verified`, `known_protocol`, `priced`, `low_confidence`, `possible_spam`, `blocked`, `unknown` |
| `trustReasonCodes` | enum[] | Ordered normalized reasons explaining the result |
| `isHiddenByDefault` | boolean | Visibility outcome for default Overview rendering |
| `classifierVersion` | string | Echoed for explainability and optional persistence |

Precedence notes:

- `possible_spam` and `blocked` always hide by default.
- `low_confidence` may hide when dust, unpriced, suspicious, or incomplete enough to pollute the default Overview.
- `known_protocol`, `verified`, `trusted`, and `priced` default to visible unless stronger caution applies.

### 3. TokenTrustReasonCode

Normalized reason vocabulary for non-trusted classifications and explanation states.

| Reason Code | Meaning |
|---|---|
| `moralisPossibleSpam` | Moralis flagged the token as possible spam |
| `moralisVerifiedContract` | Moralis flagged the contract as verified |
| `alchemyMissingPrice` | Alchemy did not return a reliable price |
| `missingLogo` | Cosmetic metadata is incomplete |
| `missingMetadata` | Symbol/name/metadata is incomplete |
| `suspiciousSymbol` | Symbol/name suggests impersonation or low confidence |
| `zeroOrDustValue` | Current value is dust-sized or effectively zero |
| `unrecognizedContract` | Not recognized by known protocol or trusted metadata sources |
| `knownAerodromeToken` | Recognized as Aerodrome-related |
| `knownProtocolContract` | Recognized as trusted protocol metadata |
| `hasReliablePrice` | Address-based Alchemy price resolved |
| `userHidden` | Reserved for future user override |
| `userAllowed` | Reserved for future user override |

### 4. OverviewTrustCoverageReasonCode

Canonical trust-related coverage and exclusion vocabulary used by this feature.

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

Usage rules:

- `HiddenAssetSummary.reasonCodes` and `OverviewExclusionSummary.reasonCodes` use this vocabulary only.
- Trust-filtering additions to page-level or block-level coverage reason arrays use this vocabulary when the reason is owned by this feature.
- Each reason code maps to a translation key in `coverage` or another approved trust-aware i18n namespace; API code must not emit ad hoc strings.

### 5. OverviewAssetRow Extension

Extends the existing Overview asset row rather than replacing it.

| Field | Type | Notes |
|---|---|---|
| Existing fields | unchanged | `tokenAddress`, `symbol`, `balance`, `priceUsd`, `valueUsd`, movement fields, classification, `priceConfidence` |
| `name` | string nullable | Optional display name for clearer inspection |
| `chainId` | integer | Explicit chain scope for the row |
| `trustStatus` | `TokenTrustStatus` | Required |
| `trustReasonCodes` | `TokenTrustReasonCode[]` | Required, may be empty only for a fully trusted row |
| `isHiddenByDefault` | boolean | Required |
| `classifierVersion` | string nullable | Optional for API visibility; mandatory internally |

Rules:

- `OverviewAssetRow` remains the canonical unit for both visible and hidden asset inspection.
- The frontend uses `isHiddenByDefault` for presentation only; it does not recompute trust.

### 6. HiddenAssetSummary

Overview-level summary for assets excluded from the default visible set.

| Field | Type | Notes |
|---|---|---|
| `hiddenCount` | integer | Number of rows hidden by default |
| `hiddenValueUsd` | number nullable | Sum of hidden asset USD values when priced |
| `reasonCodes` | `OverviewTrustCoverageReasonCode[]` | Aggregate explanation reasons for notice/coverage messaging |
| `affectsTotals` | boolean | True when excluded assets affect default totals or completeness |
| `allVisibleAssetsUnpricedOrZero` | boolean | Helps drive empty/zero-value messaging when hidden assets exist |

### 7. OverviewExclusionSummary

Reusable summary embedded into metrics and distribution blocks to describe what was excluded.

| Field | Type | Notes |
|---|---|---|
| `excludedAssetCount` | integer | Rows excluded from the block’s default calculation |
| `excludedValueUsd` | number nullable | Priced value excluded from the block |
| `reasonCodes` | `OverviewTrustCoverageReasonCode[]` | Why those exclusions happened |
| `includesUnpricedVisibleAssets` | boolean | Indicates valuation incompleteness even among visible assets |

### 8. OverviewMetrics Extension

Extends the existing metrics block with exclusion metadata while keeping the original total fields intact.

| Field | Type | Notes |
|---|---|---|
| Existing metric fields | unchanged | Net/deployed/idle and other top-line values |
| `exclusions` | `OverviewExclusionSummary` nullable | Explains hidden/default-excluded assets |

Rules:

- Default net portfolio value excludes `possible_spam`, `blocked`, and any other row hidden by policy for the relevant metric.
- Assets with no reliable price never receive fabricated USD values.
- When trust filtering affects metric coverage reason arrays, trust-owned codes must use `OverviewTrustCoverageReasonCode` values rather than ad hoc strings.

### 9. OverviewDistribution Extension

Extends the distribution block with exclusion metadata while keeping slice shape stable.

| Field | Type | Notes |
|---|---|---|
| Existing slice fields | unchanged | Distribution slices still describe visible priced allocation |
| `exclusions` | `OverviewExclusionSummary` nullable | Explains why some rows are not part of the default distribution |

Rule:

- When trust filtering affects distribution coverage reason arrays, trust-owned codes must use `OverviewTrustCoverageReasonCode` values rather than ad hoc strings.

### 10. OverviewAssets Extension

Extends the asset block without changing its role.

| Field | Type | Notes |
|---|---|---|
| `rows` | `OverviewAssetRow[]` | Full payload rows, including hidden rows |
| `hiddenSummary` | `HiddenAssetSummary` nullable | Summary for default-hidden rows |
| `defaultVisibleCount` | integer | Count of rows visible by default |

Rules:

- `rows` includes hidden assets for inspection.
- Default rendering uses `rows.filter((row) => !row.isHiddenByDefault)`.
- When trust filtering affects asset-block coverage reason arrays, trust-owned codes must use `OverviewTrustCoverageReasonCode` values rather than ad hoc strings.

### 11. KnownProtocolAssetReference

Chain-scoped recognition source used by the classifier.

| Field | Type | Notes |
|---|---|---|
| `chainId` | integer | Required |
| `tokenAddress` | string | Lowercase address |
| `source` | enum | `chain_bootstrap`, `protocol_contracts`, `aerodrome_metadata`, `mellow_metadata` |
| `protocol` | string nullable | Optional protocol family label |
| `reasonCode` | `knownAerodromeToken` or `knownProtocolContract` | Reason emitted into trust output |

### 12. TrustSignalSnapshot

Optional internal recompute record for one asset at one refresh time.

| Field | Type | Notes |
|---|---|---|
| `walletAddress` | string | Required |
| `chainId` | integer | Required |
| `tokenAddress` | string nullable | Asset identity |
| `providerSignals` | object | Normalized Moralis and Alchemy trust inputs |
| `classification` | `TokenTrustClassification` | Output |
| `capturedAt` | datetime | Refresh time |

Stage 1 note:

- Prefer storing this shape inside existing metadata JSON fields or recomputing from raw records rather than introducing a new first-class table immediately.

### 13. UserAssetVisibilityPreference

Deferred follow-up entity, intentionally not implemented in Stage 1.

| Field | Type | Notes |
|---|---|---|
| `walletAddress` | string | Required |
| `chainId` | integer | Required |
| `tokenAddress` | string | Required |
| `visibility` | enum | `default`, `always_show`, `always_hide` |
| `createdAt` | datetime | Required |
| `updatedAt` | datetime | Required |

Rule:

- A future override changes visibility behavior but must not erase trust labels or explanation codes.

## Relationships

```text
RawProviderRecord.payloadJson + PricePoint + CoverageReport.metadataJson + PortfolioSnapshot.metadataJson + known protocol lookup
  -> AssetTrustClassifierInput
    -> TokenTrustClassification
      -> OverviewAssetRow

OverviewAssetRow[]
  -> HiddenAssetSummary
  -> OverviewExclusionSummary
  -> OverviewMetrics
  -> OverviewDistribution
  -> OverviewAssets

RawProviderRecord.payloadJson + PricePoint + CoverageReport.metadataJson + PortfolioSnapshot.metadataJson + protocol metadata
  -> deterministic trust recomputation
```

## Source Rules

### Trust Inputs

- Moralis supplies trust, spam, and metadata inputs through persisted raw provider records that are normalized before classification.
- Alchemy supplies reliable price availability and valuation confidence inputs through `PricePoint` plus trust-input normalization.
- Known protocol recognition comes from chain-scoped bootstrap metadata and existing protocol metadata, not request-time RPC.
- `CoverageReport.metadataJson` and `PortfolioSnapshot.metadataJson` may store recomputation hints such as exclusion counts, visible-unpriced flags, and classifier version for auditability.

### Default Visibility Rules

- `possible_spam` and `blocked` are hidden by default.
- `low_confidence` may be hidden when dust, missing price, suspicious symbol, or missing metadata make the asset unsuitable for default Overview.
- Known protocol assets remain visible unless stronger caution signals override visibility.

### Classifier Decision Table

| Condition | Trust Outcome | Hidden By Default | Included In Default Totals | Trust-Related Coverage Or Exclusion Codes |
|---|---|---|---|---|
| Provider spam or blocked signal | `possible_spam` or `blocked` | Yes | No | `excludedSuspiciousAssets` |
| Known protocol plus provider spam conflict | Caution outcome wins; preserve known-protocol reason code | Yes | No | `excludedSuspiciousAssets`, `knownProtocolSignalConflict` |
| Known protocol plus missing logo | `known_protocol` | No | Yes when reliably priced | None from logo alone |
| Known protocol plus missing price | `known_protocol` | No | No for priced totals; `valueUsd = null` | `missingPrices`, `valuationPartial` |
| Verified contract plus reliable Alchemy price | `verified` or `priced` | No | Yes | None unless another visible-asset coverage condition applies |
| Reliable Alchemy price plus no spam signal | `priced` | No | Yes | None unless another visible-asset coverage condition applies |
| Dust plus missing metadata plus missing price | `low_confidence` | Yes | No | `lowConfidenceAssetsHidden`, `dustAssetsHidden`, `metadataIncomplete`, `missingPrices` |
| Missing provider spam metadata plus missing price | `unknown` or `low_confidence` depending on metadata, dust, and suspicious symbol | Policy-driven | No for priced totals | `providerTrustSignalsMissing`, `missingPrices`, `valuationPartial` as applicable |

Rule:

- Missing Alchemy price is a valuation-confidence issue, not proof of spam.

### Totals And Distribution Rules

- Default metrics and default distribution exclude rows hidden by default.
- Visible but unpriced assets remain visible when appropriate, but contribute `null` valuation and degrade coverage.
- Revealing hidden assets does not recalculate confident totals in Stage 1.

## Persistence Rules

- `RawProviderRecord.payloadJson` remains the source of truth for Moralis trust signals, token metadata completeness inputs, and request auditing.
- `PricePoint` remains the source of truth for current or historical pricing confidence and `hasReliableAlchemyPrice` reconstruction.
- `CoverageReport.metadataJson` may record exclusion counts, trust-related coverage reason codes, visible-unpriced flags, and classifier version.
- `PortfolioSnapshot.metadataJson` may record the filtered-total basis, excluded-value summary, hidden-asset summary metadata, and recomputation hints.
- Chain-scoped protocol metadata and known-protocol lookup remain the source of truth for `isKnownProtocolAsset` reconstruction.
- Stage 1 must verify that these existing surfaces together recover every `AssetTrustClassifierInput` field; otherwise add a narrow normalized trust-input persistence surface rather than a full trust table.
- No dedicated trust table or user override table is required in the preferred Stage 1 path.
