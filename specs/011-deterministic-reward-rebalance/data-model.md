# Data Model: Deterministic Reward & Rebalance Refactor

**Feature**: `011-deterministic-reward-rebalance`  
**Date**: 2026-05-28  
**Authority**: This document defines the normalized-entity and projection invariants required to remove time-based reward and rebalance heuristics. Existing tables remain authoritative unless explicitly extended here.

## 1. Source-Of-Truth Inputs

The refactor derives from these existing canonical tables and persisted evidence:

- `raw_provider_records`
- `ledger_events`
- `asset_movements`
- `deposits`
- `strategies`
- `strategy_exposures`
- `reward_events`
- `attribution_states`
- `attribution_source_lots`
- `inferred_actions`
- `pools`
- `performance_snapshots`
- wallet-scoped read models written by finalize (`pool_*`, `deposit_*`)

These remain the only browser-facing source path through existing internal APIs. No request-path provider reads are introduced by this feature.

## 2. Identity Invariants

### 2.1 Manual deposit identity

Manual Aerodrome deposit identity remains:

```txt
chainId + positionManagerAddress + tokenId
```

This is the only owner identity that may resolve a manual Aerodrome reward.

### 2.2 Strategy identity

Strategy identity remains:

```txt
chainId + wrapperAddress
```

or another approved strategy-contract identity when wrapper address is not the primary official surface.

### 2.3 StrategyExposure identity

User-level automated strategy ownership remains:

```txt
chainId + strategyId + walletAddress + wrapperAddress
```

Identity proof comes from share token or share balance lifecycle. If implementation verifies a stable Aerodrome or Mellow automated `deposit id`, that value should be persisted as an external deterministic reference, but it does not replace the canonical `StrategyExposure` ownership key unless product and protocol proof are updated.

For this feature, the primary expected external reference source is:

```txt
LpSugar.positions(limit, offset, walletAddress).id where row.alm == Strategy.wrapperAddress
```

That value is the Aerodrome dashboard-facing strategy position reference used for reward-linking and debug/display purposes. It must not replace canonical `StrategyExposure` identity and it must not be substituted with `LpWrapper.positionId()`.

That additive external reference must not block strategy reward ownership resolution when `StrategyExposure` ownership is otherwise proven.

Required persisted strategy-exposure identity hints:

- `wrapperAddress`
- `stakingRewardsAddress` via the linked `Strategy`
- `sharesRaw`
- `metadata_json.shareTokenAddress` when a transferable share token exists
- `metadata_json.identityBasis = share_token | share_balance_only`
- `metadata_json.officialStrategyKey` or equivalent provenance from official Mellow metadata
- `metadata_json.externalDepositReference` when a deterministic `LpSugar.positions(...).id` or other verified automated strategy-position reference is available

### 2.4 Reward identity and ownership

`reward_events` identity remains `(chainId, txHash, logIndex, rewardType)`, but ownership semantics become stricter:

- manual reward owner: `Deposit`
- strategy reward owner: `StrategyExposure` and `Strategy`
- governance reward owner: governance surfaces
- unresolved reward owner: none

## 3. Table Extensions

### 3.1 `reward_events` (EXTENDED)

Existing columns already cover transaction identity and `deposit_or_strategy_id`. This feature adds the missing user-level strategy linkage and proof semantics.

| Column | Type | Notes |
|---|---|---|
| `strategy_exposure_id` | `uuid` nullable | NEW. Links strategy rewards to the wallet’s `strategy_exposures.id` when resolvable. Null for manual or unresolved rewards. |
| `resolved_pool_id` | `uuid` nullable | NEW. Pool aggregate target when known from the resolved owner. |
| `resolution_basis` | `varchar(32)` nullable | NEW. `explicit_token_id | same_tx_token_context | strategy_wrapper_pair | staking_rewards_pair | share_lifecycle_context | unresolved`. `LpSugar`-derived position references are additive explainability metadata, not the canonical owner basis by themselves. |
| `resolution_reason_codes` | `text[]` not null default `'{}'` | NEW. E.g. `missingTokenId`, `ambiguousSamePool`, `missingStrategyExposure`, `missingShareEvidence`, `providerDecodedOnly`, `manualStrategyConflict`. |

`deposit_or_strategy_id` semantics remain:

- points to `deposits.id` for resolved manual rewards;
- points to `strategies.id` for resolved strategy rewards;
- remains null when unresolved.

`resolution_status` remains canonical (`resolved` / `unresolved`).

Recommended reward metadata invariants:

- `metadata_json.externalStrategyPositionReference` when a unique `LpSugar.positions(...).id` match exists for the proven owner
- `metadata_json.externalStrategyPositionReferenceStatus = resolved | unresolved`
- `metadata_json.ownerType = deposit | strategy | unresolved`

### 3.2 `strategy_exposures` (NO PRIMARY KEY CHANGE)

No synthetic tokenId column is added. This feature preserves the existing identity key and tightens metadata requirements only.

Required metadata invariants:

- wrapper or share token transfers that change exposure must record enough detail to explain identity continuity;
- if the wrapper exposes an ERC-20 share token, persist its address in `metadata_json.shareTokenAddress`;
- if the wrapper does not expose a transferable share token, mark `metadata_json.identityBasis = share_balance_only`;
- if `LpSugar.positions(...).id` yields a deterministic wallet-scoped wrapper match, persist it as `metadata_json.externalDepositReference` or a dedicated column and use it as the strategy reward-linking position reference;
- if the wallet-level `StrategyExposure` is proven but no deterministic `LpSugar` row exists, persist the unresolved status explicitly rather than downgrading the owner itself;
- never substitute `LpWrapper.positionId()` for the dashboard-facing strategy position reference;
- never fabricate a strategy tokenId or external deposit reference.

### 3.3 `inferred_actions` (SEMANTIC CONTRACT EXTENSION)

The existing schema is sufficient, but `metadata_json` becomes a stricter contract for deterministic residual-flow reasoning.

Required metadata keys for same-pool higher-order outcomes:

- `allocationBreakdown`: source-lot allocations by priority bucket
- `pairedSwapConsumedCandidateResidual`: boolean
- `candidatePoolResidualConsumedRaw`: raw amount consumed from the candidate pool residual
- `candidatePoolResidualShare`: optional fractional share of total funding consumed from the candidate pool residual
- `mixedFunding`: boolean
- `excessAllocationBuckets`: summary of non-candidate funding sources when applicable
- `counterpartyPoolId`: nullable target pool for transfer or reassignment cases
- `classificationBasis = residual_flow`

Canonical same-pool action types remain wallet-scoped and deterministic:

- `rebalance_same_pool`
- `redeploy_same_pool`
- `new_capital_deposit`
- `unknown_source_deposit`
- `liquidation_from_residual`
- `cash_out_from_residual`
- transfer or reassignment variants where explicitly supported

### 3.4 Wallet-scoped read models (NO NEW TABLES)

No new read-model tables are introduced. Existing finalize projections must be rebuilt from corrected normalized evidence:

- Pools: `pool_wallet_summaries`, `pool_history_snapshots`, `pool_timeline_events`
- Deposits: `deposit_wallet_summaries`, `deposit_lifecycle_events`, `deposit_performance_decompositions`

## 4. Ownership And Resolution Rules

### 4.1 Manual rewards

Manual reward resolution MUST use this order:

1. `resolution_basis = explicit_token_id`
2. `resolution_basis = same_tx_token_context`
3. unresolved

Forbidden bases:

- pool plus time window
- unique active deposit in pool
- current position in pool
- direct pool-first ownership

### 4.2 Strategy rewards

Strategy rewards resolve from:

1. official Mellow strategy metadata (`lpWrapper` + `StakingRewards` pairing)
2. wallet interaction with the paired wrapper or staking contract
3. share token or share balance lifecycle proving the owning `StrategyExposure`
4. underlying pool from the linked strategy when known

This yields:

```txt
RewardEvent -> StrategyExposure -> Strategy -> Pool
```

If strategy ownership cannot be proven to a wallet-level exposure, the reward remains unresolved even if the strategy or pool is known.

## 5. Read-Model Materialization Rules

### 5.1 Pools

Pool rewards are derived only from already resolved owners:

```txt
sum(manual deposit rewards linked to deposits in pool)
+ sum(strategy rewards linked to strategy exposures / strategies in pool)
```

`pool_timeline_events` rebalance and redeploy rows must be created only from canonical `inferred_actions`, not from time-window grouping.
If canonical inference is absent, the projection must degrade coverage or emit a neutral lifecycle row rather than reconstructing higher-order meaning locally.

### 5.2 Deposits

Deposit totals and decomposition inputs must consume only:

- resolved manual `reward_events`
- `inferred_actions` linked to the deposit or its residual states
- `attribution_states` and `attribution_source_lots` for attributable residual behavior

Unresolved rewards must degrade coverage and reason codes; they must not be counted as resolved deposit rewards.
Strategy rewards from the same pool must not be included in deposit totals, even when the deposit and strategy share the same `poolId`.

## 6. Migration Impact

### 6.1 Normalized tables requiring semantic rebuild

- `reward_events`
- `ledger_events` where classification depends on corrected inferred outcomes
- `inferred_actions`
- `attribution_states`
- `attribution_source_lots`
- `performance_snapshots` for affected scopes

### 6.2 Projection tables requiring rebuild

- `pool_wallet_summaries`
- `pool_history_snapshots`
- `pool_timeline_events`
- `deposit_wallet_summaries`
- `deposit_lifecycle_events`
- `deposit_performance_decompositions`

### 6.3 Purge/update rule

If any new FK-backed table or columnized helper is added during implementation, `apps/web/src/server/scripts/db-purge.ts` must be updated before dependencies, following the repository purge-order note.

### 6.4 Rebuild-order invariant

Finalize-time rebuilds, rerun recovery, and CLI rebuild scripts must execute the same deterministic order:

1. reward re-resolution
2. canonical inference
3. snapshot rebuild
4. pool read-model rebuild
5. deposit read-model rebuild