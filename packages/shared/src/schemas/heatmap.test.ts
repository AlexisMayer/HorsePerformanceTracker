import { describe, expect, expectTypeOf, it } from 'vitest';
import type { CelluleHeatmap } from '../calc';
import { type CelluleHeatmapDto, celluleHeatmapSchema, heatmapSchema } from './heatmap';

describe('alignement de type (aucune forme dupliquée, Architecture §2)', () => {
  it('CelluleHeatmap (calc) et CelluleHeatmapDto (Zod) sont la même forme', () => {
    expectTypeOf<CelluleHeatmap>().toEqualTypeOf<CelluleHeatmapDto>();
  });
});

describe('heatmapSchema — projection sortante (validée/strippée au bord, §5)', () => {
  const valide = {
    cheval_id: 'cheval-1',
    types: ['Oxer', 'Combinaison'],
    hauteurs: [100, 120],
    cellules: [
      {
        type: 'Oxer',
        hauteur: 100,
        taux: 0.75,
        efforts_propres: 3,
        efforts_totaux: 4,
        n_obstacles: 1,
      },
      {
        type: 'Combinaison',
        hauteur: 120,
        taux: 0,
        efforts_propres: 0,
        efforts_totaux: 6,
        n_obstacles: 1,
      },
    ],
  };

  it('accepte une matrice complète et bien formée', () => {
    expect(() => heatmapSchema.parse(valide)).not.toThrow();
  });

  it('tolère une heatmap vide (aucune donnée encore)', () => {
    expect(() =>
      heatmapSchema.parse({ cheval_id: 'cheval-1', types: [], hauteurs: [], cellules: [] }),
    ).not.toThrow();
  });

  it('strippe toute clé inconnue (rien de superflu ne sort)', () => {
    const parsed = heatmapSchema.parse({ ...valide, secret_interne: 'nope' });
    expect(parsed).not.toHaveProperty('secret_interne');
  });

  it('rejette un type d’obstacle hors référentiel', () => {
    expect(() =>
      celluleHeatmapSchema.parse({
        type: 'Inconnu',
        hauteur: 100,
        taux: 0.5,
        efforts_propres: 1,
        efforts_totaux: 2,
        n_obstacles: 1,
      }),
    ).toThrow();
  });
});
