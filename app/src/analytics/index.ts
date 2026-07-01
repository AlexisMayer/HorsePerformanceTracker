/**
 * Tranche `analytics` de l'app (lots 5.1/5.2) — le **diagnostic premium** de
 * l'onglet **Analytique**, **grisé au gratuit** (verrou 4.2 → upgrade premium) :
 *
 *  - **heatmap type × hauteur** (5.1, UI/UX §6.5) ;
 *  - **benchmark à combinaison constante** (5.2) empilé **dessous** : la
 *    progression d'une combinaison réutilisable identifiée dans le temps.
 *
 * Tout le calcul est **agrégé dans `shared`** (réutilise le taux §7) — jamais
 * recalculé ici (Architecture §2). Les helpers d'affichage (`*-format`) sont
 * **purs** (testés par Vitest) ; le gating reste l'**autorité serveur** (l'app ne
 * fait que griser, §5). `AnalytiqueContenu`/`AnalytiqueAperçu` sont réutilisés en
 * lecture seule scopée par la coquille invité (4.6, via `basePath`).
 */

export { AnalytiqueAperçu } from './analytique-apercu';
export { AnalytiqueContenu } from './analytique-contenu';
export { BenchmarkAperçu } from './benchmark-apercu';
export { type BenchmarkApi, createBenchmarkApi } from './benchmark-api';
export { BenchmarkCurve } from './benchmark-curve';
export {
  annotationHauteurs,
  type BarreBenchmark,
  benchmarkAccessibilityLabel,
  courbeBenchmark,
  dernierTaux,
  estMonoPoint,
  formatPourcent,
  tendanceLabel,
} from './benchmark-format';
export { BenchmarkSection } from './benchmark-section';
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
export { useBenchmarkList, useBenchmarkSérie } from './use-benchmark';
export { useHeatmap } from './use-heatmap';
