# Data Model: Canonical Investment Ledger

## Scope

This data model covers the ledger foundation for The Cab's first feature only. It intentionally includes wallet context, immutable evidence, canonical ledger records, pool and strategy modeling, lifecycle modeling, residual holdings, and discarded activity. It intentionally excludes pricing, realized and unrealized PnL, attribution outputs, and dashboard-specific view models.

## Core Entities

### 1. WalletAnalysisSession

- **Purpose**: Represents the single active wallet context under analysis.
- **Identity**: `analysisSessionId = chainId + walletAddress`
- **Fields**:
  - `analysisSessionId`
  - `walletAddress`
  - `chainId`
  - `connectionSource`
  - `createdAt`
  - `lastRequestedAt`
  - `latestAcceptedRunId`
  - `status` (`active`, `archived`, `failed`)
- **Validation rules**:
  - `chainId` must be Base mainnet for this feature.
  - Only one active session per wallet and chain combination may exist.

### 2. ReconstructionRun

- **Purpose**: Captures one deterministic ingestion and normalization attempt for a wallet session.
- **Identity**: `reconstructionRunId = analysisSessionId + startedAt + classifierVersion + heuristicsVersion + blockWindow`
- **Fields**:
  - `reconstructionRunId`
  - `analysisSessionId`
  - `runMode` (`initial`, `incremental`, `replay`)
  - `classifierVersion`
  - `heuristicsVersion`
  - `fromBlock`
  - `toBlock`
  - `checkpointBlock`
  - `startedAt`
  - `completedAt`
  - `status` (`pending`, `ingesting`, `normalizing`, `projecting`, `accepted`, `failed`)
  - `errorSummary` (nullable)
- **Validation rules**:
  - Accepted runs are immutable.
  - A later run may supersede an earlier accepted run but must never mutate it.

### 3. RawObservation

- **Purpose**: Stores an immutable unit of source evidence used for reconstruction.
- **Identity**: `rawObservationId = sourceType + chainId + txHash + logIndexOrTracePath`
- **Fields**:
  - `rawObservationId`
  - `reconstructionRunId`
  - `sourceType` (`block_header`, `transaction`, `receipt`, `log`, `trace_frame`)
  - `chainId`
  - `blockNumber`
  - `blockHash`
  - `txHash`
  - `logIndex` (nullable)
  - `tracePath` (nullable)
  - `contractAddress` (nullable)
  - `payloadJson`
  - `payloadHash`
  - `ingestedAt`
- **Validation rules**:
  - `payloadJson` and `payloadHash` are immutable once written.
  - Duplicate evidence must collapse to the same natural identity rather than create semantic duplicates.

### 4. Pool

- **Purpose**: Top-level analytical container for attributable activity.
- **Identity**: `poolId = chainId + protocolFamily + poolAddress`
- **Fields**:
  - `poolId`
  - `chainId`
  - `protocolFamily`
  - `poolAddress`
  - `token0Address`
  - `token1Address`
  - `feeTier` (nullable)
  - `displayName`
  - `status` (`active`, `historical`)
- **Validation rules**:
  - A pool may own many strategies.
  - A pool is used only when attribution is sufficiently confident.

### 5. Strategy

- **Purpose**: Distinct participation method inside a pool.
- **Identity**: `strategyId = poolId + strategyType + sourceContractAddress`
- **Fields**:
  - `strategyId`
  - `poolId`
  - `strategyType` (`manual`, `mellow_auto`)
  - `sourceContractAddress`
  - `label`
  - `status` (`active`, `historical`)
- **Validation rules**:
  - Manual and supported Mellow activity in the same pool must produce separate strategies.

### 6. PositionInstance

- **Purpose**: Finite lifecycle record for manual or supported Mellow exposure.
- **Identity rules**:
  - Manual: `positionInstanceId = strategyId + tokenId`
  - Supported Mellow: `positionInstanceId = strategyId + exposureSequence`
- **Fields**:
  - `positionInstanceId`
  - `strategyId`
  - `positionType` (`manual_cl`, `mellow_exposure`)
  - `status` (`open`, `partially_reduced`, `closed`, `burned`, `archived`)
  - `openedAt`
  - `closedAt` (nullable)
  - `openTxHash`
  - `closeTxHash` (nullable)
  - `tokenId` (manual only, nullable otherwise)
  - `tickLower` (manual only, nullable)
  - `tickUpper` (manual only, nullable)
  - `wrapperAddress` (supported Mellow only, nullable)
  - `stakingRewardsAddress` (supported Mellow only, nullable)
  - `shareBalanceRaw` (supported Mellow only, nullable)
  - `lifecycleSequence`
- **Validation rules**:
  - Manual `mint()` opens a new instance.
  - Manual `increaseLiquidity()` on an existing `tokenId` extends the same instance.
  - Supported Mellow opens a new instance only when exposure moves from zero to positive after being fully closed previously.

### 7. CanonicalLedgerRecord

- **Purpose**: Trusted normalized event that later product layers will consume as source of truth.
- **Identity**: `ledgerRecordId = reconstructionRunId + txHash + ordinal`
- **Fields**:
  - `ledgerRecordId`
  - `reconstructionRunId`
  - `analysisSessionId`
  - `poolId` (nullable)
  - `strategyId` (nullable)
  - `positionInstanceId` (nullable)
  - `eventType`
  - `eventSequence`
  - `txHash`
  - `blockNumber`
  - `timestamp`
  - `classificationConfidence`
  - `classifierVersion`
  - `heuristicsVersion`
  - `explanation`
- **Event types in scope**:
  - `external_deposit`
  - `external_withdrawal`
  - `manual_position_opened`
  - `manual_liquidity_added`
  - `manual_liquidity_removed`
  - `manual_fees_collected`
  - `manual_position_closed`
  - `mellow_exposure_opened`
  - `mellow_exposure_increased`
  - `mellow_exposure_decreased`
  - `mellow_reward_claimed`
  - `swap`
  - `residual_balance_update`
- **Validation rules**:
  - Trusted ledger records may not point to discarded reason codes.
  - Record ordering must be stable within a transaction.

### 8. LedgerRecordSource

- **Purpose**: Joins canonical ledger records back to contributing raw observations.
- **Identity**: composite of `ledgerRecordId + rawObservationId`
- **Fields**:
  - `ledgerRecordId`
  - `rawObservationId`
  - `sourceRole` (`primary_call`, `supporting_log`, `trace_validation`, `transfer_evidence`)
- **Validation rules**:
  - Every canonical ledger record must link to at least one raw observation.

### 9. AssetMovement

- **Purpose**: Token-level delta caused by a canonical ledger record.
- **Identity**: `assetMovementId = ledgerRecordId + tokenAddress + ordinal`
- **Fields**:
  - `assetMovementId`
  - `ledgerRecordId`
  - `tokenAddress`
  - `symbol`
  - `amountRaw`
  - `decimals`
  - `direction` (`in`, `out`, `internal`)
  - `movementRole` (`principal`, `reward`, `fee`, `swap_leg`, `residual_change`)
- **Validation rules**:
  - Movements must be explainable from linked raw observations.
  - A movement may be associated with a record that has no position instance when the activity is pool-, strategy-, or portfolio-level only.

### 10. ResidualHolding

- **Purpose**: Represents in-scope wallet-owned balances that remain visible when exact pool attribution is not sufficiently confident.
- **Identity**: `residualHoldingId = reconstructionRunId + tokenAddress + candidateContextHash`
- **Fields**:
  - `residualHoldingId`
  - `reconstructionRunId`
  - `tokenAddress`
  - `symbol`
  - `amountRaw`
  - `decimals`
  - `attributionConfidence`
  - `candidatePoolIds`
  - `latestSourceLedgerRecordId`
  - `reasonCode` (`idle_wallet_balance`, `rebalance_leftover`, `unallocated_close_proceeds`, `low_confidence_attribution`)
- **Validation rules**:
  - Residual holdings live at portfolio level, not as synthetic pools.
  - A residual holding may reference candidate pools but must not claim pool ownership when confidence is below threshold.

### 11. DiscardedActivity

- **Purpose**: First-class record of unsupported or unsafe activity that remains reviewable but untrusted.
- **Identity**: `discardedActivityId = reconstructionRunId + txHash + ordinal`
- **Fields**:
  - `discardedActivityId`
  - `reconstructionRunId`
  - `analysisSessionId`
  - `txHash`
  - `blockNumber`
  - `timestamp`
  - `reasonType` (`unsupported`, `malicious`, `ambiguous`, `invalid`)
  - `reasonCode`
  - `reasonMessage`
  - `classifierVersion`
  - `heuristicsVersion`
  - `sourceObservationIds`
- **Validation rules**:
  - Discarded activity is never part of trusted ledger projections.
  - Every discarded record must remain traceable to raw observations.

## Relationships

- One `WalletAnalysisSession` has many `ReconstructionRun` records.
- One `ReconstructionRun` has many `RawObservation`, `CanonicalLedgerRecord`, `ResidualHolding`, and `DiscardedActivity` records.
- One `Pool` has many `Strategy` records.
- One `Strategy` has many `PositionInstance` records.
- One `PositionInstance` has many `CanonicalLedgerRecord` records.
- One `CanonicalLedgerRecord` has many `LedgerRecordSource` and `AssetMovement` records.
- `ResidualHolding` and `DiscardedActivity` remain linked to the wallet session and reconstruction run even when not attached to a pool or position.

## State Transitions

### Manual PositionInstance

- `open` on `manual_position_opened`
- `open` or `partially_reduced` on `manual_liquidity_added`
- `partially_reduced` on partial `manual_liquidity_removed`
- `closed` when liquidity reaches zero and exposure ends
- `burned` when the NFT is explicitly burned after closure
- `archived` when historical cleanup projections no longer treat the position as active

### Supported Mellow PositionInstance

- `open` when wrapper or staked balance moves from zero to positive
- remain `open` when deposits or stakes increase exposure
- `partially_reduced` when withdrawals or unstake actions reduce but do not eliminate exposure
- `closed` when wallet-owned wrapper or staked balance returns to zero
- `archived` when historical cleanup projections mark the lifecycle inactive

### ReconstructionRun

- `pending` -> `ingesting` -> `normalizing` -> `projecting` -> `accepted`
- any state -> `failed` with immutable error summary

## Out-of-Scope Entities For Later Features

The following are intentionally deferred to later feature plans:

- Historical and current pricing entities
- Realized and unrealized PnL snapshots
- Attribution decompositions
- Dashboard-specific presentation models
- Manual override records