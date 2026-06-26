/**
 * Démonstration de contrat — lot 0.2 (DoD : « enums & types importables app+api »).
 *
 * Prouve, à la compilation, que `@hpt/shared` est consommable côté app (Expo) :
 * enums et calcul (valeurs) comme types d'entité (types). L'app et l'api
 * partagent ainsi LA MÊME implémentation : l'aperçu client et le calcul serveur
 * ne peuvent pas diverger (Architecture §2).
 */
import {
  type Cheval,
  estCombinaison,
  type Obstacle,
  TYPES_OBSTACLE,
  type TypeObstacle,
  tauxCombinaison,
} from '@hpt/shared';

const typesDisponibles: readonly TypeObstacle[] = TYPES_OBSTACLE;

/** Aperçu client du taux d'une combinaison — même fonction que côté serveur. */
function aperçuTauxCombinaison(
  obstacle: Pick<Obstacle, 'type' | 'répétitions' | 'barres' | 'refus' | 'nombre_d_éléments'>,
): number | null {
  if (!estCombinaison(obstacle.type) || obstacle.nombre_d_éléments === undefined) return null;
  return tauxCombinaison({
    répétitions: obstacle.répétitions,
    nombre_d_éléments: obstacle.nombre_d_éléments,
    barres: obstacle.barres,
    refus: obstacle.refus,
  });
}

export const DÉMO_CONTRAT_APP = {
  typesDisponibles,
  aperçuTauxCombinaison,
  nomCheval: (cheval: Cheval): string => cheval.nom,
} as const;
