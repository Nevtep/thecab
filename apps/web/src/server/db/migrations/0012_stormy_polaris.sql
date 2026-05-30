CREATE INDEX "reward_events_wallet_occurred_idx" ON "reward_events" USING btree ("chain_id","wallet_address","occurred_at");--> statement-breakpoint
CREATE INDEX "reward_events_wallet_resolution_idx" ON "reward_events" USING btree ("chain_id","wallet_address","resolution_status");--> statement-breakpoint
CREATE INDEX "reward_events_wallet_token_idx" ON "reward_events" USING btree ("chain_id","wallet_address","token_address");--> statement-breakpoint
CREATE INDEX "reward_events_wallet_reward_type_idx" ON "reward_events" USING btree ("chain_id","wallet_address","reward_type");--> statement-breakpoint
CREATE INDEX "reward_events_wallet_deposit_idx" ON "reward_events" USING btree ("chain_id","wallet_address","deposit_or_strategy_id");