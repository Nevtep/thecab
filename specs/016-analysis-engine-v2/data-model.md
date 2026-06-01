# Data Model: Analysis Engine V2

## Modeling Principles

- Every identity is chain-scoped.
- Raw provider evidence, canonical evidence, semantic domain events, accounting, and read models are separate layers.
- Domain events link to explicit evidence only; missing evidence creates `enrichment_needs`.
- Existing DataView read-model tables may be reused, but their source must become Engine V2 domain events/accounting instead of screen-phase provider interpretations.
- Migrations must support clean local/dev rebuilds and deterministic fixture replay.

## Core Collection Tables

### `engine_v2_collection_runs`

Tracks wallet history collection.

Key fields:

- `id`
- `analysis_run_id`
- `chain_id`
- `wallet_address`
- `source_provider`
- `source_endpoint`
- `source_query_json`
- `status`
- `started_at`
- `completed_at`
- `provider_row_count`
- `distinct_tx_count`
- `duplicate_tx_count`
- `collection_version`
- `last_cursor`
- `coverage_status`
- `reason_codes`

Indexes:

- `(chain_id, wallet_address, status)`
- `(analysis_run_id)`

### `engine_v2_provider_pages`

Immutable provider page cache.

Key fields:

- `id`
- `collection_run_id`
- `chain_id`
- `wallet_address`
- `source_provider`
- `source_endpoint`
- `request_hash`
- `response_hash`
- `cursor_in`
- `cursor_out`
- `page_index`
- `raw_json`
- `fetched_at`

Unique:

- `(chain_id, wallet_address, source_provider, source_endpoint, request_hash)`

## Canonical Evidence Tables

### `canonical_transactions`

One deduplicated transaction per wallet/chain/hash.

Key fields:

- `id`
- `chain_id`
- `wallet_address`
- `tx_hash`
- `block_number`
- `block_timestamp`
- `transaction_index`
- `from_address`
- `to_address`
- `value_native_raw`
- `input`
- `receipt_status`
- `gas_used`
- `transaction_fee_native`
- `decoded_call_json`
- `source_provider`
- `source_endpoint`
- `source_cursor`
- `provider_page_id`
- `raw_provider_record_id`
- `collection_run_id`
- `canonicalized_at`

Unique:

- `(chain_id, wallet_address, tx_hash)`

Indexes:

- `(chain_id, wallet_address, block_number, transaction_index)`
- `(chain_id, tx_hash)`

### `canonical_transaction_logs`

One normalized log row.

Key fields:

- `id`
- `canonical_transaction_id`
- `chain_id`
- `tx_hash`
- `log_index`
- `address`
- `topic0`
- `topic1`
- `topic2`
- `topic3`
- `data`
- `decoded_event_json`
- `abi_id`
- `decode_status`
- `decode_confidence`
- `source_kind` (`wallet_history`, `nft_transfer_backfill`, `eth_getLogs_backfill`)

Unique:

- `(chain_id, tx_hash, log_index)`

Indexes:

- `(chain_id, address, topic0)`
- `(canonical_transaction_id, log_index)`

### `canonical_internal_transactions`

Internal traces provided by Moralis or backfilled sources.

Key fields:

- `id`
- `canonical_transaction_id`
- `chain_id`
- `tx_hash`
- `trace_index`
- `from_address`
- `to_address`
- `value_native_raw`
- `call_type`
- `gas`
- `error`
- `raw_json`

### `canonical_asset_movements`

Native, ERC20, ERC721, LP/share, and protocol movement evidence.

Key fields:

- `id`
- `canonical_transaction_id`
- `canonical_log_id`
- `canonical_internal_transaction_id`
- `chain_id`
- `wallet_address`
- `tx_hash`
- `movement_index`
- `asset_type` (`native`, `erc20`, `erc721`, `share`, `lp`, `unknown`)
- `token_address`
- `token_id`
- `from_address`
- `to_address`
- `amount_raw`
- `direction`
- `movement_kind`
- `metadata_status`
- `price_status`
- `value_usd_at_event`
- `evidence_json`

Indexes:

- `(chain_id, wallet_address, tx_hash)`
- `(chain_id, token_address, token_id)`

### `canonical_calls`

Decoded call tree for direct and nested calls.

Key fields:

- `id`
- `canonical_transaction_id`
- `chain_id`
- `tx_hash`
- `call_path`
- `parent_call_id`
- `target_address`
- `selector`
- `function_name`
- `decoded_args_json`
- `raw_call_data`
- `abi_id`
- `decode_status`
- `decode_confidence`
- `created_at`

Unique:

- `(chain_id, tx_hash, call_path)`

Rules:

- Direct tx input creates root call.
- `multicall(bytes[])` creates child rows.
- Domain events can link to exact child calls.

## ABI, Protocol, Token, And Price Tables

### `contract_abis`

Persisted ABI registry.

Key fields:

- `id`
- `chain_id`
- `address`
- `implementation_address`
- `contract_name`
- `protocol`
- `contract_kind`
- `abi_json`
- `source_provider`
- `source_url`
- `source_reference`
- `bytecode_hash`
- `is_proxy`
- `verified_at`
- `fetched_at`
- `updated_at`
- `metadata_json`

Unique:

- `(chain_id, address, implementation_address)`

### `contract_abi_selectors`

Function selector and event topic registry.

Key fields:

- `id`
- `contract_abi_id`
- `chain_id`
- `address`
- `selector_or_topic`
- `kind`
- `signature`
- `name`
- `input_types_json`
- `output_types_json`

Indexes:

- `(chain_id, address, selector_or_topic)`
- `(chain_id, selector_or_topic)`

### `protocol_contracts` / `protocol_known_addresses`

Existing registry should be extended if needed.

Required fields:

- `chain_id`
- `address`
- `protocol`
- `contract_kind`
- `label`
- `source_url`
- `source_label`
- `verified_at`
- `confidence`
- `metadata_json`

Usage:

- Bootstrap core Aerodrome/Mellow contracts.
- Store discovered pools, gauges, reward distributors, bribe/fee distributors, wrappers, strategies, helpers/sugar, grant distributors, and protocol-known addresses.

### `token_metadata`

Token display and trust metadata.

Key fields:

- `chain_id`
- `token_address`
- `symbol`
- `name`
- `decimals`
- `logo_url`
- `categories_json`
- `possible_spam`
- `verified_contract`
- `security_score`
- `wrapped_underlying_address`
- `source_provider`
- `updated_at`

### `price_points`

Existing table should be extended or normalized to include:

- `chain_id`
- `token_address`
- `priced_at`
- `block_number`
- `source_provider`
- `resolution`
- `price_usd`
- `source_pair_address`
- `exchange_name`
- `price_last_changed_block`
- `is_current`
- `divergence_status`
- `metadata_json`

## Semantic Domain Tables

### `domain_events`

Screen-independent classified event store.

Key fields:

- `id`
- `chain_id`
- `wallet_address`
- `tx_hash`
- `primary_log_index`
- `event_index`
- `occurred_at`
- `classifier_version`
- `event_type`
- `protocol`
- `surface`
- `status` (`supported`, `partial`, `unresolved`, `unsupported`, `excluded`)
- `coverage_status`
- `confidence`
- `value_usd`
- `entity_refs_json`
- `evidence_json`
- `reason_codes`
- `parent_domain_event_id`

Unique:

- `(chain_id, wallet_address, tx_hash, event_index, classifier_version)`

### `domain_event_links`

Explicit links from domain events to entities.

Key fields:

- `domain_event_id`
- `entity_type`
- `entity_id`
- `relationship_type`
- `evidence_status`
- `confidence`
- `reason_codes`

Rules:

- Link to pool/deposit/strategy/reward/governance only with explicit evidence.
- Missing link creates enrichment need or partial coverage.

### `transaction_classification_traces`

Debug/explainability trace for each classified transaction.

Key fields:

- `id`
- `canonical_transaction_id`
- `classifier_version`
- `classification_status`
- `matched_rules_json`
- `unmatched_rules_json`
- `reason_codes`
- `evidence_json`
- `created_at`

## Enrichment Tables

### `enrichment_needs`

Deduplicated analysis-time work queue.

Key fields:

- `id`
- `chain_id`
- `wallet_address`
- `need_type`
- `dedupe_key`
- `semantic_owner_type`
- `semantic_owner_id`
- `status`
- `priority`
- `source_event_id`
- `request_json`
- `response_ref`
- `attempt_count`
- `last_error`
- `retry_after`
- `created_at`
- `updated_at`

Unique:

- `(chain_id, need_type, dedupe_key)`

Need types:

- `abi_fetch`
- `selector_decode`
- `token_metadata`
- `historical_price`
- `current_price`
- `pool_definition`
- `pool_current_state`
- `position_current_state`
- `strategy_current_state`
- `lock_identity_backfill`
- `managed_lock_state`
- `distributor_pool_link`
- `transaction_decoded_backfill`
- `log_backfill`
- `lpsugar_state`

### `protocol_state_snapshots`

Persisted current-state/helper/sugar reads.

Key fields:

- `id`
- `chain_id`
- `wallet_address`
- `source_contract_address`
- `source_selector`
- `block_number`
- `request_json`
- `raw_result`
- `decoded_json`
- `fetched_at`
- `coverage_status`
- `confidence`

Usage:

- Aerodrome locks helper/sugar wallet-scoped state.
- LpSugar current pool/strategy/position state.
- VotingEscrow current lock state.

## Governance Tables

### `governance_locks`

Normalized lock identity.

Key fields:

- `id`
- `chain_id`
- `wallet_address`
- `voting_escrow_address`
- `lock_token_id`
- `created_at`
- `created_tx_hash`
- `origin_status`
- `origin_kind`
- `origin_source`
- `current_owner_address`
- `status`
- `managed_status`
- `locked_aero_amount`
- `ve_aero_amount`
- `expires_at`
- `coverage_status`
- `confidence`
- `metadata_json`

Unique:

- `(chain_id, voting_escrow_address, lock_token_id)`

### `governance_lock_managed_links`

Relationship between a user lock and managed/relay token.

Key fields:

- `id`
- `chain_id`
- `wallet_address`
- `voting_escrow_address`
- `lock_token_id`
- `managed_token_id`
- `managed_contract_address`
- `relay_address`
- `relation_status`
- `source_event_id`
- `source_tx_hash`
- `source_block_number`
- `source_contract_address`
- `source_selector`
- `source_snapshot_id`
- `coverage_status`
- `confidence`
- `reason_codes`
- `metadata_json`
- `created_at`
- `updated_at`

Rules:

- `managed_token_id` is not wallet-owned direct lock identity.
- `depositManaged(userTokenId, managedTokenId)` is the primary relation evidence.
- Helper/sugar/RPC current state can validate current status, not rewrite history.

### `governance_lock_events`

Lifecycle event per lock.

Types:

- `create_lock`
- `grant_mint`
- `grant_received`
- `external_transfer_in`
- `increase_amount`
- `extend_lock`
- `rebase_claim_relock`
- `deposit_managed`
- `withdraw_managed`
- `withdraw_lock`

Key fields:

- `id`
- `governance_lock_id`
- `domain_event_id`
- `event_type`
- `tx_hash`
- `log_index`
- `occurred_at`
- `token_id`
- `managed_token_id`
- `aero_amount`
- `value_usd`
- `expires_at_after`
- `coverage_status`
- `confidence`
- `evidence_json`

### `governance_reward_claim_items`

Itemized governance rewards.

Key fields:

- `id`
- `parent_domain_event_id`
- `reward_event_id`
- `chain_id`
- `wallet_address`
- `tx_hash`
- `log_index`
- `reward_type`
- `token_address`
- `amount_raw`
- `amount_decimal`
- `value_usd_at_claim`
- `liquid`
- `value_effect`
- `cash_flow_kind`
- `epoch_id`
- `pool_id`
- `lock_token_id`
- `bribe_contract_address`
- `source_log_index`
- `source_contract_address`
- `source_contract_kind`
- `parent_call_id`
- `dedupe_key`
- `affects_totals`
- `coverage_status`
- `confidence`
- `evidence_json`

Rules:

- Claim-all tx may have one parent domain event and many claim items.
- Rebase relock items are non-liquid and do not create cash-in.
- Pool association remains null/partial until explicit distributor link exists.

### `protocol_reward_distributor_pool_links`

Protocol-level distributor/gauge/pool mapping.

Key fields:

- `id`
- `chain_id`
- `voter_address`
- `pool_address`
- `gauge_address`
- `distributor_address`
- `distributor_kind`
- `pool_factory_address`
- `voting_rewards_factory_address`
- `gauge_factory_address`
- `created_tx_hash`
- `created_log_index`
- `created_block_number`
- `source_event_signature`
- `validated_by_call`
- `validation_block_number`
- `coverage_status`
- `confidence`
- `evidence_json`

Rules:

- Build from `Voter.GaugeCreated` or equivalent registry evidence.
- Do not infer pool from token pair, time window, recent vote, or UI label.

## Accounting Tables

### `accounting_lots`

Chronological inventory/cost basis lots.

Key fields:

- `id`
- `chain_id`
- `wallet_address`
- `source_domain_event_id`
- `source_movement_id`
- `token_address`
- `amount_raw_initial`
- `amount_raw_remaining`
- `value_usd_at_event`
- `lot_kind`
- `entity_context_type`
- `entity_context_id`
- `opened_at`
- `closed_at`
- `coverage_status`
- `reason_codes`

### `residual_inventory_records`

Residual token inventory after withdrawals, swaps, and unresolved allocation.

Key fields:

- `id`
- `chain_id`
- `wallet_address`
- `token_address`
- `source_event_id`
- `source_pool_id`
- `source_deposit_id`
- `source_strategy_exposure_id`
- `amount_raw_remaining`
- `value_usd_at_source`
- `allocation_status`
- `created_at`
- `updated_at`

### Existing read model/accounting targets

Use or extend existing read models:

- Activity: `ledger_events`, `asset_movements`, activity detail/evidence tables if present.
- Deposits: `deposits`, `deposit_lifecycle_events`, `deposit_wallet_summaries`, `deposit_performance_decompositions`.
- Strategies: `strategies`, `strategy_exposures`, `strategy_lifecycle_events`, `strategy_wallet_summaries`, `strategy_history_snapshots`.
- Pools: `pools`, `pool_timeline_events`, `pool_wallet_summaries`, `pool_history_snapshots`.
- Rewards: `reward_events`, reward detail/link tables.
- Governance: `governance_events`, `governance_lock_exposures`, `governance_epoch_summaries`, `governance_reward_rows`, `governance_metric_snapshots`.

Rules:

- These read models must be materialized from `domain_events`, explicit links, enrichment results, and accounting outputs.
- They must not parse provider payloads independently.
- They must include coverage/confidence/reason codes.

## State Transitions

### Analysis run

```text
queued -> collecting -> canonicalizing -> decoding -> classifying -> enriching
  -> accounting -> materializing -> complete
  -> partial_complete | failed | cancelled
```

### Enrichment need

```text
pending -> in_progress -> resolved
pending -> in_progress -> unavailable
pending -> in_progress -> failed_retryable -> pending
pending -> in_progress -> failed_terminal
```

### Domain event status

```text
supported | partial | unresolved | unsupported | excluded
```

### Governance lock origin

```text
observed_create_lock
observed_transfer_in
resolved_from_nft_transfer_history
protocol_grant_lock_received
missing_origin
unknown_external_source
```

## Migration Requirements

- Add migrations for all new canonical/domain/enrichment/accounting tables.
- Add indexes for chronological wallet processing and natural dedupe keys.
- Add foreign keys where safe; if some read models store cross-version references, use soft references plus integrity tests.
- Extend existing `price_points`, `pools`, `reward_events`, and governance tables only where needed for Engine V2 outputs.
- Add migration metadata compatible with existing Drizzle migration flow.
- Add guarded local/dev purge support for Engine V2 tables and optionally all analysis/read-model tables for clean-slate validation.
