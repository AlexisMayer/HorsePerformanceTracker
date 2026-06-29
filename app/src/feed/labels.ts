import { estConcours, type TypeJalon, type TypeSéance } from '@hpt/shared';

/**
 * Helpers **purs** d'affichage du fil (lot 3.1) — aucun import React Native, donc
 * testables par Vitest. Ils ne font que **présenter** des faits déjà dérivés
 * (jamais de calcul : celui-ci vit dans `shared`, Architecture §2). Le ressenti
 * est la **seule** entorse autorisée à la règle « pas d'emoji système » (UI/UX
 * §3.3 : « sauf dans le ressenti du feed »).
 */

/** Emojis de ressenti (échelle 1-5). `null`/hors borne ⇒ `null` (rien à afficher). */
const RESSENTI_EMOJI: Record<number, string> = {
  1: '😞',
  2: '😕',
  3: '😐',
  4: '🙂',
  5: '😄',
};

/** Emoji du ressenti global (1-5), ou `null` si absent/hors échelle. */
export function ressentiEmoji(ressenti: number | null | undefined): string | null {
  if (ressenti == null) return null;
  return RESSENTI_EMOJI[ressenti] ?? null;
}

/**
 * Libellé de la fraction de réussite selon le type de séance (couche objective) :
 * un concours se lit en **« sans-faute »** (tours propres), un entraînement en
 * **« propre »** (efforts propres, §7/§9). Le calcul, lui, est identique (faits
 * agrégés de `shared`).
 */
export function effortsBasis(type: TypeSéance): 'sans-faute' | 'propre' {
  return estConcours(type) ? 'sans-faute' : 'propre';
}

/** Titre d'un jalon (célébration). Dérivé, jamais saisi. */
export function jalonTitre(type: TypeJalon): string {
  return type === 'record' ? 'Nouveau record' : 'Première fois';
}

/**
 * Marqueur de provenance d'une entrée : une séance `déclaratif` est signalée
 * **« Antérieure à l'app »** (amorçage, §2) ; une `live` n'en porte aucun.
 */
export function provenanceMarqueur(provenance: 'live' | 'déclaratif'): string | null {
  return provenance === 'déclaratif' ? 'Antérieure à l’app' : null;
}

/**
 * Date courte d'une entrée de feed (« 12 mars »). Tolérante au transport JSON (la
 * date arrive en chaîne ISO côté app, jamais un objet `Date`). Chaîne vide si
 * illisible (jamais de « Invalid Date » à l'écran).
 */
export function formatFeedDate(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}
