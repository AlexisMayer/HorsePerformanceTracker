/**
 * **Franchissements propres** — fonction pure (Modèle §10), brique des dérivés
 * « records/jalons » (feed, lot 3.1) **et** « hauteur maîtrisée » (metrics, lot
 * 3.2). Une **seule** implémentation, partagée (Architecture §2) : la vitrine et
 * le feed ne peuvent pas compter différemment.
 *
 * > **Franchissement propre** = un effort sans faute, à la hauteur de l'unité.
 *
 * Convention conservatrice du §10 :
 *  - **Obstacle simple** : `répétitions − barres − refus` efforts propres (borné
 *    ≥ 0) — chaque répétition non fautée est un franchissement propre.
 *  - **Combinaison** : comptée **seulement si l'entrée est entièrement sans
 *    faute** (barres = 0 ET refus = 0), pour `répétitions` franchissements à sa
 *    hauteur ; sinon **0**. On n'attribue pas la faute par élément, donc une
 *    seule faute disqualifie toute la ligne (règle conservatrice).
 *  - **Tour de concours** : `1` franchissement propre s'il est sans-faute, sinon
 *    `0`, à la hauteur de l'épreuve.
 *
 * Aucune entrée ne fait planter la fonction : une valeur invalide (négative, non
 * entière, NaN) compte **0** franchissement propre (rien n'est célébré à tort).
 */

import { estCombinaison, type TypeObstacle } from '../enums/obstacle';
import { sansFaute } from './sans-faute';

/**
 * Obstacle réduit à ce qui détermine ses franchissements propres / ses efforts
 * (§7/§10). Forme **canonique** réutilisée par `faits-seance` et `jalons` —
 * l'api la projette depuis une séance persistée. `nombre_d_éléments` n'a de sens
 * que pour une `Combinaison` (multiplicateur du dénominateur, §7).
 */
export interface ObstacleFranchissement {
  type: TypeObstacle;
  hauteur: number;
  répétitions: number;
  barres: number;
  refus: number;
  nombre_d_éléments?: number | null;
}

/** Tour de concours réduit à ses fautes + sa hauteur (§10). */
export interface TourFranchissement {
  hauteur: number;
  barres: number;
  refus: number;
}

function estEntierNonNégatif(n: number): boolean {
  return Number.isInteger(n) && n >= 0;
}

/**
 * Nombre de franchissements **propres** d'un obstacle à sa hauteur (§10). Voir
 * la convention conservatrice en tête de fichier. Renvoie un entier ≥ 0.
 */
export function franchissementsObstacle(o: ObstacleFranchissement): number {
  if (![o.répétitions, o.barres, o.refus].every(estEntierNonNégatif)) return 0;
  if (estCombinaison(o.type)) {
    // Conservateur : la ligne entière doit être propre ; alors `répétitions`
    // franchissements à sa hauteur (la combinaison compte comme une unité saine).
    return sansFaute({ barres: o.barres, refus: o.refus }) ? o.répétitions : 0;
  }
  return Math.max(0, o.répétitions - o.barres - o.refus);
}

/** Franchissements propres d'un tour de concours (§10) : 1 si sans-faute, sinon 0. */
export function franchissementsTour(t: TourFranchissement): number {
  if (![t.barres, t.refus].every(estEntierNonNégatif)) return 0;
  return sansFaute({ barres: t.barres, refus: t.refus }) ? 1 : 0;
}
