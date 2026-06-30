/**
 * `@hpt/shared` — source de vérité unique des contrats partagés (Architecture
 * §2). App et api importent d'ici ; aucun type n'est dupliqué de part et
 * d'autre. Cinq couches :
 *
 *  - `enums`        — référentiel figé (Modèle §0) : hauteurs, types d'obstacle/de
 *                     séance, tiers, niveaux, provenances.
 *  - `types`        — formes de domaine des entités socle (Modèle §3/§5/§6).
 *  - `schemas`      — DTO d'entrée/sortie + validation Zod (sortie sans secret).
 *  - `calc`         — fonctions de calcul pures et testées (Modèle §7).
 *  - `entitlements` — politique de gating tier→capacités/quotas (Spec §8, lot 4.1).
 */
export * from './calc';
export * from './entitlements';
export * from './enums';
export * from './schemas';
export * from './types';
