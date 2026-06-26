import { integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { champsTechniques } from './champs-techniques';
import { seance } from './seance';

/**
 * Contexte de séance — **couche qualitative** (Modèle §1/§3, 0..1 par séance).
 *
 * Choix consigné au journal : **table séparée** (et non des colonnes sur
 * `seance`). Deux raisons : (1) `Contexte` est une entité à part entière dans
 * `shared` (elle porte ses propres champs techniques `id/created_at/updated_at`)
 * — une table la reflète directement ; (2) isoler physiquement le qualitatif de
 * la colonne vertébrale objective matérialise les « deux couches étanches »
 * (§1) et la règle d'or « jamais agrégé ».
 *
 * Cardinalité **0..1** garantie par `UNIQUE(seance_id)` + `ON DELETE CASCADE`.
 * `ressenti_global` / `énergie` sont des échelles 1-5, `note` est libre — tous
 * optionnels (nullable). La **validation de plage** (1-5) appartient à Zod aux
 * frontières d'API (Architecture §5), pas au schéma : aucune contrainte `CHECK`
 * ici.
 */
export const contexte = pgTable('contexte', {
  ...champsTechniques,
  seance_id: uuid('seance_id')
    .notNull()
    .unique()
    .references(() => seance.id, { onDelete: 'cascade' }),
  ressenti_global: integer('ressenti_global'),
  énergie: integer('energie'),
  note: text('note'),
});
