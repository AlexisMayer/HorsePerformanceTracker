/**
 * Dérivé « sans-faute » d'un tour de concours (Modèle §3/§6.2) — fonction pure.
 *
 * Un tour est sans-faute quand `barres = 0 ET refus = 0`. Toute autre valeur
 * (fautes présentes, ou entrée incohérente) renvoie `false`, sans planter.
 */

export interface FautesInput {
  barres: number;
  refus: number;
}

export function sansFaute({ barres, refus }: FautesInput): boolean {
  return barres === 0 && refus === 0;
}
