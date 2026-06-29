import type { TypeObstacleSimple } from '@hpt/shared';
import { index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { champsTechniques } from './champs-techniques';
import { compte } from './compte';

/**
 * Combinaison réutilisable (Modèle §3/§8, lot 2.5) — **bibliothèque au niveau du
 * compte**. Hors socle 0.2/0.3 (différée jusqu'ici comme prévu) : ajoutée par
 * **migration additive**, sans toucher aux tables socle.
 *
 * - **Portée compte** : `compte_id` (PAS un cheval) en **`ON DELETE CASCADE`** —
 *   support structurel de la purge RGPD (cohérent avec la cascade descendante du
 *   socle 0.3 et `refresh_token` 1.1). Une réutilisable est instanciable sur
 *   **plusieurs chevaux** du compte ; seule l'instanciation (`Obstacle.
 *   combinaison_ref`) est liée à un cheval.
 * - **PAS de hauteur** : elle est fournie à l'instanciation. La structure figée
 *   se résume à `nombre_d_éléments` + `éléments` (liste **ordonnée** de types
 *   simples, en `jsonb` — même choix que `obstacle.éléments` en 0.3 : ordonné,
 *   court, sans-schéma).
 * - **`usage_count` / `last_used_at`** : compteurs **techniques** du **tri
 *   anti-bloat** (« plus utilisées, récentes » — Spec §4.3), bumpés par le
 *   service `combinations` à chaque instanciation. Hors Modèle de données ⇒
 *   **exclus de l'alignement `shared`** (même posture que `idempotency_key` en
 *   2.2). Clés ASCII ; noms de colonne désaccentués (`nombre_d_elements`,
 *   `elements`) comme en 0.3, la clé TS gardant l'accent du domaine.
 *
 * **Modification = nouvelle** (Modèle §8) : éditer une réutilisable en **crée une
 * nouvelle** ligne (l'ancienne intacte) — l'identité (`id`) est stable, garantie
 * du benchmark (lot 5.2). Aucune colonne de versioning ici (volontairement).
 */
export const combinaison = pgTable(
  'combinaison',
  {
    ...champsTechniques,
    compte_id: uuid('compte_id')
      .notNull()
      .references(() => compte.id, { onDelete: 'cascade' }),
    nom: text('nom').notNull(),
    nombre_d_éléments: integer('nombre_d_elements').notNull(),
    éléments: jsonb('elements').$type<TypeObstacleSimple[]>().notNull(),
    /** Compteur d'instanciations (monotone) — signal « plus utilisées ». */
    usage_count: integer('usage_count').notNull().default(0),
    /** Dernière instanciation — départage les usages égaux (« récentes »). */
    last_used_at: timestamp('last_used_at', { withTimezone: true, mode: 'date' }),
  },
  (t) => [index('combinaison_compte_id_idx').on(t.compte_id)],
);
