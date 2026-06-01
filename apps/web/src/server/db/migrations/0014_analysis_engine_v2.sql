CREATE TABLE IF NOT EXISTS "engine_v2_collection_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "analysis_run_id" uuid REFERENCES "analysis_runs"("id") ON DELETE cascade,
  "chain_id" integer NOT NULL,
  "wallet_address" varchar(42) NOT NULL,
  "source_provider" varchar(32) DEFAULT 'moralis' NOT NULL,
  "source_endpoint" text NOT NULL,
  "source_query_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" varchar(24) DEFAULT 'queued' NOT NULL,
  "provider_row_count" integer DEFAULT 0 NOT NULL,
  "distinct_tx_count" integer DEFAULT 0 NOT NULL,
  "duplicate_tx_count" integer DEFAULT 0 NOT NULL,
  "collection_version" varchar(32) DEFAULT 'engine-v2.0' NOT NULL,
  "last_cursor" text,
  "coverage_status" varchar(24) DEFAULT 'unknown' NOT NULL,
  "reason_codes" text[] DEFAULT '{}'::text[] NOT NULL,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "engine_v2_collection_runs_wallet_idx"
  ON "engine_v2_collection_runs" ("chain_id","wallet_address","status");
CREATE INDEX IF NOT EXISTS "engine_v2_collection_runs_analysis_run_idx"
  ON "engine_v2_collection_runs" ("analysis_run_id");

CREATE TABLE IF NOT EXISTS "engine_v2_provider_pages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "collection_run_id" uuid NOT NULL REFERENCES "engine_v2_collection_runs"("id") ON DELETE cascade,
  "chain_id" integer NOT NULL,
  "wallet_address" varchar(42) NOT NULL,
  "source_provider" varchar(32) NOT NULL,
  "source_endpoint" text NOT NULL,
  "request_hash" varchar(64) NOT NULL,
  "response_hash" varchar(64) NOT NULL,
  "cursor_in" text,
  "cursor_out" text,
  "page_index" integer NOT NULL,
  "raw_json" jsonb NOT NULL,
  "fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "engine_v2_provider_pages_request_uidx"
  ON "engine_v2_provider_pages" ("chain_id","wallet_address","source_provider","request_hash");
CREATE INDEX IF NOT EXISTS "engine_v2_provider_pages_run_idx"
  ON "engine_v2_provider_pages" ("collection_run_id","page_index");

CREATE TABLE IF NOT EXISTS "canonical_transactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "chain_id" integer NOT NULL,
  "wallet_address" varchar(42) NOT NULL,
  "tx_hash" varchar(66) NOT NULL,
  "block_number" numeric(38,0) NOT NULL,
  "block_timestamp" timestamp with time zone NOT NULL,
  "transaction_index" integer DEFAULT 0 NOT NULL,
  "from_address" varchar(42),
  "to_address" varchar(42),
  "value_native_raw" numeric(78,0) DEFAULT '0' NOT NULL,
  "input" text,
  "receipt_status" varchar(16) DEFAULT 'unknown' NOT NULL,
  "gas_used" numeric(38,0),
  "transaction_fee_native" numeric(38,18),
  "decoded_call_json" jsonb,
  "source_provider" varchar(32) DEFAULT 'moralis' NOT NULL,
  "source_endpoint" text NOT NULL,
  "source_cursor" text,
  "provider_page_id" uuid REFERENCES "engine_v2_provider_pages"("id") ON DELETE set null,
  "raw_provider_record_id" text,
  "collection_run_id" uuid REFERENCES "engine_v2_collection_runs"("id") ON DELETE set null,
  "canonicalized_at" timestamp with time zone DEFAULT now() NOT NULL,
  "metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "canonical_transactions_identity_uidx"
  ON "canonical_transactions" ("chain_id","wallet_address","tx_hash");
CREATE INDEX IF NOT EXISTS "canonical_transactions_order_idx"
  ON "canonical_transactions" ("chain_id","wallet_address","block_number","transaction_index");
CREATE INDEX IF NOT EXISTS "canonical_transactions_tx_idx"
  ON "canonical_transactions" ("chain_id","tx_hash");

CREATE TABLE IF NOT EXISTS "canonical_transaction_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "canonical_transaction_id" uuid NOT NULL REFERENCES "canonical_transactions"("id") ON DELETE cascade,
  "chain_id" integer NOT NULL,
  "tx_hash" varchar(66) NOT NULL,
  "log_index" integer NOT NULL,
  "address" varchar(42) NOT NULL,
  "topic0" varchar(66),
  "topic1" varchar(66),
  "topic2" varchar(66),
  "topic3" varchar(66),
  "data" text,
  "decoded_event_json" jsonb,
  "abi_id" uuid,
  "decode_status" varchar(24) DEFAULT 'provider_hint' NOT NULL,
  "decode_confidence" varchar(16) DEFAULT 'unknown' NOT NULL,
  "source_kind" varchar(48) DEFAULT 'wallet_history' NOT NULL,
  "raw_json" jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "canonical_transaction_logs_identity_uidx"
  ON "canonical_transaction_logs" ("chain_id","tx_hash","log_index");
CREATE INDEX IF NOT EXISTS "canonical_transaction_logs_topic_idx"
  ON "canonical_transaction_logs" ("chain_id","address","topic0");
CREATE INDEX IF NOT EXISTS "canonical_transaction_logs_tx_idx"
  ON "canonical_transaction_logs" ("canonical_transaction_id","log_index");

CREATE TABLE IF NOT EXISTS "canonical_internal_transactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "canonical_transaction_id" uuid NOT NULL REFERENCES "canonical_transactions"("id") ON DELETE cascade,
  "chain_id" integer NOT NULL,
  "tx_hash" varchar(66) NOT NULL,
  "trace_index" integer NOT NULL,
  "from_address" varchar(42),
  "to_address" varchar(42),
  "value_native_raw" numeric(78,0) DEFAULT '0' NOT NULL,
  "call_type" varchar(32),
  "gas" numeric(38,0),
  "error" text,
  "raw_json" jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "canonical_internal_txs_identity_uidx"
  ON "canonical_internal_transactions" ("chain_id","tx_hash","trace_index");
CREATE INDEX IF NOT EXISTS "canonical_internal_txs_tx_idx"
  ON "canonical_internal_transactions" ("canonical_transaction_id","trace_index");

CREATE TABLE IF NOT EXISTS "canonical_asset_movements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "canonical_transaction_id" uuid NOT NULL REFERENCES "canonical_transactions"("id") ON DELETE cascade,
  "canonical_log_id" uuid REFERENCES "canonical_transaction_logs"("id") ON DELETE set null,
  "canonical_internal_transaction_id" uuid REFERENCES "canonical_internal_transactions"("id") ON DELETE set null,
  "chain_id" integer NOT NULL,
  "wallet_address" varchar(42) NOT NULL,
  "tx_hash" varchar(66) NOT NULL,
  "movement_index" integer NOT NULL,
  "asset_type" varchar(24) NOT NULL,
  "token_address" varchar(42),
  "token_id" text,
  "from_address" varchar(42),
  "to_address" varchar(42),
  "amount_raw" numeric(78,0),
  "direction" varchar(16) DEFAULT 'unknown' NOT NULL,
  "movement_kind" varchar(48) DEFAULT 'unknown' NOT NULL,
  "metadata_status" varchar(24) DEFAULT 'missing' NOT NULL,
  "price_status" varchar(24) DEFAULT 'missing' NOT NULL,
  "value_usd_at_event" numeric(38,18),
  "evidence_json" jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "canonical_asset_movements_identity_uidx"
  ON "canonical_asset_movements" ("chain_id","tx_hash","movement_index");
CREATE INDEX IF NOT EXISTS "canonical_asset_movements_wallet_idx"
  ON "canonical_asset_movements" ("chain_id","wallet_address","tx_hash");
CREATE INDEX IF NOT EXISTS "canonical_asset_movements_token_idx"
  ON "canonical_asset_movements" ("chain_id","token_address","token_id");

CREATE TABLE IF NOT EXISTS "contract_abis" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "chain_id" integer NOT NULL,
  "address" varchar(42) NOT NULL,
  "implementation_address" varchar(42),
  "contract_name" text,
  "protocol" varchar(32),
  "contract_kind" varchar(64) DEFAULT 'unknown' NOT NULL,
  "abi_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "source_provider" varchar(32) NOT NULL,
  "source_url" text,
  "source_reference" text,
  "bytecode_hash" varchar(66),
  "is_proxy" boolean DEFAULT false NOT NULL,
  "verified_at" timestamp with time zone,
  "fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "contract_abis_identity_uidx"
  ON "contract_abis" ("chain_id","address","implementation_address");
CREATE INDEX IF NOT EXISTS "contract_abis_protocol_idx"
  ON "contract_abis" ("chain_id","protocol","contract_kind");

CREATE TABLE IF NOT EXISTS "contract_abi_selectors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "contract_abi_id" uuid NOT NULL REFERENCES "contract_abis"("id") ON DELETE cascade,
  "chain_id" integer NOT NULL,
  "address" varchar(42) NOT NULL,
  "selector_or_topic" varchar(66) NOT NULL,
  "signature" text NOT NULL,
  "fragment_type" varchar(16) NOT NULL,
  "fragment_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "contract_abi_selectors_identity_uidx"
  ON "contract_abi_selectors" ("chain_id","address","selector_or_topic","fragment_type");
CREATE INDEX IF NOT EXISTS "contract_abi_selectors_lookup_idx"
  ON "contract_abi_selectors" ("chain_id","selector_or_topic","fragment_type");

CREATE TABLE IF NOT EXISTS "canonical_calls" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "canonical_transaction_id" uuid NOT NULL REFERENCES "canonical_transactions"("id") ON DELETE cascade,
  "parent_call_id" uuid,
  "chain_id" integer NOT NULL,
  "tx_hash" varchar(66) NOT NULL,
  "call_path" text NOT NULL,
  "target_address" varchar(42),
  "selector" varchar(10),
  "function_name" text,
  "decoded_args_json" jsonb,
  "raw_call_data" text,
  "abi_id" uuid REFERENCES "contract_abis"("id") ON DELETE set null,
  "decode_status" varchar(24) DEFAULT 'missing_abi' NOT NULL,
  "decode_confidence" varchar(16) DEFAULT 'unknown' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "canonical_calls_identity_uidx"
  ON "canonical_calls" ("chain_id","tx_hash","call_path");
CREATE INDEX IF NOT EXISTS "canonical_calls_tx_idx"
  ON "canonical_calls" ("canonical_transaction_id","call_path");
CREATE INDEX IF NOT EXISTS "canonical_calls_selector_idx"
  ON "canonical_calls" ("chain_id","target_address","selector");

CREATE TABLE IF NOT EXISTS "engine_v2_protocol_known_addresses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "chain_id" integer NOT NULL,
  "address" varchar(42) NOT NULL,
  "protocol" varchar(32) NOT NULL,
  "address_kind" varchar(64) NOT NULL,
  "label" text,
  "source_provider" varchar(32) NOT NULL,
  "source_reference" text,
  "confidence" varchar(16) DEFAULT 'high' NOT NULL,
  "metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "engine_v2_protocol_known_addresses_uidx"
  ON "engine_v2_protocol_known_addresses" ("chain_id","address","address_kind");
CREATE INDEX IF NOT EXISTS "engine_v2_protocol_known_addresses_protocol_idx"
  ON "engine_v2_protocol_known_addresses" ("chain_id","protocol","address_kind");

CREATE TABLE IF NOT EXISTS "engine_v2_token_metadata" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "chain_id" integer NOT NULL,
  "token_address" varchar(42) NOT NULL,
  "symbol" varchar(64),
  "name" text,
  "decimals" integer,
  "category" varchar(64),
  "verified" boolean DEFAULT false NOT NULL,
  "possible_spam" boolean DEFAULT false NOT NULL,
  "source_provider" varchar(32) NOT NULL,
  "raw_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "engine_v2_token_metadata_uidx"
  ON "engine_v2_token_metadata" ("chain_id","token_address");

CREATE TABLE IF NOT EXISTS "engine_v2_price_points" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "chain_id" integer NOT NULL,
  "token_address" varchar(42) NOT NULL,
  "priced_at" timestamp with time zone,
  "block_number" numeric(38,0),
  "price_usd" numeric(38,18),
  "source_provider" varchar(32) NOT NULL,
  "resolution" varchar(32) DEFAULT 'historical' NOT NULL,
  "status" varchar(24) DEFAULT 'resolved' NOT NULL,
  "metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "engine_v2_price_points_uidx"
  ON "engine_v2_price_points" ("chain_id","token_address","block_number","source_provider","resolution");
CREATE INDEX IF NOT EXISTS "engine_v2_price_points_time_idx"
  ON "engine_v2_price_points" ("chain_id","token_address","priced_at");

CREATE TABLE IF NOT EXISTS "engine_v2_provider_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "chain_id" integer NOT NULL,
  "natural_key" text NOT NULL,
  "provider" varchar(32) NOT NULL,
  "endpoint" text NOT NULL,
  "request_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "response_reference" text,
  "status" varchar(24) DEFAULT 'queued' NOT NULL,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "last_error" text,
  "next_retry_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "engine_v2_provider_requests_natural_uidx"
  ON "engine_v2_provider_requests" ("chain_id","natural_key");
CREATE INDEX IF NOT EXISTS "engine_v2_provider_requests_status_idx"
  ON "engine_v2_provider_requests" ("status","next_retry_at");

CREATE TABLE IF NOT EXISTS "engine_v2_protocol_state_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "chain_id" integer NOT NULL,
  "protocol" varchar(32) NOT NULL,
  "subject_type" varchar(48) NOT NULL,
  "subject_address" varchar(42) NOT NULL,
  "subject_id" text,
  "block_number" numeric(38,0),
  "observed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "source_provider" varchar(32) NOT NULL,
  "state_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "evidence_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "engine_v2_protocol_state_snapshots_uidx"
  ON "engine_v2_protocol_state_snapshots" ("chain_id","protocol","subject_type","subject_address","subject_id","block_number");
CREATE INDEX IF NOT EXISTS "engine_v2_protocol_state_snapshots_subject_idx"
  ON "engine_v2_protocol_state_snapshots" ("chain_id","subject_type","subject_address");

CREATE TABLE IF NOT EXISTS "engine_v2_domain_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "chain_id" integer NOT NULL,
  "wallet_address" varchar(42) NOT NULL,
  "canonical_transaction_id" uuid REFERENCES "canonical_transactions"("id") ON DELETE set null,
  "canonical_call_id" uuid REFERENCES "canonical_calls"("id") ON DELETE set null,
  "parent_event_id" uuid,
  "event_type" varchar(64) NOT NULL,
  "event_family" varchar(32) NOT NULL,
  "occurred_at" timestamp with time zone NOT NULL,
  "tx_hash" varchar(66) NOT NULL,
  "sequence_index" integer NOT NULL,
  "coverage_status" varchar(24) DEFAULT 'unknown' NOT NULL,
  "confidence" varchar(16) DEFAULT 'unknown' NOT NULL,
  "reason_codes" text[] DEFAULT '{}'::text[] NOT NULL,
  "value_effect_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "evidence_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "engine_v2_domain_events_identity_uidx"
  ON "engine_v2_domain_events" ("chain_id","wallet_address","tx_hash","sequence_index");
CREATE INDEX IF NOT EXISTS "engine_v2_domain_events_wallet_idx"
  ON "engine_v2_domain_events" ("chain_id","wallet_address","occurred_at");
CREATE INDEX IF NOT EXISTS "engine_v2_domain_events_parent_idx"
  ON "engine_v2_domain_events" ("parent_event_id");

CREATE TABLE IF NOT EXISTS "engine_v2_domain_event_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "domain_event_id" uuid NOT NULL REFERENCES "engine_v2_domain_events"("id") ON DELETE cascade,
  "chain_id" integer NOT NULL,
  "entity_type" varchar(48) NOT NULL,
  "entity_id" text NOT NULL,
  "link_kind" varchar(48) DEFAULT 'explicit' NOT NULL,
  "confidence" varchar(16) DEFAULT 'high' NOT NULL,
  "evidence_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "engine_v2_domain_event_links_uidx"
  ON "engine_v2_domain_event_links" ("domain_event_id","entity_type","entity_id","link_kind");
CREATE INDEX IF NOT EXISTS "engine_v2_domain_event_links_entity_idx"
  ON "engine_v2_domain_event_links" ("chain_id","entity_type","entity_id");

CREATE TABLE IF NOT EXISTS "engine_v2_classification_traces" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "canonical_transaction_id" uuid NOT NULL REFERENCES "canonical_transactions"("id") ON DELETE cascade,
  "chain_id" integer NOT NULL,
  "tx_hash" varchar(66) NOT NULL,
  "classifier_version" varchar(32) NOT NULL,
  "matched_rule" text NOT NULL,
  "coverage_status" varchar(24) NOT NULL,
  "confidence" varchar(16) NOT NULL,
  "reason_codes" text[] DEFAULT '{}'::text[] NOT NULL,
  "evidence_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "engine_v2_classification_traces_tx_idx"
  ON "engine_v2_classification_traces" ("chain_id","tx_hash");
CREATE INDEX IF NOT EXISTS "engine_v2_classification_traces_rule_idx"
  ON "engine_v2_classification_traces" ("classifier_version","matched_rule");

CREATE TABLE IF NOT EXISTS "engine_v2_enrichment_needs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "chain_id" integer NOT NULL,
  "wallet_address" varchar(42),
  "need_type" varchar(48) NOT NULL,
  "natural_key" text NOT NULL,
  "status" varchar(24) DEFAULT 'queued' NOT NULL,
  "priority" integer DEFAULT 100 NOT NULL,
  "source_domain_event_id" uuid REFERENCES "engine_v2_domain_events"("id") ON DELETE set null,
  "reason_codes" text[] DEFAULT '{}'::text[] NOT NULL,
  "request_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "result_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "last_error" text,
  "next_retry_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "engine_v2_enrichment_needs_natural_uidx"
  ON "engine_v2_enrichment_needs" ("chain_id","need_type","natural_key");
CREATE INDEX IF NOT EXISTS "engine_v2_enrichment_needs_status_idx"
  ON "engine_v2_enrichment_needs" ("status","priority","next_retry_at");

CREATE TABLE IF NOT EXISTS "engine_v2_governance_locks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "chain_id" integer NOT NULL,
  "voting_escrow_address" varchar(42) NOT NULL,
  "lock_token_id" text NOT NULL,
  "wallet_address" varchar(42),
  "owner_address" varchar(42),
  "origin_tx_hash" varchar(66),
  "origin_kind" varchar(48) DEFAULT 'unknown' NOT NULL,
  "status" varchar(24) DEFAULT 'unknown' NOT NULL,
  "coverage_status" varchar(24) DEFAULT 'partial' NOT NULL,
  "confidence" varchar(16) DEFAULT 'unknown' NOT NULL,
  "reason_codes" text[] DEFAULT '{}'::text[] NOT NULL,
  "metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "engine_v2_governance_locks_identity_uidx"
  ON "engine_v2_governance_locks" ("chain_id","voting_escrow_address","lock_token_id");
CREATE INDEX IF NOT EXISTS "engine_v2_governance_locks_wallet_idx"
  ON "engine_v2_governance_locks" ("chain_id","wallet_address");

CREATE TABLE IF NOT EXISTS "engine_v2_governance_lock_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "governance_lock_id" uuid NOT NULL REFERENCES "engine_v2_governance_locks"("id") ON DELETE cascade,
  "domain_event_id" uuid REFERENCES "engine_v2_domain_events"("id") ON DELETE set null,
  "chain_id" integer NOT NULL,
  "event_type" varchar(48) NOT NULL,
  "occurred_at" timestamp with time zone NOT NULL,
  "tx_hash" varchar(66) NOT NULL,
  "amount_raw" numeric(78,0),
  "lock_end" timestamp with time zone,
  "coverage_status" varchar(24) DEFAULT 'unknown' NOT NULL,
  "confidence" varchar(16) DEFAULT 'unknown' NOT NULL,
  "evidence_json" jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "engine_v2_governance_lock_events_uidx"
  ON "engine_v2_governance_lock_events" ("chain_id","tx_hash","event_type","governance_lock_id");
CREATE INDEX IF NOT EXISTS "engine_v2_governance_lock_events_lock_idx"
  ON "engine_v2_governance_lock_events" ("governance_lock_id","occurred_at");

CREATE TABLE IF NOT EXISTS "engine_v2_managed_lock_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "chain_id" integer NOT NULL,
  "wallet_address" varchar(42) NOT NULL,
  "user_lock_id" uuid NOT NULL REFERENCES "engine_v2_governance_locks"("id") ON DELETE cascade,
  "managed_lock_id" uuid REFERENCES "engine_v2_governance_locks"("id") ON DELETE set null,
  "user_token_id" text NOT NULL,
  "managed_token_id" text NOT NULL,
  "manager_address" varchar(42),
  "deposited_at" timestamp with time zone,
  "withdrawn_at" timestamp with time zone,
  "evidence_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "engine_v2_managed_lock_links_uidx"
  ON "engine_v2_managed_lock_links" ("chain_id","wallet_address","user_token_id","managed_token_id");
CREATE INDEX IF NOT EXISTS "engine_v2_managed_lock_links_user_idx"
  ON "engine_v2_managed_lock_links" ("user_lock_id");

CREATE TABLE IF NOT EXISTS "engine_v2_governance_epochs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "chain_id" integer NOT NULL,
  "wallet_address" varchar(42) NOT NULL,
  "epoch_id" text NOT NULL,
  "epoch_start" timestamp with time zone,
  "epoch_end" timestamp with time zone,
  "lock_token_id" text,
  "vote_context_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "reward_context_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "coverage_status" varchar(24) DEFAULT 'unknown' NOT NULL,
  "confidence" varchar(16) DEFAULT 'unknown' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "engine_v2_governance_epochs_uidx"
  ON "engine_v2_governance_epochs" ("chain_id","wallet_address","epoch_id","lock_token_id");
CREATE INDEX IF NOT EXISTS "engine_v2_governance_epochs_wallet_idx"
  ON "engine_v2_governance_epochs" ("chain_id","wallet_address","epoch_start");

CREATE TABLE IF NOT EXISTS "engine_v2_governance_claim_batches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "domain_event_id" uuid REFERENCES "engine_v2_domain_events"("id") ON DELETE set null,
  "chain_id" integer NOT NULL,
  "wallet_address" varchar(42) NOT NULL,
  "tx_hash" varchar(66) NOT NULL,
  "claim_surface" varchar(48) NOT NULL,
  "item_count" integer DEFAULT 0 NOT NULL,
  "coverage_status" varchar(24) DEFAULT 'unknown' NOT NULL,
  "confidence" varchar(16) DEFAULT 'unknown' NOT NULL,
  "evidence_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "engine_v2_governance_claim_batches_uidx"
  ON "engine_v2_governance_claim_batches" ("chain_id","wallet_address","tx_hash","claim_surface");

CREATE TABLE IF NOT EXISTS "engine_v2_governance_claim_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "domain_event_id" uuid REFERENCES "engine_v2_domain_events"("id") ON DELETE set null,
  "chain_id" integer NOT NULL,
  "wallet_address" varchar(42) NOT NULL,
  "tx_hash" varchar(66) NOT NULL,
  "item_index" integer NOT NULL,
  "reward_type" varchar(32) NOT NULL,
  "token_address" varchar(42),
  "amount_raw" numeric(78,0),
  "value_usd_at_claim" numeric(38,18),
  "lock_token_id" text,
  "pool_id" uuid REFERENCES "pools"("id") ON DELETE set null,
  "source_contract" varchar(42),
  "affects_totals" boolean DEFAULT false NOT NULL,
  "pool_contribution" varchar(24) DEFAULT 'unresolved' NOT NULL,
  "coverage_status" varchar(24) DEFAULT 'unknown' NOT NULL,
  "confidence" varchar(16) DEFAULT 'unknown' NOT NULL,
  "evidence_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "engine_v2_governance_claim_items_uidx"
  ON "engine_v2_governance_claim_items" ("chain_id","wallet_address","tx_hash","item_index");
CREATE INDEX IF NOT EXISTS "engine_v2_governance_claim_items_wallet_idx"
  ON "engine_v2_governance_claim_items" ("chain_id","wallet_address","reward_type");

CREATE TABLE IF NOT EXISTS "engine_v2_distributor_pool_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "chain_id" integer NOT NULL,
  "distributor_address" varchar(42) NOT NULL,
  "pool_address" varchar(42) NOT NULL,
  "gauge_address" varchar(42),
  "distributor_kind" varchar(32) NOT NULL,
  "source_tx_hash" varchar(66),
  "source_log_index" integer,
  "evidence_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "engine_v2_distributor_pool_links_uidx"
  ON "engine_v2_distributor_pool_links" ("chain_id","distributor_address");
CREATE INDEX IF NOT EXISTS "engine_v2_distributor_pool_links_pool_idx"
  ON "engine_v2_distributor_pool_links" ("chain_id","pool_address");

CREATE TABLE IF NOT EXISTS "engine_v2_accounting_lots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "chain_id" integer NOT NULL,
  "wallet_address" varchar(42) NOT NULL,
  "source_domain_event_id" uuid REFERENCES "engine_v2_domain_events"("id") ON DELETE set null,
  "lot_kind" varchar(48) NOT NULL,
  "token_address" varchar(42),
  "amount_raw" numeric(78,0),
  "value_usd_at_event" numeric(38,18),
  "remaining_amount_raw" numeric(78,0),
  "entity_type" varchar(48),
  "entity_id" text,
  "coverage_status" varchar(24) DEFAULT 'unknown' NOT NULL,
  "reason_codes" text[] DEFAULT '{}'::text[] NOT NULL,
  "metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "engine_v2_accounting_lots_wallet_idx"
  ON "engine_v2_accounting_lots" ("chain_id","wallet_address","token_address");
CREATE INDEX IF NOT EXISTS "engine_v2_accounting_lots_entity_idx"
  ON "engine_v2_accounting_lots" ("chain_id","entity_type","entity_id");

CREATE TABLE IF NOT EXISTS "engine_v2_cash_flows" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "chain_id" integer NOT NULL,
  "wallet_address" varchar(42) NOT NULL,
  "source_domain_event_id" uuid REFERENCES "engine_v2_domain_events"("id") ON DELETE set null,
  "flow_kind" varchar(48) NOT NULL,
  "token_address" varchar(42),
  "amount_raw" numeric(78,0),
  "value_usd_at_event" numeric(38,18),
  "occurred_at" timestamp with time zone NOT NULL,
  "tx_hash" varchar(66) NOT NULL,
  "coverage_status" varchar(24) DEFAULT 'unknown' NOT NULL,
  "reason_codes" text[] DEFAULT '{}'::text[] NOT NULL,
  "metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "engine_v2_cash_flows_wallet_idx"
  ON "engine_v2_cash_flows" ("chain_id","wallet_address","occurred_at");
CREATE INDEX IF NOT EXISTS "engine_v2_cash_flows_event_idx"
  ON "engine_v2_cash_flows" ("source_domain_event_id");

CREATE TABLE IF NOT EXISTS "engine_v2_valuations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "chain_id" integer NOT NULL,
  "wallet_address" varchar(42),
  "source_domain_event_id" uuid REFERENCES "engine_v2_domain_events"("id") ON DELETE set null,
  "entity_type" varchar(48),
  "entity_id" text,
  "valuation_kind" varchar(32) NOT NULL,
  "token_address" varchar(42),
  "amount_raw" numeric(78,0),
  "value_usd" numeric(38,18),
  "priced_at" timestamp with time zone,
  "price_point_id" uuid REFERENCES "engine_v2_price_points"("id") ON DELETE set null,
  "status" varchar(24) DEFAULT 'unknown' NOT NULL,
  "reason_codes" text[] DEFAULT '{}'::text[] NOT NULL,
  "metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "engine_v2_valuations_entity_idx"
  ON "engine_v2_valuations" ("chain_id","entity_type","entity_id");
CREATE INDEX IF NOT EXISTS "engine_v2_valuations_event_idx"
  ON "engine_v2_valuations" ("source_domain_event_id");

CREATE TABLE IF NOT EXISTS "engine_v2_residual_inventory" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "chain_id" integer NOT NULL,
  "wallet_address" varchar(42) NOT NULL,
  "token_address" varchar(42) NOT NULL,
  "amount_raw" numeric(78,0) DEFAULT '0' NOT NULL,
  "value_usd" numeric(38,18),
  "valuation_status" varchar(24) DEFAULT 'unknown' NOT NULL,
  "coverage_status" varchar(24) DEFAULT 'partial' NOT NULL,
  "reason_codes" text[] DEFAULT '{}'::text[] NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "engine_v2_residual_inventory_uidx"
  ON "engine_v2_residual_inventory" ("chain_id","wallet_address","token_address");

CREATE TABLE IF NOT EXISTS "engine_v2_read_model_rows" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "chain_id" integer NOT NULL,
  "wallet_address" varchar(42) NOT NULL,
  "surface" varchar(32) NOT NULL,
  "row_key" text NOT NULL,
  "source_domain_event_id" uuid REFERENCES "engine_v2_domain_events"("id") ON DELETE set null,
  "coverage_status" varchar(24) DEFAULT 'unknown' NOT NULL,
  "confidence" varchar(16) DEFAULT 'unknown' NOT NULL,
  "row_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "evidence_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "materialized_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "engine_v2_read_model_rows_uidx"
  ON "engine_v2_read_model_rows" ("chain_id","wallet_address","surface","row_key");
CREATE INDEX IF NOT EXISTS "engine_v2_read_model_rows_surface_idx"
  ON "engine_v2_read_model_rows" ("chain_id","wallet_address","surface");
