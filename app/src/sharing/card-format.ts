import type { CarteBilan } from '@hpt/shared';
import { effortsBasis } from '../feed/labels';

/**
 * Helpers **purs** d'affichage de la carte de bilan (lot 3.3) — aucun import React
 * Native, donc testables par Vitest. Ils ne font que **présenter** des dérivés
 * déjà calculés par `shared` (récap `résuméCarte` §7/§9, record 3.1) : **jamais**
 * de calcul métier ici (il vit dans `shared`, Architecture §2).
 *
 * La carte célèbre par le **laiton** (signature §2), **jamais** par un emoji
 * système (UI/UX §3.3 — seule entorse autorisée : le ressenti du feed) ; le
 * **message texte** de repli (feuille de partage) reste donc lui aussi sans emoji.
 * Le libellé de la fraction (« propre » / « sans-faute ») réutilise `effortsBasis`
 * du feed (3.1) — une seule règle, jamais dupliquée.
 */

/**
 * Date de la carte « 12 mars 2026 » — **année incluse** (la carte est un artefact
 * autonome, partagé hors de l'app). Tolérante au transport JSON (la date arrive en
 * chaîne ISO côté app, jamais un objet `Date`). Chaîne vide si illisible.
 */
export function formatCarteDate(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Fraction réussie « 4/5 propre » (entraînement) / « 2/2 sans-faute » (concours),
 * ou `null` quand il n'y a rien à résumer (séance de **régularité** : Plat). Le
 * libellé suit le type via `effortsBasis` (le calcul, lui, est identique — faits
 * agrégés de `shared`).
 */
export function fractionRéussie(carte: CarteBilan): string | null {
  if (!carte.faits) return null;
  return `${carte.faits.efforts_propres}/${carte.faits.efforts_totaux} ${effortsBasis(carte.type)}`;
}

/** Résumé « ce qui a été travaillé » : types distincts joints, ou `null` (aucun — Plat/Concours). */
export function travailRésumé(carte: CarteBilan): string | null {
  return carte.types_travaillés.length > 0 ? carte.types_travaillés.join(', ') : null;
}

/** Plage de hauteurs « 100–110 cm » / « 110 cm », ou `null` (aucune hauteur — Plat). */
export function hauteursRésumé(carte: CarteBilan): string | null {
  if (carte.hauteurs.length === 0) return null;
  const min = carte.hauteurs[0];
  const max = carte.hauteurs[carte.hauteurs.length - 1];
  return min === max ? `${min} cm` : `${min}–${max} cm`;
}

/**
 * Message texte de **repli** pour la feuille de partage (quand l'image n'est pas
 * disponible) — récap compact, **sans emoji** (le laiton est réservé à l'UI). Les
 * lignes vides (régularité sans hauteur, pas de record) sont omises.
 */
export function messagePartage(carte: CarteBilan, nomCheval: string): string {
  const lignes = [`${nomCheval} — ${carte.type} du ${formatCarteDate(carte.date)}`];

  const travail = travailRésumé(carte);
  const hauteurs = hauteursRésumé(carte);
  const détail = [travail, hauteurs].filter((v): v is string => v !== null).join(' · ');
  lignes.push(détail || 'Régularité');

  const fraction = fractionRéussie(carte);
  if (fraction) lignes.push(`Réussite : ${fraction}`);

  if (carte.record !== null) lignes.push(`Nouveau record : ${carte.record} cm`);

  lignes.push('Suivi avec Horse Performance Tracker');
  return lignes.join('\n');
}

/** Nom de fichier de l'image partagée « bilan-quibelle-2026-03-12.png » (slug + date ISO). */
export function nomFichierCarte(carte: CarteBilan, nomCheval: string): string {
  const slug =
    nomCheval
      .toLowerCase()
      .normalize('NFKD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'cheval';
  const d = carte.date instanceof Date ? carte.date : new Date(carte.date);
  const iso = Number.isNaN(d.getTime()) ? 'date' : d.toISOString().slice(0, 10);
  return `bilan-${slug}-${iso}.png`;
}
