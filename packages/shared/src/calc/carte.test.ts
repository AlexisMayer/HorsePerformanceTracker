import { describe, expect, it } from 'vitest';
import { résuméCarte } from './carte';
import type { ObstacleFranchissement, TourFranchissement } from './franchissement';

const obstacle = (
  type: ObstacleFranchissement['type'],
  hauteur: number,
  patch: Partial<ObstacleFranchissement> = {},
): ObstacleFranchissement => ({
  type,
  hauteur,
  répétitions: 1,
  barres: 0,
  refus: 0,
  ...patch,
});

const tour = (hauteur: number, patch: Partial<TourFranchissement> = {}): TourFranchissement => ({
  hauteur,
  barres: 0,
  refus: 0,
  ...patch,
});

describe('résuméCarte — récap de carte (Spec §5.4, dérivé pur)', () => {
  it('dédoublonne et ordonne les types travaillés selon le référentiel', () => {
    const r = résuméCarte({
      obstacles: [obstacle('Oxer', 110), obstacle('Croix', 100), obstacle('Oxer', 105)],
      tours: [],
    });
    // Ordre du référentiel (Croix avant Oxer), sans doublon d'Oxer.
    expect(r.types_travaillés).toEqual(['Croix', 'Oxer']);
  });

  it('dédoublonne et trie les hauteurs (obstacles + tours)', () => {
    const r = résuméCarte({
      obstacles: [obstacle('Oxer', 110), obstacle('Vertical', 100), obstacle('Oxer', 110)],
      tours: [],
    });
    expect(r.hauteurs).toEqual([100, 110]);
  });

  it('réutilise faitsSéance pour le taux (jamais réimplémenté ici)', () => {
    // 4 répétitions, 1 barre ⇒ 3/4 propres, taux 0.75.
    const r = résuméCarte({
      obstacles: [obstacle('Oxer', 110, { répétitions: 4, barres: 1 })],
      tours: [],
    });
    expect(r.faits).not.toBeNull();
    expect(r.faits?.hauteur_max).toBe(110);
    expect(r.faits?.efforts_totaux).toBe(4);
    expect(r.faits?.efforts_propres).toBe(3);
    expect(r.faits?.taux_réussite).toBe(0.75);
    expect(r.faits?.sans_faute).toBe(false);
  });

  it('un Plat (0 obstacle / 0 tour) ⇒ récap de régularité, sans fausse célébration', () => {
    const r = résuméCarte({ obstacles: [], tours: [] });
    expect(r.types_travaillés).toEqual([]);
    expect(r.hauteurs).toEqual([]);
    expect(r.faits).toBeNull();
  });

  it('un Concours (tours) résume les hauteurs sans types d’obstacle', () => {
    const r = résuméCarte({
      obstacles: [],
      tours: [tour(120), tour(115)],
    });
    expect(r.types_travaillés).toEqual([]);
    expect(r.hauteurs).toEqual([115, 120]);
    // 2 tours sans-faute ⇒ taux 1, sans_faute vrai.
    expect(r.faits?.hauteur_max).toBe(120);
    expect(r.faits?.taux_réussite).toBe(1);
    expect(r.faits?.sans_faute).toBe(true);
  });
});
