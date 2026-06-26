CREATE TYPE "public"."cheval_niveau" AS ENUM('amateur', 'pro');--> statement-breakpoint
CREATE TYPE "public"."compte_tier" AS ENUM('gratuit', 'premium', 'pro');--> statement-breakpoint
CREATE TYPE "public"."compte_type" AS ENUM('amateur', 'coach');--> statement-breakpoint
CREATE TYPE "public"."obstacle_type" AS ENUM('Croix', 'Vertical', 'Oxer', 'Triple barre', 'Mur', 'Rivière', 'Combinaison');--> statement-breakpoint
CREATE TYPE "public"."seance_provenance" AS ENUM('live', 'déclaratif');--> statement-breakpoint
CREATE TYPE "public"."seance_type" AS ENUM('Plat', 'Gymnastique', 'Parcours', 'Concours');--> statement-breakpoint
CREATE TABLE "cheval" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"compte_id" uuid NOT NULL,
	"nom" text NOT NULL,
	"niveau" "cheval_niveau" NOT NULL,
	"hauteur_de_reference" integer NOT NULL,
	"age" integer,
	"race" text
);
--> statement-breakpoint
CREATE TABLE "compte" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"email" text NOT NULL,
	"nom" text NOT NULL,
	"password_hash" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"type" "compte_type" NOT NULL,
	"tier" "compte_tier" DEFAULT 'gratuit' NOT NULL,
	CONSTRAINT "compte_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "contexte" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"seance_id" uuid NOT NULL,
	"ressenti_global" integer,
	"energie" integer,
	"note" text,
	CONSTRAINT "contexte_seance_id_unique" UNIQUE("seance_id")
);
--> statement-breakpoint
CREATE TABLE "obstacle" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"seance_id" uuid NOT NULL,
	"type" "obstacle_type" NOT NULL,
	"hauteur" integer NOT NULL,
	"repetitions" integer DEFAULT 1 NOT NULL,
	"barres" integer DEFAULT 0 NOT NULL,
	"refus" integer DEFAULT 0 NOT NULL,
	"difficulte" integer,
	"nombre_d_elements" integer,
	"elements" jsonb
);
--> statement-breakpoint
CREATE TABLE "seance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cheval_id" uuid NOT NULL,
	"type" "seance_type" NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"date_modification" timestamp with time zone,
	"provenance" "seance_provenance" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tour" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"seance_id" uuid NOT NULL,
	"hauteur" integer NOT NULL,
	"barres" integer DEFAULT 0 NOT NULL,
	"refus" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cheval" ADD CONSTRAINT "cheval_compte_id_compte_id_fk" FOREIGN KEY ("compte_id") REFERENCES "public"."compte"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contexte" ADD CONSTRAINT "contexte_seance_id_seance_id_fk" FOREIGN KEY ("seance_id") REFERENCES "public"."seance"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obstacle" ADD CONSTRAINT "obstacle_seance_id_seance_id_fk" FOREIGN KEY ("seance_id") REFERENCES "public"."seance"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seance" ADD CONSTRAINT "seance_cheval_id_cheval_id_fk" FOREIGN KEY ("cheval_id") REFERENCES "public"."cheval"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tour" ADD CONSTRAINT "tour_seance_id_seance_id_fk" FOREIGN KEY ("seance_id") REFERENCES "public"."seance"("id") ON DELETE cascade ON UPDATE no action;