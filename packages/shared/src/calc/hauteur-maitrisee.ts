/**
 * **Hauteur maîtrisée** — fonction pure (Modèle §9/§10, Spec §5.2/§5.5), le
 * dérivé du **héros 1** (lot 3.2, courbe de hauteur maîtrisée + grand chiffre).
 * **Une seule** implémentation, ici (Architecture §2) : elle **réutilise** les
 * franchissements propres posés en 3.1 (`franchissementsObstacle/Tour`,
 * `SéanceJalonInput`), exactement comme la détection de record/jalon — la vitrine
 * et la maîtrisée ne peuvent pas compter différemment.
 *
 * > Une hauteur **H** est maîtrisée quand le cheval y a réalisé **≥ 3
 * > franchissements propres, sur ≥ 2 séances** (§10).
 *
 * Règles (toutes dérivées de l'historique, jamais saisies) :
 *  - Seules les séances **`live`** alimentent la maîtrisée (Modèle §2) ; le
 *    `déclaratif` est **exclu des agrégats** (il reste une ligne de départ dans le
 *    feed, hors périmètre ici).
 *  - **Franchissement propre** conservateur (§10, brique 3.1) : obstacle simple =
 *    `répétitions − barres − refus` ; combinaison comptée **seulement si la ligne
 *    entière est sans faute**, à **sa** hauteur ; tour de concours sans-faute = 1.
 *  - **Plat exclu** : une séance de Plat (0 obstacle) n'apporte aucune hauteur —
 *    elle ne contribue donc à aucune maîtrise (exclusion par construction).
 *
 * **Plancher conservateur honnête (§5.5)** : la maîtrisée est calculée sur une
 * **fenêtre glissante récente** (`FENÊTRE_MAÎTRISE_JOURS`), donc elle **peut
 * redescendre** (régression, reprise post-blessure) quand les hauteurs ne sont
 * plus corroborées récemment. Le **record absolu** (cf. `recordAbsolu`,
 * tout-temps) ne s'efface, lui, **jamais** — c'est l'autre face de l'honnêteté.
 * La fenêtre est relative à la **dernière séance** des données (jamais à
 * `Date.now()`) : la fonction reste **pure** et déterministe.
 */

import { franchissementsObstacle, franchissementsTour } from './franchissement';
import type { SéanceJalonInput } from './jalons';

/** Seuil de franchissements propres pour qu'une hauteur soit maîtrisée (§10). */
export const SEUIL_FRANCHISSEMENTS_MAÎTRISE = 3;

/** Seuil de séances distinctes pour qu'une hauteur soit maîtrisée (§10). */
export const SEUIL_SÉANCES_MAÎTRISE = 2;

/**
 * Fenêtre glissante (jours) sur laquelle la maîtrise est corroborée. Au-delà, une
 * hauteur non rejouée « vieillit » et sort du plancher (la maîtrisée redescend,
 * §5.5) — sans jamais toucher au record absolu. Valeur **généreuse** (≈ une année
 * sportive) pour ne pas dramatiser une coupure courte ; **tunable** (cf. journal,
 * réutilisée par le bilan de progression 4.4).
 */
export const FENÊTRE_MAÎTRISE_JOURS = 365;

const MS_PAR_JOUR = 24 * 60 * 60 * 1000;

/** Un point de la **courbe de maîtrise** : la maîtrisée (cm) à une date, ou `null`. */
export interface PointMaîtrise {
  date: Date;
  hauteur: number | null;
}

/**
 * Bloc « hauteur maîtrisée » : le **chiffre courant** (grand chiffre du héros, ou
 * `null` si rien n'est encore maîtrisé) et la **série temporelle** (la courbe).
 */
export interface Maîtrise {
  courante: number | null;
  série: PointMaîtrise[];
}

/** Accumulateur par hauteur : total de franchissements propres + séances distinctes. */
interface AggHauteur {
  total: number;
  séances: Set<string>;
}

/**
 * Agrège, par hauteur, les **franchissements propres** d'un ensemble de séances :
 * leur total et le nombre de **séances distinctes** qui y contribuent (≥ 1
 * franchissement propre). Une hauteur sans franchissement propre n'apparaît pas.
 */
function agrègeParHauteur(séances: SéanceJalonInput[]): Map<number, AggHauteur> {
  const parHauteur = new Map<number, AggHauteur>();
  for (const s of séances) {
    // Franchissements propres de CETTE séance, regroupés par hauteur (une séance
    // ne compte qu'une fois dans le décompte de séances d'une hauteur donnée).
    const parHauteurSéance = new Map<number, number>();
    const ajoute = (hauteur: number, propres: number) => {
      if (propres > 0) {
        parHauteurSéance.set(hauteur, (parHauteurSéance.get(hauteur) ?? 0) + propres);
      }
    };
    for (const o of s.obstacles) ajoute(o.hauteur, franchissementsObstacle(o));
    for (const t of s.tours) ajoute(t.hauteur, franchissementsTour(t));

    for (const [hauteur, propres] of parHauteurSéance) {
      const agg = parHauteur.get(hauteur) ?? { total: 0, séances: new Set<string>() };
      agg.total += propres;
      agg.séances.add(s.id);
      parHauteur.set(hauteur, agg);
    }
  }
  return parHauteur;
}

/**
 * **Hauteur maîtrisée** d'un ensemble de séances (§10), **sans fenêtre ni filtre
 * de provenance** : la plus haute hauteur H atteignant **≥ 3 franchissements
 * propres sur ≥ 2 séances**, ou `null`. Brique de bas niveau (l'appelant filtre
 * le `live` et applique la fenêtre via `hauteurMaîtrisée`).
 */
export function hauteurMaîtriséeParmi(séances: SéanceJalonInput[]): number | null {
  let max: number | null = null;
  for (const [hauteur, agg] of agrègeParHauteur(séances)) {
    const maîtrisée =
      agg.total >= SEUIL_FRANCHISSEMENTS_MAÎTRISE && agg.séances.size >= SEUIL_SÉANCES_MAÎTRISE;
    if (maîtrisée && (max === null || hauteur > max)) max = hauteur;
  }
  return max;
}

/**
 * **Hauteur maîtrisée dans le temps** (héros 1) — la **série** (un point par
 * séance `live`, ordre chronologique) et le **chiffre courant** (= dernier point).
 *
 * Chaque point est la maîtrisée (§10) calculée sur la **fenêtre glissante**
 * `(date − fenêtre, date]` : les `live` exclusivement, le `déclaratif` jamais
 * agrégé (§2), le Plat ne portant aucune hauteur. La maîtrisée **peut
 * redescendre** quand des hauteurs sortent de la fenêtre (§5.5) ; l'UI assume la
 * baisse sans dramatiser. Déterministe : la fenêtre est relative aux dates des
 * données, jamais à l'horloge.
 */
export function hauteurMaîtrisée(
  séances: SéanceJalonInput[],
  options: { fenêtreJours?: number } = {},
): Maîtrise {
  const fenêtreMs = (options.fenêtreJours ?? FENÊTRE_MAÎTRISE_JOURS) * MS_PAR_JOUR;
  const live = séances
    .filter((s) => s.provenance === 'live')
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const série: PointMaîtrise[] = live.map((s) => {
    const fin = s.date.getTime();
    const début = fin - fenêtreMs;
    const fenêtre = live.filter((autre) => {
      const t = autre.date.getTime();
      return t > début && t <= fin;
    });
    return { date: s.date, hauteur: hauteurMaîtriséeParmi(fenêtre) };
  });

  const courante = série.length > 0 ? série[série.length - 1].hauteur : null;
  return { courante, série };
}
