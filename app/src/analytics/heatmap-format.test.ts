import type { CelluleHeatmapDto, HeatmapDto } from '@hpt/shared';
import { describe, expect, it } from 'vitest';
import {
  aDesDonnées,
  celluleAccessibilityLabel,
  celluleVisuel,
  formatTaux,
  indexerCellules,
  litCellule,
} from './heatmap-format';

const cellule = (
  type: string,
  hauteur: number,
  taux: number,
  n_obstacles = 1,
): CelluleHeatmapDto => ({
  type: type as CelluleHeatmapDto['type'],
  hauteur,
  taux,
  efforts_propres: Math.round(taux * n_obstacles),
  efforts_totaux: n_obstacles,
  n_obstacles,
});

describe('formatTaux (chiffres tabulaires, §8)', () => {
  it('rend un pourcentage entier', () => {
    expect(formatTaux(5 / 6)).toBe('83');
    expect(formatTaux(0)).toBe('0');
    expect(formatTaux(1)).toBe('100');
  });
});

describe('indexerCellules / litCellule (lecture O(1) par couple)', () => {
  const index = indexerCellules([cellule('Oxer', 100, 0.75), cellule('Combinaison', 120, 0.5)]);

  it('lit une cellule présente', () => {
    expect(litCellule(index, 'Oxer', 100)?.taux).toBe(0.75);
  });

  it('rend undefined pour un couple sans donnée', () => {
    expect(litCellule(index, 'Oxer', 150)).toBeUndefined();
    expect(litCellule(index, 'Vertical', 100)).toBeUndefined();
  });
});

describe('celluleVisuel (cellule vide ≠ taux nul, vert plein → vide — DoD/§6.5)', () => {
  it('rend « vide » pour une case sans donnée (→ « — »)', () => {
    expect(celluleVisuel(undefined)).toEqual({ kind: 'vide' });
  });

  it('rend « échec » (rouille) pour un taux 0 — distinct de « vide »', () => {
    expect(celluleVisuel(cellule('Vertical', 110, 0))).toEqual({ kind: 'échec' });
  });

  it('rend « rempli » (vert) pour un taux positif, opacité croissante avec le taux', () => {
    const faible = celluleVisuel(cellule('Oxer', 100, 0.25));
    const plein = celluleVisuel(cellule('Oxer', 100, 1));
    expect(faible).toMatchObject({ kind: 'rempli', contrasteFort: false });
    expect(plein).toMatchObject({ kind: 'rempli', contrasteFort: true });
    if (faible.kind === 'rempli' && plein.kind === 'rempli') {
      expect(plein.opacité).toBeGreaterThan(faible.opacité);
      expect(plein.opacité).toBeCloseTo(1, 10);
    }
  });
});

describe('aDesDonnées (état vide = invitation, §7)', () => {
  it('vrai avec des cellules, faux sinon', () => {
    const base: HeatmapDto = { cheval_id: 'c1', types: [], hauteurs: [], cellules: [] };
    expect(aDesDonnées(base)).toBe(false);
    expect(aDesDonnées({ ...base, cellules: [cellule('Oxer', 100, 1)] })).toBe(true);
  });
});

describe('celluleAccessibilityLabel (§8)', () => {
  it('nomme le taux et le volume, ou l’absence de donnée', () => {
    expect(celluleAccessibilityLabel('Oxer', 100, cellule('Oxer', 100, 0.75, 2))).toBe(
      'Oxer, 100 centimètres : 75 % de réussite sur 2 obstacles.',
    );
    expect(celluleAccessibilityLabel('Oxer', 150, undefined)).toBe(
      'Oxer, 150 centimètres : pas de donnée.',
    );
  });
});
