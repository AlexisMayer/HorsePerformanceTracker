import { timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Champs techniques communs à **toutes** les entités persistées (Modèle §3,
 * `ChampsTechniques` de `@hpt/shared`). Étalés (`...champsTechniques`) dans
 * chaque table — Drizzle n'a pas d'héritage de table, un bag de colonnes
 * partagé est l'équivalent idiomatique.
 *
 * - `id`        : UUID, clé primaire, défaut `gen_random_uuid()` (PG ≥ 13).
 * - `created_at`: horodatage technique de création.
 * - `updated_at`: horodatage technique de dernière écriture ; `$onUpdate` le
 *   repose à chaque update applicatif (la `date`/`date_modification` *métier*
 *   d'une séance est distincte, cf. `seance.ts`).
 *
 * Les types inférés (`string`, `Date`, `Date`) correspondent à
 * `ChampsTechniques` de `shared` (alignement vérifié dans `alignment.spec.ts`).
 */
export const champsTechniques = {
  id: uuid('id').primaryKey().defaultRandom(),
  created_at: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};
