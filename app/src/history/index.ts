/**
 * Tranche `history` de l'app (lot 3.4) — l'onglet **Historique** : les **séances
 * passées** d'un cheval, **groupées par mois**, avec **faits objectifs** et
 * **badges de bilan** (`✓ simple` ; `✦ augmenté` **seulement si présent** — slot
 * câblé mais vide jusqu'au lot 4.5). La carte **rouvre le bilan simple** de 3.3
 * (`GET /sessions/:id/card`). Lecture seule, **jamais verrouillée** (historique
 * conservé, gratuit — Spec §8).
 *
 * **Surface app sans module backend dédié** (Architecture §3/§4) : elle lit des
 * **séances brutes** paginées via le service `sessions` et **compose** la vue
 * ici. Les helpers (`history-format`) sont **purs** (testés par Vitest) ; le
 * calcul des faits vit dans `shared` — jamais ici (Architecture §2).
 */
export { createHistoryApi, type HistoryApi, type HistoryQueryParams } from './history-api';
export { HistoryEntryCard, type HistoryEntryCardProps } from './history-entry-card';
export {
  type BadgeBilan,
  badgesBilan,
  faitsDeSéance,
  formatHistoryDate,
  formatMonthLabel,
  groupByMonth,
  type SectionHistorique,
} from './history-format';
export { flattenHistory, useHistory } from './use-history';
