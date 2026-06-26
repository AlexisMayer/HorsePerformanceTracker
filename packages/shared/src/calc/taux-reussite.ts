/**
 * Taux de réussite à l'entraînement — fonctions pures (Modèle §7).
 *
 * Une **seule** implémentation, partagée par l'app (aperçu) et l'api (calcul) :
 * elles ne peuvent donc pas diverger.
 *
 * Convention de retour : `null` = taux **non calculable** (dénominateur nul ou
 * entrée incohérente). Sinon, un nombre borné dans [0, 1]. Aucune entrée ne
 * fait planter la fonction.
 */

export interface ObstacleSimpleInput {
  répétitions: number;
  barres: number;
  refus: number;
}

export interface CombinaisonInput extends ObstacleSimpleInput {
  nombre_d_éléments: number;
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

/**
 * Taux d'un obstacle simple : `(répétitions − barres − refus) / répétitions`.
 * Le dénominateur est exact (= les répétitions saisies, §7).
 */
export function tauxObstacleSimple({
  répétitions,
  barres,
  refus,
}: ObstacleSimpleInput): number | null {
  if (![répétitions, barres, refus].every(estEntierNonNégatif)) return null;
  return tauxBorné(répétitions - barres - refus, répétitions);
}

/**
 * Taux d'une combinaison :
 * `(répétitions × éléments − barres − refus) / (répétitions × éléments)`.
 *
 * Le `nombre_d_éléments` multiplie les répétitions (dénominateur = efforts, pas
 * passages) ; sans lui, une combinaison de 3 éléments avec 6 barres donnerait un
 * taux négatif (§7).
 */
export function tauxCombinaison({
  répétitions,
  nombre_d_éléments,
  barres,
  refus,
}: CombinaisonInput): number | null {
  if (![répétitions, nombre_d_éléments, barres, refus].every(estEntierNonNégatif)) {
    return null;
  }
  const dénominateur = répétitions * nombre_d_éléments;
  return tauxBorné(dénominateur - barres - refus, dénominateur);
}
