# Data Model: Overview Protocol Positions

## Overview

Stage 1 extends the connected Overview read model with a dedicated protocol-positions block that sits beside wallet assets. The model is explicitly current-state oriented: it describes currently visible deployed or locked capital, its chain-scoped identity, its position family, its coverage state, and its current or estimated value treatment. It does not attempt to model full lifecycle history, rewards, realized or unrealized performance, or one-year analytics.

## Entities

### 1. OverviewProtocolPositionsBlock

Represents the new top-level Overview block returned by `GET /api/wallet/overview`.

| Field | Type | Notes |
|---|---|---|
| `source` | enum | `recent_provider_data` or `partial_fallback` |
| `coverageStatus` | enum | `full`, `partial`, or `unknown` at block level |
| `coverageReasonCodes` | string[] nullable | Canonical protocol-position coverage reasons |
| `rows` | `OverviewProtocolPosition[]` | Visible current protocol positions |
| `summary` | `OverviewProtocolPositionsSummary` | Counts and block-level explainability helpers |

Rules:

- `rows` contains only positively classified protocol positions.
- Unrelated wallet NFTs are never promoted into this block.
- Block coverage degrades when any visible position is only partially classified or valued.

### 2. OverviewProtocolPosition

Represents one current protocol position row or card in the Overview UI.

| Field | Type | Notes |
|---|---|---|
| `positionKey` | string | Deterministic chain-scoped identity for the visible row |
| `chainId` | integer | Required chain scope |
| `walletAddress` | string | Lowercase wallet scope |
| `family` | enum | `manual_deposit`, `strategy_exposure`, `governance_lock`, or `staked_lp` |
| `protocol` | enum | `aerodrome`, `mellow`, or another approved protocol identifier |
| `label` | string | Human-readable row label assembled server-side |
| `status` | enum | `active`, `locked`, `staked`, or `unknown` |
| `coverageStatus` | enum | `full`, `share_level`, `partial`, or `unknown` |
| `coverageReasonCodes` | string[] | Canonical row-level explainability reasons |
| `valueUsd` | decimal nullable | Current or estimated value when defensible |
| `valueStatus` | enum | `current`, `estimated`, or `unavailable` |
| `valueUpdatedAt` | datetime nullable | Timestamp for current or estimated value evidence |
| `primaryTokenSymbol` | string nullable | Optional shorthand for position context |
| `secondaryTokenSymbol` | string nullable | Optional shorthand for pair context |
| `poolLabel` | string nullable | Optional pool label for manual deposits or strategy context |
| `strategyLabel` | string nullable | Optional strategy label for Mellow exposure |
| `governanceLabel` | string nullable | Optional governance surface label |
| `tokenId` | string nullable | For NFT-oriented manual position identity when available |
| `metadata` | object | Sanitized context such as wrapper address, lock end, fee tier, or protocol surface |

Rules:

- Every row belongs to exactly one primary `family`.
- `valueUsd` may be null even when the position is visible.
- `coverageStatus` and `valueStatus` are independent. A row may be `share_level` with an `estimated` value, or `partial` with `unavailable` value.

### 3. OverviewProtocolPositionsSummary

Summarizes the block without replacing the row list.

| Field | Type | Notes |
|---|---|---|
| `totalCount` | integer | Number of visible protocol positions |
| `familyCounts` | object | Counts by primary family |
| `hasPartialValuation` | boolean | True when one or more rows have `valueStatus != current` |
| `hasShareLevelPositions` | boolean | True when one or more rows use `share_level` |
| `lastRefreshedAt` | datetime nullable | Latest refresh point for the block |

### 4. ProtocolPositionFamily

Canonical Stage 1 vocabulary for current Overview rows.

```ts
type ProtocolPositionFamily =
  | "manual_deposit"
  | "strategy_exposure"
  | "governance_lock"
  | "staked_lp";
```

Rules:

- `manual_deposit` is used for wallet-owned Aerodrome concentrated-liquidity positions.
- `strategy_exposure` is used for Mellow or equivalent automated strategy exposure.
- `governance_lock` is used for ve-style or equivalent governance-locked capital.
- `staked_lp` is optional in Stage 1 and only used when it materially changes the user-facing current state.

### 5. ProtocolPositionCoverageStatus

Canonical row-level completeness vocabulary.

```ts
type ProtocolPositionCoverageStatus =
  | "full"
  | "share_level"
  | "partial"
  | "unknown";
```

Interpretation:

- `full`: the app can classify the family and show current value with defensible current-state inputs.
- `share_level`: the app can classify the strategy exposure but only at the wrapper or share layer.
- `partial`: the app can show the position and some context, but either valuation or structural metadata remains incomplete.
- `unknown`: the app has enough approved evidence to show that a protocol position exists, but not enough to classify it more precisely.

### 6. ProtocolPositionValueStatus

Canonical value-treatment vocabulary.

```ts
type ProtocolPositionValueStatus =
  | "current"
  | "estimated"
  | "unavailable";
```

Interpretation:

- `current`: backed by defensible current-state inputs.
- `estimated`: backed by partial but currently acceptable inputs, such as wrapper or share-level valuation.
- `unavailable`: the position is visible but the system intentionally omits a USD number.

### 7. ProtocolPositionIdentity

Explains how Stage 1 keeps positions stable before the deeper analyzed model exists.

| Family | Preferred identity |
|---|---|
| `manual_deposit` | `chainId + protocol + nftContractAddress + tokenId` |
| `strategy_exposure` | `chainId + protocol + strategyContractAddress + walletAddress + wrapperAddress?` |
| `governance_lock` | `chainId + protocol + lockContractAddress + lockId? + walletAddress` |
| `staked_lp` | `chainId + protocol + stakingContractAddress + positionReference + walletAddress` |

Rules:

- Wallet address alone is never sufficient.
- Token symbol alone is never sufficient.
- If a final canonical identifier is unavailable, a deterministic provisional key must still use chain-scoped structural fields that later analytics can refine rather than discard.

### 8. ProtocolPositionEvidence

Represents the explainability inputs that justify a visible row.

| Field | Type | Notes |
|---|---|---|
| `evidenceType` | enum | `moralis_signal`, `rpc_read`, `contract_read`, `event_log`, `protocol_metadata`, `normalized_record` |
| `source` | string | Provider or internal source label |
| `reference` | string | Sanitized pointer such as tx hash, contract address, log topic group, or metadata key |
| `capturedAt` | datetime nullable | When the evidence was observed |
| `supports` | string[] | Which classification or valuation claims this evidence supports |

Rules:

- Raw provider or RPC payloads remain persisted server-side.
- The frontend receives only normalized evidence-derived output, not raw provider bodies.

### 9. OverviewCoverageReasonCode Extension

Stage 1 extends Overview coverage vocabularies with protocol-position-specific reasons.

```ts
type ProtocolPositionCoverageReasonCode =
  | "protocolPositionsPresent"
  | "recentProtocolReconstruction"
  | "protocolValuationPartial"
  | "strategyShareLevelOnly"
  | "governanceValueUnavailable"
  | "positionMetadataIncomplete";
```

Usage:

- Page-level and block-level coverage can include these values when protocol positions affect the honesty of the current Overview state.
- Row-level reason codes may reuse the same vocabulary or a narrower protocol-position reason set, but the API contract must document canonical values.

### 10. OverviewMetrics Reuse

The feature reuses existing metric groups instead of creating a second metric surface.

| Field | Stage 1 meaning |
|---|---|
| `manualDepositsValueUsd` | Sum of visible `manual_deposit` rows with defensible value treatment |
| `automatedStrategiesValueUsd` | Sum of visible `strategy_exposure` rows with defensible value treatment |
| `governanceValueUsd` | Sum of visible `governance_lock` rows with defensible value treatment |

Rules:

- Metrics may remain null even when rows are visible.
- A visible row with `valueStatus = unavailable` must degrade coverage rather than force a fake zero.

## Persistent Surfaces Reused In Stage 1

### RawProviderRecord

- Stores provider or RPC evidence that materially affects protocol-position detection or valuation.
- Should receive route-safe provider labels and endpoint metadata, not frontend-facing raw leakage.

### CoverageReport

- Stores block-level or page-level protocol-position coverage outcomes and explainability metadata.
- Suitable for recording whether recent bounded reconstruction was used and why.

### PortfolioSnapshot

- Stores summary-level totals and can carry protocol-position metadata in `metadataJson` when that supports explainability without requiring a new table.

### Protocol Contracts Metadata

- Existing protocol metadata is reused to recognize approved Aerodrome and Mellow surfaces and to derive chain-scoped identity ingredients.

## Relationships

```text
OverviewResponse
  -> OverviewProtocolPositionsBlock
       -> OverviewProtocolPositionsSummary
       -> OverviewProtocolPosition
            -> ProtocolPositionIdentity
            -> ProtocolPositionCoverageStatus
            -> ProtocolPositionValueStatus
            -> ProtocolPositionEvidence

OverviewMetrics
  <- aggregates valued protocol positions by family

RawProviderRecord / CoverageReport / PortfolioSnapshot
  <- persist explainability evidence and bounded-reconstruction metadata
```

## State Notes

- Stage 1 only models currently visible positions.
- A position may be visible even if it predates the 30-day reconstruction window, as long as current-state reads or recent supporting evidence can confirm it.
- A position that cannot be positively classified as an approved protocol family does not appear in `protocolPositions.rows`.