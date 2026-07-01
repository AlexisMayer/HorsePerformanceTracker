import { describe, expect, it } from 'vitest';
import type { AiBilanConfig } from './ai-bilan.config';
import { AiBilanRateLimiter } from './ai-bilan-rate-limiter';

/**
 * Le **rate limiter par utilisateur** (lot 4.5, Stack §3.6) — fenêtre glissante
 * déterministe (horloge injectée). On prouve : le plafond par compte, l'isolement
 * entre comptes, et la **remise à zéro** quand la fenêtre glisse.
 */

function config(over: Partial<AiBilanConfig> = {}): AiBilanConfig {
  return {
    modèle: 'mistral-small',
    version: 'mistral-small-2409',
    apiKey: null,
    baseUrl: 'https://api.mistral.ai',
    rateLimitMax: 2,
    rateLimitFenêtreMs: 1000,
    ...over,
  };
}

describe('AiBilanRateLimiter', () => {
  it('autorise jusqu’au plafond puis refuse (par compte)', () => {
    const now = 0;
    const limiter = new AiBilanRateLimiter(config({ rateLimitMax: 2 }), () => now);
    expect(limiter.consume('u1')).toBe(true); // 1
    expect(limiter.consume('u1')).toBe(true); // 2
    expect(limiter.consume('u1')).toBe(false); // 3 → refusé (429)
  });

  it('isole les comptes (le plafond de l’un ne touche pas l’autre)', () => {
    const now = 0;
    const limiter = new AiBilanRateLimiter(config({ rateLimitMax: 1 }), () => now);
    expect(limiter.consume('u1')).toBe(true);
    expect(limiter.consume('u1')).toBe(false);
    // u2 dispose de son propre budget.
    expect(limiter.consume('u2')).toBe(true);
  });

  it('remet à zéro quand la fenêtre glisse (garde-fou de coût, pas un blocage définitif)', () => {
    let now = 0;
    const limiter = new AiBilanRateLimiter(
      config({ rateLimitMax: 1, rateLimitFenêtreMs: 1000 }),
      () => now,
    );
    expect(limiter.consume('u1')).toBe(true);
    expect(limiter.consume('u1')).toBe(false);
    now = 1001; // au-delà de la fenêtre
    expect(limiter.consume('u1')).toBe(true);
  });
});
