/**
 * Référentiels au niveau Séance (Modèle §0/§2/§5).
 *
 * Le type de séance pilote la structure : un `Concours` est une collection de
 * tours, les autres types une collection d'obstacles (Modèle §4).
 * La provenance distingue une trace contemporaine (`live`, seule à alimenter
 * les métriques) d'un amorçage (`déclaratif`, Modèle §2).
 */

export const TYPES_SEANCE = ['Plat', 'Gymnastique', 'Parcours', 'Concours'] as const;

export type TypeSéance = (typeof TYPES_SEANCE)[number];

export const PROVENANCES = ['live', 'déclaratif'] as const;

export type Provenance = (typeof PROVENANCES)[number];

/** Vrai si la séance est un concours (structure en tours plutôt qu'en obstacles). */
export function estConcours(type: TypeSéance): boolean {
  return type === 'Concours';
}
