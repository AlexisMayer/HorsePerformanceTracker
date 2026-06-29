import type { TypeObstacleSimple } from '@hpt/shared';
import { integer, jsonb, pgTable, uuid } from 'drizzle-orm/pg-core';
import { champsTechniques } from './champs-techniques';
import { combinaison } from './combinaison';
import { obstacleTypeEnum } from './enums';
import { seance } from './seance';

/**
 * Obstacle — unité atomique de l'entraînement (Modèle §3/§6.1).
 *
 * Les champs de combinaison sont **inline** : ils n'ont de sens que lorsque
 * `type === 'Combinaison'` (type-conteneur, Modèle §0), d'où leur nullabilité.
 *
 * - `répétitions` : compteur, défaut 1 (dénominateur exact des taux, §7).
 * - `barres` / `refus` : compteurs, défaut 0.
 * - `difficulté` : marqueur de la **couche contexte**, optionnel, JAMAIS
 *   agrégé (Modèle §1).
 * - `nombre_d_éléments` : si Combinaison, multiplicateur du dénominateur (§7).
 * - `éléments` : si Combinaison, **liste ordonnée** de types d'obstacle simple,
 *   stockée en **`jsonb`** (choix consigné au journal : ordonné, court,
 *   sans-schéma — un `jsonb` préserve l'ordre et reste interrogeable, là où une
 *   table fille serait prématurée ; le détail réutilisable est le lot 2.5).
 *
 * **`combinaison_ref` (lot 2.5, reporté de 0.3)** : lien optionnel vers une
 * Combinaison réutilisable instanciée. Nullable, FK en **`ON DELETE SET NULL`** :
 * si la réutilisable est supprimée, l'obstacle **conserve** ses valeurs
 * d'instanciation (`nombre_d_éléments` copié inline, hauteur, barres/refus) et
 * donc son **taux** (§7, self-contained) ; il perd seulement le **lien nommé** et
 * l'héritage des `éléments`. À l'instanciation, `nombre_d_éléments` est **copié**
 * depuis la réutilisable (requis par la formule §7) tandis que `éléments` reste
 * **hérité** via la ref (non dupliqué → `null` inline). Migration **additive**.
 */
export const obstacle = pgTable('obstacle', {
  ...champsTechniques,
  seance_id: uuid('seance_id')
    .notNull()
    .references(() => seance.id, { onDelete: 'cascade' }),
  type: obstacleTypeEnum('type').notNull(),
  hauteur: integer('hauteur').notNull(),
  répétitions: integer('repetitions').notNull().default(1),
  barres: integer('barres').notNull().default(0),
  refus: integer('refus').notNull().default(0),
  difficulté: integer('difficulte'),
  nombre_d_éléments: integer('nombre_d_elements'),
  éléments: jsonb('elements').$type<TypeObstacleSimple[]>(),
  combinaison_ref: uuid('combinaison_ref').references(() => combinaison.id, {
    onDelete: 'set null',
  }),
});
