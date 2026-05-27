CREATE TABLE "approval_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chain_id" integer NOT NULL,
	"wallet_address" varchar(42) NOT NULL,
	"tx_hash" varchar(66) NOT NULL,
	"log_index" integer DEFAULT 0 NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"token_address" varchar(42),
	"token_id" varchar(80),
	"spender_address" varchar(42) NOT NULL,
	"spender_contract_type" varchar(32),
	"related_pool_id" uuid,
	"related_deposit_id" uuid,
	"source_ledger_event_id" uuid,
	"confidence" varchar(16) DEFAULT 'medium' NOT NULL,
	"latest_run_id" uuid,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inferred_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chain_id" integer NOT NULL,
	"wallet_address" varchar(42) NOT NULL,
	"action_type" varchar(48) NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"primary_pool_id" uuid,
	"deposit_id" uuid,
	"strategy_id" uuid,
	"source_ledger_event_id" uuid,
	"source_residual_lot_id" uuid,
	"consuming_ledger_event_ids_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"value_usd" numeric(38, 18),
	"confidence" varchar(16) DEFAULT 'medium' NOT NULL,
	"latest_run_id" uuid,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "approval_links" ADD CONSTRAINT "approval_links_related_pool_id_pools_id_fk" FOREIGN KEY ("related_pool_id") REFERENCES "public"."pools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_links" ADD CONSTRAINT "approval_links_related_deposit_id_deposits_id_fk" FOREIGN KEY ("related_deposit_id") REFERENCES "public"."deposits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_links" ADD CONSTRAINT "approval_links_source_ledger_event_id_ledger_events_id_fk" FOREIGN KEY ("source_ledger_event_id") REFERENCES "public"."ledger_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_links" ADD CONSTRAINT "approval_links_latest_run_id_analysis_runs_id_fk" FOREIGN KEY ("latest_run_id") REFERENCES "public"."analysis_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inferred_actions" ADD CONSTRAINT "inferred_actions_primary_pool_id_pools_id_fk" FOREIGN KEY ("primary_pool_id") REFERENCES "public"."pools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inferred_actions" ADD CONSTRAINT "inferred_actions_deposit_id_deposits_id_fk" FOREIGN KEY ("deposit_id") REFERENCES "public"."deposits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inferred_actions" ADD CONSTRAINT "inferred_actions_strategy_id_strategies_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."strategies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inferred_actions" ADD CONSTRAINT "inferred_actions_source_ledger_event_id_ledger_events_id_fk" FOREIGN KEY ("source_ledger_event_id") REFERENCES "public"."ledger_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inferred_actions" ADD CONSTRAINT "inferred_actions_source_residual_lot_id_attribution_source_lots_id_fk" FOREIGN KEY ("source_residual_lot_id") REFERENCES "public"."attribution_source_lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inferred_actions" ADD CONSTRAINT "inferred_actions_latest_run_id_analysis_runs_id_fk" FOREIGN KEY ("latest_run_id") REFERENCES "public"."analysis_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "approval_links_wallet_idx" ON "approval_links" USING btree ("wallet_address","chain_id");--> statement-breakpoint
CREATE INDEX "approval_links_spender_idx" ON "approval_links" USING btree ("spender_address","chain_id");--> statement-breakpoint
CREATE UNIQUE INDEX "approval_links_identity_uidx" ON "approval_links" USING btree ("chain_id","tx_hash","log_index");--> statement-breakpoint
CREATE INDEX "inferred_actions_wallet_idx" ON "inferred_actions" USING btree ("wallet_address","chain_id");--> statement-breakpoint
CREATE INDEX "inferred_actions_pool_idx" ON "inferred_actions" USING btree ("primary_pool_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inferred_actions_identity_uidx" ON "inferred_actions" USING btree ("chain_id","wallet_address","action_type",coalesce("source_ledger_event_id", '00000000-0000-0000-0000-000000000000'::uuid));