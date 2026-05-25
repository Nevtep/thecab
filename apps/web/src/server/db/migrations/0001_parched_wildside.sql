CREATE TABLE "user_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_address" varchar(42) NOT NULL,
	"chain_id" integer,
	"key" text NOT NULL,
	"value_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "user_preferences_scope_key_uidx" ON "user_preferences" USING btree ("wallet_address",coalesce("chain_id", -1),"key");--> statement-breakpoint
CREATE INDEX "user_preferences_wallet_idx" ON "user_preferences" USING btree ("wallet_address","chain_id");