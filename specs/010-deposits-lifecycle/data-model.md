# Data Model: Deposits Lifecycle

**Feature**: `010-deposits-lifecycle`
**Date**: 2026-05-27
**Authority**: This document defines the wallet-scoped read models required for the Deposits feature. Existing normalized analysis tables remain the source of truth. The three new tables are materialized projections written by `phase-finalize` and consumed only by Deposits APIs.

## 1. Source-Of-Truth Inputs (Existing)

The Deposits feature derives from existing normalized entities only:

- `deposits` (manual Aerodrome positions, NFT-keyed)
- `pools`
- `protocol_contracts`
- `ledger_events`
- `asset_movements`
- `reward_events`
- `attribution_states`, `attribution_source_lots`
- `inferred_actions` (canonical higher-order outcomes)
- `strategies`, `strategy_exposures` (cross-link only, never embedded as deposit lifecycle)
- `price_points`
- `analysis_runs`, `wallet_contexts`
- Existing protocol-position read-model fields surfaced via `readAerodromeManualPositions` (range bounds, tick bounds, `isInRange`)

These remain authoritative. New tables may be rebuilt from them at any time.

## 2. New Read-Model Tables

### 2.1 `deposit_wallet_summaries` (NEW)

One current row per `(chainId, walletAddress, depositId)` powering the list, KPI strip, and detail header.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | Surrogate. |
| `chain_id` | `integer` not null | Chain-aware identity. |
| `wallet_address` | `varchar(42)` not null | Lowercased authenticated wallet. |
| `deposit_id` | `uuid` FK → `deposits.id` not null | Position identity. |
| `pool_id` | `uuid` FK → `pools.id` not null | Pool the position belongs to. |
| `nft_token_id` | `numeric(78,0)` nullable | Full Aerodrome NFT id (string-serializable). |
| `short_token_id` | `varchar(16)` not null | Collision-safe display form for FR-003a label. |
| `position_label` | `varchar(96)` not null | Deterministic `{t0}/{t1}-{poolKind} #{shortTokenId}` (FR-003a). |
| `pool_kind` | `varchar(16)` not null | `cl` or `basic_stable` or `basic_volatile`. |
| `tick_spacing` | `integer` nullable | Present iff `pool_kind = 'cl'`. |
| `fee_tier_bps` | `integer` nullable | Pool fee tier basis points when applicable. |
| `token0_address` | `varchar(42)` not null | |
| `token1_address` | `varchar(42)` not null | |
| `token0_symbol` | `varchar(32)` not null | |
| `token1_symbol` | `varchar(32)` not null | |
| `latest_run_id` | `uuid` FK → `analysis_runs.id` not null | Materialization provenance. |
| `covered_start_day_utc` | `varchar(10)` not null | Earliest covered day. |
| `covered_end_day_utc` | `varchar(10)` not null | Latest covered day. |
| `opened_at` | `timestamptz` not null | First lifecycle event (mint or transfer-in). |
| `closed_at` | `timestamptz` nullable | Null for open positions. |
| `status` | `varchar(16)` not null | `open_active` or `closed`. |
| `opened_by_transfer_in` | `boolean` not null default `false` | FR-002a flag. |
| `current_value_usd` | `numeric(38,18)` not null default `'0'` | For open positions; mirrors closed_value_usd for closed. |
| `closed_value_usd` | `numeric(38,18)` nullable | Set when `status = 'closed'`. |
| `opened_value_usd` | `numeric(38,18)` not null default `'0'` | Net contributed principal at opening for headline use (FR-022). |
| `capital_entered_usd` | `numeric(38,18)` not null default `'0'` | Gross lifetime in (used by decomposition only). |
| `capital_withdrawn_usd` | `numeric(38,18)` not null default `'0'` | Gross lifetime out (used by decomposition only). |
| `total_rewards_usd` | `numeric(38,18)` not null default `'0'` | Covered rewards attributable to this deposit. |
| `realized_pnl_usd` | `numeric(38,18)` nullable | Set when reconstructable. |
| `unrealized_pnl_usd` | `numeric(38,18)` nullable | Set when reconstructable. |
| `total_return_usd` | `numeric(38,18)` not null default `'0'` | `current_or_closed_value + total_rewards − capital_entered + capital_withdrawn` (engine-computed). |
| `total_return_pct` | `numeric(12,6)` nullable | Signed percent vs `opened_value_usd`. |
| `estimated_annualized_return_pct` | `numeric(12,6)` nullable | Signed annualized estimate. |
| `range_lower_price` | `numeric(38,18)` nullable | Token1-denominated (FR-021); CL only. |
| `range_upper_price` | `numeric(38,18)` nullable | Token1-denominated; CL only. |
| `tick_lower` | `integer` nullable | CL only. |
| `tick_upper` | `integer` nullable | CL only. |
| `is_in_range` | `boolean` nullable | CL only; null when range data unavailable. |
| `coverage_status` | `varchar(24)` not null default `'unknown'` | `full | share_level | partial | unknown`. |
| `confidence` | `varchar(16)` not null default `'unknown'` | `high | medium | low | degraded | unknown`. |
| `coverage_reason_codes` | `text[]` not null default `'{}'` | E.g. `missingHistoricalPrice`, `transferInOrigin`, `unresolvedRewardClaim`, `lowConfidenceClassification`, `priceUnavailable`, `coverageGap`. |
| `mellow_strategy_cross_link_id` | `uuid` FK → `strategies.id` nullable | FR-012a target; null when no strategy exposure in the same pool. |
| `metadata_json` | `jsonb` not null default `{}` | Token logos, fee-tier display, lifecycle counts, last claim summary, sparkline series id refs, UI helper fields. |
| `created_at` / `updated_at` | `timestamptz` | |

**Unique index** `deposit_wallet_summaries_identity_uidx` ON `(chain_id, wallet_address, deposit_id)`.

**Supporting indexes**:
- `(chain_id, wallet_address, status)` — list status filter
- `(chain_id, wallet_address, pool_id)` — Pools→Deposits cross-link (FR-018)
- `(chain_id, wallet_address, opened_at DESC)` — default sort (FR-005a)
- `(chain_id, wallet_address, total_return_pct)` — positive/negative return filter
- `(chain_id, wallet_address, coverage_status)` — coverage-aware filters

### 2.2 `deposit_lifecycle_events` (NEW)

Chronologically ordered rows per deposit powering the lifecycle timeline (FR-008) and the "View all events" expander.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `chain_id` | `integer` not null | |
| `wallet_address` | `varchar(42)` not null | |
| `deposit_id` | `uuid` FK → `deposits.id` not null | |
| `sequence_index` | `integer` not null | Stable per deposit, 1-based. |
| `latest_run_id` | `uuid` FK → `analysis_runs.id` not null | Provenance. |
| `event_type` | `varchar(32)` not null | Restricted to the manual-position event set (FR-013): `mint_position`, `increase_liquidity`, `stake`, `claim_reward`, `unstake`, `decrease_liquidity`, `collect_fees`, `withdraw`, `burn`, `close`, `transfer_in`. |
| `occurred_at` | `timestamptz` not null | Block timestamp. |
| `tx_hash` | `varchar(66)` not null | |
| `log_index` | `integer` not null | Tie-breaker within a tx. |
| `block_number` | `bigint` not null | |
| `usd_value` | `numeric(38,18)` nullable | Total signed USD impact at event time. |
| `signed_token_deltas` | `jsonb` not null default `'[]'` | Array of `{ tokenAddress, symbol, direction: 'in'|'out', amountRaw, amountFormatted, usdValue, priceSource }`. |
| `price_source` | `varchar(24)` nullable | E.g. `alchemyHistorical`, `pricePointFallback`, `unavailable`. |
| `confidence` | `varchar(16)` not null default `'unknown'` | |
| `inferred_action_id` | `uuid` FK → `inferred_actions.id` nullable | Links rebalance/redeploy narratives. |
| `coverage_reason_codes` | `text[]` not null default `'{}'` | |
| `metadata_json` | `jsonb` not null default `{}` | Counterparty hints, gauge address for stake/unstake, claim source, etc. |
| `created_at` | `timestamptz` | |

**Unique index** `deposit_lifecycle_events_identity_uidx` ON `(chain_id, wallet_address, deposit_id, sequence_index)`.

**Supporting indexes**:
- `(chain_id, wallet_address, deposit_id, occurred_at)` — chronological scan
- `(chain_id, wallet_address, deposit_id, event_type)` — filter inside timeline

### 2.3 `deposit_performance_decompositions` (NEW)

One current row per `(chainId, walletAddress, depositId)` carrying the reconciled performance breakdown and the explicit `unattributed` residual (FR-011a).

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `chain_id` | `integer` not null | |
| `wallet_address` | `varchar(42)` not null | |
| `deposit_id` | `uuid` FK → `deposits.id` not null | |
| `latest_run_id` | `uuid` FK → `analysis_runs.id` not null | |
| `total_return_usd` | `numeric(38,18)` not null default `'0'` | Mirrors summary row; persisted for reconciliation invariant. |
| `rewards_usd` | `numeric(38,18)` not null default `'0'` | Attributed rewards (incl. fee collection). |
| `fees_usd` | `numeric(38,18)` not null default `'0'` | Pool fees collected. |
| `asset_price_effect_usd` | `numeric(38,18)` not null default `'0'` | Pure asset-price movement on capital still inside the LP between events (continuous, non-event-triggered drift). |
| `rebalance_effect_usd` | `numeric(38,18)` not null default `'0'` | **Rebalance / impermanent-loss effect.** Materializes at each `decrease_liquidity` / `close` / `burn` event as the (LP value at event − HODL benchmark at event) delta, valued at observed prices at the event block per FR-011b. Captures both range exits in CL pools and standard IL in basic pools. |
| `realized_pnl_usd` | `numeric(38,18)` not null default `'0'` | Realized PnL on **post-withdrawal swaps** of underlying tokens: swap proceeds USD minus the withdrawal-block cost basis of the same token. Excludes the IL component already booked in `rebalance_effect_usd`. |
| `unrealized_pnl_usd` | `numeric(38,18)` not null default `'0'` | Unrealized PnL on tokens withdrawn from the LP and still held by the wallet at read time: (current price − withdrawal-block cost basis) × amount still held. |
| `unattributed_usd` | `numeric(38,18)` not null default `'0'` | **MUST equal** `total_return_usd − (rewards + fees + asset_price_effect + rebalance_effect + realized + unrealized)` (FR-011a). |
| `unattributed_reason_codes` | `text[]` not null default `'{}'` | E.g. `missingHistoricalPrice`, `unresolvedRewardClaim`, `coverageGap`, `lowConfidenceClassification`, `priceUnavailable`. |
| `component_percentages` | `jsonb` not null default `{}` | Pre-computed percentages of `total_return_usd` for each bar; UI consumes as-is. |
| `created_at` / `updated_at` | `timestamptz` | |

**Unique index** `deposit_performance_decompositions_identity_uidx` ON `(chain_id, wallet_address, deposit_id)`.

**Reconciliation invariant** (engine-enforced and test-enforced): for every row,
`abs(total_return_usd − (rewards_usd + fees_usd + asset_price_effect_usd + rebalance_effect_usd + realized_pnl_usd + unrealized_pnl_usd + unattributed_usd)) ≤ 1e-9`.

## 3. Materialization Rules

1. **Source-of-funds**: lifecycle events are derived from `ledger_events` + `asset_movements` filtered to `deposits.tokenId` and the manual-position event set; gauge contract transfers are classified as `stake`/`unstake` per existing engine rules (analysis-engine-history-notes #3/#4).
2. **Transfer-in (FR-002a)**: when the first event for a `tokenId` is a wallet-inbound NFT transfer, `opened_by_transfer_in = true`, `opened_value_usd` and `capital_entered_usd` are valued at the transfer-in event using `price_points`, `confidence = degraded`, `coverage_reason_codes += [transferInOrigin]`.
3. **Net vs gross (FR-022)**: `opened_value_usd` is net contributed principal (`capital_entered_usd - capital_withdrawn_usd`) clamped at the opening event for headline; gross values stay in their dedicated columns for the decomposition.
4. **Rewards backfill (FR-025)**: for each `reward_events` row attributed to the deposit with `amount_usd IS NULL`, recompute USD via `amount_raw + token_address + price_points` for the claim day; if no historical price exists, the lifecycle event row carries `price_source = 'unavailable'` and `coverage_reason_codes += [priceUnavailable]`.
5. **CL range (FR-021)**: copy `rangeLowerPrice`, `rangeUpperPrice`, `tickLower`, `tickUpper`, latest `isInRange` from `readAerodromeManualPositions` outputs; for basic pools and unavailable CL data, set null and propagate `coverage_reason_codes += [rangeUnavailable]` when degrading confidence.
6. **Strategies cross-link (FR-012a)**: if any `strategy_exposures` row exists for `(chainId, walletAddress)` whose strategy's `primary_pool_id = pool_id`, persist that `strategies.id` into `mellow_strategy_cross_link_id`; otherwise null.
7. **Reconciliation (FR-011a)**: compute attributed components first, then set `unattributed_usd = total_return_usd − Σ(attributed)`. Reason codes are aggregated from the component-level signals.
8. **Coverage**: `coverage_status` is derived from event coverage (price availability, classification confidence, attribution certainty); `partial` if any reason code present; `share_level` reserved for Strategies and not used here.
9. **Closure**: `status = 'closed'` and `closed_at` set when terminal sequence is `burn`, `close`, or a `decrease_liquidity` that drains the position to zero followed by a `collect_fees`/`withdraw`. Otherwise `open_active`.
10. **Withdrawal pricing & impermanent-loss materialization (FR-011b)**: every `decrease_liquidity` / `withdraw` / `close` / `burn` lifecycle event MUST persist `signed_token_deltas[].usdValue` using the price observed at the event block. When the position is **out of range** at the event (CL only) and the withdrawal is single-asset, the single token MUST still be valued at its observed price at that block; when no observation exists at the block, the materializer MUST fall back to the nearest `price_points` value within the configured tolerance window and add `priceFallbackDca` to `coverage_reason_codes` (never a future / latest price beyond that window, never a constant peg assumption). At each such event, the materializer MUST also compute the **realized impermanent-loss contribution** as `(LP_value_at_event − HODL_basket_value_at_event)` where the HODL basket is the entry-weighted reference token amounts the wallet would have held if it had never deposited, both valued at the event-block prices, and add the result to `rebalance_effect_usd`. For CFMM pools the LP value follows `x·y = k`; for CL pools it follows the standard Uniswap-v3 tick formula using the position's `(L, tickLower, tickUpper)`. Any subsequent swap of the withdrawn underlying tokens MUST contribute to `realized_pnl_usd` only (`swap_proceeds_usd − withdrawal_block_cost_basis_usd`) and MUST NOT be re-attributed to `rebalance_effect_usd`, preventing double-counting of IL.
11. **Capital flow vs return attribution**: `capital_entered_usd` and `capital_withdrawn_usd` are persisted on `deposit_wallet_summaries` as gross flow magnitudes for the Performance panel's contextual Capital flow strip (FR-011 split (a)); they are NOT included in the reconciliation invariant in §2.3 and MUST NOT be rendered inside the reconciling Return attribution stack.

## 4. Migration Plan

1. New migration adds the three tables, indexes, and FKs.
2. `apps/web/src/server/scripts/db-purge.ts` is updated to delete `deposit_lifecycle_events`, `deposit_performance_decompositions`, and `deposit_wallet_summaries` BEFORE `deposits`, `ledger_events`, `asset_movements`, `reward_events`, `inferred_actions` in the FK-safe purge order (analysis-engine-history-notes purge rule).
3. `phase-finalize` invokes `materializeDepositReadModels(runContext)` chunked per deposit; chunked inserts mirror the Pools-history fix to avoid `mergeQueries` overflow (analysis-engine-history-notes #19).
4. Backfill for existing analyzed wallets is handled by re-running `phase-finalize` on the next analysis trigger; no destructive rewrites of legacy tables.

## 5. View Models (UI Shape)

The repository returns view-model-friendly shapes; mappers in `features/deposits/deposits.mappers.ts` apply locale formatting.

```ts
type DepositSummaryView = {
  id: string;
  positionLabel: string;
  poolId: string;
  poolName: string;
  poolKind: "cl" | "basic_stable" | "basic_volatile";
  status: "open_active" | "closed";
  openedAt: string;
  closedAt: string | null;
  openedValueUsd: number;          // net headline (FR-022)
  currentOrClosedValueUsd: number;
  totalRewardsUsd: number;
  realizedPnlUsd: number;          // exposed for FR-L04 row column
  unrealizedPnlUsd: number;        // exposed for FR-L04 row column
  totalReturnUsd: number;
  totalReturnPct: number | null;
  estimatedAnnualizedReturnPct: number | null;
  coverageStatus: CoverageStatus;
  confidence: Confidence;
  coverageReasonCodes: string[];
  openedByTransferIn: boolean;
  isInRange: boolean | null;
};

type DepositDetailView = DepositSummaryView & {
  tickLower: number | null;
  tickUpper: number | null;
  rangeLowerPrice: number | null;   // token1-denominated
  rangeUpperPrice: number | null;
  feeTierBps: number | null;
  token0: { address: string; symbol: string };
  token1: { address: string; symbol: string };
  capitalEnteredUsd: number;        // gross, decomposition-only
  capitalWithdrawnUsd: number;      // gross, decomposition-only
  decomposition: {
    totalReturnUsd: number;
    rewardsUsd: number;
    feesUsd: number;
    assetPriceEffectUsd: number;
    rebalanceEffectUsd: number;
    realizedPnlUsd: number;
    unrealizedPnlUsd: number;
    unattributedUsd: number;        // reconciles exactly (FR-011a)
    unattributedReasonCodes: string[];
    componentPercentages: Record<string, number>;
  };
  lifecycle: DepositLifecycleEventView[];
  mellowStrategyCrossLinkId: string | null;
};
```

## 6. Read-time derivations (no new tables)

- **Value chart series (FR-009).** The detail route derives the event-anchored value chart series at read time from the ordered `deposit_lifecycle_events` rows for the deposit. No new persisted table is introduced. The derivation rules are:
  - One `openedValue` point at the position-open event using net opened USD (FR-022).
  - One `additionalCapital` point per subsequent `increase_liquidity` event.
  - One `rewards` point per `claim_reward` / `collect_fees` event (cumulative running sum).
  - One `withdrawal` point per `decrease_liquidity` event.
  - One `closedValue` point at the close event (if status = `closed`).
  - One `currentValue` point at `coveredRange.endDayUtc` for open positions.
  - `gaps[]` is emitted when consecutive events span an uncovered window (per `coverage_status = partial` flags on either side), each gap carrying the engine’s reason code; the client renders these as broken segments and a `CabPartialCoverageNotice`.
- **Per-event movement table (FR-010).** The detail route returns `lifecycle[].signedTokenDeltas` as the table source. No additional aggregation table is introduced.
