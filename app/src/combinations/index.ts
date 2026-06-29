/**
 * Module `combinations` de l'app (lot 2.5) — **bibliothèque de compte** des
 * combinaisons réutilisables, câblée sur l'API du module `combinations`. Surface
 * React : `CombinationsProvider` + `useCombinations` (liste triée par usage +
 * mutations). La logique testable sans React (`combinations-api`) vit dans son
 * module et est couverte par Vitest ; la sélection/sauvegarde d'une réutilisable
 * dans la saisie réutilise les helpers purs de `sessions/draft` (`selectReusable`,
 * `obstacleToCombinaisonDto`).
 */
export { type CombinationsApi, createCombinationsApi } from './combinations-api';
export {
  type CombinationsContextValue,
  CombinationsProvider,
  useCombinations,
} from './combinations-context';
