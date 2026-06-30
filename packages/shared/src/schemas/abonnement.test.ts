import { describe, expect, it } from 'vitest';
import { TIERS } from '../enums/compte';
import {
  abonnementStatutSortieSchema,
  checkoutDemandeSchema,
  checkoutSortieSchema,
  offresSortieSchema,
  STATUTS_ABONNEMENT,
  TIERS_PAYANTS,
} from './abonnement';

/**
 * Contrats de l'abonnement (lot 4.2). On prouve que les **tiers payants** sont
 * un sous-ensemble du référentiel (sans `gratuit`), que le checkout n'accepte
 * **pas** `gratuit`, et que les sorties (checkout, état, offres) valident la
 * forme attendue par l'app.
 */
describe('TIERS_PAYANTS', () => {
  it('est un sous-ensemble de TIERS, sans « gratuit »', () => {
    for (const t of TIERS_PAYANTS) {
      expect(TIERS).toContain(t);
    }
    expect(TIERS_PAYANTS).not.toContain('gratuit');
    expect([...TIERS_PAYANTS]).toEqual(['premium', 'pro']);
  });
});

describe('checkoutDemandeSchema', () => {
  it('accepte premium et pro', () => {
    expect(checkoutDemandeSchema.parse({ tier_cible: 'premium' }).tier_cible).toBe('premium');
    expect(checkoutDemandeSchema.parse({ tier_cible: 'pro' }).tier_cible).toBe('pro');
  });

  it('refuse « gratuit » (non souscriptible) et l’inconnu', () => {
    expect(() => checkoutDemandeSchema.parse({ tier_cible: 'gratuit' })).toThrow();
    expect(() => checkoutDemandeSchema.parse({ tier_cible: 'platine' })).toThrow();
  });
});

describe('checkoutSortieSchema', () => {
  it('exige une URL de checkout et un id d’abonnement', () => {
    const ok = checkoutSortieSchema.parse({
      checkout_url: 'https://www.mollie.com/checkout/test/abc',
      abonnement_id: '11111111-1111-1111-1111-111111111111',
    });
    expect(ok.checkout_url).toContain('mollie');
    expect(() =>
      checkoutSortieSchema.parse({ checkout_url: 'pas-une-url', abonnement_id: 'x' }),
    ).toThrow();
  });
});

describe('abonnementStatutSortieSchema', () => {
  it('accepte un abonnement actif + une URL de gestion', () => {
    const v = abonnementStatutSortieSchema.parse({
      abonnement: { statut: 'actif', tier_cible: 'pro' },
      gestion_url: 'https://my.mollie.com/dashboard',
    });
    expect(v.abonnement?.statut).toBe('actif');
    expect(v.gestion_url).toContain('mollie');
  });

  it('accepte l’absence d’abonnement (null) et de gestion (null)', () => {
    const v = abonnementStatutSortieSchema.parse({ abonnement: null, gestion_url: null });
    expect(v.abonnement).toBeNull();
    expect(v.gestion_url).toBeNull();
  });

  it('couvre tous les statuts du cycle', () => {
    for (const statut of STATUTS_ABONNEMENT) {
      const v = abonnementStatutSortieSchema.parse({
        abonnement: { statut, tier_cible: 'premium' },
        gestion_url: null,
      });
      expect(v.abonnement?.statut).toBe(statut);
    }
  });
});

describe('offresSortieSchema', () => {
  it('valide des offres avec montant/devise/intervalle (montants paramétrables)', () => {
    const v = offresSortieSchema.parse({
      offres: [
        { tier: 'premium', montant: '9.99', devise: 'EUR', intervalle: '1 month' },
        { tier: 'pro', montant: '19.99', devise: 'EUR', intervalle: '1 month' },
      ],
    });
    expect(v.offres).toHaveLength(2);
    expect(v.offres[0].montant).toBe('9.99');
  });

  it('refuse une devise mal formée', () => {
    expect(() =>
      offresSortieSchema.parse({
        offres: [{ tier: 'premium', montant: '9.99', devise: 'EUROS', intervalle: '1 month' }],
      }),
    ).toThrow();
  });
});
