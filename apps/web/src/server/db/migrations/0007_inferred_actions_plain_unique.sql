-- Drop the coalesce-expression unique index in favor of plain column tuple so
-- drizzle's `onConflictDoUpdate.target` can reference the columns directly.
-- The engine always emits inferred_actions with a non-null source_ledger_event_id,
-- so NULL handling via coalesce is unnecessary.
DROP INDEX IF EXISTS "inferred_actions_identity_uidx";
CREATE UNIQUE INDEX "inferred_actions_identity_uidx" ON "inferred_actions" USING btree ("chain_id","wallet_address","action_type","source_ledger_event_id");
