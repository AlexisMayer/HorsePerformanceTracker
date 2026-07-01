/**
 * **Benchmark à combinaison constante** — fonction pure (Modèle §9, Spec §5.3,
 * UI/UX §6.5), l'agrégat de **diagnostic premium** du lot 5.2. **Une seule**
 * implémentation, ici (Architecture §2) : elle **réutilise le taux §7** via
 * `effortsObstacle` (décomposition en efforts propres/totaux) — jamais réécrite,
 * jamais divergente.
 *
 * On suit dans le temps la **réussite d'une combinaison réutilisable identifiée**
 * (structure figée) pour un cheval, afin d'isoler la **progression du couple** :
 * l'amélioration est attribuable au cheval, pas à une structure plus facile.
 *
 * Périmètre (décisions figées, jamais réinterrogées) :
 *  - **Identité stable = clé du benchmark** (Modèle §8, lot 2.5). Le benchmark
 *    s'indexe sur l'**identité** de la réutilisable (`combinaison_ref`). Comme
 *    « modifier une combinaison en crée une **nouvelle** » (pas de versioning),
 *    une structure modifiée porte un **autre** `combinaison_ref` → **série
 *    distincte** (comparaison *like-for-like* garantie). On ne mélange **jamais**
 *    deux `combinaison_ref` dans une même série.
 *  - **Un point = une instanciation `live`.** Chaque obstacle de type Combinaison
 *    **référençant** cette réutilisable dans une séance **`live`** produit un point
 *    `{ date, taux §7 combinaison, hauteur }`. La **hauteur peut varier** d'une
 *    instanciation à l'autre (la **structure** est constante, pas la barre) → elle
 *    est portée en **annotation** du point, jamais confondue avec le taux.
 *  - **`live` uniquement** (Modèle §2) : le `déclaratif` est **exclu** de
 *    l'agrégat. **Couche contexte jamais agrégée** (Modèle §1) : l'entrée ne porte
 *    aucun marqueur qualitatif (difficulté/ressenti) — rien à agréger.
 *  - **Obstacle dé-lié exclu.** Un obstacle dont la réutilisable a été supprimée a
 *    `combinaison_ref = null` (FK `SET NULL`, lot 2.5) : il n'est **plus rattaché**
 *    à l'identité suivie → **hors série** (coût consigné par 2.5 pour 5.2).
 */

import { estCombinaison, type TypeObstacle } from '../enums/obstacle';
import type { Provenance } from '../enums/seance';
import type { Tendance } from '../enums/tendance';
import { effortsObstacle } from './taux-reussite';

/**
 * Obstacle réduit à ce qui alimente le benchmark. L'api le projette depuis un
 * obstacle persisté (`ObstacleSortie`) : le `combinaison_ref` porte l'**identité**
 * suivie ; `type`/`répétitions`/`barres`/`refus`/`nombre_d_éléments` déterminent le
 * **taux §7** (réutilisé, jamais réécrit). `nombre_d_éléments` est copié inline sur
 * l'obstacle à l'instanciation (lot 2.5) → le taux reste self-contained.
 */
export interface ObstacleBenchmarkInput {
  type: TypeObstacle;
  hauteur: number;
  répétitions: number;
  barres: number;
  refus: number;
  nombre_d_éléments?: number | null;
  /** Identité de la réutilisable instanciée ; `null` = inline ou dé-lié (hors série). */
  combinaison_ref: string | null;
}

/**
 * Séance réduite à ce qui alimente le benchmark. `provenance` pilote l'exclusion
 * du `déclaratif` (§2) ; `date` est la **date métier** (immuable, §2) portée par
 * chaque point ; seuls les `obstacles` d'entraînement sont lus (le Plat n'en a
 * pas, le Concours porte des *tours* sans `combinaison_ref` → jamais projetés).
 */
export interface SéanceBenchmarkInput {
  date: Date;
  provenance: Provenance;
  obstacles: ObstacleBenchmarkInput[];
}

/**
 * Un **point** du benchmark : une **instanciation `live`** d'un `combinaison_ref`.
 * Le `taux` est le **taux §7 combinaison** exact (∈ [0, 1]) ; la `hauteur` est une
 * **annotation** (la barre du jour, variable), jamais confondue avec le taux.
 */
export interface PointBenchmark {
  /** Date métier de la séance (immuable, §2) — l'axe temps de la progression. */
  date: Date;
  /** Taux §7 combinaison exact de l'instanciation (`propres / totaux`), ∈ [0, 1]. */
  taux: number;
  /** Hauteur de l'instanciation (annotation) — peut varier, structure constante. */
  hauteur: number;
}

/**
 * **Série benchmark** d'un `combinaison_ref` pour un cheval : les **points**
 * ordonnés par date (progression dans le temps) + la **tendance** globale. La
 * tendance n'est calculée qu'avec **≥ 2 points** (sinon `null` — pas de fausse
 * tendance sur un point isolé, DoD mono-point).
 */
export interface SérieBenchmark {
  points: PointBenchmark[];
  tendance: Tendance | null;
}

/**
 * Une réutilisable **benchmarkable** pour un cheval : son identité
 * (`combinaison_ref`), le **nombre d'instanciations `live` calculables**
 * (`n_points`, = le nombre de points de sa série) et la **date de la dernière**
 * (récence, pour le tri anti-bloat). Enrichie côté api du `nom`/`nombre_d_éléments`
 * (lus via le service `combinations`, jamais recalculés ici).
 */
export interface CombinaisonInstanciée {
  combinaison_ref: string;
  n_points: number;
  derniere: Date;
}

/**
 * Écart minimal de pente (taux par instanciation) pour trancher `hausse`/`baisse`
 * plutôt que `stable` — heuristique lisible (~1 point de % par instanciation),
 * **tunable en une source**. En deçà, la progression est jugée `stable` (on ne
 * dramatise pas un micro-écart, cohérent §7 « assume la baisse sans dramatiser »).
 */
const EPSILON_TENDANCE = 0.01;

/**
 * Une instanciation calculable (interne) : l'identité suivie + son point. **Brique
 * unique** du lot — la série (`sérieBenchmark`) et la liste benchmarkable
 * (`combinaisonsInstanciées`) en dérivent, avec **exactement** le même filtre
 * (`live`, Combinaison, `combinaison_ref` non nul, taux §7 calculable) → le
 * `n_points` de la liste **égale** par construction le nombre de points de la série.
 */
interface Instanciation extends PointBenchmark {
  combinaison_ref: string;
}

/**
 * Extrait toutes les **instanciations `live` calculables** de combinaisons liées
 * (tous `combinaison_ref` confondus). Filtre : séance **`live`** (§2), obstacle de
 * type **Combinaison** au **`combinaison_ref` non nul** (dé-lié exclu), **taux §7
 * calculable** (`effortsObstacle` ≠ `null` — entrée invalide ignorée sans planter).
 */
function instanciations(séances: SéanceBenchmarkInput[]): Instanciation[] {
  const points: Instanciation[] = [];
  for (const s of séances) {
    // §2 : seules les séances `live` alimentent l'agrégat ; le déclaratif est exclu.
    if (s.provenance !== 'live') continue;
    for (const o of s.obstacles) {
      // Identité suivie : une Combinaison **liée** (ref non nulle). Un obstacle
      // inline (ref nulle) ou dé-lié (SET NULL, 2.5) n'est pas rattaché à une
      // identité → hors benchmark.
      if (!estCombinaison(o.type) || o.combinaison_ref === null) continue;
      // Taux §7 combinaison (réutilisé, jamais réécrit) : dénominateur = efforts
      // (`répétitions × nombre_d_éléments`). Non calculable ⇒ point ignoré.
      const efforts = effortsObstacle(o);
      if (efforts === null) continue;
      points.push({
        combinaison_ref: o.combinaison_ref,
        date: s.date,
        taux: efforts.propres / efforts.totaux,
        hauteur: o.hauteur,
      });
    }
  }
  return points;
}

/**
 * **Série benchmark** d'un `combinaison_ref` **précis** pour un cheval (Modèle §9)
 * : les instanciations `live` de **cette** identité, ordonnées par date, chacune
 * portant le **taux §7 combinaison** + sa **hauteur** en annotation, plus la
 * **tendance** globale (≥ 2 points). **Jamais** de mélange d'identités : on filtre
 * sur l'égalité stricte du `combinaison_ref` → comparaison *like-for-like* (2.5).
 *
 * Déterministe et pur : tri **stable** par date (les instanciations d'une même
 * date gardent l'ordre séance/obstacle), indépendant de l'ordre d'entrée.
 */
export function sérieBenchmark(
  combinaisonRef: string,
  séances: SéanceBenchmarkInput[],
): SérieBenchmark {
  const points = instanciations(séances)
    .filter((i) => i.combinaison_ref === combinaisonRef)
    .map(({ date, taux, hauteur }): PointBenchmark => ({ date, taux, hauteur }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  return { points, tendance: tendanceSérie(points) };
}

/**
 * **Combinaisons benchmarkables** d'un cheval : les identités (`combinaison_ref`)
 * **instanciées** en `live`, avec leur nombre d'instanciations calculables
 * (`n_points`) et la date de la dernière. Triées **par usage** (anti-bloat, Spec
 * §4.3) au sens **per-cheval** : `n_points` décroissant (« le plus travaillé sur ce
 * cheval »), puis récence (`derniere`), puis `combinaison_ref` (déterminisme).
 *
 * Une combinaison **instanciée une seule fois** figure avec `n_points = 1` (sa
 * série montrera **un point** + invitation à la rejouer — pas de fausse tendance).
 */
export function combinaisonsInstanciées(séances: SéanceBenchmarkInput[]): CombinaisonInstanciée[] {
  const parRef = new Map<string, CombinaisonInstanciée>();
  for (const i of instanciations(séances)) {
    const courant = parRef.get(i.combinaison_ref);
    if (courant) {
      courant.n_points += 1;
      if (i.date.getTime() > courant.derniere.getTime()) courant.derniere = i.date;
    } else {
      parRef.set(i.combinaison_ref, {
        combinaison_ref: i.combinaison_ref,
        n_points: 1,
        derniere: i.date,
      });
    }
  }
  return [...parRef.values()].sort(
    (a, b) =>
      b.n_points - a.n_points ||
      b.derniere.getTime() - a.derniere.getTime() ||
      a.combinaison_ref.localeCompare(b.combinaison_ref),
  );
}

/**
 * **Tendance** de la série : le **signe de la pente** (moindres carrés) du taux sur
 * l'index des instanciations, réduite à `hausse`/`stable`/`baisse`. `null` en deçà
 * de **2 points** (aucune tendance sur un point isolé — DoD mono-point). Honnête et
 * déterministe (indice, pas la date : robuste aux instanciations rapprochées) ;
 * `stable` dans la bande `EPSILON_TENDANCE` pour ne pas dramatiser un micro-écart.
 */
function tendanceSérie(points: PointBenchmark[]): Tendance | null {
  const n = points.length;
  if (n < 2) return null;
  const moyenneX = (n - 1) / 2;
  const moyenneY = points.reduce((acc, p) => acc + p.taux, 0) / n;
  let covariance = 0;
  let varianceX = 0;
  for (let x = 0; x < n; x++) {
    const dx = x - moyenneX;
    covariance += dx * (points[x].taux - moyenneY);
    varianceX += dx * dx;
  }
  // `varianceX > 0` dès `n ≥ 2` (indices distincts) → pas de division par zéro.
  const pente = covariance / varianceX;
  if (pente > EPSILON_TENDANCE) return 'hausse';
  if (pente < -EPSILON_TENDANCE) return 'baisse';
  return 'stable';
}
