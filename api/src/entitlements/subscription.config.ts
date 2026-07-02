import type { TierPayant } from '@hpt/shared';

/**
 * Config de l'**abonnement** (lot 4.2) — décisions tranchées, lues de
 * l'environnement (Stack §6/§9.4).
 *
 * **Montants paramétrables, jamais en dur** : les tarifs vivent **ici** (une
 * source unique), surchargés par l'env ; aucun montant n'est dispersé dans les
 * services, contrôleurs ou l'app (l'app les **lit** via `GET
 * /me/subscription/offres`). En prod, `MOLLIE_API_KEY` vient du **Secret
 * Manager** (Stack §3.5) ; en dev, défauts ergonomiques (mode **test** Mollie),
 * et **sans clé** on bascule sur l'adaptateur **fake** (webhooks simulables
 * localement).
 */
export interface OffreConfig {
  /** Valeur décimale Mollie (ex. `"9.99"`). */
  montant: string;
}

export interface SubscriptionConfig {
  /** Code devise ISO-4217 (ex. `EUR`). */
  devise: string;
  /** Cadence de facturation Mollie (ex. `"1 month"`). */
  intervalle: string;
  /** Montant par tier payant — paramétrable (env), source unique. */
  offres: Record<TierPayant, OffreConfig>;
  /** Clé API Mollie (`test_…` en dev). `null` ⇒ adaptateur **fake** (dev sans clé). */
  mollieApiKey: string | null;
  /** URL publique du webhook Mollie (reçoit l'id de paiement). */
  webhookUrl: string;
  /** Deep link de retour dans l'app après checkout (ex. `hpt://upgrade-return`). */
  redirectUrl: string;
  /** URL de l'espace de gestion Mollie (renvoi gérer/résilier, Spec §9.3) ; `null` si non fournie. */
  gestionUrl: string | null;
}

/**
 * Défauts **dev** (jamais des tarifs de prod) — même posture que `DATABASE_URL`
 * (0.3) ou les secrets JWT dev (1.1) : ergonomiques en local, surchargés par
 * l'env en staging/prod. La **valeur** n'est jamais codée ailleurs que dans ce
 * loader.
 */
const DEV_DEFAULTS = {
  devise: 'EUR',
  intervalle: '1 month',
  montantPremium: '9.99',
  montantPro: '19.99',
  webhookUrl: 'http://10.0.0.9:3000/webhooks/mollie',
  redirectUrl: 'hpt://upgrade-return',
} as const;

/** Charge la config d'abonnement depuis l'environnement (paramétrable, non figée). */
export function loadSubscriptionConfig(): SubscriptionConfig {
  const apiKey = process.env.MOLLIE_API_KEY?.trim();
  return {
    devise: process.env.SUBSCRIPTION_CURRENCY ?? DEV_DEFAULTS.devise,
    intervalle: process.env.SUBSCRIPTION_INTERVAL ?? DEV_DEFAULTS.intervalle,
    offres: {
      premium: { montant: process.env.SUBSCRIPTION_PREMIUM_AMOUNT ?? DEV_DEFAULTS.montantPremium },
      pro: { montant: process.env.SUBSCRIPTION_PRO_AMOUNT ?? DEV_DEFAULTS.montantPro },
    },
    mollieApiKey: apiKey && apiKey.length > 0 ? apiKey : null,
    webhookUrl: process.env.MOLLIE_WEBHOOK_URL ?? DEV_DEFAULTS.webhookUrl,
    redirectUrl: process.env.MOLLIE_REDIRECT_URL ?? DEV_DEFAULTS.redirectUrl,
    gestionUrl: process.env.MOLLIE_BILLING_URL?.trim() || null,
  };
}

/** Jeton d'injection de la config d'abonnement (résolue une fois, au démarrage). */
export const SUBSCRIPTION_CONFIG = Symbol('SUBSCRIPTION_CONFIG');
