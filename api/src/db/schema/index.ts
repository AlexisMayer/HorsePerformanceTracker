/**
 * Schéma Drizzle des **6 entités socle** (lot 0.3) — réalité en base des
 * contrats de `@hpt/shared` (lot 0.2). Point d'entrée unique consommé par
 * `drizzle.config.ts` (génération de migration) et par les vérifications
 * d'alignement / d'application.
 *
 * Propriété orientée vers le bas, `ON DELETE CASCADE` à chaque arête :
 *   Compte → Cheval → Séance → { Obstacle, Tour, Contexte }
 */
export * from './abonnement';
export * from './ai-bilan';
export * from './champs-techniques';
export * from './cheval';
export * from './combinaison';
export * from './compte';
export * from './contexte';
export * from './enums';
export * from './obstacle';
export * from './refresh-token';
export * from './seance';
export * from './tour';
export * from './verification-token';
