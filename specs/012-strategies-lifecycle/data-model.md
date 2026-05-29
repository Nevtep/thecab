# Data Model: Strategies Lifecycle

**Feature**: `012-strategies-lifecycle`  
**Date**: 2026-05-29

This document defines the wallet-scoped read models required for the Strategies DataView. Existing normalized analysis tables remain the source of truth. New tables are rebuildable projections written during analysis finalization and consumed only by Strategies APIs and regression scripts.

## 1. Source-Of-Truth Inputs (Existing)

Strategies derives from existing normalized entities and persisted provider evidence:

- `strategies`
- `strategy_exposures`
- `pools`
- `protocol_contracts`
- `ledger_events`
- `asset_movements`
- `reward_events`
- `price_points`
- `performance_snapshots`
- `pool_wallet_summaries`, `pool_history_snapshots`, `pool_timeline_events`
- `deposit_wallet_summaries`
- `raw_provider_records`
- `analysis_runs`, `analysis_slices`, `wallet_contexts`

These remain authoritative. Strategy read models must be rebuildable from these rows for a given `(chainId, walletAddress, runId)`.

## 2. New Read-Model Tables

### 2.1 `strategy_wallet_summaries` (NEW)

One current row per `(chainId, walletAddress, strategyExposureId)` powering the master list, KPI strip, selected-panel header, cross-links, and regression totals.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | Surrogate key. |
| `chain_id` | `integer` not null | Chain-aware identity. |
| `wallet_address` | `varchar(42)` not null | Lowercased authenticated wallet. |
| `strategy_id` | `uuid` FK -> `strategies.id` not null | Strategy identity. |
| `strategy_exposure_id` | `uuid` FK -> `strategy_exposures.id` not null | Wallet-specific exposure. |
| `primary_pool_id` | `uuid` FK -> `pools.id` nullable | Underlying Aerodrome pool when known. |
| `latest_run_id` | `uuid` FK -> `analysis_runs.id` not null | Materialization provenance. |
| `strategy_label` | `text` not null | Display label, usually token pair + pool kind. |
| `protocol` | `varchar(32)` not null default `mellow` | Initial scope is Mellow. |
| `wrapper_address` | `varchar(42)` nullable | Strategy wrapper/lpWrapper when known. |
| `staking_rewards_address` | `varchar(42)` nullable | StakingRewards contract when known. |
| `external_strategy_position_reference` | `text` nullable | Dashboard-facing strategy reference when deterministically known. |
| `external_strategy_position_reference_status` | `varchar(24)` not null default `unresolved` | `resolved` or `unresolved`. |
| `pool_mapping_status` | `varchar(24)` not null default `unknown` | `confirmed`, `inferred`, `unknown`. |
| `status` | `varchar(24)` not null | `active`, `closed`, `unknown`. |
| `opened_at` | `timestamptz` nullable | First known exposure event. |
| `closed_at` | `timestamptz` nullable | Last terminal exit event when known. |
| `covered_start_day_utc` | `varchar(10)` nullable | Earliest covered day. |
| `covered_end_day_utc` | `varchar(10)` nullable | Latest covered day. |
| `deposited_value_usd` | `numeric(38,18)` not null default `0` | Total user entry value into the strategy. |
| `withdrawn_value_usd` | `numeric(38,18)` not null default `0` | Total user exit value from the strategy. |
| `current_estimated_value_usd` | `numeric(38,18)` nullable | Current share-level valuation when available. |
| `shares_received_raw` | `numeric(78,0)` not null default `0` | Lifetime shares received/minted. |
| `shares_redeemed_raw` | `numeric(78,0)` not null default `0` | Lifetime shares redeemed/burned. |
| `current_shares_raw` | `numeric(78,0)` not null default `0` | Current share balance. |
| `share_symbol` | `varchar(48)` nullable | Strategy share or wrapper share symbol. |
| `total_rewards_usd` | `numeric(38,18)` not null default `0` | Rewards resolved to this strategy exposure. |
| `resolved_reward_count` | `integer` not null default `0` | Count of resolved strategy reward events. |
| `unresolved_reward_count` | `integer` not null default `0` | Count of strategy-shaped reward candidates not counted. |
| `realized_pnl_usd` | `numeric(38,18)` nullable | Realized result when reconstructable. |
| `unrealized_pnl_usd` | `numeric(38,18)` nullable | Unrealized result when reconstructable. |
| `total_return_usd` | `numeric(38,18)` nullable | Strategy-level return, partial if coverage requires. |
| `total_return_pct` | `numeric(12,6)` nullable | Signed return percentage. |
| `estimated_annualized_return_pct` | `numeric(12,6)` nullable | Signed annualized estimate. |
| `coverage_status` | `varchar(24)` not null default `share_level` | `full`, `share_level`, `partial`, `unknown`. |
| `confidence` | `varchar(16)` not null default `unknown` | `high`, `medium`, `low`, `degraded`, `unknown`. |
| `coverage_reason_codes` | `text[]` not null default `{}` | Machine reason codes for note and badges. |
| `metadata_json` | `jsonb` not null default `{}` | Token icons, pool label, row trend cue, component counts, UI helper metadata. |
| `created_at` / `updated_at` | `timestamptz` | Audit timestamps. |

**Unique index**: `(chain_id, wallet_address, strategy_exposure_id)`.

**Supporting indexes**:

- `(chain_id, wallet_address, status)`
- `(chain_id, wallet_address, primary_pool_id)`
- `(chain_id, wallet_address, coverage_status)`
- `(chain_id, wallet_address, current_estimated_value_usd DESC)`
- `(chain_id, wallet_address, opened_at DESC)`

### 2.2 `strategy_history_snapshots` (NEW)

Daily wallet-scoped strategy rows powering KPI trend cues, current value history, and future chart expansion.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | Surrogate key. |
| `chain_id` | `integer` not null | Chain-aware identity. |
| `wallet_address` | `varchar(42)` not null | Lowercased wallet. |
| `strategy_id` | `uuid` FK -> `strategies.id` not null | Strategy identity. |
| `strategy_exposure_id` | `uuid` FK -> `strategy_exposures.id` not null | Exposure identity. |
| `primary_pool_id` | `uuid` FK -> `pools.id` nullable | Pool relationship where known. |
| `day_utc` | `varchar(10)` not null | Snapshot day. |
| `latest_run_id` | `uuid` FK -> `analysis_runs.id` not null | Provenance. |
| `coverage_status` | `varchar(24)` not null default `share_level` | Coverage for this snapshot. |
| `share_balance_raw` | `numeric(78,0)` not null default `0` | Share balance on day. |
| `estimated_value_usd` | `numeric(38,18)` nullable | Share-level value if available. |
| `deposited_value_usd` | `numeric(38,18)` not null default `0` | Daily entry value. |
| `withdrawn_value_usd` | `numeric(38,18)` not null default `0` | Daily exit value. |
| `reward_value_usd` | `numeric(38,18)` not null default `0` | Daily resolved rewards. |
| `cumulative_rewards_usd` | `numeric(38,18)` not null default `0` | Running strategy rewards. |
| `total_return_usd` | `numeric(38,18)` nullable | Daily return where reconstructable. |
| `metadata_json` | `jsonb` not null default `{}` | Coverage and valuation helpers. |
| `created_at` | `timestamptz` | Audit timestamp. |

**Unique index**: `(chain_id, wallet_address, strategy_exposure_id, day_utc)`.

**Supporting indexes**:

- `(chain_id, wallet_address, day_utc)`
- `(chain_id, wallet_address, strategy_exposure_id, day_utc)`
- `(chain_id, wallet_address, primary_pool_id, day_utc)`

### 2.3 `strategy_lifecycle_events` (NEW)

Chronological rows per strategy exposure powering lifecycle timeline, selected panel, reward table source, transaction comparison, and external links.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | Surrogate key. |
| `chain_id` | `integer` not null | Chain-aware identity. |
| `wallet_address` | `varchar(42)` not null | Lowercased wallet. |
| `strategy_id` | `uuid` FK -> `strategies.id` not null | Strategy identity. |
| `strategy_exposure_id` | `uuid` FK -> `strategy_exposures.id` not null | Exposure identity. |
| `primary_pool_id` | `uuid` FK -> `pools.id` nullable | Pool relationship. |
| `sequence_index` | `integer` not null | Stable 1-based event order. |
| `latest_run_id` | `uuid` FK -> `analysis_runs.id` not null | Provenance. |
| `event_type` | `varchar(40)` not null | `strategy_deposit`, `strategy_share_receive`, `strategy_stake`, `strategy_claim`, `strategy_unstake`, `strategy_withdraw`, `strategy_share_redeem`, `strategy_close`, `strategy_internal_rebalance`, `strategy_fee_dilution`, `strategy_baseline_transfer_in`, `unresolved_strategy_reward`. |
| `occurred_at` | `timestamptz` not null | Block timestamp. |
| `tx_hash` | `varchar(66)` nullable | Null only for synthetic coverage rows. |
| `log_index` | `integer` nullable | Tie-breaker in transaction. |
| `block_number` | `bigint` nullable | Source block. |
| `source_ledger_event_id` | `uuid` FK -> `ledger_events.id` nullable | Traceability to normalized event. |
| `source_reward_event_id` | `uuid` FK -> `reward_events.id` nullable | Present for strategy rewards. |
| `usd_value` | `numeric(38,18)` nullable | Event value at block/day price. |
| `share_delta_raw` | `numeric(78,0)` nullable | Signed share movement. |
| `token_deltas_json` | `jsonb` not null default `[]` | Token/share movement rows for DataView. |
| `price_source` | `varchar(32)` nullable | `alchemyHistorical`, `pricePointFallback`, `unavailable`, etc. |
| `confidence` | `varchar(16)` not null default `unknown` | Event confidence. |
| `coverage_status` | `varchar(24)` not null default `share_level` | Event coverage. |
| `coverage_reason_codes` | `text[]` not null default `{}` | Reason codes for note/tooltips. |
| `metadata_json` | `jsonb` not null default `{}` | Wrapper, staking, external reference, pool mapping, source tx fields. |
| `created_at` | `timestamptz` | Audit timestamp. |

**Unique index**: `(chain_id, wallet_address, strategy_exposure_id, sequence_index)`.

**Supporting indexes**:

- `(chain_id, wallet_address, strategy_exposure_id, occurred_at)`
- `(chain_id, wallet_address, strategy_exposure_id, event_type)`
- `(chain_id, wallet_address, tx_hash)`
- `(chain_id, wallet_address, source_reward_event_id)`

## 3. Materialization Rules

1. **Strategy identity**: read from `strategies` and prefer official metadata for label, wrapper, staking, and pool mapping. Pool-only identity must not merge wrappers.
2. **Exposure identity**: read from `strategy_exposures` by `(chainId, walletAddress, strategyId, wrapperAddress)`.
3. **Lifecycle candidates**: derive strategy lifecycle events from `ledger_events` and `asset_movements` whose metadata or classified surface ties to known wrapper/staking/share contracts. Known event categories become `strategy_deposit`, `strategy_share_receive`, `strategy_stake`, `strategy_unstake`, `strategy_withdraw`, `strategy_share_redeem`, or `strategy_close`.
4. **Baseline transfer-in**: if the first known strategy event is an inbound share receipt without a known deposit, create `strategy_baseline_transfer_in`, degrade confidence, and add `baselineTransferIn` to coverage reasons.
5. **Rewards**: include only `reward_events` where `strategy_exposure_id` equals the exposure. `deposit_or_strategy_id` may also point to the strategy, but it cannot replace `strategy_exposure_id` for wallet-specific ownership.
6. **Unresolved strategy-shaped rewards**: create visible lifecycle rows for strategy-shaped candidates that cannot be counted, using `unresolved_strategy_reward` and coverage reasons. They do not contribute to `total_rewards_usd`.
7. **Value and return**: compute current value from share-level valuation when available. If share price or underlying valuation is missing, keep shares visible, set value/return fields null, and set coverage `partial` or `unknown`.
8. **Coverage**:
   - `full`: user deposits, withdrawals, shares, rewards, underlying valuation, and relevant internal activity are reconstructable.
   - `share_level`: user deposits, withdrawals, shares, and rewards are reliable, but internal strategy operations are incomplete.
   - `partial`: some prices, share valuation, pool mapping, rewards, or lifecycle links are missing.
   - `unknown`: strategy exposure detected but not reliably analyzable.
9. **Internal strategy activity**: persist `strategy_internal_rebalance` and `strategy_fee_dilution` only when confidently tied to known strategy contracts. Never emit these as manual deposit events.
10. **Pool aggregate linkage**: for strategies with `primary_pool_id`, resolved strategy rewards and current strategy value are available to pool read-model rebuilds.
11. **Deposit exclusion**: deposit read-model rebuilds must aggregate only rewards resolved to deposit identity. Strategy-owned rewards in the same pool are excluded.
12. **Regression traceability**: every lifecycle event with a transaction must carry `tx_hash`, source row ids where available, and enough metadata to compare against raw provider records and chain transaction evidence.

## 4. View Models

```ts
type StrategySummaryView = {
  id: string;
  strategyId: string;
  strategyExposureId: string;
  strategyLabel: string;
  protocol: "mellow";
  primaryPoolId: string | null;
  poolLabel: string | null;
  poolMappingStatus: "confirmed" | "inferred" | "unknown";
  status: "active" | "closed" | "unknown";
  currentEstimatedValueUsd: number | null;
  depositedValueUsd: number;
  withdrawnValueUsd: number;
  currentSharesRaw: string;
  shareSymbol: string | null;
  totalRewardsUsd: number;
  realizedPnlUsd: number | null;
  unrealizedPnlUsd: number | null;
  totalReturnUsd: number | null;
  totalReturnPct: number | null;
  estimatedAnnualizedReturnPct: number | null;
  coverageStatus: "full" | "share_level" | "partial" | "unknown";
  confidence: "high" | "medium" | "low" | "degraded" | "unknown";
  coverageReasonCodes: string[];
};

type StrategyDetailView = StrategySummaryView & {
  wrapperAddress: string | null;
  stakingRewardsAddress: string | null;
  externalStrategyPositionReference: string | null;
  externalStrategyPositionReferenceStatus: "resolved" | "unresolved";
  sharesReceivedRaw: string;
  sharesRedeemedRaw: string;
  resolvedRewardCount: number;
  unresolvedRewardCount: number;
  history: Array<{ dayUtc: string; estimatedValueUsd: number | null; cumulativeRewardsUsd: number }>;
  rewards: StrategyRewardView[];
  lifecycle: StrategyLifecycleEventView[];
  coverageNote: {
    status: "full" | "share_level" | "partial" | "unknown";
    titleKey: string;
    bodyKey: string;
    reasonCodes: string[];
  };
};
```

## 5. Migration Plan

1. Add three strategy read-model tables and indexes.
2. Update `db-purge.ts` to delete strategy lifecycle/history/summary rows before `strategy_exposures` and `strategies`.
3. Add `materializeStrategyReadModels` and call it from `phase-finalize` after reward resolution and before pool/deposit read-model rebuild assertions.
4. Add `rebuild-strategy-read-models.ts` for rerunning materialization by `RUN_ID`.
5. Update pool and deposit rebuild order to support the final sequence: reward re-resolution, canonical inference, strategy rebuild, pool rebuild, deposit rebuild, snapshot rebuild.

## 6. Invariants

- A `strategy_wallet_summaries.total_rewards_usd` equals the sum of resolved `reward_events.amount_usd` for that `strategy_exposure_id`, excluding unresolved rows.
- A `deposit_wallet_summaries.total_rewards_usd` never includes a row where `reward_events.strategy_exposure_id` is non-null.
- A `pool_wallet_summaries.total_rewards_usd` equals resolved deposit rewards for the pool plus resolved strategy rewards for the pool, within rounding tolerance.
- A selected strategy with `coverage_status != full` must have non-empty coverage note content.
- No strategy lifecycle event may be reclassified as a manual deposit lifecycle event unless a separate manual deposit is proven by NFT identity.
