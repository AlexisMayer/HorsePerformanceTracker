import type { TierPayant } from '@hpt/shared';

/**
 * **Port Mollie** (lot 4.2) — la frontière d'I/O du PSP isolée derrière une
 * interface étroite et **injectable** (même posture que le port de partage de
 * 3.3). Le service d'abonnement n'orchestre que **ces types** : il se teste avec
 * un **fake** (in-memory, déterministe), sans réseau ni clé. L'adaptateur réel
 * (`MollieHttpClient`) parle à l'API Mollie en **mode test** ; il n'est **jamais**
 * importé par un test.
 *
 * Flux d'abonnement Mollie retenu (Stack §6 — Subscriptions + **SEPA Direct
 * Debit** privilégié, carte en complément) :
 *  1. **créerCheckout** — crée le client + un **premier paiement** (`sequenceType:
 *     first`) qui établit le **mandat** (SEPA/carte) et renvoie l'URL de checkout ;
 *  2. au retour du webhook, **lirePaiement** donne le statut + le mandat ;
 *  3. paiement honoré → **créerAbonnement** (récurrent, sur le mandat) ;
 *  4. **annulerAbonnement** à la résiliation.
 *
 * **Autorité du tier = le webhook** : aucune méthode ici n'élève le tier ; le
 * service le fait en réconciliant le paiement (cf. `subscriptions.service`).
 */

/** Jeton d'injection de l'implémentation du port (fake en dev/test, http en prod). */
export const MOLLIE = Symbol('MOLLIE');

/** Montant Mollie : valeur décimale en chaîne (`"9.99"`) + devise ISO-4217. */
export interface MontantMollie {
  value: string;
  currency: string;
}

/**
 * Métadonnées **opaques** attachées au paiement/abonnement Mollie — permettent de
 * relier un webhook (qui ne porte que l'id de paiement) à notre abonnement. **Aucune
 * donnée de cheval** (RGPD, Stack §6) : seulement nos identifiants internes.
 */
export interface MetadonneesAbonnement {
  abonnementId: string;
  compteId: string;
  tierCible: TierPayant;
}

export interface CreerCheckoutParams {
  /** E-mail du compte (seule PII transmise à Mollie, Stack §6/§7.2). */
  email: string;
  montant: MontantMollie;
  description: string;
  /** Deep link de retour dans l'app. */
  redirectUrl: string;
  /** URL publique du webhook (Mollie y postera l'id de paiement). */
  webhookUrl: string;
  metadata: MetadonneesAbonnement;
}

export interface CheckoutCree {
  paymentId: string;
  customerId: string;
  /** URL de la page de paiement Mollie à ouvrir (navigateur in-app/externe). */
  checkoutUrl: string;
}

/** Statuts de paiement Mollie (libellés natifs de l'API v2). */
export type StatutPaiementMollie =
  | 'open'
  | 'pending'
  | 'authorized'
  | 'paid'
  | 'failed'
  | 'canceled'
  | 'expired';

export interface PaiementMollie {
  id: string;
  statut: StatutPaiementMollie;
  customerId: string | null;
  /** Mandat (SEPA/carte) — présent quand le paiement établit un mandat valide. */
  mandateId: string | null;
  metadata: Partial<MetadonneesAbonnement> | null;
}

/**
 * Paramètres d'un **changement de formule** (MOD-001, premium→pro) : un paiement
 * **sur le mandat existant** du client (aucun nouveau client ni mandat créé — le
 * mandat est attaché au **client** Mollie, pas à l'abonnement). C'est l'analogue
 * du premier paiement de la souscription neuve, mais **`sequenceType: recurring`**
 * (le mandat est déjà là) : sa confirmation par webhook déclenche la bascule pro
 * (résiliation du premium + création du pro sur ce même mandat, cf.
 * `subscriptions.service`). **Sans proration** (Stack §6 — tarif plat mono-tier).
 */
export interface CreerPaiementChangementParams {
  /** Client Mollie **existant** (celui de l'abonnement premium) — réutilisé, jamais recréé. */
  customerId: string;
  /** Mandat **existant** à réutiliser (issu du premier paiement premium) ; `null` ⇒ Mollie choisit. */
  mandateId: string | null;
  montant: MontantMollie;
  description: string;
  /** Deep link de retour dans l'app (le tier ne bascule qu'au webhook). */
  redirectUrl: string;
  /** URL publique du webhook (Mollie y postera l'id de paiement). */
  webhookUrl: string;
  metadata: MetadonneesAbonnement;
}

export interface CreerAbonnementParams {
  customerId: string;
  montant: MontantMollie;
  /** Cadence Mollie (ex. `"1 month"`). */
  intervalle: string;
  description: string;
  webhookUrl: string;
  /** Mandat sur lequel prélever (issu du premier paiement) ; `null` ⇒ Mollie choisit. */
  mandateId: string | null;
  metadata: MetadonneesAbonnement;
}

/** Frontière d'I/O Mollie — la seule dépendance du service d'abonnement vers le PSP. */
export interface MolliePort {
  /** Crée le client + le premier paiement (mandat) ; renvoie l'URL de checkout. */
  créerCheckout(params: CreerCheckoutParams): Promise<CheckoutCree>;
  /**
   * **Changement de formule** (premium→pro) : paiement sur le **mandat existant**
   * du client (aucun nouveau client/mandat). Sa confirmation par webhook déclenche
   * la bascule pro. Renvoie l'id de paiement (clé du webhook) + l'URL de retour.
   */
  créerPaiementChangement(params: CreerPaiementChangementParams): Promise<CheckoutCree>;
  /** Lit l'état courant d'un paiement (appelé à la réception du webhook). */
  lirePaiement(paymentId: string): Promise<PaiementMollie>;
  /** Crée l'abonnement récurrent une fois le mandat valide. */
  créerAbonnement(params: CreerAbonnementParams): Promise<{ subscriptionId: string }>;
  /** Résilie l'abonnement récurrent (gestion/résiliation). */
  annulerAbonnement(params: { customerId: string; subscriptionId: string }): Promise<void>;
}
