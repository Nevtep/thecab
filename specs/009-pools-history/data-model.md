# Data Model: Analyzed Pools History

**Feature**: `009-pools-history`  
**Date**: 2026-05-25  
**Authority**: This document defines the wallet-scoped read models required for the Pools feature. Existing normalized protocol tables remain the source of truth. The new tables are materialized projections written by background analysis and consumed by DB-backed Pools APIs.

## 1. Source-Of-Truth Inputs (Existing)

The Pools feature continues to derive from existing normalized entities:

- `pools`
- `deposits`
- `strategies`
- `strategy_exposures`
- `ledger_events`
- `asset_movements`
- `reward_events`
- `attribution_states`
- `attribution_source_lots`
- `performance_snapshots`
- `pool_metrics_snapshots`
- `coverage_reports`
- `wallet_contexts`

These tables remain authoritative. Pools read models may be rebuilt from them at any time.

## 2. New Read-Model Tables

### 2.1 `pool_wallet_summaries` (NEW)

One current row per `(chainId, walletAddress, poolId)` used by the Pools list and pool header.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | Surrogate key. |
| `chain_id` | `integer` not null | Chain-aware identity. |
| `wallet_address` | `varchar(42)` not null | Lowercased authenticated wallet. |
| `pool_id` | `uuid` FK -> `pools.id` not null | Pool identity. |
| `latest_run_id` | `uuid` FK -> `analysis_runs.id` not null | Provenance of latest materialization. |
| `covered_start_day_utc` | `varchar(10)` not null | Earliest covered day in this summary. |
| `covered_end_day_utc` | `varchar(10)` not null | Latest covered day in this summary. |
| `first_participated_at` | `timestamptz` nullable | Earliest known pool participation event. |
| `last_participated_at` | `timestamptz` nullable | Latest known lifecycle event. |
| `status` | `varchar(24)` not null default `'unknown'` | `active | inactive | closed | unknown`. |
| `exposure_mix` | `varchar(24)` not null default `'unknown'` | `manual | automated | mixed | residual_only | unknown`. |
| `coverage_status` | `varchar(24)` not null default `'unknown'` | `full | share_level | partial | unknown`. |
| `current_attributed_value_usd` | `numeric(38,18)` not null default `'0'` | Total current pool value. |
| `current_deployed_value_usd` | `numeric(38,18)` not null default `'0'` | Actively deployed value. |
| `current_residual_value_usd` | `numeric(38,18)` not null default `'0'` | Wallet-held residual attribution. |
| `current_manual_value_usd` | `numeric(38,18)` not null default `'0'` | Manual deposit contribution. |
| `current_strategy_value_usd` | `numeric(38,18)` not null default `'0'` | Automated strategy contribution. |
| `capital_entered_usd` | `numeric(38,18)` not null default `'0'` | Lifetime covered capital in. |
| `capital_withdrawn_usd` | `numeric(38,18)` not null default `'0'` | Lifetime covered capital out. |
| `realized_pnl_usd` | `numeric(38,18)` nullable | Covered realized PnL if reconstructable. |
| `unrealized_pnl_usd` | `numeric(38,18)` nullable | Covered unrealized PnL if reconstructable. |
| `total_rewards_usd` | `numeric(38,18)` not null default `'0'` | Covered rewards attributable to this pool. |
| `annualized_return_pct` | `numeric(12,6)` nullable | Historical capital-aware estimate. |
| `metadata_json` | `jsonb` not null default `{}` | Token labels, fee tier labels, current composition summary, strategy counts, deposit counts, coverage reason codes, active range status, UI helper fields. |
| `created_at` / `updated_at` | `timestamptz` | |

**Unique index** `pool_wallet_summaries_identity_uidx` ON `(chain_id, wallet_address, pool_id)`.

**Supporting indexes**:
- `(chain_id, wallet_address, status)` for active/closed filters
- `(chain_id, wallet_address, coverage_status)` for partial/share-level filters
- `(chain_id, wallet_address, updated_at)` for latest list refresh ordering

### 2.2 `pool_history_snapshots` (NEW)

One daily row per `(chainId, walletAddress, poolId, dayUtc)` used by pool detail charts and range-bound metrics.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `chain_id` | `integer` not null | |
| `wallet_address` | `varchar(42)` not null | |
| `pool_id` | `uuid` FK -> `pools.id` not null | |
| `day_utc` | `varchar(10)` not null | Daily resolution only. |
| `latest_run_id` | `uuid` FK -> `analysis_runs.id` not null | Materialization provenance. |
| `coverage_status` | `varchar(24)` not null default `'unknown'` | |
| `total_value_usd` | `numeric(38,18)` not null default `'0'` | Total attributed exposure. |
| `deployed_value_usd` | `numeric(38,18)` not null default `'0'` | Active pool deployment. |
| `residual_value_usd` | `numeric(38,18)` not null default `'0'` | Residual attributed assets. |
| `manual_value_usd` | `numeric(38,18)` not null default `'0'` | Manual segment. |
| `strategy_value_usd` | `numeric(38,18)` not null default `'0'` | Automated segment. |
| `reward_value_usd` | `numeric(38,18)` not null default `'0'` | Daily reward value or covered reward movement for the day. |
| `cumulative_rewards_usd` | `numeric(38,18)` not null default `'0'` | Cumulative covered rewards through the day. |
| `capital_in_usd` | `numeric(38,18)` not null default `'0'` | Day-level capital entering the pool. |
| `capital_out_usd` | `numeric(38,18)` not null default `'0'` | Day-level capital leaving the pool. |
| `pnl_usd` | `numeric(38,18)` nullable | If reconstructable for that day. |
| `annualized_return_pct` | `numeric(12,6)` nullable | Optional day-scoped estimate. |
| `metadata_json` | `jsonb` not null default `{}` | Composition snapshot, event marker counts, segment coverage, token mix, range availability flags, covered reason codes. |
| `created_at` | `timestamptz` | |

**Unique index** `pool_history_snapshots_identity_uidx` ON `(chain_id, wallet_address, pool_id, day_utc)`.

**Supporting indexes**:
- `(chain_id, wallet_address, pool_id, day_utc)` for range scans
- `(chain_id, wallet_address, day_utc)` for rebuild and integrity checks

### 2.3 `pool_timeline_events` (NEW)

One grouped, user-facing timeline row per attributable pool event. This table exists because grouped rebalance and redeploy events should not be reconstructed on every request.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `chain_id` | `integer` not null | |
| `wallet_address` | `varchar(42)` not null | |
| `pool_id` | `uuid` FK -> `pools.id` not null | |
| `latest_run_id` | `uuid` FK -> `analysis_runs.id` not null | Provenance. |
| `event_key` | `varchar(128)` not null | Deterministic grouped identity for idempotent rebuilds. |
| `event_type` | `varchar(32)` not null | `deposit | increase | withdraw | claim | rebalance | redeploy | strategy_deposit | strategy_withdraw | strategy_claim | partial_swap_attribution | close | other`. |
| `occurred_at` | `timestamptz` not null | Display order anchor. |
| `source_ledger_event_id` | `uuid` FK -> `ledger_events.id` nullable | Primary provenance when one event anchors the group. |
| `related_deposit_id` | `uuid` FK -> `deposits.id` nullable | Manual lifecycle link where relevant. |
| `related_strategy_id` | `uuid` FK -> `strategies.id` nullable | Strategy link where relevant. |
| `confidence` | `varchar(16)` not null default `'medium'` | `high | medium | low`. |
| `coverage_status` | `varchar(24)` not null default `'unknown'` | `full | share_level | partial | unknown`. |
| `attributed_value_usd` | `numeric(38,18)` nullable | Attributable economic value of the grouped event. |
| `metadata_json` | `jsonb` not null default `{}` | Token movements, partial attribution flags, explanation fragments, tx hashes, before/after value, linked event IDs, explorer references. |
| `created_at` / `updated_at` | `timestamptz` | |

**Unique index** `pool_timeline_events_identity_uidx` ON `(chain_id, wallet_address, pool_id, event_key)`.

**Supporting indexes**:
- `(chain_id, wallet_address, pool_id, occurred_at desc)` for detail timeline queries
- `(chain_id, wallet_address, latest_run_id)` for rebuild cleanup

## 3. Materialization Rules

### 3.1 Write timing

Pool read models are written only by the analysis pipeline after normalized source tables have been updated. They are not mutated by route handlers.

### 3.2 Phase ownership

- Existing normalized reconstruction remains in `phase.deposits`, `phase.rewards`, `phase.activity`, and `phase.pools`.
- A new finalization-side service `materializePoolReadModels()` writes `pool_wallet_summaries`, `pool_history_snapshots`, and `pool_timeline_events` from normalized tables before the run is marked complete.
- The analysis API contract remains unchanged; Pools read models are an implementation detail of successful finalization.

### 3.3 Rebuild behavior

- Materialization is idempotent per `(chainId, walletAddress, latestRunId)`.
- Re-running analysis for the same wallet replaces prior read-model rows for that wallet and chain.
- Read models may be rebuilt by a maintenance script without re-fetching providers, using only normalized DB records.

## 4. Relationship To Existing Snapshot Tables

### 4.1 `performance_snapshots`

`performance_snapshots(scope = 'pool')` remains useful as a generic cross-feature performance surface, but it is not sufficient alone for Pools UI because it does not encode segment breakdowns, grouped lifecycle events, or correct historical pool values under the current implementation.

### 4.2 `pool_metrics_snapshots`

`pool_metrics_snapshots` remains protocol-level and pool-centric, not wallet-centric. It can still support context such as TVL, fees, and volume, but it does not replace wallet-scoped pool history.

## 5. API Read Shapes Enabled By This Model

- `GET /api/pools` can serve list cards directly from `pool_wallet_summaries` joined to `pools` and optional related pool metadata.
- `GET /api/pools/:poolId` can serve current header metrics from `pool_wallet_summaries`, chart series from `pool_history_snapshots`, and lifecycle/rebalance activity from `pool_timeline_events`.
- No provider calls are required in request flow.

## 6. Analysis Extension Requirement

The current engine is not yet sufficient for the full Pools feature without extension. Specifically:

- `computeSnapshots()` currently reuses the latest pool total across all daily pool rows in the covered range.
- There is no wallet-scoped materialized pool timeline for grouped rebalance and redeploy display.
- There is no summary table optimized for list filters and current metric cards.

This feature therefore requires analysis extension, but the extension is additive and stays inside the existing background pipeline.