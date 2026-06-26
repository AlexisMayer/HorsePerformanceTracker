import { integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';
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
});
