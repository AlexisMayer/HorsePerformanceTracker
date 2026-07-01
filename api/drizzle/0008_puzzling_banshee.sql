CREATE TYPE "public"."acces_invite_statut" AS ENUM('en_attente', 'actif', 'révoqué');--> statement-breakpoint
CREATE TABLE "acces_invite" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cheval_id" uuid NOT NULL,
	"compte_pro_id" uuid NOT NULL,
	"invite_email" text NOT NULL,
	"invite_compte_id" uuid,
	"statut" "acces_invite_statut" DEFAULT 'en_attente' NOT NULL,
	"token_hash" text,
	CONSTRAINT "acces_invite_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "acces_invite" ADD CONSTRAINT "acces_invite_cheval_id_cheval_id_fk" FOREIGN KEY ("cheval_id") REFERENCES "public"."cheval"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acces_invite" ADD CONSTRAINT "acces_invite_compte_pro_id_compte_id_fk" FOREIGN KEY ("compte_pro_id") REFERENCES "public"."compte"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acces_invite" ADD CONSTRAINT "acces_invite_invite_compte_id_compte_id_fk" FOREIGN KEY ("invite_compte_id") REFERENCES "public"."compte"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "acces_invite_cheval_id_idx" ON "acces_invite" USING btree ("cheval_id");--> statement-breakpoint
CREATE INDEX "acces_invite_invite_compte_id_idx" ON "acces_invite" USING btree ("invite_compte_id");--> statement-breakpoint
CREATE INDEX "acces_invite_compte_pro_id_idx" ON "acces_invite" USING btree ("compte_pro_id");