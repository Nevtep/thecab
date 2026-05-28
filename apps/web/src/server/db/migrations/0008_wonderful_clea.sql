CREATE TABLE "deposit_lifecycle_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chain_id" integer NOT NULL,
	"wallet_address" varchar(42) NOT NULL,
	"deposit_id" uuid NOT NULL,
	"sequence_index" integer NOT NULL,
	"latest_run_id" uuid NOT NULL,
	"event_type" varchar(32) NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"tx_hash" varchar(66) NOT NULL,
	"log_index" integer NOT NULL,
	"block_number" integer NOT NULL,
	"usd_value" numeric(38, 18),
	"signed_token_deltas" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"price_source" varchar(24),
	"confidence" varchar(16) DEFAULT 'unknown' NOT NULL,
	"inferred_action_id" uuid,
	"coverage_reason_codes" text[] DEFAULT '{}'::text[] NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deposit_performance_decompositions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chain_id" integer NOT NULL,
	"wallet_address" varchar(42) NOT NULL,
	"deposit_id" uuid NOT NULL,
	"latest_run_id" uuid NOT NULL,
	"total_return_usd" numeric(38, 18) DEFAULT '0' NOT NULL,
	"rewards_usd" numeric(38, 18) DEFAULT '0' NOT NULL,
	"fees_usd" numeric(38, 18) DEFAULT '0' NOT NULL,
	"asset_price_effect_usd" numeric(38, 18) DEFAULT '0' NOT NULL,
	"rebalance_effect_usd" numeric(38, 18) DEFAULT '0' NOT NULL,
	"realized_pnl_usd" numeric(38, 18) DEFAULT '0' NOT NULL,
	"unrealized_pnl_usd" numeric(38, 18) DEFAULT '0' NOT NULL,
	"unattributed_usd" numeric(38, 18) DEFAULT '0' NOT NULL,
	"unattributed_reason_codes" text[] DEFAULT '{}'::text[] NOT NULL,
	"component_percentages" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deposit_wallet_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chain_id" integer NOT NULL,
	"wallet_address" varchar(42) NOT NULL,
	"deposit_id" uuid NOT NULL,
	"pool_id" uuid NOT NULL,
	"latest_run_id" uuid NOT NULL,
	"position_label" text NOT NULL,
	"pool_kind" varchar(24) DEFAULT 'cl' NOT NULL,
	"fee_tier_bps" integer,
	"token_id" text,
	"token0_address" varchar(42),
	"token0_symbol" varchar(32),
	"token1_address" varchar(42),
	"token1_symbol" varchar(32),
	"status" varchar(24) DEFAULT 'open_active' NOT NULL,
	"opened_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"opened_by_transfer_in" boolean DEFAULT false NOT NULL,
	"opened_value_usd" numeric(38, 18) DEFAULT '0' NOT NULL,
	"current_value_usd" numeric(38, 18) DEFAULT '0' NOT NULL,
	"capital_entered_usd" numeric(38, 18) DEFAULT '0' NOT NULL,
	"capital_withdrawn_usd" numeric(38, 18) DEFAULT '0' NOT NULL,
	"total_rewards_usd" numeric(38, 18) DEFAULT '0' NOT NULL,
	"realized_pnl_usd" numeric(38, 18) DEFAULT '0' NOT NULL,
	"unrealized_pnl_usd" numeric(38, 18) DEFAULT '0' NOT NULL,
	"total_return_usd" numeric(38, 18) DEFAULT '0' NOT NULL,
	"total_return_pct" numeric(12, 6),
	"estimated_annualized_return_pct" numeric(12, 6),
	"tick_lower" integer,
	"tick_upper" integer,
	"range_lower_price" numeric(38, 18),
	"range_upper_price" numeric(38, 18),
	"is_in_range" boolean,
	"coverage_status" varchar(24) DEFAULT 'unknown' NOT NULL,
	"confidence" varchar(16) DEFAULT 'unknown' NOT NULL,
	"coverage_reason_codes" text[] DEFAULT '{}'::text[] NOT NULL,
	"covered_start_day_utc" varchar(10),
	"covered_end_day_utc" varchar(10),
	"mellow_strategy_cross_link_id" uuid,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
DROP INDEX "inferred_actions_identity_uidx";--> statement-breakpoint
ALTER TABLE "deposit_lifecycle_events" ADD CONSTRAINT "deposit_lifecycle_events_deposit_id_deposits_id_fk" FOREIGN KEY ("deposit_id") REFERENCES "public"."deposits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit_lifecycle_events" ADD CONSTRAINT "deposit_lifecycle_events_latest_run_id_analysis_runs_id_fk" FOREIGN KEY ("latest_run_id") REFERENCES "public"."analysis_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit_lifecycle_events" ADD CONSTRAINT "deposit_lifecycle_events_inferred_action_id_inferred_actions_id_fk" FOREIGN KEY ("inferred_action_id") REFERENCES "public"."inferred_actions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit_performance_decompositions" ADD CONSTRAINT "deposit_performance_decompositions_deposit_id_deposits_id_fk" FOREIGN KEY ("deposit_id") REFERENCES "public"."deposits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit_performance_decompositions" ADD CONSTRAINT "deposit_performance_decompositions_latest_run_id_analysis_runs_id_fk" FOREIGN KEY ("latest_run_id") REFERENCES "public"."analysis_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit_wallet_summaries" ADD CONSTRAINT "deposit_wallet_summaries_deposit_id_deposits_id_fk" FOREIGN KEY ("deposit_id") REFERENCES "public"."deposits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit_wallet_summaries" ADD CONSTRAINT "deposit_wallet_summaries_pool_id_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."pools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit_wallet_summaries" ADD CONSTRAINT "deposit_wallet_summaries_latest_run_id_analysis_runs_id_fk" FOREIGN KEY ("latest_run_id") REFERENCES "public"."analysis_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit_wallet_summaries" ADD CONSTRAINT "deposit_wallet_summaries_mellow_strategy_cross_link_id_strategies_id_fk" FOREIGN KEY ("mellow_strategy_cross_link_id") REFERENCES "public"."strategies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "deposit_lifecycle_events_identity_uidx" ON "deposit_lifecycle_events" USING btree ("chain_id","wallet_address","deposit_id","sequence_index");--> statement-breakpoint
CREATE INDEX "deposit_lifecycle_events_occurred_idx" ON "deposit_lifecycle_events" USING btree ("chain_id","wallet_address","deposit_id","occurred_at");--> statement-breakpoint
CREATE INDEX "deposit_lifecycle_events_type_idx" ON "deposit_lifecycle_events" USING btree ("chain_id","wallet_address","deposit_id","event_type");--> statement-breakpoint
CREATE UNIQUE INDEX "deposit_performance_decompositions_identity_uidx" ON "deposit_performance_decompositions" USING btree ("chain_id","wallet_address","deposit_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deposit_wallet_summaries_identity_uidx" ON "deposit_wallet_summaries" USING btree ("chain_id","wallet_address","deposit_id");--> statement-breakpoint
CREATE INDEX "deposit_wallet_summaries_status_idx" ON "deposit_wallet_summaries" USING btree ("chain_id","wallet_address","status");--> statement-breakpoint
CREATE INDEX "deposit_wallet_summaries_opened_idx" ON "deposit_wallet_summaries" USING btree ("chain_id","wallet_address","opened_at");--> statement-breakpoint
CREATE INDEX "deposit_wallet_summaries_pool_idx" ON "deposit_wallet_summaries" USING btree ("chain_id","wallet_address","pool_id");--> statement-breakpoint
CREATE INDEX "deposit_wallet_summaries_coverage_idx" ON "deposit_wallet_summaries" USING btree ("chain_id","wallet_address","coverage_status");--> statement-breakpoint
CREATE UNIQUE INDEX "inferred_actions_identity_uidx" ON "inferred_actions" USING btree ("chain_id","wallet_address","action_type","source_ledger_event_id");