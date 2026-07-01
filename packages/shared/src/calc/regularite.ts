/**
 * **Régularité** — fonction pure (Modèle §9, Spec §6.1/§6.2), le **cœur du bilan
 * de progression** (lot 4.4) : la **preuve du travail fourni** (fréquence +
 * continuité sur les **dates de séance**), donc la justification des honoraires
 * d'un coach. **Une seule** implémentation, ici (Architecture §2) — comme la
 * hauteur maîtrisée (§10) : ni l'aperçu app ni le rapport api ne peuvent compter
 * différemment.
 *
 * Règles (dérivées de l'historique, jamais saisies) :
 *  - Seules les séances **`live`** alimentent la régularité (Modèle §2, Spec §6) ;
 *    le `déclaratif` (ligne de départ, séances « de mémoire ») est **exclu des
 *    agrégats et du bilan** (Spec §2.4) — filtré ici.
 *  - **Tous les types comptent**, y compris le **Plat** (0 obstacle) : une séance
 *    de Plat « nourrit seulement fréquence/régularité » (Modèle §3) — la
 *    régularité mesure l'**assiduité**, pas la hauteur. C'est ce qui la distingue
 *    de la maîtrisée (qui, elle, exclut le Plat).
 *
 * **Fenêtre de curation (§6.3)** : le rapport choisit une **période** ; on la
 * passe en `{ from, to }` (bornes incluses). La donnée sous-jacente reste
 * **inviolable** — la fenêtre ne fait que **restreindre** ce qu'on résume, jamais
 * l'altérer. Hors fenêtre fournie, on couvre la période réelle des données
 * (première → dernière séance `live`). **Pure et déterministe** : aucune lecture
 * de `Date.now()`.
 */

import type { Provenance } from '../enums/seance';

/** Nombre de jours d'un mois « moyen » — normalise la fréquence en séances/mois. */
export const JOURS_PAR_MOIS = 30;

const MS_PAR_JOUR = 24 * 60 * 60 * 1000;
const MS_PAR_SEMAINE = 7 * MS_PAR_JOUR;

/**
 * Séance réduite à ce qui détermine la régularité : sa **date** et sa
 * **provenance** (pour exclure le `déclaratif`). L'api la projette depuis une
 * séance persistée (`SéanceSortie`) — glue de champs, aucun calcul.
 */
export interface SéanceRégularitéInput {
  date: Date;
  provenance: Provenance;
}

/** Bornes (incluses) de la période documentée par le rapport (curation §6.3). */
export interface FenêtreRégularité {
  from?: Date | null;
  to?: Date | null;
}

/**
 * Régularité & suivi d'une période (Spec §6.2, section 4). `null` sur les dates
 * quand aucune séance `live` n'entre dans la fenêtre.
 *
 *  - `total_séances`   — nombre de séances `live` de la période (Plat inclus).
 *  - `début` / `fin`   — première / dernière séance `live` de la période.
 *  - `jours_couverts`  — étendue (jours, inclusive) de la période documentée.
 *  - `séances_par_mois`— **fréquence** : séances rapportées à un mois moyen.
 *  - `semaines_actives`— **continuité** : semaines calendaires portant ≥ 1 séance.
 *  - `plus_longue_série_semaines` — plus longue suite de semaines **consécutives**
 *                        actives (une coupure casse la série).
 */
export interface RégularitéBilan {
  total_séances: number;
  début: Date | null;
  fin: Date | null;
  jours_couverts: number;
  séances_par_mois: number;
  semaines_actives: number;
  plus_longue_série_semaines: number;
}

/** Indice de semaine (aligné sur l'époque Unix) — base des dérivés de continuité. */
function indiceSemaine(date: Date): number {
  return Math.floor(date.getTime() / MS_PAR_SEMAINE);
}

/**
 * Plus longue suite d'entiers **consécutifs** parmi un ensemble d'indices de
 * semaine (continuité) : trie les indices distincts et compte le plus long
 * segment sans trou. `0` si l'ensemble est vide.
 */
function plusLongueSérieConsécutive(indices: number[]): number {
  const triés = [...new Set(indices)].sort((a, b) => a - b);
  let meilleure = 0;
  let courante = 0;
  let précédent: number | null = null;
  for (const i of triés) {
    courante = précédent !== null && i === précédent + 1 ? courante + 1 : 1;
    if (courante > meilleure) meilleure = courante;
    précédent = i;
  }
  return meilleure;
}

/**
 * **Régularité** d'un ensemble de séances sur une période (§6.2). Filtre le
 * `live` (§2), restreint à la fenêtre `{ from, to }` (curation §6.3, bornes
 * incluses), puis dérive fréquence + continuité. La fréquence est rapportée à
 * l'étendue **documentée** : si la fenêtre est fournie, on couvre `from..to`
 * (une période creuse abaisse honnêtement la fréquence) ; sinon on couvre la
 * période réelle des séances (première → dernière). Déterministe.
 */
export function régularité(
  séances: SéanceRégularitéInput[],
  fenêtre: FenêtreRégularité = {},
): RégularitéBilan {
  const from = fenêtre.from ?? null;
  const to = fenêtre.to ?? null;

  const dansPériode = séances
    .filter((s) => s.provenance === 'live')
    .filter((s) => (from === null || s.date >= from) && (to === null || s.date <= to))
    .map((s) => s.date)
    .sort((a, b) => a.getTime() - b.getTime());

  if (dansPériode.length === 0) {
    return {
      total_séances: 0,
      début: null,
      fin: null,
      jours_couverts: 0,
      séances_par_mois: 0,
      semaines_actives: 0,
      plus_longue_série_semaines: 0,
    };
  }

  const début = dansPériode[0];
  const fin = dansPériode[dansPériode.length - 1];

  // Étendue documentée : la fenêtre fournie prime (une période choisie « creuse »
  // ne se raccourcit pas à la dernière séance) ; sinon l'étendue réelle des data.
  const bornéDébut = from ?? début;
  const bornéFin = to ?? fin;
  const jours_couverts = Math.max(
    1,
    Math.round((bornéFin.getTime() - bornéDébut.getTime()) / MS_PAR_JOUR) + 1,
  );

  const séances_par_mois = (dansPériode.length / jours_couverts) * JOURS_PAR_MOIS;

  const semaines = dansPériode.map(indiceSemaine);
  const semaines_actives = new Set(semaines).size;
  const plus_longue_série_semaines = plusLongueSérieConsécutive(semaines);

  return {
    total_séances: dansPériode.length,
    début,
    fin,
    jours_couverts,
    séances_par_mois,
    semaines_actives,
    plus_longue_série_semaines,
  };
}
