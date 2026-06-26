import type { ChampsTechniques } from './champs-techniques';

/**
 * Tour — unité atomique du concours (Modèle §3/§6.2).
 *
 * `sans_faute` (barres = 0 ET refus = 0) est *dérivé*, jamais stocké : il se
 * calcule via `calc/sansFaute`. La hauteur est fixée par l'épreuve.
 */
export interface Tour extends ChampsTechniques {
  seance_id: string;
  hauteur: number;
  barres: number;
  refus: number;
}
