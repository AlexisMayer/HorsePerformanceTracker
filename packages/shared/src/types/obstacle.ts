import type { TypeObstacle, TypeObstacleSimple } from '../enums/obstacle';
import type { ChampsTechniques } from './champs-techniques';

/**
 * Obstacle — unité atomique de l'entraînement (Modèle §3/§6.1).
 *
 * Les champs de combinaison sont *inline* : ils n'ont de sens que lorsque
 * `type === 'Combinaison'` (type-conteneur, Modèle §0). Les fautes restent au
 * niveau de la combinaison, jamais par élément.
 */
export interface Obstacle extends ChampsTechniques {
  seance_id: string;
  type: TypeObstacle;
  /** Hauteur en cm, sur un cran du référentiel (§0). */
  hauteur: number;
  /** Compteur (défaut 1) ; dénominateur exact des taux de réussite (§7). */
  répétitions: number;
  barres: number;
  refus: number;
  /** Marqueur de couche contexte — optionnel, JAMAIS agrégé (§1). */
  difficulté?: number;
  /** Si Combinaison : multiplicateur du dénominateur (§7). Présent inline même
   *  instancié depuis une réutilisable (copié à l'instanciation — calcul §7
   *  self-contained, lot 2.5). */
  nombre_d_éléments?: number;
  /** Si Combinaison : types des éléments, dans l'ordre (optionnel ; **hérités**
   *  via `combinaison_ref` quand l'obstacle instancie une réutilisable). */
  éléments?: TypeObstacleSimple[];
  /** Si Combinaison : lien vers la réutilisable instanciée (Modèle §3/§8, lot
   *  2.5). Nullable ; `ON DELETE SET NULL` si la réutilisable est supprimée —
   *  l'obstacle garde alors ses valeurs (`nombre_d_éléments`, hauteur, taux) et
   *  perd seulement le lien nommé + l'héritage des `éléments`. */
  combinaison_ref?: string;
}
