DROP INDEX "analysis_slices_identity_uidx";--> statement-breakpoint
CREATE UNIQUE INDEX "analysis_slices_run_index_uidx" ON "analysis_slices" USING btree ("run_id","slice_index");--> statement-breakpoint
CREATE INDEX "analysis_slices_window_idx" ON "analysis_slices" USING btree ("chain_id","wallet_address","slice_start_utc","slice_end_utc");