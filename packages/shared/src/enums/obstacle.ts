/**
 * Types d'obstacle — chips du référentiel (Modèle §0).
 *
 * `Combinaison` est un type-conteneur : mêmes champs qu'un obstacle simple,
 * plus `nombre_d_éléments` (multiplicateur du dénominateur, §7) et, au choix,
 * le détail ordonné de ses éléments. Un élément de combinaison est toujours un
 * obstacle *simple* (pas une combinaison imbriquée) : d'où `TypeObstacleSimple`.
 */

export const TYPES_OBSTACLE_SIMPLE = [
  'Croix',
  'Vertical',
  'Oxer',
  'Triple barre',
  'Mur',
  'Rivière',
] as const;

export type TypeObstacleSimple = (typeof TYPES_OBSTACLE_SIMPLE)[number];

export const TYPES_OBSTACLE = [...TYPES_OBSTACLE_SIMPLE, 'Combinaison'] as const;

export type TypeObstacle = (typeof TYPES_OBSTACLE)[number];

/** Vrai si l'obstacle est une combinaison (ouvre `nombre_d_éléments` / `éléments`). */
export function estCombinaison(type: TypeObstacle): boolean {
  return type === 'Combinaison';
}
