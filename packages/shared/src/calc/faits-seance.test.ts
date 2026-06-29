import { describe, expect, expectTypeOf, it } from 'vitest';
import type { FaitsSéanceDto } from '../schemas/feed';
import { type FaitsSéance, faitsSéance } from './faits-seance';

describe('faitsSéance (agrégat objectif, §1/§7/§9)', () => {
  it('renvoie null pour une séance sans franchissement (Plat → régularité)', () => {
    expect(faitsSéance({ obstacles: [], tours: [] })).toBeNull();
  });

  it('agrège hauteur max, efforts propres / totaux et le taux (entraînement, §7)', () => {
    // Oxer 110 : 4 efforts, 1 barre → 3 propres ; Combinaison 115 (2 éléments) :
    // 1 répétition × 2 = 2 efforts, sans faute → 2 propres. Total 5/6.
    const faits = faitsSéance({
      obstacles: [
        { type: 'Oxer', hauteur: 110, répétitions: 4, barres: 1, refus: 0 },
        {
          type: 'Combinaison',
          hauteur: 115,
          répétitions: 1,
          barres: 0,
          refus: 0,
          nombre_d_éléments: 2,
        },
      ],
      tours: [],
    });
    expect(faits).not.toBeNull();
    expect(faits?.hauteur_max).toBe(115);
    expect(faits?.efforts_totaux).toBe(6);
    expect(faits?.efforts_propres).toBe(5);
    expect(faits?.taux_réussite).toBeCloseTo(5 / 6, 10);
    expect(faits?.sans_faute).toBe(false);
  });

  it('marque sans_faute quand aucune barre ni refus sur la séance', () => {
    const faits = faitsSéance({
      obstacles: [{ type: 'Vertical', hauteur: 100, répétitions: 2, barres: 0, refus: 0 }],
      tours: [],
    });
    expect(faits?.sans_faute).toBe(true);
    expect(faits?.taux_réussite).toBe(1);
  });

  it('traite un concours : 1 effort par tour, taux = tours sans-faute / tours (§9)', () => {
    const faits = faitsSéance({
      obstacles: [],
      tours: [
        { hauteur: 120, barres: 0, refus: 0 },
        { hauteur: 125, barres: 4, refus: 0 },
      ],
    });
    expect(faits?.hauteur_max).toBe(125);
    expect(faits?.efforts_totaux).toBe(2);
    expect(faits?.efforts_propres).toBe(1);
    expect(faits?.taux_réussite).toBe(0.5);
    expect(faits?.sans_faute).toBe(false);
  });

  it('borne une combinaison sur-fautée sans rendre le total négatif (§7)', () => {
    // Combinaison 3 éléments, 2 répétitions → 6 efforts ; 8 fautes ⇒ 0 propre, pas -2.
    const faits = faitsSéance({
      obstacles: [
        {
          type: 'Combinaison',
          hauteur: 120,
          répétitions: 2,
          barres: 6,
          refus: 2,
          nombre_d_éléments: 3,
        },
      ],
      tours: [],
    });
    expect(faits?.efforts_totaux).toBe(6);
    expect(faits?.efforts_propres).toBe(0);
    expect(faits?.taux_réussite).toBe(0);
  });
});

describe('alignement de type (aucune forme dupliquée, Architecture §2)', () => {
  it('FaitsSéance (calc) et FaitsSéanceDto (Zod) sont la même forme', () => {
    expectTypeOf<FaitsSéance>().toEqualTypeOf<FaitsSéanceDto>();
  });
});
