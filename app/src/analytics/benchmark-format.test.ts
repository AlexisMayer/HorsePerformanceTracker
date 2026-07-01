import type { BenchmarkSérieDto, PointBenchmarkDto } from '@hpt/shared';
import { describe, expect, it } from 'vitest';
import {
  annotationHauteurs,
  benchmarkAccessibilityLabel,
  courbeBenchmark,
  dernierTaux,
  estMonoPoint,
  formatPourcent,
  tendanceLabel,
} from './benchmark-format';

const point = (taux: number, hauteur = 110): PointBenchmarkDto => ({
  date: new Date('2026-03-01'),
  taux,
  hauteur,
});

const série = (
  points: PointBenchmarkDto[],
  tendance: BenchmarkSérieDto['tendance'],
): BenchmarkSérieDto => ({
  cheval_id: 'c1',
  combinaison_ref: 'ref-1',
  nom: 'Double oxer',
  nombre_d_éléments: 2,
  points,
  tendance,
});

describe('formatPourcent (chiffres tabulaires, §8)', () => {
  it('rend un pourcentage entier', () => {
    expect(formatPourcent(5 / 6)).toBe('83');
    expect(formatPourcent(0)).toBe('0');
    expect(formatPourcent(1)).toBe('100');
  });
});

describe('courbeBenchmark — barres = taux (pas de normalisation trompeuse)', () => {
  it('le remplissage est le taux lui-même (barre pleine = 100 %)', () => {
    const barres = courbeBenchmark([point(0.5, 110), point(0.75, 115), point(1, 120)]);
    expect(barres.map((b) => b.relatif)).toEqual([0.5, 0.75, 1]);
    // La hauteur voyage en annotation, jamais confondue avec le taux.
    expect(barres.map((b) => b.hauteur)).toEqual([110, 115, 120]);
  });

  it('borne le remplissage dans [0, 1] et garde les `max` points récents', () => {
    const barres = courbeBenchmark([point(0), point(0.5), point(1)], { max: 2 });
    expect(barres.map((b) => b.relatif)).toEqual([0.5, 1]);
  });
});

describe('dernierTaux — grand chiffre courant', () => {
  it('rend le taux du dernier point, ou null si vide', () => {
    expect(dernierTaux([point(0.5), point(0.9)])).toBe(0.9);
    expect(dernierTaux([])).toBeNull();
  });
});

describe('estMonoPoint — combinaison à rejouer', () => {
  it('vrai pour un seul point, faux sinon', () => {
    expect(estMonoPoint([point(1)])).toBe(true);
    expect(estMonoPoint([point(1), point(1)])).toBe(false);
    expect(estMonoPoint([])).toBe(false);
  });
});

describe('tendanceLabel — honnête, sans dramatiser', () => {
  it('mappe la tendance sur un libellé, null si non tranchable', () => {
    expect(tendanceLabel('hausse')).toBe('En progression');
    expect(tendanceLabel('baisse')).toBe('En recul');
    expect(tendanceLabel('stable')).toBe('Stable');
    expect(tendanceLabel(null)).toBeNull();
  });
});

describe('annotationHauteurs — la barre varie, la structure est constante', () => {
  it('résume la plage de hauteurs (unique ou intervalle)', () => {
    expect(annotationHauteurs([point(1, 110)])).toBe('110 cm');
    expect(annotationHauteurs([point(1, 110), point(1, 120)])).toBe('110–120 cm');
    expect(annotationHauteurs([])).toBeNull();
  });
});

describe('benchmarkAccessibilityLabel — lecteurs d’écran (§8)', () => {
  it('décrit progression, mono-point (à rejouer) et série vide', () => {
    expect(benchmarkAccessibilityLabel(série([point(0.5), point(1)], 'hausse'))).toContain(
      '2 instanciations',
    );
    expect(benchmarkAccessibilityLabel(série([point(0.5), point(1)], 'hausse'))).toContain(
      'en progression',
    );
    expect(benchmarkAccessibilityLabel(série([point(0.75)], null))).toContain('Rejoue');
    expect(benchmarkAccessibilityLabel(série([], null))).toContain('aucune instanciation');
  });
});
