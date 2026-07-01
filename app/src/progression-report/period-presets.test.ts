import { describe, expect, it } from 'vitest';
import { PÉRIODE_PRESETS, périodePourPreset } from './period-presets';

/**
 * Tests **purs** (Node) des préréglages de période du bilan (lot 4.4). Prouve la
 * traduction choix → fenêtre `{ from, to }` (curation §6.3), déterministe.
 */

const maintenant = new Date('2026-07-01T12:00:00.000Z');

describe('périodePourPreset — curation de période (§6.3)', () => {
  it('« tout » = période ouverte des deux côtés (tout l’historique)', () => {
    expect(périodePourPreset('tout', maintenant)).toEqual({ from: null, to: null });
  });

  it('« 3m » = fenêtre glissante de 90 jours finissant à maintenant', () => {
    const p = périodePourPreset('3m', maintenant);
    expect(p.to).toBe('2026-07-01T12:00:00.000Z');
    // 90 jours avant le 1ᵉʳ juillet → 2 avril.
    expect(p.from).toBe('2026-04-02T12:00:00.000Z');
  });

  it('les fenêtres bornées grandissent avec le préréglage (3m < 6m < 12m)', () => {
    const from3 = new Date(périodePourPreset('3m', maintenant).from as string).getTime();
    const from6 = new Date(périodePourPreset('6m', maintenant).from as string).getTime();
    const from12 = new Date(périodePourPreset('12m', maintenant).from as string).getTime();
    expect(from6).toBeLessThan(from3);
    expect(from12).toBeLessThan(from6);
  });

  it('chaque préréglage produit une période valide (from ≤ to quand borné)', () => {
    for (const preset of PÉRIODE_PRESETS) {
      const p = périodePourPreset(preset, maintenant);
      if (p.from && p.to) {
        expect(new Date(p.from).getTime()).toBeLessThanOrEqual(new Date(p.to).getTime());
      }
    }
  });
});
