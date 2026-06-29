/**
 * Tranche `feed` de l'app (lot 3.1) — l'onglet **Feed** : le fil mono-cheval
 * (faits objectifs en avant, contexte en légende), les **jalons** injectés
 * (laiton, célébration) et les **entrées de régularité** (Plat). Lecture seule,
 * jamais verrouillée (gratuit). Le **héros** (courbe maîtrisée + vitrine records)
 * est le lot 3.2 — il vivra au-dessus de ce même fil.
 *
 * Les helpers d'affichage (`labels`) sont **purs** (testés par Vitest) ; le
 * calcul (faits §7/§9, jalons §10) vit dans `shared` — jamais ici (Architecture
 * §2).
 */
export { BarMotif } from './bar-motif';
export { createFeedApi, type FeedApi, type FeedQueryParams } from './feed-api';
export { FeedEntryCard } from './feed-entry-card';
export {
  effortsBasis,
  formatFeedDate,
  jalonTitre,
  provenanceMarqueur,
  ressentiEmoji,
} from './labels';
export { MilestoneCard } from './milestone-card';
export { RegularityEntry } from './regularity-entry';
export { entréeKey, flattenFeed, useFeed } from './use-feed';
