import { boolean, pgTable, text } from 'drizzle-orm/pg-core';
import { champsTechniques } from './champs-techniques';
import { compteTierEnum, compteTypeEnum } from './enums';

/**
 * Compte utilisateur (Modèle §3) — racine de la propriété ; tout cascade vers
 * le bas depuis ici (Compte → Cheval → Séance → …).
 *
 * `password_hash` est un secret : il vit en base mais aucun DTO de sortie ne
 * l'expose (cf. `compteSortieSchema` de `shared`). `email` est l'identité de
 * connexion → unique. Le hachage du mot de passe et la validation appartiennent
 * aux lots d'auth (1.1), pas au schéma.
 */
export const compte = pgTable('compte', {
  ...champsTechniques,
  email: text('email').notNull().unique(),
  nom: text('nom').notNull(),
  password_hash: text('password_hash').notNull(),
  email_verified: boolean('email_verified').notNull().default(false),
  type: compteTypeEnum('type').notNull(),
  tier: compteTierEnum('tier').notNull().default('gratuit'),
});
