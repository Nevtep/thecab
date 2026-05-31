# Data Model: Activity DataView

## Overview

Activity is a read-oriented DataView over normalized analysis evidence. The feature does not replace existing ledger, reward, deposit, strategy, pool, or governance entities. It creates a product contract for presenting and filtering activity rows, selected transaction evidence, linked entities, movement data, coverage/confidence, and rebalance explanation.

All entities are chain-scoped. Product v1 supports Base mainnet, but no Activity identity may rely on address or transaction hash alone.

## Entity: ActivityEvent

Represents one interpreted wallet action or economic component.

### Fields

- `activityEventId`: Stable row identity.
- `chainId`: Active chain.
- `walletAddress`: Connected wallet.
- `txHash`: Transaction hash scoped by `chainId`.
- `eventIndex`: Stable ordering within transaction.
- `occurredAt`: Transaction or event timestamp.
- `blockNumber`: Block number when available.
- `actionType`: Product action class.
- `protocolSurface`: Router, Pool, Gauge, Reward, Voter, veAERO, Mellow wrapper, Mellow staking rewards, explorer-evidence-only, unknown, or other supported surface.
- `summaryLabelKey`: Localized label key for row summary.
- `coverageState`: `full`, `partial`, `unresolved`, `excluded`, `unsupported`, `malicious`, `ambiguous`, `discarded`, or `unavailable`.
- `coverageReasonCodes`: Stable reason codes.
- `confidence`: `high`, `medium`, `low`, or `none`.
- `classificationReasonCodes`: Stable reason codes for classification basis.
- `affectsTotals`: Whether the event affects confident product totals.
- `excludedFromTotalsReason`: Reason when excluded.
- `linkedEntities`: List of evidence-backed product links.
- `assetMovements`: Token movement summaries.
- `valueUsd`: USD value when valuation coverage exists.
- `sourceEvidence`: Evidence summary.
- `rebalanceExplanation`: Optional rebalance/source allocation detail.

### Validation Rules

- `chainId + txHash + eventIndex` must identify one ActivityEvent.
- `actionType` must map to a localized user-facing label.
- Events with `malicious`, `unsupported`, `ambiguous`, `discarded`, `excluded`, or `unavailable` coverage must not affect confident totals unless a metric explicitly declares that scope.
- Linked entities must be evidence-backed. Pool/time proximity is not sufficient for ownership.
- Missing valuation must set value coverage to partial or unavailable.

## Entity: ActivityTransaction

Represents the transaction-level container for one or more ActivityEvents.

### Fields

- `chainId`
- `txHash`
- `walletAddress`
- `blockNumber`
- `occurredAt`
- `status`
- `externalTxUrl`
- `providerRecordRefs`
- `supplementalEvidenceUsed`
- `evidenceGapReasonCodes`

### Relationships

- Has many ActivityEvents.
- May reference raw provider records.
- May reference supplemental explorer evidence records.

## Entity: AssetMovement

Represents token-level delta caused by an ActivityEvent.

### Fields

- `movementId`
- `chainId`
- `txHash`
- `activityEventId`
- `direction`: `in`, `out`, `neutral`, or `unknown`.
- `tokenAddress`
- `tokenSymbol`
- `tokenAmount`
- `valueUsd`
- `valuationCoverageState`
- `valuationReasonCodes`
- `counterpartyAddress`
- `movementIndex`

### Validation Rules

- Token addresses are chain-scoped.
- Token amount may be present without USD value.
- Missing or partial pricing cannot be filled with current-price fallback unless the product spec later explicitly allows it.

## Entity: LinkedEntity

Represents an evidence-backed relationship from an ActivityEvent to another product surface.

### Fields

- `kind`: `pool`, `deposit`, `position`, `strategy`, `strategyExposure`, `reward`, `governance`, or `none`.
- `entityId`
- `label`
- `route`
- `relationship`: `contributes`, `explains`, `opens`, `closes`, `updates`, `claims`, `votes`, `excluded`, or `unknown`.
- `evidenceReasonCodes`
- `confidence`

### Validation Rules

- Manual deposit links require deposit or position identity evidence.
- Strategy links require strategy or strategy exposure evidence.
- Reward links require reward event evidence.
- Governance links require governance event or governance-surface evidence.
- Pool links can indicate market context or contribution, but pool context alone does not establish owner identity.

## Entity: ClassificationEvidence

Represents why a row received its action type, protocol surface, links, coverage, and confidence.

### Fields

- `classificationBasis`: Protocol event, decoded transaction, transfer pattern, contract call, official metadata, supplemental explorer evidence, residual attribution, price evidence, or manual exclusion rule.
- `sourceRecordRefs`: Provider record references.
- `supplementalEvidenceUsed`: Boolean.
- `missingEvidenceReasonCodes`: Evidence gaps.
- `conflictReasonCodes`: Contradictory evidence.
- `userFacingSummaryKey`: Localized explanation key.

### Validation Rules

- Supplemental evidence can improve classification and decomposition.
- Supplemental evidence cannot invent ownership without explicit identity or protocol-backed semantics.
- Conflicting evidence must lower confidence or mark the row partial/ambiguous unless protocol semantics resolve it.

## Entity: RebalanceExplanation

Represents transaction-level attribution for rebalances and partial swap attribution.

### Fields

- `rebalanceType`: `full_pool_rebalance`, `partial_swap_attribution`, `unresolved_attribution`, or `not_rebalance`.
- `relatedWithdrawEventIds`
- `relatedSwapEventIds`
- `relatedDepositEventIds`
- `residualStateRefs`
- `poolEffect`
- `tokenFlow`
- `sourceAllocationItems`
- `confidence`
- `coverageState`
- `reasonCodes`

### Source Allocation Item

- `sourceKind`: `candidate_pool_residual`, `cash_in`, `liquidation_inventory`, `other_residual_pool_prorata`, or `unsupported_remainder`.
- `tokenAddress`
- `tokenAmount`
- `valueUsd`
- `coverageState`
- `reasonCodes`

### Validation Rules

- A token movement must not be fully attributed to a pool when residual attribution supports only a partial amount.
- Unsupported remainder must stay visible and excluded from confident pool effects.

## Entity: ActivitySummary

Represents summary instrumentation for the current filter context.

### Fields

- `totalRows`
- `interpretedRows`
- `supportedRows`
- `partialOrUnresolvedRows`
- `excludedOrMaliciousRows`
- `valuationCoveragePercent`
- `confidenceBreakdown`
- `coverageState`
- `reasonCodes`

### Validation Rules

- Summary values must use the same filters as ledger rows.
- Excluded/malicious rows must be counted separately from supported interpreted rows.

## Entity: ActivityFilterContext

Represents the user's current ledger scope.

### Fields

- `search`
- `datePreset`
- `dateStart`
- `dateEnd`
- `actionTypes`
- `protocolSurfaces`
- `poolId`
- `depositId`
- `strategyId`
- `strategyExposureId`
- `rewardEventId`
- `governanceEventId`
- `tokenAddress`
- `coverageState`
- `confidence`
- `resolutionStatus`
- `selectedActivityEventId`
- `sort`
- `direction`
- `page`
- `pageSize`

### Validation Rules

- Filter state must be wallet- and chain-scoped.
- Filter combinations returning no rows must not clear the rest of the page state.
- Incoming context from other sections must appear as visible removable filter chips.

## State Transitions

```text
raw provider record
  -> candidate transaction
  -> supplemental evidence lookup when needed
  -> normalized ledger event
  -> asset movements
  -> classification evidence
  -> linked entities where evidence supports them
  -> activity read model row
  -> Activity DataView row/detail
```

Coverage/confidence transitions:

```text
full
  -> partial       when valuation, entity link, or decomposition is incomplete
  -> unresolved    when required evidence is missing
  -> unsupported   when the surface is not supported
  -> malicious     when spam/phishing evidence is present
  -> ambiguous     when evidence conflicts or multiple interpretations remain possible
  -> discarded     when the event is intentionally ignored for analytics
  -> unavailable   when required evidence cannot be fetched or reconstructed
```
