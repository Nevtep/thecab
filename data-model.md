# The Cab — Data Model v1

## Purpose

This document defines the initial domain model for **The Cab**, a web analytics application for tracking and understanding investment performance in **Aerodrome on Base** and its relevant **Mellow integration**.

The model is intentionally designed for:

- one connected wallet at a time
- USD/USDC-centric analysis
- deterministic onchain reconstruction
- pool-level aggregation with strategy isolation

---

## 1. Design principles

The model follows these product principles:

1. **Pool-first analysis**: pools are the main aggregation unit.
2. **Strategy isolation**: manual and Mellow strategies under the same pool remain separated.
3. **Position lifecycle integrity**: each deposit/position has explicit beginning, evolution, and end.
4. **Ledger-first truth**: all analytics derive from normalized events and asset movements.
5. **Portfolio completeness**: open positions and idle balances both count toward total portfolio value.

---

## 2. Entity overview

The main entities are:

- `WalletContext`
- `Protocol`
- `Pool`
- `Strategy`
- `PositionInstance`
- `LedgerEvent`
- `AssetMovement`
- `PricePoint`
- `PerformanceSnapshot`
- `PortfolioSnapshot`
- `DiscardedEvent`

---

## 3. Core entities

## 3.1. WalletContext

Represents the currently connected wallet under analysis.

### Fields
- `address`
- `chainId`
- `connectedAt`
- `lastIndexedBlock`
- `status`

### Notes
- only one active wallet is analyzed at a time
- all derived analytics belong to this context

---

## 3.2. Protocol

Represents a supported source of DeFi activity.

### Initial values
- `aerodrome_manual`
- `mellow_aerodrome`

### Purpose
Used to separate protocol-specific interpretation while still allowing unified reporting.

---

## 3.3. Pool

Represents the main analytical grouping unit.

### Fields
- `poolId`
- `protocolFamily`
- `chainId`
- `token0`
- `token1`
- `feeTier` (if available / relevant)
- `poolAddress`
- `displayName`
- `isActive`

### Purpose
A `Pool` aggregates:
- strategies
- positions
- rewards
- capital flows
- current value

### Examples
- `WETH / USDC`
- `cbBTC / WETH`

---

## 3.4. Strategy

Represents a distinct way of participating in a pool.

### Fields
- `strategyId`
- `poolId`
- `strategyType`
- `protocol`
- `label`
- `sourceContractAddress`
- `status`

### Initial strategy types
- `manual`
- `mellow_auto`

### Purpose
A pool may contain multiple strategies in parallel.

Example:
- Pool: `WETH/USDC`
  - Strategy A: `mellow_auto`
  - Strategy B: `manual`

### Notes
This is where The Cab separates performance attribution that should not be merged.

---

## 3.5. PositionInstance

Represents a finite deposit or exposure lifecycle inside a strategy.

### Fields
- `positionInstanceId`
- `strategyId`
- `positionType`
- `openedAt`
- `closedAt`
- `status`
- `openTxHash`
- `closeTxHash`
- `openedValueUsd`
- `closedValueUsd`
- `notes`

### Manual-specific fields
- `tokenId` (Aerodrome NFT position id)
- `tickLower`
- `tickUpper`
- `initialLiquidity`
- `currentLiquidity`

### Mellow-specific fields
- `wrapperAddress`
- `stakingRewardsAddress`
- `managedPositionReference`
- `shareBalance` or equivalent tracked quantity

### Status candidates
- `open`
- `partially_reduced`
- `closed`
- `burned`
- `archived`

### Purpose
This is the main finite lifecycle unit for economic interpretation.

### Notes
- manual: usually tied to Aerodrome NFT identity
- Mellow: tied to strategy exposure instance, not necessarily to a user-owned NFT

---

## 4. Event model

## 4.1. LedgerEvent

Represents a normalized event derived from one or more onchain actions.

### Fields
- `ledgerEventId`
- `walletAddress`
- `poolId`
- `strategyId`
- `positionInstanceId` (nullable when not position-specific)
- `protocol`
- `eventType`
- `txHash`
- `logIndex`
- `blockNumber`
- `timestamp`
- `confidence`
- `rawSource`
- `isDiscarded`

### Event type candidates
- `external_deposit`
- `external_withdrawal`
- `mint_position`
- `increase_liquidity`
- `decrease_liquidity`
- `collect_fees`
- `stake`
- `unstake`
- `claim_reward`
- `swap`
- `rebalance`
- `mellow_deposit`
- `mellow_withdraw`
- `lock_aero`
- `relock_aero`
- `idle_balance_change`
- `unsupported`
- `malicious`
- `discarded`

### Purpose
`LedgerEvent` is the canonical source of truth for analytics.

---

## 4.2. AssetMovement

Represents the token-level asset deltas caused by a ledger event.

### Fields
- `assetMovementId`
- `ledgerEventId`
- `tokenAddress`
- `symbol`
- `amountRaw`
- `amountNormalized`
- `direction` (`in`, `out`, `internal`)
- `usdValueAtEvent`
- `priceSource`

### Purpose
Allows exact decomposition of:
- what moved
- how much moved
- what it was worth at the time

### Notes
This is essential for explaining performance numerically.

---

## 4.3. DiscardedEvent

Represents an event that was detected but intentionally excluded from sensitive analytics.

### Fields
- `discardedEventId`
- `txHash`
- `reasonType`
- `reasonMessage`
- `rawClassification`
- `timestamp`

### Reason type candidates
- `malicious`
- `unsupported`
- `ambiguous`
- `invalid`

### Purpose
Supports the rule that The Cab should not require manual reconciliation.

---

## 5. Pricing model

## 5.1. PricePoint

Represents a historical or current price used for valuation.

### Fields
- `pricePointId`
- `tokenAddress`
- `timestamp`
- `priceUsd`
- `source`
- `resolution`
- `confidence`

### Purpose
Supports:
- event-time valuation
- current valuation
- realized and unrealized PnL attribution

### Notes
USD/USDC is the main valuation base for the app.

---

## 6. Derived analytics entities

## 6.1. PerformanceSnapshot

Represents a computed performance state for a chosen scope.

### Fields
- `performanceSnapshotId`
- `scopeType`
- `scopeId`
- `timestamp`
- `capitalInUsd`
- `capitalOutUsd`
- `realizedPnlUsd`
- `unrealizedPnlUsd`
- `rewardRealizedUsd`
- `assetPriceEffectUsd`
- `rebalanceRealizedUsd`
- `currentValueUsd`
- `estimatedAnnualizedReturnPct`

### Scope type candidates
- `portfolio`
- `pool`
- `strategy`
- `position_instance`

### Purpose
Provides reusable metrics for dashboards and reports.

---

## 6.2. PortfolioSnapshot

Represents the current or historical overall portfolio state of the connected wallet.

### Fields
- `portfolioSnapshotId`
- `walletAddress`
- `timestamp`
- `totalValueUsd`
- `openPositionsValueUsd`
- `idleAssetsValueUsd`
- `realizedPnlUsd`
- `unrealizedPnlUsd`
- `capitalInUsd`
- `capitalOutUsd`

### Purpose
Supports the top-level portfolio dashboard and charting.

---

## 7. Relationships

The high-level relational structure is:

- one `WalletContext` -> many `Pool`
- one `Pool` -> many `Strategy`
- one `Strategy` -> many `PositionInstance`
- one `PositionInstance` -> many `LedgerEvent`
- one `LedgerEvent` -> many `AssetMovement`
- one `AssetMovement` -> one `PricePoint` at valuation time
- one `Pool` / `Strategy` / `PositionInstance` -> many `PerformanceSnapshot`

---

## 8. Identity rules

## 8.1. Pool identity rule

A pool is the analytical parent grouping for all related manual and Mellow participation in the same trading pair / venue.

## 8.2. Strategy identity rule

A strategy is distinct when the participation method materially differs.

Examples:
- same pool, manual = one strategy
- same pool, Mellow = another strategy

## 8.3. Manual position identity rule

A manual concentrated-liquidity position is identified primarily by Aerodrome NFT `tokenId`.

Rules:
- `mint()` => new `PositionInstance`
- `increaseLiquidity(existing tokenId)` => same `PositionInstance`

## 8.4. Mellow position identity rule

A Mellow exposure is tracked as a strategy-specific position/exposure instance tied to wrapper/staking behavior, not as if the user manually owned an Aerodrome LP NFT per deposit.

---

## 9. Metric decomposition requirements

The model must support these required metrics:

- capital entered
- capital withdrawn
- realized PnL
- unrealized PnL
- estimated annualized return
- gains/losses caused by asset price movement
- gains from rewards / claims
- realized effects of swaps / rebalance
- total current portfolio value including idle assets

---

## 10. Open modeling questions for later phases

These do not block the initial model, but will need refinement later:

1. precise formula for annualized return
2. treatment of partial closes and partial redeployments
3. treatment of fee accrual vs collected fees
4. exact Mellow share/exposure accounting semantics
5. scope of AERO lock and governance analytics in MVP vs later phases
6. how aggressively to infer rebalance events vs merely showing constituent swaps and closes

---

## 11. Summary

This data model is designed to support:

- deterministic onchain analytics
- accurate lifecycle tracking
- pool-level aggregation
- strategy-level separation
- position-level detail
- event-level explainability
- portfolio completeness in USD terms

