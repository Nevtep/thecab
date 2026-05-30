CREATE TABLE "strategy_history_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chain_id" integer NOT NULL,
	"wallet_address" varchar(42) NOT NULL,
	"strategy_id" uuid NOT NULL,
	"strategy_exposure_id" uuid NOT NULL,
	"primary_pool_id" uuid,
	"day_utc" varchar(10) NOT NULL,
	"latest_run_id" uuid NOT NULL,
	"coverage_status" varchar(24) DEFAULT 'share_level' NOT NULL,
	"share_balance_raw" numeric(78, 0) DEFAULT '0' NOT NULL,
	"estimated_value_usd" numeric(38, 18),
	"deposited_value_usd" numeric(38, 18) DEFAULT '0' NOT NULL,
	"withdrawn_value_usd" numeric(38, 18) DEFAULT '0' NOT NULL,
	"reward_value_usd" numeric(38, 18) DEFAULT '0' NOT NULL,
	"cumulative_rewards_usd" numeric(38, 18) DEFAULT '0' NOT NULL,
	"total_return_usd" numeric(38, 18),
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strategy_lifecycle_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chain_id" integer NOT NULL,
	"wallet_address" varchar(42) NOT NULL,
	"strategy_id" uuid NOT NULL,
	"strategy_exposure_id" uuid NOT NULL,
	"primary_pool_id" uuid,
	"sequence_index" integer NOT NULL,
	"latest_run_id" uuid NOT NULL,
	"event_type" varchar(40) NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"tx_hash" varchar(66),
	"log_index" integer,
	"block_number" numeric(38, 0),
	"source_ledger_event_id" uuid,
	"source_reward_event_id" uuid,
	"usd_value" numeric(38, 18),
	"share_delta_raw" numeric(78, 0),
	"token_deltas_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"price_source" varchar(32),
	"confidence" varchar(16) DEFAULT 'unknown' NOT NULL,
	"coverage_status" varchar(24) DEFAULT 'share_level' NOT NULL,
	"coverage_reason_codes" text[] DEFAULT '{}'::text[] NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strategy_wallet_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chain_id" integer NOT NULL,
	"wallet_address" varchar(42) NOT NULL,
	"strategy_id" uuid NOT NULL,
	"strategy_exposure_id" uuid NOT NULL,
	"primary_pool_id" uuid,
	"latest_run_id" uuid NOT NULL,
	"strategy_label" text NOT NULL,
	"protocol" varchar(32) DEFAULT 'mellow' NOT NULL,
	"wrapper_address" varchar(42),
	"staking_rewards_address" varchar(42),
	"external_strategy_position_reference" text,
	"external_strategy_position_reference_status" varchar(24) DEFAULT 'unresolved' NOT NULL,
	"pool_mapping_status" varchar(24) DEFAULT 'unknown' NOT NULL,
	"status" varchar(24) DEFAULT 'unknown' NOT NULL,
	"opened_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"covered_start_day_utc" varchar(10),
	"covered_end_day_utc" varchar(10),
	"deposited_value_usd" numeric(38, 18) DEFAULT '0' NOT NULL,
	"withdrawn_value_usd" numeric(38, 18) DEFAULT '0' NOT NULL,
	"current_estimated_value_usd" numeric(38, 18),
	"shares_received_raw" numeric(78, 0) DEFAULT '0' NOT NULL,
	"shares_redeemed_raw" numeric(78, 0) DEFAULT '0' NOT NULL,
	"current_shares_raw" numeric(78, 0) DEFAULT '0' NOT NULL,
	"share_symbol" varchar(48),
	"total_rewards_usd" numeric(38, 18) DEFAULT '0' NOT NULL,
	"resolved_reward_count" integer DEFAULT 0 NOT NULL,
	"unresolved_reward_count" integer DEFAULT 0 NOT NULL,
	"realized_pnl_usd" numeric(38, 18),
	"unrealized_pnl_usd" numeric(38, 18),
	"total_return_usd" numeric(38, 18),
	"total_return_pct" numeric(12, 6),
	"estimated_annualized_return_pct" numeric(12, 6),
	"coverage_status" varchar(24) DEFAULT 'share_level' NOT NULL,
	"confidence" varchar(16) DEFAULT 'unknown' NOT NULL,
	"coverage_reason_codes" text[] DEFAULT '{}'::text[] NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "strategy_history_snapshots" ADD CONSTRAINT "strategy_history_snapshots_strategy_id_strategies_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."strategies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_history_snapshots" ADD CONSTRAINT "strategy_history_snapshots_strategy_exposure_id_strategy_exposures_id_fk" FOREIGN KEY ("strategy_exposure_id") REFERENCES "public"."strategy_exposures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_history_snapshots" ADD CONSTRAINT "strategy_history_snapshots_primary_pool_id_pools_id_fk" FOREIGN KEY ("primary_pool_id") REFERENCES "public"."pools"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_history_snapshots" ADD CONSTRAINT "strategy_history_snapshots_latest_run_id_analysis_runs_id_fk" FOREIGN KEY ("latest_run_id") REFERENCES "public"."analysis_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_lifecycle_events" ADD CONSTRAINT "strategy_lifecycle_events_strategy_id_strategies_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."strategies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_lifecycle_events" ADD CONSTRAINT "strategy_lifecycle_events_strategy_exposure_id_strategy_exposures_id_fk" FOREIGN KEY ("strategy_exposure_id") REFERENCES "public"."strategy_exposures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_lifecycle_events" ADD CONSTRAINT "strategy_lifecycle_events_primary_pool_id_pools_id_fk" FOREIGN KEY ("primary_pool_id") REFERENCES "public"."pools"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_lifecycle_events" ADD CONSTRAINT "strategy_lifecycle_events_latest_run_id_analysis_runs_id_fk" FOREIGN KEY ("latest_run_id") REFERENCES "public"."analysis_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_lifecycle_events" ADD CONSTRAINT "strategy_lifecycle_events_source_ledger_event_id_ledger_events_id_fk" FOREIGN KEY ("source_ledger_event_id") REFERENCES "public"."ledger_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_lifecycle_events" ADD CONSTRAINT "strategy_lifecycle_events_source_reward_event_id_reward_events_id_fk" FOREIGN KEY ("source_reward_event_id") REFERENCES "public"."reward_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_wallet_summaries" ADD CONSTRAINT "strategy_wallet_summaries_strategy_id_strategies_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."strategies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_wallet_summaries" ADD CONSTRAINT "strategy_wallet_summaries_strategy_exposure_id_strategy_exposures_id_fk" FOREIGN KEY ("strategy_exposure_id") REFERENCES "public"."strategy_exposures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_wallet_summaries" ADD CONSTRAINT "strategy_wallet_summaries_primary_pool_id_pools_id_fk" FOREIGN KEY ("primary_pool_id") REFERENCES "public"."pools"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_wallet_summaries" ADD CONSTRAINT "strategy_wallet_summaries_latest_run_id_analysis_runs_id_fk" FOREIGN KEY ("latest_run_id") REFERENCES "public"."analysis_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "strategy_history_snapshots_identity_uidx" ON "strategy_history_snapshots" USING btree ("chain_id","wallet_address","strategy_exposure_id","day_utc");--> statement-breakpoint
CREATE INDEX "strategy_history_snapshots_day_idx" ON "strategy_history_snapshots" USING btree ("chain_id","wallet_address","day_utc");--> statement-breakpoint
CREATE INDEX "strategy_history_snapshots_exposure_day_idx" ON "strategy_history_snapshots" USING btree ("chain_id","wallet_address","strategy_exposure_id","day_utc");--> statement-breakpoint
CREATE INDEX "strategy_history_snapshots_pool_day_idx" ON "strategy_history_snapshots" USING btree ("chain_id","wallet_address","primary_pool_id","day_utc");--> statement-breakpoint
CREATE UNIQUE INDEX "strategy_lifecycle_events_identity_uidx" ON "strategy_lifecycle_events" USING btree ("chain_id","wallet_address","strategy_exposure_id","sequence_index");--> statement-breakpoint
CREATE INDEX "strategy_lifecycle_events_occurred_idx" ON "strategy_lifecycle_events" USING btree ("chain_id","wallet_address","strategy_exposure_id","occurred_at");--> statement-breakpoint
CREATE INDEX "strategy_lifecycle_events_type_idx" ON "strategy_lifecycle_events" USING btree ("chain_id","wallet_address","strategy_exposure_id","event_type");--> statement-breakpoint
CREATE INDEX "strategy_lifecycle_events_tx_idx" ON "strategy_lifecycle_events" USING btree ("chain_id","wallet_address","tx_hash");--> statement-breakpoint
CREATE INDEX "strategy_lifecycle_events_reward_idx" ON "strategy_lifecycle_events" USING btree ("chain_id","wallet_address","source_reward_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "strategy_wallet_summaries_identity_uidx" ON "strategy_wallet_summaries" USING btree ("chain_id","wallet_address","strategy_exposure_id");--> statement-breakpoint
CREATE INDEX "strategy_wallet_summaries_status_idx" ON "strategy_wallet_summaries" USING btree ("chain_id","wallet_address","status");--> statement-breakpoint
CREATE INDEX "strategy_wallet_summaries_pool_idx" ON "strategy_wallet_summaries" USING btree ("chain_id","wallet_address","primary_pool_id");--> statement-breakpoint
CREATE INDEX "strategy_wallet_summaries_coverage_idx" ON "strategy_wallet_summaries" USING btree ("chain_id","wallet_address","coverage_status");--> statement-breakpoint
CREATE INDEX "strategy_wallet_summaries_value_idx" ON "strategy_wallet_summaries" USING btree ("chain_id","wallet_address","current_estimated_value_usd");--> statement-breakpoint
CREATE INDEX "strategy_wallet_summaries_opened_idx" ON "strategy_wallet_summaries" USING btree ("chain_id","wallet_address","opened_at");