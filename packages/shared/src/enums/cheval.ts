/**
 * Référentiel au niveau Cheval (Modèle §0/§3).
 *
 * Le niveau est volontairement grossier en v1 (`amateur | pro`), extensible
 * plus tard sans casse.
 */

export const NIVEAUX_CHEVAL = ['amateur', 'pro'] as const;

export type NiveauCheval = (typeof NIVEAUX_CHEVAL)[number];
