import type {
  BilanProgressionParams,
  ChevalSortie,
  Métriques,
  PointMaîtriseDto,
  SéanceSortie,
  TourSortie,
} from '@hpt/shared';
import { describe, expect, it } from 'vitest';
import { composeBilanSections } from './compose-bilan';

/**
 * Preuve **unitaire pure** (sans DB, tourne en `pnpm test`) de la composition des
 * sections du bilan de progression (lot 4.4, Spec §6.2/§6.3). On vérifie la
 * **curation** (période + indicateurs changent le rapport), la **réutilisation**
 * de la maîtrisée (metrics 3.2) et l'**exclusion** de la couche déclarative/du
 * ressenti — sans jamais muter la donnée sous-jacente (inviolabilité §2).
 */

const TECH = { created_at: new Date(0), updated_at: new Date(0) };

const cheval: ChevalSortie = {
  ...TECH,
  id: 'ch1',
  compte_id: 'c1',
  nom: 'Quibelle',
  niveau: 'amateur',
  hauteur_de_référence: 110,
  âge: 8,
  race: 'SF',
  archivé: false,
};

function tour(id: string, hauteur: number, barres = 0, refus = 0): TourSortie {
  return { ...TECH, id, seance_id: 's', hauteur, barres, refus };
}

function séance(opts: {
  id: string;
  date: string;
  type: SéanceSortie['type'];
  provenance?: SéanceSortie['provenance'];
  tours?: TourSortie[];
}): SéanceSortie {
  return {
    ...TECH,
    id: opts.id,
    cheval_id: 'ch1',
    type: opts.type,
    date: new Date(opts.date),
    date_modification: null,
    provenance: opts.provenance ?? 'live',
    obstacles: [],
    tours: opts.tours ?? [],
    contexte: null,
  };
}

// Historique : 3 séances live + 1 déclarative (à exclure de tout agrégat, §2).
const séances: SéanceSortie[] = [
  séance({
    id: 's1',
    date: '2026-01-05',
    type: 'Concours',
    tours: [tour('t1', 110), tour('t2', 120, 1)],
  }),
  séance({
    id: 'sd',
    date: '2026-01-12',
    type: 'Concours',
    provenance: 'déclaratif',
    tours: [tour('td', 140)],
  }),
  séance({ id: 's2', date: '2026-01-19', type: 'Concours', tours: [tour('t3', 115)] }),
  séance({ id: 's3', date: '2026-02-16', type: 'Parcours' }),
];

// Courbe de maîtrise **déjà composée par metrics** (réutilisée, jamais recalculée).
const série: PointMaîtriseDto[] = [
  { date: new Date('2026-01-05'), hauteur: 100 },
  { date: new Date('2026-01-19'), hauteur: 110 },
  { date: new Date('2026-02-16'), hauteur: 115 },
];
const métriques: Métriques = {
  cheval_id: 'ch1',
  maîtrise: { courante: 115, record: 120, série },
  vitrine: { record: null, jalons: [] },
};

function params(over: {
  from?: string | null;
  to?: string | null;
  indicateurs?: Partial<BilanProgressionParams['indicateurs']>;
}): BilanProgressionParams {
  return {
    période: { from: over.from ?? null, to: over.to ?? null },
    indicateurs: {
      niveau_démontré: true,
      performance_concours: true,
      régularité: true,
      trajectoire: true,
      ...over.indicateurs,
    },
    format: 'lien',
  };
}

describe('composeBilanSections — période complète, tous indicateurs (DoD 6 sections)', () => {
  const b = composeBilanSections({ cheval, séances, métriques, params: params({}) });

  it('compose les 6 sections (§6.2)', () => {
    expect(b.identité.nom).toBe('Quibelle');
    expect(b.période).toBeDefined();
    expect(b.niveau_démontré).toBeDefined();
    expect(b.performance_concours).toBeDefined();
    expect(b.régularité).toBeDefined();
    expect(b.trajectoire).toBeDefined();
  });

  it('identité = fiche cheval, sans aucun champ de contexte (couche objective §6)', () => {
    expect(b.identité).toEqual({
      nom: 'Quibelle',
      niveau: 'amateur',
      hauteur_de_référence: 110,
      âge: 8,
      race: 'SF',
    });
  });

  it('niveau démontré : maîtrisée réutilisée (dernier point) + plus haut SF concours', () => {
    expect(b.niveau_démontré?.hauteur_maîtrisée).toBe(115);
    // Plus haut tour sans-faute LIVE : 115 (110 & 115 propres ; 120 fauté ; 140 = déclaratif exclu).
    expect(b.niveau_démontré?.record_sans_faute_concours).toBe(115);
  });

  it('performance concours : sans-faute par hauteur, déclaratif exclu', () => {
    const perf = b.performance_concours;
    expect(perf?.total_tours).toBe(3); // 110, 120, 115 (live) ; 140 déclaratif exclu
    expect(perf?.tours_sans_faute).toBe(2);
    expect(perf?.taux_sans_faute).toBeCloseTo(2 / 3, 5);
    // Trié de la plus haute à la plus basse ; 140 (déclaratif) absent.
    expect(perf?.par_hauteur.map((p) => p.hauteur)).toEqual([120, 115, 110]);
    expect(perf?.par_hauteur.find((p) => p.hauteur === 120)?.taux_sans_faute).toBe(0);
  });

  it('trajectoire : courbe réutilisée + tendance à la hausse (100 → 115)', () => {
    expect(b.trajectoire?.points).toHaveLength(3);
    expect(b.trajectoire?.départ).toBe(100);
    expect(b.trajectoire?.arrivée).toBe(115);
    expect(b.trajectoire?.tendance).toBe('hausse');
  });

  it('régularité : compte les séances LIVE (déclaratif exclu), période documentée', () => {
    expect(b.régularité?.total_séances).toBe(3); // s1, s2, s3 ; sd (déclaratif) exclu
    expect(b.période.nb_séances).toBe(3);
  });
});

describe('composeBilanSections — curation de période (§6.3, donnée inviolable)', () => {
  it('resserrer la période change le rapport (moins de séances, autre maîtrisée)', () => {
    const étroit = composeBilanSections({
      cheval,
      séances,
      métriques,
      params: params({ from: '2026-01-01', to: '2026-01-10' }),
    });
    // Seule s1 (05/01) est dans la fenêtre ; s2/s3 hors, sd déclaratif exclu.
    expect(étroit.période.nb_séances).toBe(1);
    expect(étroit.régularité?.total_séances).toBe(1);
    // Maîtrisée = dernier point de la courbe DANS la période (05/01 → 100).
    expect(étroit.niveau_démontré?.hauteur_maîtrisée).toBe(100);
    // Concours : seul le tour de s1 compte (110 propre, 120 fauté).
    expect(étroit.performance_concours?.total_tours).toBe(2);
    expect(étroit.niveau_démontré?.record_sans_faute_concours).toBe(110);
    // Trajectoire réduite à un seul point → tendance stable.
    expect(étroit.trajectoire?.points).toHaveLength(1);
    expect(étroit.trajectoire?.tendance).toBe('stable');
  });

  it('la curation ne mute jamais la donnée d’entrée (inviolabilité §2)', () => {
    composeBilanSections({
      cheval,
      séances,
      métriques,
      params: params({ from: '2026-01-01', to: '2026-01-10' }),
    });
    // Historique et courbe intacts après curation.
    expect(séances).toHaveLength(4);
    expect(métriques.maîtrise.série).toHaveLength(3);
  });
});

describe('composeBilanSections — curation d’indicateurs (§6.3)', () => {
  it('décocher un indicateur retire sa section (sans toucher les autres)', () => {
    const sansConcours = composeBilanSections({
      cheval,
      séances,
      métriques,
      params: params({ indicateurs: { performance_concours: false, régularité: false } }),
    });
    expect(sansConcours.performance_concours).toBeUndefined();
    expect(sansConcours.régularité).toBeUndefined();
    // identité + période toujours là (cadre du livrable) ; les autres respectent le choix.
    expect(sansConcours.identité).toBeDefined();
    expect(sansConcours.période).toBeDefined();
    expect(sansConcours.niveau_démontré).toBeDefined();
    expect(sansConcours.trajectoire).toBeDefined();
  });
});
