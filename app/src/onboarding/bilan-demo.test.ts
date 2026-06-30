import { HAUTEUR_MAX_CM, HAUTEUR_MIN_CM } from '@hpt/shared';
import { describe, expect, it } from 'vitest';
import { BILAN_DEMO, bilanDemoTrajectoireLabel } from './bilan-demo';

describe('BILAN_DEMO (données de démonstration, découplé de 4.4)', () => {
  it('raconte une progression croissante au sens large', () => {
    const t = BILAN_DEMO.trajectoire;
    expect(t.length).toBeGreaterThan(1);
    for (let i = 1; i < t.length; i++) {
      expect(t[i]).toBeGreaterThanOrEqual(t[i - 1]);
    }
  });

  it('garde des hauteurs dans le référentiel §0', () => {
    for (const h of [...BILAN_DEMO.trajectoire, BILAN_DEMO.maîtrisée, BILAN_DEMO.record]) {
      expect(h).toBeGreaterThanOrEqual(HAUTEUR_MIN_CM);
      expect(h).toBeLessThanOrEqual(HAUTEUR_MAX_CM);
    }
  });

  it('garde le record au-dessus (ou égal) de la maîtrisée — honnêteté §5.5', () => {
    expect(BILAN_DEMO.record).toBeGreaterThanOrEqual(BILAN_DEMO.maîtrisée);
  });

  it('documente une régularité non triviale (cœur du bilan, §6.1)', () => {
    expect(BILAN_DEMO.séances).toBeGreaterThan(0);
    expect(BILAN_DEMO.semaines).toBeGreaterThan(0);
  });
});

describe('bilanDemoTrajectoireLabel', () => {
  it('annonce les bornes de la trajectoire (lecteurs d’écran, §8)', () => {
    const label = bilanDemoTrajectoireLabel(BILAN_DEMO);
    expect(label).toContain('95');
    expect(label).toContain('115');
  });
});
