import type { PériodeParams } from '@hpt/shared';

/**
 * **Préréglages de période** du bilan de progression (lot 4.4, curation §6.3) —
 * **logique pure** (aucun import React Native), donc testable par Vitest. Traduit
 * un choix humain (« 3 derniers mois », « tout l'historique ») en fenêtre
 * `{ from, to }` ISO envoyée à l'API. La donnée sous-jacente reste **inviolable** :
 * la période ne fait que **cadrer** ce que le rapport résume.
 *
 * **Pur et déterministe** : la fonction prend `maintenant` en paramètre (jamais
 * `Date.now()` en dur), pour des tests stables. Fenêtres en **jours** (pas de mois
 * calendaires) → pas d'effet de bord sur les mois courts.
 */

export const PÉRIODE_PRESETS = ['tout', '3m', '6m', '12m'] as const;

export type PériodePreset = (typeof PÉRIODE_PRESETS)[number];

/** Libellés d'affichage des préréglages (sélecteur segmenté). */
export const PÉRIODE_PRESET_LABELS: Record<PériodePreset, string> = {
  tout: 'Tout',
  '3m': '3 mois',
  '6m': '6 mois',
  '12m': '12 mois',
};

/** Étendue en jours d'un préréglage borné (le préréglage `tout` reste ouvert). */
const JOURS_PRESET: Record<Exclude<PériodePreset, 'tout'>, number> = {
  '3m': 90,
  '6m': 180,
  '12m': 365,
};

const MS_PAR_JOUR = 24 * 60 * 60 * 1000;

/**
 * Traduit un préréglage en période `{ from, to }` (bornes ISO, `null` = ouvert).
 * `tout` → période totalement ouverte (tout l'historique) ; les autres → fenêtre
 * glissante de N jours finissant à `maintenant`.
 */
export function périodePourPreset(preset: PériodePreset, maintenant: Date): PériodeParams {
  if (preset === 'tout') return { from: null, to: null };
  const from = new Date(maintenant.getTime() - JOURS_PRESET[preset] * MS_PAR_JOUR);
  return { from: from.toISOString(), to: maintenant.toISOString() };
}
