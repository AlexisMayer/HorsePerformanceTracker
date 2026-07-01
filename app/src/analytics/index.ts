/**
 * Tranche `analytics` de l'app (lot 5.1) — le **diagnostic premium** de l'onglet
 * **Analytique** : la **heatmap type × hauteur** (UI/UX §6.5), **grisée au
 * gratuit** (verrou 4.2 → upgrade premium). Le taux est **exact** (saisie par
 * obstacle, 2.3) et **agrégé dans `shared`** (réutilise le taux §7) — jamais
 * recalculé ici (Architecture §2). La heatmap est **hors set héros** (Spec §5.3).
 *
 * Les helpers d'affichage (`heatmap-format`) sont **purs** (testés par Vitest) ;
 * le gating reste l'**autorité serveur** (l'app ne fait que griser, §5).
 */

export { HeatmapAperçu } from './heatmap-apercu';
export { createHeatmapApi, type HeatmapApi } from './heatmap-api';
export {
  aDesDonnées,
  type CelluleVisuel,
  celluleAccessibilityLabel,
  celluleVisuel,
  formatTaux,
  indexerCellules,
  litCellule,
} from './heatmap-format';
export { HeatmapGrid } from './heatmap-grid';
export { HeatmapView } from './heatmap-view';
export { useHeatmap } from './use-heatmap';
