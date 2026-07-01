import { boolean, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { champsTechniques } from './champs-techniques';
import { compte } from './compte';
import { chevalNiveauEnum } from './enums';

/**
 * Cheval (Modèle §3). Appartient à **un seul** compte en v1 (pas de partage) :
 * `ON DELETE CASCADE` vers `compte` — support structurel de la purge RGPD (la
 * *logique* de suppression de compte reste au lot 1.3).
 *
 * `hauteur_de_référence` est déclarative (cm, sur un cran du référentiel §0) ;
 * `âge` et `race` sont optionnels (nullable). Le nom de colonne physique est
 * désaccentué (`hauteur_de_reference`, `age`) ; la clé TS garde l'accent du
 * domaine pour rester alignée sur `shared`.
 *
 * `archivé` (lot 4.3, Spec §9.2) : un cheval **vendu/parti** est archivé →
 * **lecture seule** (son historique est conservé), **hors liste active** et
 * **hors quota** de chevaux, **réversible**. `NOT NULL DEFAULT false` : tout
 * cheval naît actif ; le décompte du quota (`countActifs`, pré-câblé en 4.1)
 * filtre `archivé = false`, si bien qu'un cheval archivé en **sort
 * mécaniquement**. Nom de colonne physique désaccentué (`archive`).
 */
export const cheval = pgTable('cheval', {
  ...champsTechniques,
  compte_id: uuid('compte_id')
    .notNull()
    .references(() => compte.id, { onDelete: 'cascade' }),
  nom: text('nom').notNull(),
  niveau: chevalNiveauEnum('niveau').notNull(),
  hauteur_de_référence: integer('hauteur_de_reference').notNull(),
  âge: integer('age'),
  race: text('race'),
  archivé: boolean('archive').notNull().default(false),
});
