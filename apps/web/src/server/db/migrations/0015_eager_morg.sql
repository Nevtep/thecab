CREATE TABLE "engine_v2_classified_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canonical_transaction_id" uuid NOT NULL,
	"chain_id" integer NOT NULL,
	"wallet_address" varchar(42) NOT NULL,
	"tx_hash" varchar(66) NOT NULL,
	"occurred_at" timestamp with time zone,
	"block_number" numeric(38, 0),
	"transaction_index" integer,
	"sequence_index" integer DEFAULT 0 NOT NULL,
	"from_address" varchar(42),
	"to_address" varchar(42),
	"selector" varchar(10) NOT NULL,
	"contract_label" text,
	"contract_name" text,
	"decoded_function" varchar(128),
	"decoded_args_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"transfer_count" integer DEFAULT 0 NOT NULL,
	"inbound_transfer_count" integer DEFAULT 0 NOT NULL,
	"outbound_transfer_count" integer DEFAULT 0 NOT NULL,
	"approval_count" integer DEFAULT 0 NOT NULL,
	"classification" varchar(96) NOT NULL,
	"classifier_version" varchar(32) NOT NULL,
	"confidence" varchar(48) NOT NULL,
	"reason" text NOT NULL,
	"needs_resolution" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "engine_v2_classified_transactions" ADD CONSTRAINT "engine_v2_classified_transactions_canonical_transaction_id_canonical_transactions_id_fk" FOREIGN KEY ("canonical_transaction_id") REFERENCES "public"."canonical_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "engine_v2_classified_transactions_canonical_uidx" ON "engine_v2_classified_transactions" USING btree ("canonical_transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "engine_v2_classified_transactions_identity_uidx" ON "engine_v2_classified_transactions" USING btree ("chain_id","wallet_address","tx_hash");--> statement-breakpoint
CREATE INDEX "engine_v2_classified_transactions_wallet_idx" ON "engine_v2_classified_transactions" USING btree ("chain_id","wallet_address","occurred_at");--> statement-breakpoint
CREATE INDEX "engine_v2_classified_transactions_tx_idx" ON "engine_v2_classified_transactions" USING btree ("chain_id","tx_hash");--> statement-breakpoint
CREATE INDEX "engine_v2_classified_transactions_classification_idx" ON "engine_v2_classified_transactions" USING btree ("chain_id","wallet_address","classification");--> statement-breakpoint
CREATE INDEX "engine_v2_classified_transactions_selector_idx" ON "engine_v2_classified_transactions" USING btree ("chain_id","selector");--> statement-breakpoint
CREATE INDEX "engine_v2_classified_transactions_version_idx" ON "engine_v2_classified_transactions" USING btree ("classifier_version");