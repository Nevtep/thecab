# Data Model: Historical Portfolio Dashboard

## Scope

This model defines product-facing dashboard read entities for one connected wallet session on Base. It composes canonical ledger, pricing, and accounting outputs without redefining those domains.

## Read Entities

### 1. DashboardSessionView

- **Purpose**: Entry read model for dashboard rendering lifecycle.
- **Identity**: `dashboardSessionViewId = analysisSessionId + acceptedRunId + asOf`
- **Fields**:
  - `analysisSessionId`
  - `walletAddress`
  - `chainId`
  - `bootstrapState` (`empty`, `warming`, `ready`)
  - `viewState` (`loading`, `partial`, `empty`, `failure`, `ready`)
  - `acceptedRunId` (nullable)
  - `latestRunId` (nullable)
  - `asOf`
  - `errorSummary` (nullable)

### 2. PortfolioOverviewCard

- **Purpose**: Current economic summary for top dashboard cards.
- **Identity**: `portfolioOverviewCardId = analysisSessionId + acceptedRunId + asOf`
- **Fields**:
  - `totalValueUsd`
  - `capitalEnteredUsd`
  - `capitalWithdrawnUsd`
  - `realizedPnlUsd`
  - `unrealizedPnlUsd`
  - `idleResidualValueUsd`
  - `coverageStatus` (`full`, `partial`)
  - `traceRefs`

### 3. PortfolioHistoryPoint

- **Purpose**: Time-indexed point for total portfolio evolution chart.
- **Identity**: `portfolioHistoryPointId = acceptedRunId + ledgerRecordId`
- **Fields**:
  - `ledgerRecordId`
  - `blockNumber`
  - `timestamp`
  - `totalValueUsd` (nullable for partial windows)
  - `coverageStatus`

### 4. PoolDeployedCapitalSeries

- **Purpose**: Historical deployed-capital evolution by pool.
- **Identity**: `poolSeriesId = acceptedRunId + poolId`
- **Fields**:
  - `poolId`
  - `displayName`
  - `points[]`
    - `ledgerRecordId`
    - `blockNumber`
    - `timestamp`
    - `eventType`
    - `flowDirection` (`in`, `out`, `internal`)

### 5. PoolDashboardSummary

- **Purpose**: List/detail payload for pool surfaces.
- **Identity**: `poolDashboardSummaryId = acceptedRunId + poolId + asOf`
- **Fields**:
  - `poolId`
  - `displayName`
  - `currentValueUsd`
  - `capitalEnteredUsd`
  - `capitalWithdrawnUsd`
  - `realizedPnlUsd`
  - `unrealizedPnlUsd`
  - `coverageSummary`
  - `strategySummaries[]`

### 6. StrategyDashboardSummary

- **Purpose**: Strategy-level detail inside a pool.
- **Identity**: `strategyDashboardSummaryId = acceptedRunId + strategyId + asOf`
- **Fields**:
  - `strategyId`
  - `strategyType` (`manual`, `mellow_auto`)
  - `currentValueUsd`
  - `capitalEnteredUsd`
  - `capitalWithdrawnUsd`
  - `realizedPnlUsd`
  - `unrealizedPnlUsd`
  - `coverageSummary`

### 7. TimelineMarker

- **Purpose**: Explainability markers for major economic actions.
- **Identity**: `timelineMarkerId = acceptedRunId + ledgerRecordId + markerType`
- **Fields**:
  - `ledgerRecordId`
  - `blockNumber`
  - `timestamp`
  - `markerType` (`claim`, `lock`, `vote`, `rebalance`, `close`, `reopen`, `other`)
  - `label`

### 8. RebalanceFlowLink

- **Purpose**: Explicit cross-pool migration links.
- **Identity**: `rebalanceFlowLinkId = acceptedRunId + txHash + sourceRecordId + destinationRecordId`
- **Fields**:
  - `txHash`
  - `fromPoolId`
  - `toPoolId`
  - `sourceEventType`
  - `destinationEventType`
  - `timestamp`
  - `confidence` (`heuristic`, `high`)
  - `explanation`

### 9. IdleResidualBalanceRow

- **Purpose**: Visible undeployed or unallocated balances included in portfolio truth.
- **Identity**: `idleResidualBalanceRowId = analysisSessionId + tokenAddress + asOf`
- **Fields**:
  - `tokenAddress`
  - `symbol`
  - `amountRaw`
  - `currentValueUsd` (nullable)
  - `coverageStatus` (`priced`, `partial`, `unpriced`)
  - `reasonCode`
  - `candidatePoolIds[]`

## Relationships

- One `DashboardSessionView` has one `PortfolioOverviewCard`.
- One `DashboardSessionView` has many `PortfolioHistoryPoint` values.
- One `DashboardSessionView` has many `PoolDashboardSummary` values.
- One `PoolDashboardSummary` has many `StrategyDashboardSummary` values.
- One `DashboardSessionView` has many `TimelineMarker` values.
- One `DashboardSessionView` has many `RebalanceFlowLink` values.
- One `DashboardSessionView` has many `IdleResidualBalanceRow` values.

## Reconciliation Rules

1. Portfolio totals must reconcile to sum of priced pool and strategy contributions plus priced idle or residual balances.
2. Manual and supported Mellow strategies must remain separate rows within a pool.
3. Discarded and unsupported events remain reviewable but excluded from trusted economic totals.
4. Rebalance flow links are explanatory and must not overwrite core accounting values.

## State Rules

- `loading`: request in progress or session bootstrap unresolved.
- `partial`: data is present with explicit coverage or freshness gaps.
- `empty`: no accepted run or no qualifying dashboard data yet.
- `failure`: request failed and no trusted fallback available.
- `ready`: accepted-run dashboard surfaces are available and coherent.
