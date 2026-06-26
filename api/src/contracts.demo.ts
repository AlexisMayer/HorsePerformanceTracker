/**
 * Démonstration de contrat — lot 0.2 (DoD : « enums & types importables app+api »).
 *
 * Prouve, à la compilation, que `@hpt/shared` est consommable côté api : enums
 * et fonctions de calcul (valeurs) comme types d'entité et DTO (types). Ce
 * n'est PAS un module de domaine — ceux-ci arrivent avec leurs lots. Exclu du
 * build de production (`tsconfig.build.json`) ; seul le typecheck le vérifie.
 */
import {
  type Compte,
  type CompteSortie,
  compteSortieSchema,
  TIERS,
  type Tier,
  tauxObstacleSimple,
} from '@hpt/shared';

const tierParDéfaut: Tier = TIERS[0];

/** Projection publique : `password_hash` ne peut pas transiter (DTO de sortie). */
function projeterCompte(compte: Compte): CompteSortie {
  return compteSortieSchema.parse(compte);
}

export const DÉMO_CONTRAT_API = {
  tierParDéfaut,
  projeterCompte,
  exempleTaux: tauxObstacleSimple({ répétitions: 4, barres: 1, refus: 0 }),
} as const;
