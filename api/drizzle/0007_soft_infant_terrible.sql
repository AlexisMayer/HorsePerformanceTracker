CREATE TABLE "bilan_augmente" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"seance_id" uuid NOT NULL,
	"date_generation" timestamp with time zone NOT NULL,
	"modele" text NOT NULL,
	"version" text NOT NULL,
	"analyse" text NOT NULL,
	"recommandations" text NOT NULL,
	CONSTRAINT "bilan_augmente_seance_unique" UNIQUE("seance_id")
);
--> statement-breakpoint
ALTER TABLE "bilan_augmente" ADD CONSTRAINT "bilan_augmente_seance_id_seance_id_fk" FOREIGN KEY ("seance_id") REFERENCES "public"."seance"("id") ON DELETE cascade ON UPDATE no action;