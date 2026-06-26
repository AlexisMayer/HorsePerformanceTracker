import { pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { champsTechniques } from './champs-techniques';
import { cheval } from './cheval';
import { seanceProvenanceEnum, seanceTypeEnum } from './enums';

/**
 * Séance (Modèle §3/§5) — porte l'**inviolabilité** (Modèle §2), encodée ici au
 * niveau de la *forme* :
 *
 * - `date` : date métier **immuable**, `NOT NULL`, **sans défaut** (fournie à la
 *   création ; pour le `déclaratif` elle peut différer de `created_at`).
 * - `date_modification` : `NULL` tant que la séance n'a pas été éditée ; posée à
 *   la première édition d'une séance ancienne.
 * - `provenance` : enum `live | déclaratif` (seul le `live` alimentera les
 *   métriques — règle appliquée par les agrégats, lots métier).
 *
 * L'**application** de l'immuabilité (refus d'un UPDATE silencieux de `date`,
 * pose automatique de `date_modification`/provenance) vit dans le **service
 * `sessions`** (Architecture §3), pas en base : le schéma en porte la *forme*,
 * pas la garde runtime. `ON DELETE CASCADE` vers `cheval`.
 *
 * Hors périmètre 0.3 (reportés, cf. journal) : la **clé d'idempotence** de
 * création (→ lot 2.2).
 */
export const seance = pgTable('seance', {
  ...champsTechniques,
  cheval_id: uuid('cheval_id')
    .notNull()
    .references(() => cheval.id, { onDelete: 'cascade' }),
  type: seanceTypeEnum('type').notNull(),
  date: timestamp('date', { withTimezone: true, mode: 'date' }).notNull(),
  date_modification: timestamp('date_modification', { withTimezone: true, mode: 'date' }),
  provenance: seanceProvenanceEnum('provenance').notNull(),
});
