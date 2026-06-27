CREATE TYPE "public"."verification_token_type" AS ENUM('email_verification', 'password_reset');--> statement-breakpoint
CREATE TABLE "verification_token" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"compte_id" uuid NOT NULL,
	"type" "verification_token_type" NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	CONSTRAINT "verification_token_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "verification_token" ADD CONSTRAINT "verification_token_compte_id_compte_id_fk" FOREIGN KEY ("compte_id") REFERENCES "public"."compte"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "verification_token_compte_id_idx" ON "verification_token" USING btree ("compte_id");