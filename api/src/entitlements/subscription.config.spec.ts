import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadSubscriptionConfig } from './subscription.config';

/**
 * Config d'abonnement (lot 4.2) — preuve que les **montants sont paramétrables**
 * (lus de l'env, jamais en dur) et que **sans clé** Mollie on bascule en mode
 * **fake** (webhooks simulables localement).
 */
const CLÉS = [
  'MOLLIE_API_KEY',
  'SUBSCRIPTION_CURRENCY',
  'SUBSCRIPTION_INTERVAL',
  'SUBSCRIPTION_PREMIUM_AMOUNT',
  'SUBSCRIPTION_PRO_AMOUNT',
  'MOLLIE_WEBHOOK_URL',
  'MOLLIE_REDIRECT_URL',
  'MOLLIE_BILLING_URL',
] as const;

describe('loadSubscriptionConfig', () => {
  let sauvegarde: Record<string, string | undefined>;

  beforeEach(() => {
    sauvegarde = {};
    for (const clé of CLÉS) {
      sauvegarde[clé] = process.env[clé];
      delete process.env[clé];
    }
  });

  afterEach(() => {
    for (const clé of CLÉS) {
      if (sauvegarde[clé] === undefined) delete process.env[clé];
      else process.env[clé] = sauvegarde[clé];
    }
  });

  it('lit les montants depuis l’environnement (paramétrables, non figés)', () => {
    process.env.SUBSCRIPTION_PREMIUM_AMOUNT = '12.50';
    process.env.SUBSCRIPTION_PRO_AMOUNT = '29.00';
    process.env.SUBSCRIPTION_CURRENCY = 'EUR';
    process.env.SUBSCRIPTION_INTERVAL = '3 months';

    const cfg = loadSubscriptionConfig();
    expect(cfg.offres.premium.montant).toBe('12.50');
    expect(cfg.offres.pro.montant).toBe('29.00');
    expect(cfg.devise).toBe('EUR');
    expect(cfg.intervalle).toBe('3 months');
  });

  it('sans clé Mollie → mode fake (mollieApiKey null)', () => {
    expect(loadSubscriptionConfig().mollieApiKey).toBeNull();
  });

  it('avec une clé test → la clé est portée (adaptateur réel)', () => {
    process.env.MOLLIE_API_KEY = 'test_abc123';
    expect(loadSubscriptionConfig().mollieApiKey).toBe('test_abc123');
  });

  it('fournit des défauts dev ergonomiques (montants + URL de retour)', () => {
    const cfg = loadSubscriptionConfig();
    expect(cfg.offres.premium.montant).toMatch(/^\d+\.\d{2}$/);
    expect(cfg.offres.pro.montant).toMatch(/^\d+\.\d{2}$/);
    expect(cfg.redirectUrl).toContain('://');
    expect(cfg.gestionUrl).toBeNull();
  });

  it('expose l’URL de gestion Mollie quand fournie (renvoi résiliation)', () => {
    process.env.MOLLIE_BILLING_URL = 'https://my.mollie.com/dashboard';
    expect(loadSubscriptionConfig().gestionUrl).toBe('https://my.mollie.com/dashboard');
  });
});
