import { describe, expect, it } from 'vitest';
import { historiqueQuerySchema, type PageHistorique, pageHistoriqueSchema } from './historique';
import type { SéanceSortie } from './seance';

/**
 * Tests **purs** des DTO de l'historique (lot 3.4). La page réutilise
 * `séanceSortieSchema` (aucune forme dupliquée, Architecture §2) ; la query de
 * pagination borne `limit` et valide le curseur `before`, **comme le fil** (3.1).
 */

const séance: SéanceSortie = {
  id: 's1',
  created_at: new Date('2026-03-12T10:00:00.000Z'),
  updated_at: new Date('2026-03-12T10:00:00.000Z'),
  cheval_id: 'cheval-1',
  type: 'Plat',
  date: new Date('2026-03-12T10:00:00.000Z'),
  date_modification: null,
  provenance: 'live',
  obstacles: [],
  tours: [],
  contexte: null,
};

describe('historiqueQuerySchema — pagination validée au bord (§5)', () => {
  it('applique le défaut `limit = 20` quand absent', () => {
    expect(historiqueQuerySchema.parse({})).toEqual({ limit: 20 });
  });

  it('coerce une limite en chaîne (query string) en nombre', () => {
    expect(historiqueQuerySchema.parse({ limit: '10' }).limit).toBe(10);
  });

  it('borne la limite (1 ≤ limit ≤ 50)', () => {
    expect(() => historiqueQuerySchema.parse({ limit: 0 })).toThrow();
    expect(() => historiqueQuerySchema.parse({ limit: 51 })).toThrow();
  });

  it('accepte un curseur `before` ISO et rejette une date non ISO', () => {
    expect(() => historiqueQuerySchema.parse({ before: '2026-03-12T10:00:00.000Z' })).not.toThrow();
    expect(() => historiqueQuerySchema.parse({ before: '12/03/2026' })).toThrow();
  });
});

describe('pageHistoriqueSchema — page de séances + curseur', () => {
  const page: PageHistorique = {
    cheval_id: 'cheval-1',
    séances: [séance],
    next_before: '2026-03-12T10:00:00.000Z',
    has_more: true,
  };

  it('accepte une page valide (séances brutes réutilisées de `sessions`)', () => {
    expect(() => pageHistoriqueSchema.parse(page)).not.toThrow();
  });

  it('accepte une page vide (fin de fil : curseur null, has_more false)', () => {
    expect(() =>
      pageHistoriqueSchema.parse({
        cheval_id: 'cheval-1',
        séances: [],
        next_before: null,
        has_more: false,
      }),
    ).not.toThrow();
  });

  it('strippe toute clé inconnue au bord (rien de superflu ne sort)', () => {
    const parsed = pageHistoriqueSchema.parse({ ...page, secret_interne: 'nope' });
    expect(parsed).not.toHaveProperty('secret_interne');
  });

  it('rejette une séance dont le type sort du référentiel', () => {
    expect(() =>
      pageHistoriqueSchema.parse({
        ...page,
        séances: [{ ...séance, type: 'Dressage' }],
      }),
    ).toThrow();
  });
});
