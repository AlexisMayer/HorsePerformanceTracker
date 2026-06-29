import { describe, expect, expectTypeOf, it } from 'vitest';
import type { RésuméCarte } from '../calc';
import { type CarteBilan, carteBilanSchema } from './sharing';

describe('alignement de type (aucune forme dupliquée, Architecture §2)', () => {
  it('RésuméCarte (calc) est exactement le récap du DTO de carte', () => {
    // La carte = le récap pur (`résuméCarte`) + l'identité (ids/date/type) + le
    // record. Le récap ne doit pas diverger entre le calc et le DTO partagé.
    expectTypeOf<RésuméCarte>().toEqualTypeOf<
      Pick<CarteBilan, 'types_travaillés' | 'hauteurs' | 'faits'>
    >();
  });
});

describe('carteBilanSchema — projection sortante (validée/strippée au bord, §5)', () => {
  const valide: CarteBilan = {
    seance_id: 's1',
    cheval_id: 'cheval-1',
    date: new Date('2026-03-12'),
    type: 'Parcours',
    types_travaillés: ['Oxer', 'Vertical'],
    hauteurs: [100, 110],
    faits: {
      hauteur_max: 110,
      efforts_totaux: 5,
      efforts_propres: 4,
      taux_réussite: 0.8,
      sans_faute: false,
    },
    record: 110,
  };

  it('accepte une carte complète avec record', () => {
    expect(() => carteBilanSchema.parse(valide)).not.toThrow();
  });

  it('accepte une carte sans record (carte récap simple)', () => {
    expect(() => carteBilanSchema.parse({ ...valide, record: null })).not.toThrow();
  });

  it('accepte une carte de régularité (Plat : faits null, pas de hauteur)', () => {
    expect(() =>
      carteBilanSchema.parse({
        ...valide,
        type: 'Plat',
        types_travaillés: [],
        hauteurs: [],
        faits: null,
        record: null,
      }),
    ).not.toThrow();
  });

  it('strippe toute clé inconnue (rien de superflu ne sort)', () => {
    const parsed = carteBilanSchema.parse({ ...valide, secret_interne: 'nope' });
    expect(parsed).not.toHaveProperty('secret_interne');
  });

  it('rejette un type d’obstacle hors référentiel', () => {
    expect(() => carteBilanSchema.parse({ ...valide, types_travaillés: ['Tremplin'] })).toThrow();
  });
});
