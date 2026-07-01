import { describe, expect, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';
import type { Tendance } from '../enums/tendance';
import type { BenchmarkSérieDto, PointBenchmarkDto } from '../schemas/benchmark';
import type { tendanceSchema } from '../schemas/referentiel';
import {
  combinaisonsInstanciées,
  type ObstacleBenchmarkInput,
  type PointBenchmark,
  type SéanceBenchmarkInput,
  type SérieBenchmark,
  sérieBenchmark,
} from './benchmark';
import { tauxCombinaison } from './taux-reussite';

const REF_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const REF_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

/** Une instanciation de combinaison **liée** (ref non nulle), `nombre_d_éléments=2` par défaut. */
function combi(
  ref: string | null,
  hauteur: number,
  fautes: { répétitions: number; barres: number; refus: number; nombre_d_éléments?: number },
): ObstacleBenchmarkInput {
  return {
    type: 'Combinaison',
    hauteur,
    répétitions: fautes.répétitions,
    barres: fautes.barres,
    refus: fautes.refus,
    nombre_d_éléments: fautes.nombre_d_éléments ?? 2,
    combinaison_ref: ref,
  };
}

/** Séance `live` datée (le cas nominal du benchmark). */
function live(date: string, obstacles: ObstacleBenchmarkInput[]): SéanceBenchmarkInput {
  return { date: new Date(date), provenance: 'live', obstacles };
}

/** Séance `déclaratif` datée (doit être **exclue** de l'agrégat, §2). */
function déclaratif(date: string, obstacles: ObstacleBenchmarkInput[]): SéanceBenchmarkInput {
  return { date: new Date(date), provenance: 'déclaratif', obstacles };
}

describe('sérieBenchmark — progression d’une combinaison identifiée dans le temps (DoD)', () => {
  it('ordonne par date, porte le taux §7 par point et rend une tendance (≥ 2 points)', () => {
    // Même identité (REF_A), structure figée (2 éléments), progression dans le temps :
    // 1/2 barre → 0.5, puis 3/4 → 0.75, puis 4/4 → 1.0 (le cheval progresse).
    const série = sérieBenchmark(REF_A, [
      live('2026-03-01', [combi(REF_A, 110, { répétitions: 1, barres: 1, refus: 0 })]),
      live('2026-04-01', [combi(REF_A, 110, { répétitions: 2, barres: 1, refus: 0 })]),
      live('2026-05-01', [combi(REF_A, 110, { répétitions: 2, barres: 0, refus: 0 })]),
    ]);

    expect(série.points.map((p) => p.taux)).toEqual([0.5, 0.75, 1]);
    expect(série.points.map((p) => p.date.toISOString())).toEqual([
      new Date('2026-03-01').toISOString(),
      new Date('2026-04-01').toISOString(),
      new Date('2026-05-01').toISOString(),
    ]);
    // Taux = taux §7 combinaison exact (réutilisé, jamais réécrit).
    expect(série.points[1].taux).toBe(
      tauxCombinaison({ répétitions: 2, barres: 1, refus: 0, nombre_d_éléments: 2 }),
    );
    expect(série.tendance).toBe('hausse');
  });

  it('trie même quand les séances arrivent dans le désordre (déterministe)', () => {
    const série = sérieBenchmark(REF_A, [
      live('2026-05-01', [combi(REF_A, 110, { répétitions: 2, barres: 0, refus: 0 })]),
      live('2026-03-01', [combi(REF_A, 110, { répétitions: 1, barres: 1, refus: 0 })]),
    ]);
    expect(série.points.map((p) => p.taux)).toEqual([0.5, 1]);
  });

  it('porte la hauteur en annotation, jamais confondue avec le taux (hauteurs variables)', () => {
    // La structure est constante (REF_A) ; la barre varie (110 → 120). La hauteur
    // est portée telle quelle ; le taux §7 est indépendant d'elle.
    const série = sérieBenchmark(REF_A, [
      live('2026-03-01', [combi(REF_A, 110, { répétitions: 1, barres: 1, refus: 0 })]),
      live('2026-04-01', [combi(REF_A, 120, { répétitions: 2, barres: 0, refus: 0 })]),
    ]);
    expect(série.points).toEqual([
      { date: new Date('2026-03-01'), taux: 0.5, hauteur: 110 },
      { date: new Date('2026-04-01'), taux: 1, hauteur: 120 },
    ]);
  });

  it('détecte une baisse et un plateau sans dramatiser (tendance)', () => {
    const baisse = sérieBenchmark(REF_A, [
      live('2026-03-01', [combi(REF_A, 110, { répétitions: 2, barres: 0, refus: 0 })]),
      live('2026-04-01', [combi(REF_A, 110, { répétitions: 2, barres: 1, refus: 0 })]),
      live('2026-05-01', [combi(REF_A, 110, { répétitions: 1, barres: 1, refus: 0 })]),
    ]);
    expect(baisse.tendance).toBe('baisse');

    const plateau = sérieBenchmark(REF_A, [
      live('2026-03-01', [combi(REF_A, 110, { répétitions: 2, barres: 1, refus: 0 })]),
      live('2026-04-01', [combi(REF_A, 110, { répétitions: 2, barres: 1, refus: 0 })]),
    ]);
    expect(plateau.tendance).toBe('stable');
  });
});

describe('sérieBenchmark — mono-point : un point, aucune fausse tendance (DoD)', () => {
  it('une combinaison instanciée une seule fois donne un point et `tendance = null`', () => {
    const série = sérieBenchmark(REF_A, [
      live('2026-03-01', [combi(REF_A, 110, { répétitions: 2, barres: 1, refus: 0 })]),
    ]);
    expect(série.points).toHaveLength(1);
    expect(série.tendance).toBeNull();
  });
});

describe('sérieBenchmark — identité stable : jamais de mélange de combinaison_ref (DoD)', () => {
  it('ne compte que les instanciations de l’identité demandée (séries distinctes)', () => {
    // Deux réutilisables différentes (REF_A, REF_B) — dont une « modifiée » qui, par
    // 2.5, est une NOUVELLE identité (REF_B). Une même séance peut porter les deux.
    const séances = [
      live('2026-03-01', [
        combi(REF_A, 110, { répétitions: 2, barres: 0, refus: 0 }),
        combi(REF_B, 130, { répétitions: 2, barres: 2, refus: 0 }),
      ]),
      live('2026-04-01', [combi(REF_A, 110, { répétitions: 2, barres: 1, refus: 0 })]),
    ];

    const a = sérieBenchmark(REF_A, séances);
    const b = sérieBenchmark(REF_B, séances);

    expect(a.points).toHaveLength(2);
    expect(a.points.every((p) => p.hauteur === 110)).toBe(true);
    // La série B ne contient QUE B (une structure modifiée = série distincte).
    expect(b.points).toHaveLength(1);
    expect(b.points[0]).toMatchObject({ hauteur: 130, taux: 0.5 });
  });
});

describe('sérieBenchmark — périmètre : live only, dé-lié exclu, non calculable ignoré', () => {
  it('exclut le `déclaratif` (§2) même s’il référence la combinaison', () => {
    const série = sérieBenchmark(REF_A, [
      déclaratif('2026-02-01', [combi(REF_A, 110, { répétitions: 2, barres: 0, refus: 0 })]),
      live('2026-03-01', [combi(REF_A, 110, { répétitions: 2, barres: 1, refus: 0 })]),
    ]);
    expect(série.points).toHaveLength(1);
    expect(série.points[0].taux).toBe(0.75);
  });

  it('exclut un obstacle dé-lié (`combinaison_ref = null`, SET NULL de 2.5)', () => {
    const série = sérieBenchmark(REF_A, [
      // Même structure inline mais SANS ref (dé-lié) → hors identité suivie.
      live('2026-03-01', [combi(null, 110, { répétitions: 2, barres: 0, refus: 0 })]),
      live('2026-04-01', [combi(REF_A, 110, { répétitions: 2, barres: 1, refus: 0 })]),
    ]);
    expect(série.points).toHaveLength(1);
  });

  it('ignore une instanciation non calculable sans planter (répétitions 0)', () => {
    const série = sérieBenchmark(REF_A, [
      live('2026-03-01', [combi(REF_A, 110, { répétitions: 0, barres: 0, refus: 0 })]),
      live('2026-04-01', [combi(REF_A, 110, { répétitions: 2, barres: 0, refus: 0 })]),
    ]);
    expect(série.points).toHaveLength(1);
    expect(série.points[0].taux).toBe(1);
  });

  it('série vide pour une identité jamais instanciée (invitation côté app)', () => {
    const série = sérieBenchmark(REF_A, [
      live('2026-03-01', [combi(REF_B, 110, { répétitions: 2, barres: 0, refus: 0 })]),
    ]);
    expect(série).toEqual({ points: [], tendance: null });
  });
});

describe('combinaisonsInstanciées — liste benchmarkable triée par usage (per-cheval)', () => {
  it('compte les instanciations calculables, la dernière date, et trie par n_points', () => {
    const liste = combinaisonsInstanciées([
      live('2026-03-01', [
        combi(REF_A, 110, { répétitions: 2, barres: 0, refus: 0 }),
        combi(REF_B, 130, { répétitions: 1, barres: 0, refus: 0 }),
      ]),
      live('2026-04-01', [combi(REF_A, 110, { répétitions: 2, barres: 1, refus: 0 })]),
      // Dé-lié + déclaratif : ne comptent pas.
      live('2026-05-01', [combi(null, 110, { répétitions: 2, barres: 0, refus: 0 })]),
      déclaratif('2026-06-01', [combi(REF_B, 130, { répétitions: 2, barres: 0, refus: 0 })]),
    ]);

    // REF_A (2 instanciations) avant REF_B (1) : tri par usage (anti-bloat, §4.3).
    expect(liste.map((c) => c.combinaison_ref)).toEqual([REF_A, REF_B]);
    expect(liste[0]).toMatchObject({ combinaison_ref: REF_A, n_points: 2 });
    expect(liste[0].derniere).toEqual(new Date('2026-04-01'));
    // REF_B : le déclaratif ne compte pas → 1 seul point (mono-point à rejouer).
    expect(liste[1]).toMatchObject({ combinaison_ref: REF_B, n_points: 1 });
    expect(liste[1].derniere).toEqual(new Date('2026-03-01'));
  });

  it('n_points d’une entrée égale le nombre de points de sa série (cohérence)', () => {
    const séances = [
      live('2026-03-01', [combi(REF_A, 110, { répétitions: 2, barres: 0, refus: 0 })]),
      live('2026-04-01', [combi(REF_A, 110, { répétitions: 2, barres: 1, refus: 0 })]),
    ];
    const [entrée] = combinaisonsInstanciées(séances);
    expect(entrée.n_points).toBe(sérieBenchmark(REF_A, séances).points.length);
  });

  it('liste vide quand aucune combinaison liée n’est instanciée', () => {
    expect(combinaisonsInstanciées([live('2026-03-01', [])])).toEqual([]);
  });
});

describe('benchmark — alignement calc ≡ DTO (aucune forme dupliquée, Archi §2)', () => {
  it('les types calc et Zod coïncident exactement', () => {
    expectTypeOf<PointBenchmark>().toEqualTypeOf<PointBenchmarkDto>();
    // La tendance dérivée (calc) et le schéma Zod partagent le tuple `TENDANCES`.
    expectTypeOf<z.infer<typeof tendanceSchema>>().toEqualTypeOf<Tendance>();
    expectTypeOf<SérieBenchmark>().toEqualTypeOf<Pick<BenchmarkSérieDto, 'points' | 'tendance'>>();
  });
});
