import { type FaitsSéance, faitsSéance, type SéanceSortie } from '@hpt/shared';

/**
 * Helpers **purs** de composition de l'historique (lot 3.4, UI/UX §6.4) — aucun
 * import React Native, donc testables par Vitest. L'historique est une **surface
 * app sans module backend dédié** (Architecture §3/§4) : le backend ne fait que
 * **paginer** des séances brutes ; **ici** on compose la vue — **faits objectifs**
 * (via `faitsSéance` de `shared`, jamais réimplémenté), **groupement par mois** et
 * **badges de bilan**. Le calcul vit dans `shared` (Architecture §2) ; ces helpers
 * ne font que **présenter**.
 */

/**
 * **Faits objectifs** d'une séance (couche objective, §1/§7/§9), ou `null` pour
 * une séance **sans franchissement** — un **Plat** (0 obstacle, Modèle §3),
 * rendu en **régularité** (UI/UX §6.4). Réutilise `faitsSéance` de `shared` : la
 * même dérivation que le fil (3.1) et la carte (3.3), jamais recalculée — taux et
 * hauteur ne peuvent pas diverger entre les surfaces.
 */
export function faitsDeSéance(séance: SéanceSortie): FaitsSéance | null {
  return faitsSéance({
    obstacles: séance.obstacles.map((o) => ({
      type: o.type,
      hauteur: o.hauteur,
      répétitions: o.répétitions,
      barres: o.barres,
      refus: o.refus,
      nombre_d_éléments: o.nombre_d_éléments,
    })),
    tours: séance.tours.map((t) => ({ hauteur: t.hauteur, barres: t.barres, refus: t.refus })),
  });
}

/** Noms de mois en français (le libellé de groupe ne dépend pas d'`Intl`/ICU). */
const MOIS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

/** Convertit le transport (chaîne ISO côté app) en `Date`, ou `null` si illisible. */
function toDate(value: Date | string): Date | null {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Date courte d'une carte d'historique (« 12/03 », UI/UX §6.4) — chiffres
 * tabulaires côté UI (§8). Tolérante au transport JSON (chaîne ISO) ; chaîne vide
 * si illisible (jamais de « Invalid Date » à l'écran).
 */
export function formatHistoryDate(value: Date | string): string {
  const d = toDate(value);
  if (d === null) return '';
  const jour = String(d.getDate()).padStart(2, '0');
  const mois = String(d.getMonth() + 1).padStart(2, '0');
  return `${jour}/${mois}`;
}

/**
 * Libellé du groupe **mois** (« MARS 2026 », UI/UX §6.4). Tolérant au transport ;
 * chaîne vide si illisible. Construit sans `Intl` pour rester déterministe (tests
 * + parité d'affichage quel que soit le moteur JS).
 */
export function formatMonthLabel(value: Date | string): string {
  const d = toDate(value);
  if (d === null) return '';
  return `${MOIS[d.getMonth()].toUpperCase()} ${d.getFullYear()}`;
}

/** Clé de regroupement par mois (« 2026-03 »), stable et triable. */
function monthKey(value: Date | string): string {
  const d = toDate(value);
  if (d === null) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Une section d'historique = un mois et ses séances (récent → ancien). */
export interface SectionHistorique {
  /** Libellé affiché (« MARS 2026 »). */
  title: string;
  /** Clé stable du mois (« 2026-03 ») — `key` de section. */
  key: string;
  /** Séances du mois, dans l'ordre reçu (récent → ancien). */
  data: SéanceSortie[];
}

/**
 * **Groupe les séances par mois** (UI/UX §6.4) en **préservant l'ordre** reçu
 * (récent → ancien). Les pages arrivant déjà ordonnées, regrouper les séries
 * consécutives par mois suffit — un mois à cheval sur deux pages reste **une
 * seule** section (on regroupe la liste aplatie complète à chaque rendu). Les
 * séances illisibles (date absente) sont ignorées plutôt que mal classées.
 */
export function groupByMonth(séances: SéanceSortie[]): SectionHistorique[] {
  const sections: SectionHistorique[] = [];
  let courante: SectionHistorique | null = null;
  for (const s of séances) {
    const key = monthKey(s.date);
    if (key === '') continue;
    if (courante === null || courante.key !== key) {
      courante = { title: formatMonthLabel(s.date), key, data: [s] };
      sections.push(courante);
    } else {
      courante.data.push(s);
    }
  }
  return sections;
}

/** Un badge de bilan rattaché à une séance (UI/UX §4). */
export type BadgeBilan = 'simple' | 'augmenté';

/**
 * **Badges de bilan** d'une séance (UI/UX §4/§6.4). Le **bilan simple** (`✓`) est
 * **toujours** disponible : il se **ré-ouvre** via la carte de 3.3
 * (`GET /sessions/:id/card`), sans état. Le **bilan augmenté** (`✦`, IA) n'est
 * affiché **que si un bilan augmenté existe** pour la séance.
 *
 * **Câblage conditionnel, slot prêt mais vide (lot 3.4).** Le `✦` est piloté par
 * `augmentéDisponible` — il **n'est pas** affiché en dur. En 3.4 **aucune source**
 * de bilan augmenté n'existe (le module `ai-bilan` est le lot **4.5**) : l'écran
 * **ne fournit jamais** `augmentéDisponible`, donc le `✦` **n'apparaît jamais**.
 * En 4.5, l'historique **lira `ai-bilan`** et passera `true` quand un bilan existe
 * — sans toucher à ce conditionnel (prouvé par test : `true` ⇒ `✦`, sinon non).
 */
export function badgesBilan(augmentéDisponible?: boolean): BadgeBilan[] {
  return augmentéDisponible ? ['simple', 'augmenté'] : ['simple'];
}
