import { describe, expect, expectTypeOf, it } from 'vitest';
import { TIERS } from '../enums/compte';
import { type EntitlementSortie, entitlementSortieSchema } from '../schemas/entitlement';
import {
  aLaCapacité,
  CAPACITÉS,
  type Capacité,
  type Entitlement,
  entitlementPourTier,
  MATRICE_ENTITLEMENT,
  PLAFOND_COMBINAISONS_GRATUIT,
  peutCréer,
  QUOTAS,
  quotaPour,
} from './entitlement';

/**
 * Politique d'entitlement (lot 4.1) — **donnée pure et testée** dans `shared`
 * (Architecture §2), source unique lue par l'app (grisage 4.2) et l'api (garde +
 * quota). On vérifie ici que la matrice est **fidèle au tableau Spec §8** et que
 * les accesseurs purs se comportent aux bornes.
 */

describe('matrice d’entitlement (fidélité au tableau Spec §8)', () => {
  it('gratuit : aucune capacité payante, 1 cheval, bibliothèque plafonnée', () => {
    expect(MATRICE_ENTITLEMENT.gratuit.capacités).toEqual({
      analytique_diagnostic: false,
      bilan_augmenté: false,
      bilan_progression: false,
      multi_chevaux: false,
      comptes_invité: false,
    });
    expect(MATRICE_ENTITLEMENT.gratuit.quotas).toEqual({
      chevaux: 1,
      combinaisons: PLAFOND_COMBINAISONS_GRATUIT,
    });
  });

  it('premium : exploitation mono-cheval déverrouillée, 1 cheval, combinaisons illimitées', () => {
    // Premium ouvre analytique + bilans (sur UN cheval) ; pas de multi/invité.
    expect(MATRICE_ENTITLEMENT.premium.capacités).toEqual({
      analytique_diagnostic: true,
      bilan_augmenté: true,
      bilan_progression: true,
      multi_chevaux: false,
      comptes_invité: false,
    });
    expect(MATRICE_ENTITLEMENT.premium.quotas).toEqual({ chevaux: 1, combinaisons: null });
  });

  it('pro : tout déverrouillé, chevaux & combinaisons illimités', () => {
    expect(MATRICE_ENTITLEMENT.pro.capacités).toEqual({
      analytique_diagnostic: true,
      bilan_augmenté: true,
      bilan_progression: true,
      multi_chevaux: true,
      comptes_invité: true,
    });
    expect(MATRICE_ENTITLEMENT.pro.quotas).toEqual({ chevaux: null, combinaisons: null });
  });

  it('couvre chaque tier du référentiel (aucun tier sans politique)', () => {
    for (const tier of TIERS) {
      expect(MATRICE_ENTITLEMENT[tier]).toBeDefined();
    }
  });

  it('multi_chevaux ⇔ quota chevaux illimité (les deux angles concordent)', () => {
    for (const tier of TIERS) {
      const multi = MATRICE_ENTITLEMENT[tier].capacités.multi_chevaux;
      const illimité = MATRICE_ENTITLEMENT[tier].quotas.chevaux === null;
      expect(multi).toBe(illimité);
    }
  });
});

describe('entitlementPourTier', () => {
  it('assemble tier + capacités + quotas', () => {
    expect(entitlementPourTier('premium')).toEqual({
      tier: 'premium',
      capacités: {
        analytique_diagnostic: true,
        bilan_augmenté: true,
        bilan_progression: true,
        multi_chevaux: false,
        comptes_invité: false,
      },
      quotas: { chevaux: 1, combinaisons: null },
    });
  });

  it('renvoie des copies défensives (la matrice partagée reste immuable)', () => {
    const e = entitlementPourTier('gratuit');
    e.capacités.analytique_diagnostic = true;
    e.quotas.chevaux = 99;
    expect(MATRICE_ENTITLEMENT.gratuit.capacités.analytique_diagnostic).toBe(false);
    expect(MATRICE_ENTITLEMENT.gratuit.quotas.chevaux).toBe(1);
  });
});

describe('aLaCapacité (base de la garde)', () => {
  it('refuse toute capacité payante au gratuit', () => {
    for (const cap of CAPACITÉS) {
      expect(aLaCapacité('gratuit', cap)).toBe(false);
    }
  });

  it('accorde analytique/bilans au premium mais lui refuse multi/invité', () => {
    expect(aLaCapacité('premium', 'analytique_diagnostic')).toBe(true);
    expect(aLaCapacité('premium', 'bilan_augmenté')).toBe(true);
    expect(aLaCapacité('premium', 'bilan_progression')).toBe(true);
    expect(aLaCapacité('premium', 'multi_chevaux')).toBe(false);
    expect(aLaCapacité('premium', 'comptes_invité')).toBe(false);
  });

  it('accorde toutes les capacités au pro', () => {
    for (const cap of CAPACITÉS) {
      expect(aLaCapacité('pro', cap)).toBe(true);
    }
  });
});

describe('quotaPour & peutCréer (base de l’enforcement)', () => {
  it('lit le plafond par ressource (null = illimité)', () => {
    expect(quotaPour('gratuit', 'chevaux')).toBe(1);
    expect(quotaPour('gratuit', 'combinaisons')).toBe(PLAFOND_COMBINAISONS_GRATUIT);
    expect(quotaPour('pro', 'chevaux')).toBeNull();
  });

  it('chevaux : gratuit/premium autorisent le 1er, refusent le 2e ; pro illimité', () => {
    // 0 existant → créer le 1er : autorisé. 1 existant → créer le 2e : refusé.
    for (const tier of ['gratuit', 'premium'] as const) {
      expect(peutCréer(tier, 'chevaux', 0)).toBe(true);
      expect(peutCréer(tier, 'chevaux', 1)).toBe(false);
      expect(peutCréer(tier, 'chevaux', 5)).toBe(false);
    }
    expect(peutCréer('pro', 'chevaux', 0)).toBe(true);
    expect(peutCréer('pro', 'chevaux', 999)).toBe(true);
  });

  it('combinaisons : gratuit borné au plafond, premium/pro illimités', () => {
    expect(peutCréer('gratuit', 'combinaisons', PLAFOND_COMBINAISONS_GRATUIT - 1)).toBe(true);
    expect(peutCréer('gratuit', 'combinaisons', PLAFOND_COMBINAISONS_GRATUIT)).toBe(false);
    expect(peutCréer('premium', 'combinaisons', 9999)).toBe(true);
    expect(peutCréer('pro', 'combinaisons', 9999)).toBe(true);
  });

  it('traite un compte négatif comme 0 (robustesse)', () => {
    expect(peutCréer('gratuit', 'chevaux', -3)).toBe(true);
  });
});

describe('alignement politique ↔ DTO de sortie (shared, une seule forme)', () => {
  it('la projection d’un tier passe le schéma Zod de sortie', () => {
    for (const tier of TIERS) {
      expect(() => entitlementSortieSchema.parse(entitlementPourTier(tier))).not.toThrow();
    }
  });

  it('le type inféré du DTO == le type de la politique', () => {
    // Garde de type : si la matrice et le schéma divergent, le typecheck casse.
    expectTypeOf<EntitlementSortie>().toEqualTypeOf<Entitlement>();
    expectTypeOf<keyof EntitlementSortie['capacités']>().toEqualTypeOf<Capacité>();
  });

  it('les clés du DTO couvrent exactement la politique', () => {
    const e = entitlementSortieSchema.parse(entitlementPourTier('pro'));
    expect(Object.keys(e.capacités).sort()).toEqual([...CAPACITÉS].sort());
    expect(Object.keys(e.quotas).sort()).toEqual([...QUOTAS].sort());
  });
});
