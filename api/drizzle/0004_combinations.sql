CREATE TABLE "combinaison" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"compte_id" uuid NOT NULL,
	"nom" text NOT NULL,
	"nombre_d_elements" integer NOT NULL,
	"elements" jsonb NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "obstacle" ADD COLUMN "combinaison_ref" uuid;--> statement-breakpoint
ALTER TABLE "combinaison" ADD CONSTRAINT "combinaison_compte_id_compte_id_fk" FOREIGN KEY ("compte_id") REFERENCES "public"."compte"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "combinaison_compte_id_idx" ON "combinaison" USING btree ("compte_id");--> statement-breakpoint
ALTER TABLE "obstacle" ADD CONSTRAINT "obstacle_combinaison_ref_combinaison_id_fk" FOREIGN KEY ("combinaison_ref") REFERENCES "public"."combinaison"("id") ON DELETE set null ON UPDATE no action;