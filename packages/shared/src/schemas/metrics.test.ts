import { describe, expect, expectTypeOf, it } from 'vitest';
import type { Jalon, PointMaîtrise } from '../calc';
import { type JalonDto, métriquesSchema, type PointMaîtriseDto, vitrineSchema } from './metrics';

describe('alignement de type (aucune forme dupliquée, Architecture §2)', () => {
  it('Jalon (calc) et JalonDto (Zod) sont la même forme — la vitrine réutilise 3.1', () => {
    expectTypeOf<Jalon>().toEqualTypeOf<JalonDto>();
  });

  it('PointMaîtrise (calc) et PointMaîtriseDto (Zod) sont la même forme', () => {
    expectTypeOf<PointMaîtrise>().toEqualTypeOf<PointMaîtriseDto>();
  });
});

describe('métriquesSchema — projection sortante (validée/strippée au bord, §5)', () => {
  const valide = {
    cheval_id: 'cheval-1',
    maîtrise: {
      courante: 115,
      record: 125,
      série: [{ date: new Date('2026-01-01'), hauteur: 115 }],
    },
    vitrine: {
      record: { seance_id: 's3', date: new Date('2026-03-01'), type: 'record', hauteur: 125 },
      jalons: [{ seance_id: 's3', date: new Date('2026-03-01'), type: 'record', hauteur: 125 }],
    },
  };

  it('accepte une réponse complète et bien formée', () => {
    expect(() => métriquesSchema.parse(valide)).not.toThrow();
  });

  it('tolère une maîtrise vide (rien encore maîtrisé) et une vitrine vide', () => {
    expect(() =>
      métriquesSchema.parse({
        cheval_id: 'cheval-1',
        maîtrise: { courante: null, record: null, série: [] },
        vitrine: { record: null, jalons: [] },
      }),
    ).not.toThrow();
  });

  it('strippe toute clé inconnue (rien de superflu ne sort)', () => {
    const parsed = métriquesSchema.parse({ ...valide, secret_interne: 'nope' });
    expect(parsed).not.toHaveProperty('secret_interne');
  });

  it('rejette un type de jalon hors référentiel', () => {
    expect(() =>
      vitrineSchema.parse({
        record: null,
        jalons: [{ seance_id: 's1', date: new Date(), type: 'inconnu', hauteur: 110 }],
      }),
    ).toThrow();
  });
});
