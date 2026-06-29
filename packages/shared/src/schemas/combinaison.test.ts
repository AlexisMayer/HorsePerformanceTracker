import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  type CombinaisonSortie,
  combinaisonCréerSchema,
  combinaisonModifierSchema,
  combinaisonSortieSchema,
  nomAutoCombinaison,
} from './combinaison';

describe('nomAutoCombinaison (auto-nommage, Spec §4.3)', () => {
  it('nomme par cardinalité (Double / Triple / Quadruple)', () => {
    expect(nomAutoCombinaison(2)).toBe('Double');
    expect(nomAutoCombinaison(3)).toBe('Triple');
    expect(nomAutoCombinaison(4)).toBe('Quadruple');
  });

  it('suffixe du type dominant quand tous les éléments sont identiques', () => {
    expect(nomAutoCombinaison(3, ['Oxer', 'Oxer', 'Oxer'])).toBe('Triple oxer');
    expect(nomAutoCombinaison(2, ['Vertical', 'Vertical'])).toBe('Double vertical');
  });

  it('reste sur la cardinalité seule si les types sont mélangés', () => {
    expect(nomAutoCombinaison(2, ['Vertical', 'Oxer'])).toBe('Double');
  });

  it('retombe sur un libellé générique au-delà de 4 éléments', () => {
    expect(nomAutoCombinaison(5)).toBe('Combinaison à 5 éléments');
  });
});

describe('combinaisonCréerSchema (DTO d’entrée)', () => {
  it('valide une réutilisable détaillée (nom optionnel)', () => {
    const parsed = combinaisonCréerSchema.parse({
      nombre_d_éléments: 2,
      éléments: ['Vertical', 'Oxer'],
    });
    expect(parsed.nombre_d_éléments).toBe(2);
    expect(parsed.nom).toBeUndefined();
  });

  it('rejette une cardinalité incohérente (éléments ≠ nombre_d_éléments)', () => {
    expect(
      combinaisonCréerSchema.safeParse({
        nombre_d_éléments: 3,
        éléments: ['Vertical', 'Oxer'],
      }).success,
    ).toBe(false);
  });

  it('exige au moins 2 éléments (une combinaison n’a pas de sens en deçà)', () => {
    expect(
      combinaisonCréerSchema.safeParse({ nombre_d_éléments: 1, éléments: ['Vertical'] }).success,
    ).toBe(false);
  });

  it('ne porte aucune cible (`compte_id`) dans le corps — elle vient du jeton', () => {
    const parsed = combinaisonCréerSchema.parse({
      nombre_d_éléments: 2,
      éléments: ['Croix', 'Croix'],
    });
    expect(parsed).not.toHaveProperty('compte_id');
  });
});

describe('combinaisonModifierSchema (modification = nouvelle, Modèle §8)', () => {
  it('accepte un renommage seul (la structure est héritée par le service)', () => {
    expect(combinaisonModifierSchema.safeParse({ nom: 'Mon double favori' }).success).toBe(true);
  });

  it('accepte une nouvelle structure complète', () => {
    expect(
      combinaisonModifierSchema.safeParse({
        nombre_d_éléments: 3,
        éléments: ['Oxer', 'Oxer', 'Vertical'],
      }).success,
    ).toBe(true);
  });

  it('rejette un corps vide (rien à dériver)', () => {
    expect(combinaisonModifierSchema.safeParse({}).success).toBe(false);
  });

  it('rejette une cardinalité incohérente quand les deux sont fournis', () => {
    expect(
      combinaisonModifierSchema.safeParse({
        nombre_d_éléments: 2,
        éléments: ['Oxer', 'Oxer', 'Oxer'],
      }).success,
    ).toBe(false);
  });
});

describe('combinaisonSortieSchema (projection de lecture)', () => {
  it('projette les champs de domaine + usage_count, et retire toute clé inattendue', () => {
    const sortie = combinaisonSortieSchema.parse({
      id: '11111111-1111-1111-1111-111111111111',
      created_at: new Date(),
      updated_at: new Date(),
      compte_id: '22222222-2222-2222-2222-222222222222',
      nom: 'Triple oxer',
      nombre_d_éléments: 3,
      éléments: ['Oxer', 'Oxer', 'Oxer'],
      usage_count: 4,
      // Clés internes/parasites : doivent disparaître (strip).
      last_used_at: new Date(),
      secret_interne: 'ne-doit-pas-fuiter',
    } as Record<string, unknown>);
    expect(sortie.nom).toBe('Triple oxer');
    expect(sortie.usage_count).toBe(4);
    expect(sortie).not.toHaveProperty('last_used_at');
    expect(sortie).not.toHaveProperty('secret_interne');
    expectTypeOf<CombinaisonSortie>().not.toHaveProperty('last_used_at');
  });
});
