import { integer, pgTable, uuid } from 'drizzle-orm/pg-core';
import { champsTechniques } from './champs-techniques';
import { seance } from './seance';

/**
 * Tour — unité atomique du concours (Modèle §3/§6.2). `hauteur` fixée par
 * l'épreuve ; `barres` / `refus` en compteurs (défaut 0).
 *
 * `sans_faute` (barres = 0 ET refus = 0) est **dérivé**, JAMAIS stocké
 * (Modèle §9/§10) : il se calcule via `calc/sansFaute` de `shared` — aucune
 * colonne ici. `ON DELETE CASCADE` vers `seance`.
 */
export const tour = pgTable('tour', {
  ...champsTechniques,
  seance_id: uuid('seance_id')
    .notNull()
    .references(() => seance.id, { onDelete: 'cascade' }),
  hauteur: integer('hauteur').notNull(),
  barres: integer('barres').notNull().default(0),
  refus: integer('refus').notNull().default(0),
});
