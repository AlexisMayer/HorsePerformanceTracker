/**
 * Module `horses` de l'app (lot 2.1) — fiche cheval CRUD câblée sur l'API.
 * Surface React : `HorsesProvider` + `useHorses` (liste + cheval courant +
 * mutations), `HorseSelector` (en-tête) et `HorseForm` (création/édition). La
 * logique testable sans React (`horses-api`) vit dans son module et est couverte
 * par Vitest.
 */
export { horseErrorMessage, isQuotaBlocked } from './error-messages';
export { HorseForm, type HorseFormSubmit } from './horse-form';
export { HorseSelector } from './horse-selector';
export { type HorsesContextValue, HorsesProvider, useHorses } from './horses-context';
