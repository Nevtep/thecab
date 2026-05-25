CREATE TABLE "analysis_slices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"wallet_address" varchar(42) NOT NULL,
	"chain_id" integer NOT NULL,
	"slice_index" integer NOT NULL,
	"slice_start_utc" timestamp with time zone NOT NULL,
	"slice_end_utc" timestamp with time zone NOT NULL,
	"status" varchar(24) DEFAULT 'queued' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"coverage_reasons_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"provider_attempts_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tx_count_seen" integer DEFAULT 0 NOT NULL,
	"tx_count_processed" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pool_metrics_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chain_id" integer NOT NULL,
	"pool_id" uuid NOT NULL,
	"day_utc" varchar(10) NOT NULL,
	"tvl_usd" numeric(38, 18),
	"volume_24h_usd" numeric(38, 18),
	"fees_24h_usd" numeric(38, 18),
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processed_txs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chain_id" integer NOT NULL,
	"tx_hash" varchar(66) NOT NULL,
	"wallet_address" varchar(42) NOT NULL,
	"block_number" numeric(38, 0) NOT NULL,
	"first_run_id" uuid NOT NULL,
	"first_slice_id" uuid NOT NULL,
	"processed_at_utc" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processing_cursors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_address" varchar(42) NOT NULL,
	"chain_id" integer NOT NULL,
	"last_processed_day_utc" varchar(10),
	"last_processed_block_number" numeric(38, 0),
	"last_successful_run_id" uuid,
	"last_advanced_at" timestamp with time zone,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strategy_exposures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chain_id" integer NOT NULL,
	"strategy_id" uuid NOT NULL,
	"wallet_address" varchar(42) NOT NULL,
	"wrapper_address" varchar(42) NOT NULL,
	"shares_raw" numeric(78, 0) DEFAULT '0' NOT NULL,
	"underlying0_amount_raw" numeric(78, 0),
	"underlying1_amount_raw" numeric(78, 0),
	"valuation_block_number" numeric(38, 0),
	"coverage_status" varchar(24) DEFAULT 'share_level' NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analysis_runs" ADD COLUMN "triggered_at_utc" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "analysis_runs" ADD COLUMN "utc_day_bucket" varchar(10) DEFAULT to_char(timezone('UTC', now()), 'YYYY-MM-DD') NOT NULL;--> statement-breakpoint
ALTER TABLE "analysis_runs" ADD COLUMN "coverage" varchar(16) DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "analysis_runs" ADD COLUMN "coverage_reasons_json" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "analysis_runs" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "analysis_runs" ADD COLUMN "cancelled_reason" varchar(64);--> statement-breakpoint
ALTER TABLE "deposits" ADD COLUMN "position_manager_address" varchar(42);--> statement-breakpoint
ALTER TABLE "deposits" ADD COLUMN "mint_tx_hash" varchar(66);--> statement-breakpoint
ALTER TABLE "deposits" ADD COLUMN "coverage_status" varchar(24) DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "ledger_events" ADD COLUMN "classification" varchar(32);--> statement-breakpoint
ALTER TABLE "ledger_events" ADD COLUMN "classification_run_id" uuid;--> statement-breakpoint
ALTER TABLE "performance_snapshots" ADD COLUMN "day_utc" varchar(10);--> statement-breakpoint
ALTER TABLE "performance_snapshots" ADD COLUMN "resolution" varchar(16) DEFAULT 'daily' NOT NULL;--> statement-breakpoint
ALTER TABLE "performance_snapshots" ADD COLUMN "coverage_status" varchar(24) DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "raw_provider_records" ADD COLUMN "slice_id" uuid;--> statement-breakpoint
ALTER TABLE "raw_provider_records" ADD COLUMN "request_hash" varchar(64) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "raw_provider_records" ADD COLUMN "fetched_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "reward_events" ADD COLUMN "deposit_or_strategy_id" uuid;--> statement-breakpoint
ALTER TABLE "reward_events" ADD COLUMN "accrual_snapshot_day_utc" varchar(10);--> statement-breakpoint
ALTER TABLE "reward_events" ADD COLUMN "is_accrual_snapshot" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "analysis_slices" ADD CONSTRAINT "analysis_slices_run_id_analysis_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."analysis_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_metrics_snapshots" ADD CONSTRAINT "pool_metrics_snapshots_pool_id_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."pools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processed_txs" ADD CONSTRAINT "processed_txs_first_run_id_analysis_runs_id_fk" FOREIGN KEY ("first_run_id") REFERENCES "public"."analysis_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processed_txs" ADD CONSTRAINT "processed_txs_first_slice_id_analysis_slices_id_fk" FOREIGN KEY ("first_slice_id") REFERENCES "public"."analysis_slices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_cursors" ADD CONSTRAINT "processing_cursors_last_successful_run_id_analysis_runs_id_fk" FOREIGN KEY ("last_successful_run_id") REFERENCES "public"."analysis_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_exposures" ADD CONSTRAINT "strategy_exposures_strategy_id_strategies_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."strategies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "analysis_slices_identity_uidx" ON "analysis_slices" USING btree ("chain_id","wallet_address","slice_start_utc","slice_end_utc");--> statement-breakpoint
CREATE INDEX "analysis_slices_run_idx" ON "analysis_slices" USING btree ("run_id","slice_index");--> statement-breakpoint
CREATE INDEX "analysis_slices_status_idx" ON "analysis_slices" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "pool_metrics_snapshots_identity_uidx" ON "pool_metrics_snapshots" USING btree ("chain_id","pool_id","day_utc");--> statement-breakpoint
CREATE UNIQUE INDEX "processed_txs_identity_uidx" ON "processed_txs" USING btree ("chain_id","tx_hash","wallet_address");--> statement-breakpoint
CREATE INDEX "processed_txs_block_idx" ON "processed_txs" USING btree ("chain_id","block_number");--> statement-breakpoint
CREATE UNIQUE INDEX "processing_cursors_identity_uidx" ON "processing_cursors" USING btree ("chain_id","wallet_address");--> statement-breakpoint
CREATE UNIQUE INDEX "strategy_exposures_identity_uidx" ON "strategy_exposures" USING btree ("chain_id","strategy_id","wallet_address","wrapper_address");--> statement-breakpoint
ALTER TABLE "ledger_events" ADD CONSTRAINT "ledger_events_classification_run_id_analysis_runs_id_fk" FOREIGN KEY ("classification_run_id") REFERENCES "public"."analysis_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_provider_records" ADD CONSTRAINT "raw_provider_records_slice_id_analysis_slices_id_fk" FOREIGN KEY ("slice_id") REFERENCES "public"."analysis_slices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analysis_runs_wallet_day_idx" ON "analysis_runs" USING btree ("chain_id","wallet_address","utc_day_bucket");--> statement-breakpoint
CREATE UNIQUE INDEX "analysis_runs_completed_per_day_uidx" ON "analysis_runs" USING btree ("chain_id","wallet_address","utc_day_bucket") WHERE "analysis_runs"."status" = 'complete';--> statement-breakpoint
CREATE UNIQUE INDEX "attribution_source_lots_identity_uidx" ON "attribution_source_lots" USING btree ("chain_id","source_ledger_event_id","token_address");--> statement-breakpoint
CREATE UNIQUE INDEX "attribution_states_identity_uidx" ON "attribution_states" USING btree ("chain_id","wallet_address","pool_id","token_address","source_ledger_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deposits_identity_uidx" ON "deposits" USING btree ("chain_id","position_manager_address","token_id") WHERE "deposits"."token_id" is not null and "deposits"."position_manager_address" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "performance_snapshots_identity_uidx" ON "performance_snapshots" USING btree ("chain_id","wallet_address","scope",coalesce("scope_ref_id", '00000000-0000-0000-0000-000000000000'::uuid),"day_utc","resolution");--> statement-breakpoint
CREATE INDEX "raw_provider_records_hash_idx" ON "raw_provider_records" USING btree ("provider","endpoint","request_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "reward_events_accrual_uidx" ON "reward_events" USING btree ("chain_id","deposit_or_strategy_id","accrual_snapshot_day_utc") WHERE "reward_events"."is_accrual_snapshot" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "strategies_identity_uidx" ON "strategies" USING btree ("chain_id","wrapper_address") WHERE "strategies"."wrapper_address" is not null;