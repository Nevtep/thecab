CREATE TABLE IF NOT EXISTS "governance_lock_exposures" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "run_id" uuid REFERENCES "analysis_runs"("id") ON DELETE cascade,
  "chain_id" integer NOT NULL,
  "wallet_address" varchar(42) NOT NULL,
  "lock_id" varchar(128),
  "status" varchar(24) DEFAULT 'unknown' NOT NULL,
  "locked_aero_amount" numeric(78,18),
  "locked_aero_value_usd" numeric(38,18),
  "ve_aero_exposure" numeric(78,18),
  "created_at_utc" timestamp with time zone,
  "expires_at_utc" timestamp with time zone,
  "coverage_status" varchar(24) DEFAULT 'unavailable' NOT NULL,
  "confidence" varchar(16) DEFAULT 'none' NOT NULL,
  "reason_codes" text[] DEFAULT '{}'::text[] NOT NULL,
  "lifecycle_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "materialized_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "governance_lock_exposures_wallet_idx"
  ON "governance_lock_exposures" ("chain_id","wallet_address");
CREATE INDEX IF NOT EXISTS "governance_lock_exposures_run_idx"
  ON "governance_lock_exposures" ("run_id");

CREATE TABLE IF NOT EXISTS "governance_epoch_summaries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "run_id" uuid REFERENCES "analysis_runs"("id") ON DELETE cascade,
  "chain_id" integer NOT NULL,
  "wallet_address" varchar(42) NOT NULL,
  "epoch_id" varchar(64) NOT NULL,
  "epoch_start_utc" timestamp with time zone,
  "epoch_end_utc" timestamp with time zone,
  "vote_mode" varchar(24) DEFAULT 'unknown' NOT NULL,
  "reset_state" varchar(24) DEFAULT 'unknown' NOT NULL,
  "reward_state" varchar(24) DEFAULT 'unknown' NOT NULL,
  "fees_usd" numeric(38,18),
  "bribes_usd" numeric(38,18),
  "rebases_usd" numeric(38,18),
  "voted_pools_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "coverage_status" varchar(24) DEFAULT 'unavailable' NOT NULL,
  "confidence" varchar(16) DEFAULT 'none' NOT NULL,
  "reason_codes" text[] DEFAULT '{}'::text[] NOT NULL,
  "metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "materialized_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "governance_epoch_summaries_identity_uidx"
  ON "governance_epoch_summaries" ("chain_id","wallet_address","epoch_id");
CREATE INDEX IF NOT EXISTS "governance_epoch_summaries_wallet_idx"
  ON "governance_epoch_summaries" ("chain_id","wallet_address");
CREATE INDEX IF NOT EXISTS "governance_epoch_summaries_run_idx"
  ON "governance_epoch_summaries" ("run_id");

CREATE TABLE IF NOT EXISTS "governance_reward_rows" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "run_id" uuid REFERENCES "analysis_runs"("id") ON DELETE cascade,
  "chain_id" integer NOT NULL,
  "wallet_address" varchar(42) NOT NULL,
  "reward_event_id" uuid REFERENCES "reward_events"("id") ON DELETE set null,
  "governance_event_id" uuid REFERENCES "governance_events"("id") ON DELETE set null,
  "tx_hash" varchar(66) NOT NULL,
  "log_index" integer DEFAULT 0 NOT NULL,
  "claimed_at" timestamp with time zone NOT NULL,
  "reward_type" varchar(32) NOT NULL,
  "token_address" varchar(42),
  "token_symbol" varchar(24),
  "amount_raw" numeric(78,0),
  "amount_decimal" numeric(78,18),
  "value_usd_at_claim" numeric(38,18),
  "epoch_id" varchar(64),
  "pool_id" uuid REFERENCES "pools"("id") ON DELETE set null,
  "coverage_status" varchar(24) DEFAULT 'unavailable' NOT NULL,
  "confidence" varchar(16) DEFAULT 'none' NOT NULL,
  "affects_totals" boolean DEFAULT false NOT NULL,
  "context_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "evidence_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "materialized_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "governance_reward_rows_identity_uidx"
  ON "governance_reward_rows" ("chain_id","wallet_address","tx_hash","log_index","reward_type");
CREATE INDEX IF NOT EXISTS "governance_reward_rows_wallet_claimed_idx"
  ON "governance_reward_rows" ("chain_id","wallet_address","claimed_at");
CREATE INDEX IF NOT EXISTS "governance_reward_rows_reward_event_idx"
  ON "governance_reward_rows" ("reward_event_id");
CREATE INDEX IF NOT EXISTS "governance_reward_rows_pool_idx"
  ON "governance_reward_rows" ("chain_id","wallet_address","pool_id");

CREATE TABLE IF NOT EXISTS "governance_metric_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "run_id" uuid REFERENCES "analysis_runs"("id") ON DELETE cascade,
  "chain_id" integer NOT NULL,
  "wallet_address" varchar(42) NOT NULL,
  "summary_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "selected_detail_json" jsonb,
  "coverage_status" varchar(24) DEFAULT 'unavailable' NOT NULL,
  "confidence" varchar(16) DEFAULT 'none' NOT NULL,
  "materialized_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "governance_metric_snapshots_wallet_idx"
  ON "governance_metric_snapshots" ("chain_id","wallet_address");
CREATE INDEX IF NOT EXISTS "governance_metric_snapshots_run_idx"
  ON "governance_metric_snapshots" ("run_id");
