import { pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
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
 * **Clé d'idempotence (lot 2.2, reportée de 0.3).** `idempotency_key` est un
 * **UUID généré côté client**, fourni à la création : un réessai avec la même clé
 * ne crée pas de doublon (Architecture §5, Stack §4). Colonne **technique hors
 * Modèle de données socle** (cf. journal 2.2) — d'où la clé ASCII et l'exclusion
 * de l'alignement `shared`. **Portée d'unicité = `(cheval_id, idempotency_key)`**
 * (« minimum nécessaire ») : l'idempotence porte sur « créer CETTE séance pour CE
 * cheval » ; scoper au cheval (lui-même scopé au compte par la propriété, 2.1)
 * confine l'espace de noms de la clé au propriétaire et évite qu'une clé d'un
 * tenant interfère avec un autre. Un UUID client rend toute collision dans ce
 * scope effectivement impossible, hors réessai légitime.
 */
export const seance = pgTable(
  'seance',
  {
    ...champsTechniques,
    cheval_id: uuid('cheval_id')
      .notNull()
      .references(() => cheval.id, { onDelete: 'cascade' }),
    type: seanceTypeEnum('type').notNull(),
    date: timestamp('date', { withTimezone: true, mode: 'date' }).notNull(),
    date_modification: timestamp('date_modification', { withTimezone: true, mode: 'date' }),
    provenance: seanceProvenanceEnum('provenance').notNull(),
    idempotency_key: uuid('idempotency_key').notNull(),
  },
  (t) => [unique('seance_cheval_idempotency_unique').on(t.cheval_id, t.idempotency_key)],
);
