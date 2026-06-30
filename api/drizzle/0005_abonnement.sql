CREATE TYPE "public"."abonnement_statut" AS ENUM('en_attente', 'actif', 'annulé', 'échoué');--> statement-breakpoint
CREATE TYPE "public"."abonnement_tier" AS ENUM('premium', 'pro');--> statement-breakpoint
CREATE TABLE "abonnement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"compte_id" uuid NOT NULL,
	"tier_cible" "abonnement_tier" NOT NULL,
	"statut" "abonnement_statut" DEFAULT 'en_attente' NOT NULL,
	"mollie_customer_id" text,
	"mollie_payment_id" text,
	"mollie_subscription_id" text,
	"mollie_mandate_id" text
);
--> statement-breakpoint
ALTER TABLE "abonnement" ADD CONSTRAINT "abonnement_compte_id_compte_id_fk" FOREIGN KEY ("compte_id") REFERENCES "public"."compte"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "abonnement_compte_id_idx" ON "abonnement" USING btree ("compte_id");--> statement-breakpoint
CREATE INDEX "abonnement_mollie_payment_id_idx" ON "abonnement" USING btree ("mollie_payment_id");