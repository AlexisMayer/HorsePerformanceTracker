/**
 * Taux de réussite à l'entraînement — fonctions pures (Modèle §7).
 *
 * Une **seule** implémentation, partagée par l'app (aperçu) et l'api (calcul) :
 * elles ne peuvent donc pas diverger. Le cœur du §7 est la **décomposition en
 * efforts** (`effortsObstacle` : numérateur `propres` / dénominateur `totaux`) —
 * réutilisée par le taux par-obstacle **et** par l'agrégation heatmap (lot 5.1),
 * qui somme ces efforts par cellule `type × hauteur`. Aucune arithmétique du §7
 * n'est réécrite ailleurs.
 *
 * Convention de retour : `null` = taux **non calculable** (dénominateur nul ou
 * entrée incohérente). Sinon, un nombre borné dans [0, 1]. Aucune entrée ne
 * fait planter la fonction.
 */

import { estCombinaison, type TypeObstacle } from '../enums/obstacle';

export interface ObstacleSimpleInput {
  répétitions: number;
  barres: number;
  refus: number;
}

export interface CombinaisonInput extends ObstacleSimpleInput {
  nombre_d_éléments: number;
}

/**
 * Efforts §7 d'un obstacle : le **numérateur** (`propres` = efforts sans faute,
 * borné ≥ 0) et le **dénominateur** (`totaux` = efforts, pas passages). Le taux
 * en découle (`propres / totaux`) ; la heatmap **somme** ces efforts par cellule
 * puis divise (Σpropres / Σtotaux) — d'où l'intérêt d'exposer la décomposition
 * plutôt que le seul ratio (un ratio par-obstacle ne s'agrège pas correctement).
 */
export interface EffortsObstacle {
  /** Efforts sans faute (numérateur), borné ≥ 0 (fautes > efforts ⇒ 0, jamais négatif). */
  propres: number;
  /** Efforts totaux (dénominateur exact) : `répétitions`, `× nombre_d_éléments` pour une combinaison. */
  totaux: number;
}

/** Obstacle réduit à ce qui détermine ses efforts §7 (simple **ou** combinaison). */
export interface ObstacleEffortInput {
  type: TypeObstacle;
  répétitions: number;
  barres: number;
  refus: number;
  /** N'a de sens que pour une `Combinaison` (multiplicateur du dénominateur, §7). */
  nombre_d_éléments?: number | null;
}

function estEntierNonNégatif(n: number): boolean {
  return Number.isInteger(n) && n >= 0;
}

/**
 * Borne un taux dans [0, 1]. Renvoie `null` si le dénominateur est nul/négatif.
 * Une entrée incohérente (fautes > efforts) est ramenée à 0 plutôt que négative.
 */
function tauxBorné(numérateur: number, dénominateur: number): number | null {
  if (dénominateur <= 0) return null;
  return Math.min(1, Math.max(0, numérateur / dénominateur));
}

/** Efforts §7 d'un obstacle **simple** : dénominateur = `répétitions`, ou `null`. */
function effortsSimple({
  répétitions,
  barres,
  refus,
}: ObstacleSimpleInput): EffortsObstacle | null {
  if (![répétitions, barres, refus].every(estEntierNonNégatif)) return null;
  if (répétitions <= 0) return null;
  return { propres: Math.max(0, répétitions - barres - refus), totaux: répétitions };
}

/** Efforts §7 d'une **combinaison** : dénominateur = `répétitions × éléments`, ou `null`. */
function effortsCombinaison({
  répétitions,
  nombre_d_éléments,
  barres,
  refus,
}: CombinaisonInput): EffortsObstacle | null {
  if (![répétitions, nombre_d_éléments, barres, refus].every(estEntierNonNégatif)) return null;
  const totaux = répétitions * nombre_d_éléments;
  if (totaux <= 0) return null;
  return { propres: Math.max(0, totaux - barres - refus), totaux };
}

/**
 * **Décomposition §7 en efforts** d'un obstacle quelconque (dispatch simple /
 * combinaison sur `type`), ou `null` si non calculable (entrée invalide, ou
 * combinaison sans `nombre_d_éléments`). **Brique unique** du §7 : le taux
 * par-obstacle et l'agrégation heatmap (5.1) en dérivent, sans réécrire
 * l'arithmétique. Le dénominateur d'une combinaison est bien `répétitions ×
 * nombre_d_éléments` (efforts, pas passages).
 */
export function effortsObstacle(o: ObstacleEffortInput): EffortsObstacle | null {
  if (estCombinaison(o.type)) {
    return effortsCombinaison({
      répétitions: o.répétitions,
      nombre_d_éléments: o.nombre_d_éléments ?? 0,
      barres: o.barres,
      refus: o.refus,
    });
  }
  return effortsSimple({ répétitions: o.répétitions, barres: o.barres, refus: o.refus });
}

/**
 * Taux d'un obstacle simple : `(répétitions − barres − refus) / répétitions`.
 * Le dénominateur est exact (= les répétitions saisies, §7). Dérive de la
 * décomposition en efforts (une seule arithmétique du §7).
 */
export function tauxObstacleSimple(input: ObstacleSimpleInput): number | null {
  const e = effortsSimple(input);
  return e === null ? null : tauxBorné(e.propres, e.totaux);
}

/**
 * Taux d'une combinaison :
 * `(répétitions × éléments − barres − refus) / (répétitions × éléments)`.
 *
 * Le `nombre_d_éléments` multiplie les répétitions (dénominateur = efforts, pas
 * passages) ; sans lui, une combinaison de 3 éléments avec 6 barres donnerait un
 * taux négatif (§7). Dérive de la décomposition en efforts (même arithmétique).
 */
export function tauxCombinaison(input: CombinaisonInput): number | null {
  const e = effortsCombinaison(input);
  return e === null ? null : tauxBorné(e.propres, e.totaux);
}
