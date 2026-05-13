CREATE TABLE "analysis_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_address" varchar(42) NOT NULL,
	"chain_id" integer NOT NULL,
	"status" varchar(24) DEFAULT 'queued' NOT NULL,
	"stage" varchar(64) DEFAULT 'queued' NOT NULL,
	"progress_pct" integer DEFAULT 0 NOT NULL,
	"mode" varchar(24) DEFAULT 'full_history' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now(),
	"completed_at" timestamp with time zone,
	"last_error" text,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chain_id" integer NOT NULL,
	"ledger_event_id" uuid,
	"movement_index" integer DEFAULT 0 NOT NULL,
	"wallet_address" varchar(42) NOT NULL,
	"token_address" varchar(42) NOT NULL,
	"direction_in" boolean DEFAULT true NOT NULL,
	"amount_raw" numeric(78, 0) NOT NULL,
	"amount_usd" numeric(38, 18),
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attribution_source_lots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chain_id" integer NOT NULL,
	"wallet_address" varchar(42) NOT NULL,
	"token_address" varchar(42) NOT NULL,
	"source_type" varchar(32) NOT NULL,
	"source_ledger_event_id" uuid,
	"amount_raw" numeric(78, 0) NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attribution_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chain_id" integer NOT NULL,
	"wallet_address" varchar(42) NOT NULL,
	"pool_id" uuid,
	"token_address" varchar(42) NOT NULL,
	"source_ledger_event_id" uuid,
	"residual_amount_raw" numeric(78, 0) NOT NULL,
	"resolution_status" varchar(32) DEFAULT 'still_waiting' NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coverage_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid,
	"chain_id" integer NOT NULL,
	"wallet_address" varchar(42) NOT NULL,
	"scope" varchar(32) NOT NULL,
	"status" varchar(24) NOT NULL,
	"confidence" varchar(16) DEFAULT 'medium' NOT NULL,
	"details" text,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deposits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chain_id" integer NOT NULL,
	"wallet_address" varchar(42) NOT NULL,
	"pool_id" uuid,
	"token_id" text,
	"status" varchar(24) DEFAULT 'open' NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discarded_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chain_id" integer NOT NULL,
	"wallet_address" varchar(42) NOT NULL,
	"tx_hash" varchar(66) NOT NULL,
	"reason_code" varchar(64) NOT NULL,
	"details" text,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "governance_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chain_id" integer NOT NULL,
	"wallet_address" varchar(42) NOT NULL,
	"tx_hash" varchar(66) NOT NULL,
	"log_index" integer DEFAULT 0 NOT NULL,
	"event_type" varchar(32) NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chain_id" integer NOT NULL,
	"tx_hash" varchar(66) NOT NULL,
	"log_index" integer DEFAULT 0 NOT NULL,
	"event_type" varchar(64) NOT NULL,
	"wallet_address" varchar(42) NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"confidence" varchar(16) DEFAULT 'medium' NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "performance_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chain_id" integer NOT NULL,
	"wallet_address" varchar(42) NOT NULL,
	"scope" varchar(24) NOT NULL,
	"scope_ref_id" uuid,
	"captured_at" timestamp with time zone NOT NULL,
	"value_usd" numeric(38, 18) DEFAULT '0' NOT NULL,
	"pnl_usd" numeric(38, 18),
	"annualized_return_pct" numeric(12, 6),
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chain_id" integer NOT NULL,
	"pool_address" varchar(42) NOT NULL,
	"label" text NOT NULL,
	"token0_address" varchar(42),
	"token1_address" varchar(42),
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chain_id" integer NOT NULL,
	"wallet_address" varchar(42) NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"total_value_usd" numeric(38, 18) DEFAULT '0' NOT NULL,
	"deployed_value_usd" numeric(38, 18),
	"idle_value_usd" numeric(38, 18),
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chain_id" integer NOT NULL,
	"token_address" varchar(42) NOT NULL,
	"priced_at" timestamp with time zone NOT NULL,
	"source" varchar(24) DEFAULT 'alchemy' NOT NULL,
	"resolution" varchar(24) DEFAULT 'spot' NOT NULL,
	"confidence" varchar(16) DEFAULT 'high' NOT NULL,
	"price_usd" numeric(38, 18) NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "protocol_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chain_id" integer NOT NULL,
	"address" varchar(42) NOT NULL,
	"protocol" varchar(32) NOT NULL,
	"contract_type" varchar(48) NOT NULL,
	"source" varchar(64) DEFAULT 'manual' NOT NULL,
	"source_reference" text,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raw_provider_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid,
	"provider" varchar(24) NOT NULL,
	"endpoint" text NOT NULL,
	"chain_id" integer NOT NULL,
	"wallet_address" varchar(42),
	"request_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"response_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"confidence" varchar(16) DEFAULT 'high' NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reward_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chain_id" integer NOT NULL,
	"wallet_address" varchar(42) NOT NULL,
	"tx_hash" varchar(66) NOT NULL,
	"log_index" integer DEFAULT 0 NOT NULL,
	"reward_type" varchar(32) NOT NULL,
	"token_address" varchar(42),
	"amount_raw" numeric(78, 0),
	"amount_usd" numeric(38, 18),
	"occurred_at" timestamp with time zone NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strategies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chain_id" integer NOT NULL,
	"label" text NOT NULL,
	"protocol" varchar(32) DEFAULT 'mellow' NOT NULL,
	"wrapper_address" varchar(42),
	"staking_rewards_address" varchar(42),
	"primary_pool_id" uuid,
	"coverage_status" varchar(24) DEFAULT 'unknown' NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_contexts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chain_id" integer NOT NULL,
	"wallet_address" varchar(42) NOT NULL,
	"last_analyzed_at" timestamp with time zone,
	"last_successful_run_id" uuid,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "asset_movements" ADD CONSTRAINT "asset_movements_ledger_event_id_ledger_events_id_fk" FOREIGN KEY ("ledger_event_id") REFERENCES "public"."ledger_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attribution_source_lots" ADD CONSTRAINT "attribution_source_lots_source_ledger_event_id_ledger_events_id_fk" FOREIGN KEY ("source_ledger_event_id") REFERENCES "public"."ledger_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attribution_states" ADD CONSTRAINT "attribution_states_pool_id_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."pools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attribution_states" ADD CONSTRAINT "attribution_states_source_ledger_event_id_ledger_events_id_fk" FOREIGN KEY ("source_ledger_event_id") REFERENCES "public"."ledger_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coverage_reports" ADD CONSTRAINT "coverage_reports_run_id_analysis_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."analysis_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_pool_id_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."pools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_provider_records" ADD CONSTRAINT "raw_provider_records_run_id_analysis_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."analysis_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategies" ADD CONSTRAINT "strategies_primary_pool_id_pools_id_fk" FOREIGN KEY ("primary_pool_id") REFERENCES "public"."pools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_contexts" ADD CONSTRAINT "wallet_contexts_last_successful_run_id_analysis_runs_id_fk" FOREIGN KEY ("last_successful_run_id") REFERENCES "public"."analysis_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analysis_runs_wallet_idx" ON "analysis_runs" USING btree ("wallet_address","chain_id");--> statement-breakpoint
CREATE INDEX "analysis_runs_status_idx" ON "analysis_runs" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "asset_movements_identity_uidx" ON "asset_movements" USING btree ("chain_id","ledger_event_id","movement_index");--> statement-breakpoint
CREATE INDEX "attribution_source_lots_wallet_idx" ON "attribution_source_lots" USING btree ("wallet_address","chain_id");--> statement-breakpoint
CREATE INDEX "attribution_states_wallet_idx" ON "attribution_states" USING btree ("wallet_address","chain_id");--> statement-breakpoint
CREATE INDEX "coverage_reports_wallet_idx" ON "coverage_reports" USING btree ("wallet_address","chain_id");--> statement-breakpoint
CREATE INDEX "deposits_wallet_idx" ON "deposits" USING btree ("wallet_address","chain_id");--> statement-breakpoint
CREATE INDEX "discarded_events_wallet_idx" ON "discarded_events" USING btree ("wallet_address","chain_id");--> statement-breakpoint
CREATE UNIQUE INDEX "governance_events_identity_uidx" ON "governance_events" USING btree ("chain_id","tx_hash","log_index","event_type");--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_events_identity_uidx" ON "ledger_events" USING btree ("chain_id","tx_hash","log_index","event_type");--> statement-breakpoint
CREATE INDEX "performance_snapshots_wallet_idx" ON "performance_snapshots" USING btree ("wallet_address","chain_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pools_chain_address_uidx" ON "pools" USING btree ("chain_id","pool_address");--> statement-breakpoint
CREATE UNIQUE INDEX "portfolio_snapshots_identity_uidx" ON "portfolio_snapshots" USING btree ("chain_id","wallet_address","captured_at");--> statement-breakpoint
CREATE UNIQUE INDEX "price_points_identity_uidx" ON "price_points" USING btree ("chain_id","token_address","priced_at","source","resolution");--> statement-breakpoint
CREATE UNIQUE INDEX "protocol_contracts_chain_address_uidx" ON "protocol_contracts" USING btree ("chain_id","address");--> statement-breakpoint
CREATE INDEX "raw_provider_records_chain_idx" ON "raw_provider_records" USING btree ("chain_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reward_events_identity_uidx" ON "reward_events" USING btree ("chain_id","tx_hash","log_index","reward_type");--> statement-breakpoint
CREATE INDEX "strategies_chain_idx" ON "strategies" USING btree ("chain_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_contexts_identity_uidx" ON "wallet_contexts" USING btree ("chain_id","wallet_address");