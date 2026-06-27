ALTER TABLE "seance" ADD COLUMN "idempotency_key" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "seance" ADD CONSTRAINT "seance_cheval_idempotency_unique" UNIQUE("cheval_id","idempotency_key");