/**
 * Tranche `metrics` de l'app (lot 3.2) — les **deux graphes héros** posés
 * **au-dessus** du fil (3.1) dans l'onglet **Feed** : la **courbe de hauteur
 * maîtrisée** (grand chiffre tabulaire + motif barre + courbe, en vert sous-bois)
 * et la **vitrine à records/jalons** (plaques laiton). Lecture seule, **jamais
 * verrouillée** (gratuit). L'UI **assume la baisse** de la maîtrisée sans effacer
 * le record (§5.5).
 *
 * Les helpers d'affichage (`metrics-format`) sont **purs** (testés par Vitest) ;
 * tout le calcul (hauteur maîtrisée §10, records 3.1) vit dans `shared` — jamais
 * ici (Architecture §2).
 */
export { createMetricsApi, type MetricsApi } from './metrics-api';
export {
  type BarreMaîtrise,
  courbeMaîtrise,
  formatHauteur,
  maîtriseAccessibilityLabel,
  type PlaquesVitrine,
  plaquesVitrine,
} from './metrics-format';
export { MetricsHero } from './metrics-hero';
export { useMetrics } from './use-metrics';
