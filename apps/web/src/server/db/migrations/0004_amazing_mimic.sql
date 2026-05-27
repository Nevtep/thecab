CREATE TABLE "pool_history_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chain_id" integer NOT NULL,
	"wallet_address" varchar(42) NOT NULL,
	"pool_id" uuid NOT NULL,
	"day_utc" varchar(10) NOT NULL,
	"latest_run_id" uuid NOT NULL,
	"coverage_status" varchar(24) DEFAULT 'unknown' NOT NULL,
	"total_value_usd" numeric(38, 18) DEFAULT '0' NOT NULL,
	"deployed_value_usd" numeric(38, 18) DEFAULT '0' NOT NULL,
	"residual_value_usd" numeric(38, 18) DEFAULT '0' NOT NULL,
	"manual_value_usd" numeric(38, 18) DEFAULT '0' NOT NULL,
	"strategy_value_usd" numeric(38, 18) DEFAULT '0' NOT NULL,
	"reward_value_usd" numeric(38, 18) DEFAULT '0' NOT NULL,
	"cumulative_rewards_usd" numeric(38, 18) DEFAULT '0' NOT NULL,
	"capital_in_usd" numeric(38, 18) DEFAULT '0' NOT NULL,
	"capital_out_usd" numeric(38, 18) DEFAULT '0' NOT NULL,
	"pnl_usd" numeric(38, 18),
	"annualized_return_pct" numeric(12, 6),
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pool_timeline_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chain_id" integer NOT NULL,
	"wallet_address" varchar(42) NOT NULL,
	"pool_id" uuid NOT NULL,
	"latest_run_id" uuid NOT NULL,
	"event_key" varchar(128) NOT NULL,
	"event_type" varchar(32) NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"source_ledger_event_id" uuid,
	"related_deposit_id" uuid,
	"related_strategy_id" uuid,
	"confidence" varchar(16) DEFAULT 'medium' NOT NULL,
	"coverage_status" varchar(24) DEFAULT 'unknown' NOT NULL,
	"attributed_value_usd" numeric(38, 18),
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pool_wallet_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chain_id" integer NOT NULL,
	"wallet_address" varchar(42) NOT NULL,
	"pool_id" uuid NOT NULL,
	"latest_run_id" uuid NOT NULL,
	"covered_start_day_utc" varchar(10) NOT NULL,
	"covered_end_day_utc" varchar(10) NOT NULL,
	"first_participated_at" timestamp with time zone,
	"last_participated_at" timestamp with time zone,
	"status" varchar(24) DEFAULT 'unknown' NOT NULL,
	"exposure_mix" varchar(24) DEFAULT 'unknown' NOT NULL,
	"coverage_status" varchar(24) DEFAULT 'unknown' NOT NULL,
	"current_attributed_value_usd" numeric(38, 18) DEFAULT '0' NOT NULL,
	"current_deployed_value_usd" numeric(38, 18) DEFAULT '0' NOT NULL,
	"current_residual_value_usd" numeric(38, 18) DEFAULT '0' NOT NULL,
	"current_manual_value_usd" numeric(38, 18) DEFAULT '0' NOT NULL,
	"current_strategy_value_usd" numeric(38, 18) DEFAULT '0' NOT NULL,
	"capital_entered_usd" numeric(38, 18) DEFAULT '0' NOT NULL,
	"capital_withdrawn_usd" numeric(38, 18) DEFAULT '0' NOT NULL,
	"realized_pnl_usd" numeric(38, 18),
	"unrealized_pnl_usd" numeric(38, 18),
	"total_rewards_usd" numeric(38, 18) DEFAULT '0' NOT NULL,
	"annualized_return_pct" numeric(12, 6),
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pool_history_snapshots" ADD CONSTRAINT "pool_history_snapshots_pool_id_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."pools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_history_snapshots" ADD CONSTRAINT "pool_history_snapshots_latest_run_id_analysis_runs_id_fk" FOREIGN KEY ("latest_run_id") REFERENCES "public"."analysis_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_timeline_events" ADD CONSTRAINT "pool_timeline_events_pool_id_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."pools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_timeline_events" ADD CONSTRAINT "pool_timeline_events_latest_run_id_analysis_runs_id_fk" FOREIGN KEY ("latest_run_id") REFERENCES "public"."analysis_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_timeline_events" ADD CONSTRAINT "pool_timeline_events_source_ledger_event_id_ledger_events_id_fk" FOREIGN KEY ("source_ledger_event_id") REFERENCES "public"."ledger_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_timeline_events" ADD CONSTRAINT "pool_timeline_events_related_deposit_id_deposits_id_fk" FOREIGN KEY ("related_deposit_id") REFERENCES "public"."deposits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_timeline_events" ADD CONSTRAINT "pool_timeline_events_related_strategy_id_strategies_id_fk" FOREIGN KEY ("related_strategy_id") REFERENCES "public"."strategies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_wallet_summaries" ADD CONSTRAINT "pool_wallet_summaries_pool_id_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."pools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_wallet_summaries" ADD CONSTRAINT "pool_wallet_summaries_latest_run_id_analysis_runs_id_fk" FOREIGN KEY ("latest_run_id") REFERENCES "public"."analysis_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pool_history_snapshots_identity_uidx" ON "pool_history_snapshots" USING btree ("chain_id","wallet_address","pool_id","day_utc");--> statement-breakpoint
CREATE INDEX "pool_history_snapshots_pool_day_idx" ON "pool_history_snapshots" USING btree ("chain_id","wallet_address","pool_id","day_utc");--> statement-breakpoint
CREATE INDEX "pool_history_snapshots_day_idx" ON "pool_history_snapshots" USING btree ("chain_id","wallet_address","day_utc");--> statement-breakpoint
CREATE UNIQUE INDEX "pool_timeline_events_identity_uidx" ON "pool_timeline_events" USING btree ("chain_id","wallet_address","pool_id","event_key");--> statement-breakpoint
CREATE INDEX "pool_timeline_events_occurred_idx" ON "pool_timeline_events" USING btree ("chain_id","wallet_address","pool_id","occurred_at");--> statement-breakpoint
CREATE INDEX "pool_timeline_events_run_idx" ON "pool_timeline_events" USING btree ("chain_id","wallet_address","latest_run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pool_wallet_summaries_identity_uidx" ON "pool_wallet_summaries" USING btree ("chain_id","wallet_address","pool_id");--> statement-breakpoint
CREATE INDEX "pool_wallet_summaries_status_idx" ON "pool_wallet_summaries" USING btree ("chain_id","wallet_address","status");--> statement-breakpoint
CREATE INDEX "pool_wallet_summaries_coverage_idx" ON "pool_wallet_summaries" USING btree ("chain_id","wallet_address","coverage_status");--> statement-breakpoint
CREATE INDEX "pool_wallet_summaries_updated_idx" ON "pool_wallet_summaries" USING btree ("chain_id","wallet_address","updated_at");