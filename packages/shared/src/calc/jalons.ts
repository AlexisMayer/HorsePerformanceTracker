/**
 * **Détection de record / jalon** — fonction pure (Modèle §2/§9/§10, Spec
 * §5.1/§5.5). Le **cœur dérivé** que le feed (lot 3.1) injecte dans le fil et que
 * la **vitrine à records** (metrics, lot 3.2) réutilisera : **une seule**
 * implémentation, ici (Architecture §2). Réconciliation roadmap ↔ architecture :
 * la roadmap ordonne 3.1 avant 3.2, mais le feed a besoin des records pour ses
 * jalons → on **pose le calc dans `shared` dès 3.1**, sans le dupliquer en 3.2.
 *
 * Règles (toutes dérivées de l'historique, jamais saisies) :
 *  - Seules les séances **`live`** engendrent des jalons. Le `déclaratif` nourrit
 *    le feed mais reste **exclu des dérivés** (§2) : aucun record/jalon.
 *  - **record** : la meilleure hauteur franchie proprement par une séance dépasse
 *    **strictement** tout l'historique `live` antérieur (« plus haut
 *    franchissement propre », §10) — au plus un par séance.
 *  - **première_fois** : une hauteur franchie proprement pour la **première fois**
 *    (jamais franchie proprement avant), **hors** la hauteur de record de la même
 *    séance (déjà célébrée par le record).
 *
 * Le **record absolu ne s'efface jamais** (§5.5) : c'est l'affaire de la vitrine
 * (3.2). Ici on **dérive de l'historique courant** — une suppression de séance
 * (2.4) **recompose** donc mécaniquement les jalons (rien n'est stocké).
 */

import type { TypeJalon } from '../enums/jalon';
import type { Provenance } from '../enums/seance';
import {
  franchissementsObstacle,
  franchissementsTour,
  type ObstacleFranchissement,
  type TourFranchissement,
} from './franchissement';

/**
 * Séance réduite à ce qui détermine ses jalons. L'api `feed` la projette depuis
 * une séance persistée (`SéanceSortie`) — `provenance` pilote l'exclusion du
 * `déclaratif`, `date` l'ordre chronologique, `id` le rattachement du jalon.
 */
export interface SéanceJalonInput {
  id: string;
  date: Date;
  provenance: Provenance;
  obstacles: ObstacleFranchissement[];
  tours: TourFranchissement[];
}

/**
 * Un jalon dérivé, **attaché à la séance `live`** qui l'a généré (`seance_id` +
 * `date` pour l'injecter au bon endroit du fil). `hauteur` est la hauteur
 * célébrée (cm).
 */
export interface Jalon {
  seance_id: string;
  date: Date;
  type: TypeJalon;
  hauteur: number;
}

/** Hauteurs franchies **proprement** dans une séance (uniques, ordre croissant). */
function hauteursFranchies(s: SéanceJalonInput): number[] {
  const hauteurs = new Set<number>();
  for (const o of s.obstacles) {
    if (franchissementsObstacle(o) >= 1) hauteurs.add(o.hauteur);
  }
  for (const t of s.tours) {
    if (franchissementsTour(t) >= 1) hauteurs.add(t.hauteur);
  }
  return [...hauteurs].sort((a, b) => a - b);
}

/**
 * Dérive les jalons d'un historique de séances (ordre quelconque en entrée). On
 * ne considère que le **`live`**, trié par `date` croissante (la chronologie
 * détermine ce qui est « nouveau » / un « record »). Retourne les jalons dans
 * l'ordre chronologique de leur séance ; l'appelant les regroupe par `seance_id`
 * pour les injecter dans le fil.
 */
export function détecteJalons(séances: SéanceJalonInput[]): Jalon[] {
  const live = séances
    .filter((s) => s.provenance === 'live')
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  /** Hauteurs déjà franchies proprement par les séances antérieures. */
  const franchiesAvant = new Set<number>();
  /** Plus haut franchissement propre de tout l'historique antérieur. */
  let recordMax: number | null = null;
  const jalons: Jalon[] = [];

  for (const s of live) {
    const franchies = hauteursFranchies(s);
    if (franchies.length === 0) continue;

    const sommet = franchies[franchies.length - 1];
    let hauteurRecord: number | null = null;

    // Record : le sommet de la séance dépasse strictement l'historique antérieur.
    if (recordMax === null || sommet > recordMax) {
      jalons.push({ seance_id: s.id, date: s.date, type: 'record', hauteur: sommet });
      hauteurRecord = sommet;
      recordMax = sommet;
    }

    // Premières fois : toute autre hauteur jamais franchie proprement avant.
    for (const h of franchies) {
      if (h !== hauteurRecord && !franchiesAvant.has(h)) {
        jalons.push({ seance_id: s.id, date: s.date, type: 'première_fois', hauteur: h });
      }
    }

    for (const h of franchies) franchiesAvant.add(h);
  }

  return jalons;
}
