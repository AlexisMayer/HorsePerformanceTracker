/**
 * Module `sessions` de l'app (lot 2.3) — **UX de saisie rapide** par-dessus
 * l'API de création de 2.2. Surface React : l'écran de saisie (`/capture`)
 * orchestré par `useSessionCapture`, et ses composants (chips de type, slider de
 * hauteur, compteurs « tap », éditeurs d'obstacle/de tour). La logique pure
 * (brouillon, projection vers le DTO, duplication, aperçu des taux via `shared`,
 * idempotence, réessai) vit dans des modules `.ts` testés par Vitest.
 */
export { ChipGroup, type ChipOption } from './chips';
export { DifficultyMarker } from './difficulty-marker';
export { canSave } from './draft';
export { sessionErrorMessage } from './error-messages';
export { ObstacleEditor } from './obstacle-editor';
export { TourEditor } from './tour-editor';
export { type SessionCapture, useSessionCapture } from './use-session-capture';
