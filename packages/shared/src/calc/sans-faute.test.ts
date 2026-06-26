import { describe, expect, it } from 'vitest';
import { sansFaute } from './sans-faute';

describe('sansFaute', () => {
  it('est vrai seulement quand barres = 0 ET refus = 0', () => {
    expect(sansFaute({ barres: 0, refus: 0 })).toBe(true);
    expect(sansFaute({ barres: 1, refus: 0 })).toBe(false);
    expect(sansFaute({ barres: 0, refus: 1 })).toBe(false);
    expect(sansFaute({ barres: 2, refus: 3 })).toBe(false);
  });

  it('ne plante pas sur une entrée incohérente', () => {
    expect(sansFaute({ barres: -1, refus: 0 })).toBe(false);
    expect(sansFaute({ barres: Number.NaN, refus: 0 })).toBe(false);
  });
});
