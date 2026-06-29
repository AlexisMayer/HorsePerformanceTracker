import type { TypeObstacleSimple } from '../enums/obstacle';
import type { ChampsTechniques } from './champs-techniques';

/**
 * Combinaison réutilisable (Modèle §3/§8) — entité de la **bibliothèque au
 * niveau du compte**. Seules les combinaisons ont une structure qu'on rejoue
 * d'une séance à l'autre ; la séance, elle, est une collection jetable.
 *
 * **Portée compte** (`compte_id`, PAS un cheval) : un coach rejoue la même
 * combinaison sur plusieurs chevaux sans la ressaisir ; seule l'**instanciation**
 * (un `Obstacle` de type Combinaison portant `combinaison_ref`) est liée à un
 * cheval.
 *
 * **PAS de hauteur** : elle est fournie à l'instanciation dans une séance. La
 * structure figée se résume au `nombre_d_éléments` et aux `éléments` (types +
 * ordre). Un élément est toujours un obstacle *simple* (pas de combinaison
 * imbriquée), d'où `TypeObstacleSimple[]`.
 *
 * **Identité stable** (Modèle §8) : modifier une réutilisable en **crée une
 * nouvelle** (pas de versioning) → l'`id` ne « bouge » jamais sous un benchmark
 * (lot 5.2). Les compteurs d'usage (tri anti-bloat) sont des champs **techniques**
 * portés par la table, hors de cette forme de domaine (cf. journal 2.5).
 */
export interface CombinaisonRéutilisable extends ChampsTechniques {
  compte_id: string;
  nom: string;
  /** Structure figée : multiplicateur du dénominateur à l'instanciation (§7). */
  nombre_d_éléments: number;
  /** Structure figée : types des éléments, dans l'ordre. */
  éléments: TypeObstacleSimple[];
}
