import {
  type BilanProgressionParams,
  type BilanSections,
  type ChevalSortie,
  type IdentitéBilan,
  type Métriques,
  type NiveauDémontréBilan,
  type PerformanceConcoursBilan,
  type PerformanceHauteur,
  type PointMaîtriseDto,
  type PériodeMétaBilan,
  régularité,
  type SéanceRégularitéInput,
  type SéanceSortie,
  sansFaute,
  type Tendance,
  type TrajectoireBilan,
} from '@hpt/shared';

/**
 * **Composition pure** des sections du bilan de progression (lot 4.4, Spec §6.2)
 * — le cœur testable du module `progression-report`, **sans I/O** (le service
 * fait les lectures ; ici on ne fait qu'**assembler**). Deux principes du cadrage
 * tenus par construction :
 *
 *  - **Réutilisation, aucun recalcul divergent (Architecture §2)** : la **hauteur
 *    maîtrisée** et sa **courbe** viennent de `metrics` (3.2, déjà composées) ; la
 *    **régularité** de la fonction pure `shared` ; le **sans-faute** du primitif
 *    `shared`. On ne réimplémente **aucune** métrique.
 *  - **Curation au niveau rapport (§6.3), donnée inviolable (§2)** : la **période**
 *    ne fait que **restreindre** ce qu'on résume (filtre `from..to`, bornes
 *    incluses) ; les **indicateurs** décochés **retirent** leur section. Rien
 *    n'est muté : cette fonction est pure et ne touche pas ses entrées.
 *
 * **Couche objective + `live` uniquement (Spec §6, Modèle §2)** : le `déclaratif`
 * est exclu de tous les agrégats (par `régularité` et par le filtre concours) ; le
 * **contexte** (ressenti, note, difficulté) n'est **jamais** lu ici.
 */

export interface ComposeBilanInput {
  cheval: ChevalSortie;
  /** Historique complet du cheval (live + déclaratif) — filtré ici selon le besoin. */
  séances: SéanceSortie[];
  /** Métriques héros déjà composées par `metrics` (maîtrise + vitrine) — réutilisées. */
  métriques: Métriques;
  /** Paramètres de curation (période + indicateurs + format). */
  params: BilanProgressionParams;
}

/** Projette une séance persistée vers l'entrée de régularité (§9) — glue de champs. */
function toRégularitéInput(s: SéanceSortie): SéanceRégularitéInput {
  return { date: s.date, provenance: s.provenance };
}

/**
 * Compose les **6 sections** (§6.2) à partir des données lues + de la curation.
 * `identité` et `période` sont toujours présentes ; les quatre autres sections ne
 * sont composées que si leur **indicateur** est activé (§6.3).
 */
export function composeBilanSections(input: ComposeBilanInput): BilanSections {
  const { cheval, séances, métriques, params } = input;
  const from = params.période.from ? new Date(params.période.from) : null;
  const to = params.période.to ? new Date(params.période.to) : null;

  const dansPériode = (date: Date): boolean =>
    (from === null || date >= from) && (to === null || date <= to);

  // Séances **live** de la période (Plat inclus) — base des sections concours et
  // du décompte de la période. Le `déclaratif` est exclu (couche objective, §2).
  const liveEnPériode = séances.filter((s) => s.provenance === 'live' && dansPériode(s.date));

  // §6.2 (6) Période — fenêtre documentée + nombre de séances live retenues.
  const période: PériodeMétaBilan = {
    from,
    to,
    nb_séances: liveEnPériode.length,
  };

  // §6.2 (1) Identité — fiche cheval (aucune donnée de contexte privé).
  const identité: IdentitéBilan = {
    nom: cheval.nom,
    niveau: cheval.niveau,
    hauteur_de_référence: cheval.hauteur_de_référence,
    âge: cheval.âge,
    race: cheval.race,
  };

  const sections: BilanSections = { identité, période };

  // Points de la courbe de maîtrise (réutilisée de `metrics`) restreints à la
  // période — projection de curation, jamais un recalcul de la maîtrisée.
  const pointsEnPériode: PointMaîtriseDto[] = métriques.maîtrise.série.filter((p) =>
    dansPériode(p.date),
  );

  if (params.indicateurs.niveau_démontré) {
    sections.niveau_démontré = composeNiveauDémontré(pointsEnPériode, liveEnPériode);
  }
  if (params.indicateurs.performance_concours) {
    sections.performance_concours = composePerformanceConcours(liveEnPériode);
  }
  if (params.indicateurs.régularité) {
    // La fonction pure `shared` filtre live + période elle-même (source unique).
    sections.régularité = régularité(séances.map(toRégularitéInput), { from, to });
  }
  if (params.indicateurs.trajectoire) {
    sections.trajectoire = composeTrajectoire(pointsEnPériode);
  }

  return sections;
}

/**
 * §6.2 (2) **Niveau démontré** — hauteur **maîtrisée** (dernier point de la courbe
 * réutilisée dans la période, cohérent avec le « chiffre courant » de `metrics`)
 * + plus haut **franchissement propre en concours** (tour sans-faute le plus haut,
 * dérivé du primitif `sansFaute` de `shared`).
 */
function composeNiveauDémontré(
  pointsEnPériode: PointMaîtriseDto[],
  liveEnPériode: SéanceSortie[],
): NiveauDémontréBilan {
  const hauteur_maîtrisée =
    pointsEnPériode.length > 0 ? pointsEnPériode[pointsEnPériode.length - 1].hauteur : null;

  let record_sans_faute_concours: number | null = null;
  for (const s of liveEnPériode) {
    if (s.type !== 'Concours') continue;
    for (const t of s.tours) {
      if (sansFaute({ barres: t.barres, refus: t.refus })) {
        if (record_sans_faute_concours === null || t.hauteur > record_sans_faute_concours) {
          record_sans_faute_concours = t.hauteur;
        }
      }
    }
  }

  return { hauteur_maîtrisée, record_sans_faute_concours };
}

/**
 * §6.2 (3) **Performance concours** — tours joués, sans-faute par hauteur d'épreuve
 * (le sans-faute est le primitif `shared`, jamais réimplémenté). Sur les séances
 * `Concours` **`live`** de la période ; `par_hauteur` de la plus haute à la plus
 * basse (lecture « niveau »).
 */
function composePerformanceConcours(liveEnPériode: SéanceSortie[]): PerformanceConcoursBilan {
  interface Agg {
    tours: number;
    sans_faute: number;
  }
  const parHauteur = new Map<number, Agg>();
  let total_tours = 0;
  let tours_sans_faute = 0;

  for (const s of liveEnPériode) {
    if (s.type !== 'Concours') continue;
    for (const t of s.tours) {
      const propre = sansFaute({ barres: t.barres, refus: t.refus });
      total_tours += 1;
      if (propre) tours_sans_faute += 1;
      const agg = parHauteur.get(t.hauteur) ?? { tours: 0, sans_faute: 0 };
      agg.tours += 1;
      if (propre) agg.sans_faute += 1;
      parHauteur.set(t.hauteur, agg);
    }
  }

  const par_hauteur: PerformanceHauteur[] = [...parHauteur.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([hauteur, agg]) => ({
      hauteur,
      tours: agg.tours,
      sans_faute: agg.sans_faute,
      taux_sans_faute: agg.tours > 0 ? agg.sans_faute / agg.tours : null,
    }));

  return {
    total_tours,
    tours_sans_faute,
    taux_sans_faute: total_tours > 0 ? tours_sans_faute / total_tours : null,
    par_hauteur,
  };
}

/**
 * §6.2 (5) **Trajectoire** — la **courbe de hauteur maîtrisée** réutilisée de
 * `metrics`, restreinte à la période, + la **tendance** (départ → arrivée, sur les
 * points maîtrisés). Assume la baisse sans dramatiser (§5.5) : `baisse` est une
 * tendance légitime, pas une erreur.
 */
function composeTrajectoire(pointsEnPériode: PointMaîtriseDto[]): TrajectoireBilan {
  const maîtrisés = pointsEnPériode.map((p) => p.hauteur).filter((h): h is number => h !== null);
  const départ = maîtrisés.length > 0 ? maîtrisés[0] : null;
  const arrivée = maîtrisés.length > 0 ? maîtrisés[maîtrisés.length - 1] : null;

  let tendance: Tendance | null = null;
  if (départ !== null && arrivée !== null) {
    tendance = arrivée > départ ? 'hausse' : arrivée < départ ? 'baisse' : 'stable';
  }

  return { points: pointsEnPériode, tendance, départ, arrivée };
}
