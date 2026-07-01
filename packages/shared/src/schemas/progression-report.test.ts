import { describe, expect, expectTypeOf, it } from 'vitest';
import type { RégularitéBilan } from '../calc';
import {
  bilanProgressionParamsSchema,
  bilanSectionsSchema,
  périodeParamsSchema,
  type RégularitéBilanDto,
} from './progression-report';

describe('alignement de type (aucune forme dupliquée, Architecture §2)', () => {
  it('RégularitéBilan (calc) et RégularitéBilanDto (Zod) sont la même forme', () => {
    // La régularité est calculée UNE fois dans `shared/calc` ; le DTO n'en est que
    // le miroir validé au bord — l'aperçu app et le rapport api ne divergent pas.
    expectTypeOf<RégularitéBilan>().toEqualTypeOf<RégularitéBilanDto>();
  });
});

describe('bilanProgressionParamsSchema — curation par défaut (§6.3)', () => {
  it('un corps vide = rapport complet, tout l’historique, format lien', () => {
    const p = bilanProgressionParamsSchema.parse({});
    expect(p.format).toBe('lien');
    expect(p.période).toEqual({ from: null, to: null });
    expect(p.indicateurs).toEqual({
      niveau_démontré: true,
      performance_concours: true,
      régularité: true,
      trajectoire: true,
    });
  });

  it('les indicateurs sont individuellement désactivables (curation)', () => {
    const p = bilanProgressionParamsSchema.parse({
      indicateurs: { performance_concours: false, trajectoire: false },
    });
    expect(p.indicateurs.performance_concours).toBe(false);
    expect(p.indicateurs.trajectoire).toBe(false);
    // Les autres restent par défaut à true.
    expect(p.indicateurs.régularité).toBe(true);
  });

  it('rejette une période où la fin précède le début', () => {
    expect(() =>
      périodeParamsSchema.parse({
        from: '2026-03-01T00:00:00.000Z',
        to: '2026-01-01T00:00:00.000Z',
      }),
    ).toThrow();
  });
});

describe('bilanSectionsSchema — sections facultatives (curation §6.3)', () => {
  const identité = {
    nom: 'Quibelle',
    niveau: 'amateur' as const,
    hauteur_de_référence: 110,
    âge: null,
    race: null,
  };
  const période = { from: null, to: null, nb_séances: 0 };

  it('identité et période suffisent (les 4 autres sections sont optionnelles)', () => {
    expect(() => bilanSectionsSchema.parse({ identité, période })).not.toThrow();
  });

  it('accepte les sections activées quand elles sont présentes', () => {
    expect(() =>
      bilanSectionsSchema.parse({
        identité,
        période: { ...période, nb_séances: 4 },
        régularité: {
          total_séances: 4,
          début: new Date('2026-01-01'),
          fin: new Date('2026-01-29'),
          jours_couverts: 29,
          séances_par_mois: 4.1,
          semaines_actives: 4,
          plus_longue_série_semaines: 4,
        },
        trajectoire: {
          points: [{ date: new Date('2026-01-01'), hauteur: 110 }],
          tendance: 'hausse',
          départ: 100,
          arrivée: 110,
        },
      }),
    ).not.toThrow();
  });
});
