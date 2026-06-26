import type { ChampsTechniques } from './champs-techniques';

/**
 * Contexte de séance — couche qualitative (Modèle §3, 0..1 par séance).
 *
 * Règle d'or (§1) : aucune de ces données ne devient une métrique, une courbe
 * ou une ligne de bilan. Elle vit uniquement comme légende dans le feed.
 */
export interface Contexte extends ChampsTechniques {
  seance_id: string;
  /** Ressenti global, échelle 1-5 (optionnel). */
  ressenti_global?: number;
  /** Énergie, échelle 1-5 (optionnel). */
  énergie?: number;
  note?: string;
}
