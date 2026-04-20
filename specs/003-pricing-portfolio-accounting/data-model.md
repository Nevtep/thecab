# Data Model: Pricing and Portfolio Accounting Engine

## Scope

This data model extends the canonical ledger with pricing and accounting entities only. It intentionally consumes existing wallet sessions, reconstruction runs, canonical ledger records, asset movements, residual holdings, and discarded activity rather than redefining them. It focuses on normalized price inputs, valued movements, current holdings valuation, cost-basis-aware accounting summaries, and explicit coverage metadata.

## Persisted Pricing Entities

### 1. PriceAsset

- **Purpose**: Defines the canonical pricing identity for a token used by the accounting layer.
- **Identity**: `priceAssetId = chainId + tokenAddress`
- **Fields**:
  - `priceAssetId`
  - `chainId`
  - `tokenAddress`
  - `symbol`
  - `decimals`
  - `providerAssetKey`
  - `aliasTargetAssetId` (nullable)
  - `pricingStatus` (`direct`, `alias`, `unsupported`)
- **Validation rules**:
  - Only one active pricing identity may exist per chain and token address.
  - Alias pricing must point to an explicitly configured target asset.

### 2. PricePoint

- **Purpose**: Normalized historical or current price input used for valuation.
- **Identity**: `pricePointId = priceAssetId + quoteCurrency + effectiveAt + sourceKind`
- **Fields**:
  - `pricePointId`
  - `priceAssetId`
  - `quoteCurrency` (`usd`)
  - `sourceKind` (`historical`, `current`)
  - `effectiveAt`
  - `fetchedAt`
  - `priceValue`
  - `resolution` (`minute`, `hour`, `spot`)
  - `confidence` (`high`, `medium`, `low`)
  - `pricingMethod` (`direct`, `wrapped_alias`, `stable_alias`)
  - `providerName`
  - `providerReference`
- **Validation rules**:
  - `priceValue` must always represent normalized USD value.
  - Current price points may be superseded by fresher points but older points remain immutable.

### 3. PriceCoverageDecision

- **Purpose**: Records why a movement or holding was priced, downgraded, or left unpriced.
- **Identity**: `coverageDecisionId = subjectType + subjectId`
- **Fields**:
  - `coverageDecisionId`
  - `subjectType` (`asset_movement`, `holding_balance`, `scope_summary`)
  - `subjectId`
  - `coverageStatus` (`priced`, `partial`, `unpriced`, `excluded`)
  - `reasonCode`
  - `reasonMessage`
  - `pricePointId` (nullable)
  - `fallbackUsed` (boolean)
- **Validation rules**:
  - An unpriced subject must not reference a fake `pricePointId`.
  - Partial coverage requires an explicit reason.

## Derived Valuation Entities

### 4. ValuedMovement

- **Purpose**: Represents one canonical asset movement enriched with event-time valuation.
- **Identity**: `valuedMovementId = assetMovementId`
- **Fields**:
  - `valuedMovementId`
  - `assetMovementId`
  - `ledgerRecordId`
  - `analysisSessionId`
  - `scopeRefs` (`portfolio`, `poolId`, `strategyId`, `positionInstanceId`)
  - `direction`
  - `movementRole`
  - `amountRaw`
  - `amountNormalized`
  - `eventTimestamp`
  - `eventValueUsd`
  - `coverageStatus`
  - `pricePointId` (nullable)
  - `coverageReasonCode` (nullable)
- **Validation rules**:
  - The event timestamp must come from the canonical ledger record, not a raw observation.
  - Unpriced movements remain present and traceable even when `eventValueUsd` is null.

### 5. CurrentHoldingValuation

- **Purpose**: Represents the current value of an open holding, residual balance, or idle wallet balance.
- **Identity**: `holdingValuationId = holdingType + holdingRef + asOf`
- **Fields**:
  - `holdingValuationId`
  - `holdingType` (`position_inventory`, `residual_balance`, `idle_wallet_balance`)
  - `holdingRef`
  - `analysisSessionId`
  - `scopeRefs` (`portfolio`, `poolId`, `strategyId`, `positionInstanceId`)
  - `tokenAddress`
  - `amountRaw`
  - `amountNormalized`
  - `asOf`
  - `currentValueUsd`
  - `pricePointId` (nullable)
  - `coverageStatus`
  - `coverageReasonCode` (nullable)
- **Validation rules**:
  - Holdings with missing current prices remain modeled but are marked `partial` or `unpriced`.
  - Idle wallet balances must still belong to portfolio-level totals even if not attributable to a pool.

## Derived Accounting Entities

### 6. ScopeInventory

- **Purpose**: Tracks remaining cost basis and quantity by token for a specific analytical scope.
- **Identity**: `scopeInventoryId = scopeType + scopeId + tokenAddress`
- **Fields**:
  - `scopeInventoryId`
  - `scopeType` (`portfolio`, `pool`, `strategy`, `position_instance`)
  - `scopeId`
  - `tokenAddress`
  - `quantityRaw`
  - `quantityNormalized`
  - `costBasisUsd`
  - `averageCostPerUnitUsd`
  - `lastUpdatedAt`
- **Validation rules**:
  - Inventory updates must be deterministic and ordered by valued-movement sequence.
  - Inventory may only exist for scopes that are supported by canonical continuity.

### 7. AccountingCoverageSummary

- **Purpose**: Summarizes how much of a scope is fully priced versus partial or excluded.
- **Identity**: `coverageSummaryId = scopeType + scopeId + asOf`
- **Fields**:
  - `coverageSummaryId`
  - `scopeType`
  - `scopeId`
  - `asOf`
  - `pricedValueUsd`
  - `excludedValueUsd` (nullable)
  - `unpricedComponentsCount`
  - `coverageStatus` (`full`, `partial`)
  - `reasonCodes`
- **Validation rules**:
  - Partial coverage must disclose excluded or unpriced portions explicitly.

### 8. PortfolioAccountingSnapshot

- **Purpose**: The top-level accounting output for one wallet session and accepted run.
- **Identity**: `portfolioAccountingSnapshotId = analysisSessionId + acceptedRunId + asOf`
- **Fields**:
  - `portfolioAccountingSnapshotId`
  - `analysisSessionId`
  - `acceptedRunId`
  - `asOf`
  - `quoteCurrency` (`usd`)
  - `totalValueUsd`
  - `capitalEnteredUsd`
  - `capitalWithdrawnUsd`
  - `realizedPnlUsd`
  - `unrealizedPnlUsd`
  - `idleBalanceValueUsd`
  - `coverageSummary`
  - `traceRefs`
- **Validation rules**:
  - `totalValueUsd` covers priced active exposure plus priced idle or residual balances only.
  - Excluded or unpriced portions must remain visible via `coverageSummary`.

### 9. PoolAccountingSummary

- **Purpose**: Reusable accounting summary for one pool.
- **Identity**: `poolAccountingSummaryId = poolId + acceptedRunId + asOf`
- **Fields**:
  - `poolAccountingSummaryId`
  - `poolId`
  - `displayName`
  - `currentValueUsd`
  - `capitalEnteredUsd`
  - `capitalWithdrawnUsd`
  - `realizedPnlUsd`
  - `unrealizedPnlUsd`
  - `coverageSummary`
  - `strategySummaries`
  - `traceRefs`
- **Validation rules**:
  - Pool totals must reconcile to the sum of priced strategy summaries plus any explicitly disclosed excluded portions.

### 10. StrategyAccountingSummary

- **Purpose**: Accounting summary for one strategy inside a pool.
- **Identity**: `strategyAccountingSummaryId = strategyId + acceptedRunId + asOf`
- **Fields**:
  - `strategyAccountingSummaryId`
  - `strategyId`
  - `strategyType` (`manual`, `mellow_auto`)
  - `currentValueUsd`
  - `capitalEnteredUsd`
  - `capitalWithdrawnUsd`
  - `realizedPnlUsd`
  - `unrealizedPnlUsd`
  - `coverageSummary`
  - `positionSummaries`
  - `traceRefs`
- **Validation rules**:
  - Manual and supported Mellow strategies must remain separate even when they share a pool.

### 11. PositionAccountingSummary

- **Purpose**: Optional detailed accounting summary for one reliable position instance.
- **Identity**: `positionAccountingSummaryId = positionInstanceId + acceptedRunId + asOf`
- **Fields**:
  - `positionAccountingSummaryId`
  - `positionInstanceId`
  - `positionType`
  - `currentValueUsd`
  - `capitalEnteredUsd`
  - `capitalWithdrawnUsd`
  - `realizedPnlUsd`
  - `unrealizedPnlUsd`
  - `coverageSummary`
  - `precisionStatus` (`exact`, `rolled_up`)
  - `traceRefs`
- **Validation rules**:
  - `precisionStatus = exact` is allowed only when every contributing valued movement is linked to one stable `positionInstanceId`, lifecycle ordering is unambiguous, and remaining inventory for the lifecycle can be reconciled without overlap against sibling positions.
  - If any contributing movement can only be attributed at strategy or pool scope, the position summary must not be emitted as `exact`.

### 12. IdleBalanceSummary

- **Purpose**: Represents current priced or unpriced idle or unallocated wallet balances that remain outside active strategy exposure.
- **Identity**: `idleBalanceSummaryId = analysisSessionId + tokenAddress + asOf`
- **Fields**:
  - `idleBalanceSummaryId`
  - `analysisSessionId`
  - `tokenAddress`
  - `symbol`
  - `amountRaw`
  - `currentValueUsd`
  - `coverageStatus`
  - `reasonCode` (`idle_wallet_balance`, `rebalance_leftover`, `unallocated_close_proceeds`, `low_confidence_attribution`)
  - `candidatePoolIds`
  - `traceRefs`
- **Validation rules**:
  - Idle balances must roll into portfolio totals if priced.
  - Unpriced idle balances must remain disclosed even when excluded from totals.

## Relationships

- One `PriceAsset` has many `PricePoint` records.
- One `PricePoint` may support many `ValuedMovement` and `CurrentHoldingValuation` records.
- One `AssetMovement` maps to zero or one `ValuedMovement`.
- One `ValuedMovement` may update one or more `ScopeInventory` records depending on analytical scope.
- One `PortfolioAccountingSnapshot` has many `PoolAccountingSummary` and `IdleBalanceSummary` records.
- One `PoolAccountingSummary` has many `StrategyAccountingSummary` records.
- One `StrategyAccountingSummary` has many `PositionAccountingSummary` records when precision is reliable.

## Derived Calculation Rules

- `capitalEnteredUsd` originates from `external_deposit` valued movements and other explicitly external funding movements.
- `capitalWithdrawnUsd` originates from `external_withdrawal` valued movements and other explicitly external removal movements.
- `realizedPnlUsd` is recognized when inventory is disposed relative to carrying basis and when rewards or fees crystallize as realized value.
- `unrealizedPnlUsd` is the current priced value of remaining inventory minus remaining cost basis.
- `totalValueUsd` equals current priced active exposure plus current priced idle or residual balances, with excluded or unpriced portions disclosed separately rather than folded into zero.
- Discarded or unsupported activity never contributes directly to trusted totals, capital flows, or PnL, but its exclusion reason codes may contribute to `AccountingCoverageSummary.reasonCodes` so omitted scope is visible.