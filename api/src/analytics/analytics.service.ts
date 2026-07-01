import {
  agrègeHeatmap,
  type BenchmarkListeDto,
  type BenchmarkSérieDto,
  benchmarkListeSchema,
  benchmarkSérieSchema,
  combinaisonsInstanciées,
  type Heatmap,
  type HeatmapDto,
  heatmapSchema,
  type ObstacleBenchmarkInput,
  type ObstacleFranchissement,
  type ObstacleSortie,
  type SéanceBenchmarkInput,
  type SéanceHeatmapInput,
  type SéanceSortie,
  sérieBenchmark,
} from '@hpt/shared';
import { Injectable } from '@nestjs/common';
import { CombinationsService } from '../combinations/combinations.service';
import { SessionsService } from '../sessions/sessions.service';

/**
 * Service de domaine **`analytics`** (lots 5.1/5.2, Architecture §3) — **surface de
 * lecture/composition** du **diagnostic premium**. Il **compose** deux outils, il
 * n'écrit **aucune** entité :
 *
 *  - **Heatmap type × hauteur** (5.1, Spec §5.3, Modèle §9) — taux §7 exact par
 *    cellule `(type, hauteur)`.
 *  - **Benchmark à combinaison constante** (5.2, Modèle §8/§9) — la **progression
 *    d'une combinaison réutilisable identifiée dans le temps**, pour isoler la
 *    progression du **cheval** (structure figée).
 *
 * Il lit **via les services** (jamais leurs tables, Architecture §1/§3) :
 *  - `sessions.listForHorse` (scope compte + propriété du cheval → 404 sans fuite) ;
 *  - `combinations` (identité/propriété d'une réutilisable) pour le benchmark.
 *
 * **Aucun calcul n'est implémenté ici** (Architecture §2) : le module **orchestre**
 * les fonctions pures de `shared` — `agrègeHeatmap` et `sérieBenchmark` /
 * `combinaisonsInstanciées`, qui **réutilisent le taux §7** (`effortsObstacle`).
 * Seules les séances **`live`** l'alimentent (Modèle §2) ; le `déclaratif` est
 * exclu ; la **couche contexte n'est jamais agrégée** (Modèle §1).
 *
 * **Lecture per-cheval, réutilisable en aval** : les surfaces sont composées pour
 * **un cheval** et le service est **exporté** → les comptes invité (4.6) les
 * **relisent en lecture seule scopée** (heatmap **et** benchmark), sans recalcul.
 */
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly sessions: SessionsService,
    private readonly combinations: CombinationsService,
  ) {}

  /**
   * Compose la **heatmap type × hauteur** d'un cheval **du compte courant** (404
   * si étranger). L'agrégat dérive de l'historique `live` (obstacles
   * d'entraînement) ; il est **validé/strippé au bord** (Architecture §5).
   */
  async heatmap(compteId: string, chevalId: string): Promise<HeatmapDto> {
    const séances = await this.sessions.listForHorse(compteId, chevalId);
    const heatmap: Heatmap = agrègeHeatmap(séances.map(toHeatmapInput));
    return heatmapSchema.parse({ cheval_id: chevalId, ...heatmap } satisfies HeatmapDto);
  }

  /**
   * **Liste des combinaisons benchmarkables** d'un cheval (5.2) : les réutilisables
   * **instanciées** en `live` pour ce cheval, triées **par usage** (per-cheval,
   * anti-bloat §4.3). La dérivation (`combinaisonsInstanciées`, pure) donne
   * l'identité + le décompte ; l'**identité affichable** (`nom`,
   * `nombre_d_éléments`) est **lue via le service `combinations`** (jamais sa
   * table). Un `combinaison_ref` non nul pointe toujours une ligne existante (FK
   * `SET NULL` à la suppression, 2.5) → le join défensif ignore l'absent.
   */
  async benchmarkList(compteId: string, chevalId: string): Promise<BenchmarkListeDto> {
    const séances = await this.sessions.listForHorse(compteId, chevalId);
    const instanciées = combinaisonsInstanciées(séances.map(toBenchmarkInput));
    if (instanciées.length === 0) {
      return benchmarkListeSchema.parse({
        cheval_id: chevalId,
        combinaisons: [],
      } satisfies BenchmarkListeDto);
    }

    // Identité affichable via le service (une lecture, indexée par id) — pas de N+1,
    // pas de lecture de table (§1). L'ordre par usage vient de `combinaisonsInstanciées`.
    const bibliothèque = await this.combinations.list(compteId);
    const parId = new Map(bibliothèque.map((c) => [c.id, c]));

    const combinaisons = instanciées.flatMap((i) => {
      const c = parId.get(i.combinaison_ref);
      if (!c) return [];
      return [
        {
          combinaison_ref: i.combinaison_ref,
          nom: c.nom,
          nombre_d_éléments: c.nombre_d_éléments,
          n_points: i.n_points,
        },
      ];
    });

    return benchmarkListeSchema.parse({
      cheval_id: chevalId,
      combinaisons,
    } satisfies BenchmarkListeDto);
  }

  /**
   * **Série benchmark** d'un `combinaison_ref` pour un cheval (5.2) : la
   * progression **like-for-like** de cette identité dans le temps (points `{ date,
   * taux §7, hauteur }` + tendance). Double scope compte : `listForHorse` (404 si
   * cheval étranger) **et** `combinations.findForAccount` (404 si la réutilisable
   * n'est pas celle du compte — et fournit son `nom`/`nombre_d_éléments`). La
   * fonction pure filtre sur l'**égalité stricte** du ref → **jamais** de mélange
   * d'identités (2.5). Une identité jamais instanciée sur ce cheval ⇒ série **vide**
   * (invitation côté app), pas une erreur.
   */
  async benchmarkSérie(
    compteId: string,
    chevalId: string,
    combinaisonRef: string,
  ): Promise<BenchmarkSérieDto> {
    const séances = await this.sessions.listForHorse(compteId, chevalId);
    const combinaison = await this.combinations.findForAccount(compteId, combinaisonRef);
    const série = sérieBenchmark(combinaisonRef, séances.map(toBenchmarkInput));
    return benchmarkSérieSchema.parse({
      cheval_id: chevalId,
      combinaison_ref: combinaisonRef,
      nom: combinaison.nom,
      nombre_d_éléments: combinaison.nombre_d_éléments,
      ...série,
    } satisfies BenchmarkSérieDto);
  }
}

/** Projette un obstacle persisté vers la forme réduite des dérivés (§7/§9). */
function toFranchissementObstacle(o: ObstacleSortie): ObstacleFranchissement {
  return {
    type: o.type,
    hauteur: o.hauteur,
    répétitions: o.répétitions,
    barres: o.barres,
    refus: o.refus,
    nombre_d_éléments: o.nombre_d_éléments,
  };
}

/**
 * Projette une séance persistée vers l'entrée de la heatmap `shared` (§2/§9) —
 * `provenance` pilote l'exclusion du `déclaratif` ; seuls les `obstacles`
 * d'entraînement sont retenus (tours/Plat/contexte non lus). Glue de lecture
 * (mapping de champs, pas de calcul), miroir du feed (3.1) / des métriques (3.2).
 */
function toHeatmapInput(s: SéanceSortie): SéanceHeatmapInput {
  return {
    provenance: s.provenance,
    obstacles: s.obstacles.map(toFranchissementObstacle),
  };
}

/**
 * Projette une séance persistée vers l'entrée du **benchmark** `shared` (5.2) :
 * la `date` métier (axe temps, §2), la `provenance` (exclusion du `déclaratif`) et
 * les `obstacles` **avec leur `combinaison_ref`** (l'identité suivie — un obstacle
 * dé-lié porte `null` et sortira de la série). La couche contexte n'est pas lue
 * (jamais agrégée, §1).
 */
function toBenchmarkInput(s: SéanceSortie): SéanceBenchmarkInput {
  return {
    date: s.date,
    provenance: s.provenance,
    obstacles: s.obstacles.map(toBenchmarkObstacle),
  };
}

/** Projette un obstacle persisté vers la forme réduite du benchmark (§7 + identité). */
function toBenchmarkObstacle(o: ObstacleSortie): ObstacleBenchmarkInput {
  return {
    type: o.type,
    hauteur: o.hauteur,
    répétitions: o.répétitions,
    barres: o.barres,
    refus: o.refus,
    nombre_d_éléments: o.nombre_d_éléments,
    combinaison_ref: o.combinaison_ref,
  };
}
