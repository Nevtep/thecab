ALTER TABLE "reward_events" ADD COLUMN "strategy_exposure_id" uuid;--> statement-breakpoint
ALTER TABLE "reward_events" ADD COLUMN "resolved_pool_id" uuid;--> statement-breakpoint
ALTER TABLE "reward_events" ADD COLUMN "resolution_basis" varchar(32);--> statement-breakpoint
ALTER TABLE "reward_events" ADD COLUMN "resolution_reason_codes" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "reward_events" ADD CONSTRAINT "reward_events_strategy_exposure_id_strategy_exposures_id_fk" FOREIGN KEY ("strategy_exposure_id") REFERENCES "public"."strategy_exposures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_events" ADD CONSTRAINT "reward_events_resolved_pool_id_pools_id_fk" FOREIGN KEY ("resolved_pool_id") REFERENCES "public"."pools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reward_events_strategy_exposure_idx" ON "reward_events" USING btree ("strategy_exposure_id");--> statement-breakpoint
CREATE INDEX "reward_events_resolved_pool_idx" ON "reward_events" USING btree ("resolved_pool_id");