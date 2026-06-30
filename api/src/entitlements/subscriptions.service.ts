import {
  type AbonnementStatutSortie,
  abonnementStatutSortieSchema,
  type CheckoutSortie,
  checkoutSortieSchema,
  type OffresSortie,
  offresSortieSchema,
  TIERS_PAYANTS,
  type TierPayant,
} from '@hpt/shared';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { type Database, DRIZZLE } from '../db/database.module';
import { abonnement, compte } from '../db/schema';
import { MOLLIE, type MolliePort } from './mollie/mollie.port';
import { SUBSCRIPTION_CONFIG, type SubscriptionConfig } from './subscription.config';

/**
 * Service **abonnement & upgrade in-app** (lot 4.2, extension du module
 * `entitlements` — Architecture §3 : « Tiers, **Mollie**, garde de gating »).
 *
 * **Décision figée — le webhook est l'autorité du tier** (Stack §6) :
 *  - `créerCheckout` ne fait que **préparer** (ligne `en_attente`, paiement
 *    Mollie) — il **ne touche jamais** `compte.tier` ;
 *  - `réconcilier` (appelé par le **webhook**) est le **seul** endroit qui élève
 *    `compte.tier`, et seulement sur un paiement **honoré** (mandat valide) ;
 *  - le retour client ne fait que **re-lire** (`statut`) — d'où l'état *pending*
 *    honnête tant que le mandat SEPA n'est pas confirmé.
 *
 * Le tier ainsi posé sur `compte` rejoint la garde/les quotas (4.1) au
 * **prochain jeton** (l'app force un refresh au retour — contrat 4.1). Ce
 * service ne porte **aucune** règle de tier : il compose la politique `shared`
 * (4.1) et le port Mollie, sans dupliquer la matrice.
 */
@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(MOLLIE) private readonly mollie: MolliePort,
    @Inject(SUBSCRIPTION_CONFIG) private readonly config: SubscriptionConfig,
  ) {}

  /**
   * **Offres** proposées au paywall (premium/pro) — montants **lus de la config**
   * (paramétrables, jamais en dur, Stack §6/§9.4). L'app les lit pour afficher
   * les tarifs ; elle ne les connaît pas autrement.
   */
  listerOffres(): OffresSortie {
    return offresSortieSchema.parse({
      offres: TIERS_PAYANTS.map((tier) => ({
        tier,
        montant: this.config.offres[tier].montant,
        devise: this.config.devise,
        intervalle: this.config.intervalle,
      })),
    });
  }

  /**
   * Démarre un **checkout** d'upgrade : crée la ligne `abonnement` (`en_attente`)
   * puis le **premier paiement** Mollie (mandat SEPA/carte) et renvoie l'URL de
   * checkout. **N'élève pas** le tier (cf. autorité du webhook). Seul l'e-mail du
   * compte est transmis à Mollie (RGPD, Stack §6).
   */
  async créerCheckout(
    compteId: string,
    email: string,
    tierCible: TierPayant,
  ): Promise<CheckoutSortie> {
    const [row] = await this.db
      .insert(abonnement)
      .values({ compte_id: compteId, tier_cible: tierCible, statut: 'en_attente' })
      .returning({ id: abonnement.id });

    const checkout = await this.mollie.créerCheckout({
      email,
      montant: { value: this.config.offres[tierCible].montant, currency: this.config.devise },
      description: this.description(tierCible),
      redirectUrl: this.config.redirectUrl,
      webhookUrl: this.config.webhookUrl,
      metadata: { abonnementId: row.id, compteId, tierCible },
    });

    await this.db
      .update(abonnement)
      .set({ mollie_payment_id: checkout.paymentId, mollie_customer_id: checkout.customerId })
      .where(eq(abonnement.id, row.id));

    return checkoutSortieSchema.parse({
      checkout_url: checkout.checkoutUrl,
      abonnement_id: row.id,
    });
  }

  /**
   * **Réconciliation au webhook — l'autorité du tier** (Stack §6). À partir de
   * l'id de paiement (seule donnée du webhook), retrouve l'abonnement, lit l'état
   * **réel** du paiement chez Mollie, et :
   *  - **honoré** (paid/authorized, mandat valide) → crée l'abonnement récurrent,
   *    marque `actif` et **élève `compte.tier`** ;
   *  - **échoué** (failed/canceled/expired) → marque `échoué` (tier inchangé) ;
   *  - **en attente** (open/pending) → laisse `en_attente` (SEPA pending).
   *
   * **Idempotent** : un abonnement déjà `actif` est ignoré (re-livraison du
   * webhook) ; l'abonnement récurrent n'est créé qu'une fois. Un paiement inconnu
   * est un no-op (jamais d'élévation).
   */
  async réconcilier(paymentId: string): Promise<void> {
    const [row] = await this.db
      .select()
      .from(abonnement)
      .where(eq(abonnement.mollie_payment_id, paymentId))
      .limit(1);

    if (!row) {
      this.logger.warn(`Webhook Mollie : paiement inconnu ${paymentId} — ignoré.`);
      return;
    }
    if (row.statut === 'actif') return; // déjà réconcilié (re-livraison)

    const paiement = await this.mollie.lirePaiement(paymentId);
    const tierCible = row.tier_cible;

    if (paiement.statut === 'paid' || paiement.statut === 'authorized') {
      const customerId = paiement.customerId ?? row.mollie_customer_id;
      let subscriptionId = row.mollie_subscription_id;

      // Crée l'abonnement récurrent **une seule fois** (sur le mandat du 1er paiement).
      if (!subscriptionId && customerId) {
        const sub = await this.mollie.créerAbonnement({
          customerId,
          montant: { value: this.config.offres[tierCible].montant, currency: this.config.devise },
          intervalle: this.config.intervalle,
          description: this.description(tierCible),
          webhookUrl: this.config.webhookUrl,
          mandateId: paiement.mandateId,
          metadata: { abonnementId: row.id, compteId: row.compte_id, tierCible },
        });
        subscriptionId = sub.subscriptionId;
      }

      await this.db
        .update(abonnement)
        .set({
          statut: 'actif',
          mollie_subscription_id: subscriptionId,
          mollie_mandate_id: paiement.mandateId,
          mollie_customer_id: customerId,
        })
        .where(eq(abonnement.id, row.id));

      // **Autorité serveur** : c'est ICI — et seulement ici — que le tier s'élève.
      await this.db.update(compte).set({ tier: tierCible }).where(eq(compte.id, row.compte_id));

      this.logger.log(
        `Abonnement ${row.id} actif → compte ${row.compte_id} élevé en ${tierCible}.`,
      );
      return;
    }

    if (
      paiement.statut === 'failed' ||
      paiement.statut === 'canceled' ||
      paiement.statut === 'expired'
    ) {
      await this.db.update(abonnement).set({ statut: 'échoué' }).where(eq(abonnement.id, row.id));
      return;
    }
    // open / pending : mandat SEPA non encore confirmé → on reste en_attente.
  }

  /**
   * **État d'abonnement** du compte (le plus récent), pour l'état *pending* /
   * déverrouillé au retour du checkout, + l'**URL de gestion Mollie** (renvoi
   * gérer/résilier, Spec §9.3). Re-validé par le schéma de sortie `shared`.
   */
  async statut(compteId: string): Promise<AbonnementStatutSortie> {
    const [row] = await this.db
      .select({ statut: abonnement.statut, tier_cible: abonnement.tier_cible })
      .from(abonnement)
      .where(eq(abonnement.compte_id, compteId))
      .orderBy(desc(abonnement.created_at))
      .limit(1);

    return abonnementStatutSortieSchema.parse({
      abonnement: row ? { statut: row.statut, tier_cible: row.tier_cible } : null,
      gestion_url: this.config.gestionUrl,
    });
  }

  /**
   * **Résiliation** : annule l'abonnement récurrent Mollie (s'il y en a un actif)
   * et marque la ligne `annulé`. La **bascule de tier** au terme de la période
   * (proration/timing fin) est laissée à la gestion Mollie (point ouvert, §6) —
   * d'où le renvoi vers l'espace Mollie en complément. Idempotent : sans
   * abonnement actif, renvoie simplement l'état courant.
   */
  async annuler(compteId: string): Promise<AbonnementStatutSortie> {
    const [row] = await this.db
      .select()
      .from(abonnement)
      .where(eq(abonnement.compte_id, compteId))
      .orderBy(desc(abonnement.created_at))
      .limit(1);

    if (row && row.statut === 'actif' && row.mollie_subscription_id && row.mollie_customer_id) {
      await this.mollie.annulerAbonnement({
        customerId: row.mollie_customer_id,
        subscriptionId: row.mollie_subscription_id,
      });
      await this.db.update(abonnement).set({ statut: 'annulé' }).where(eq(abonnement.id, row.id));
    }
    return this.statut(compteId);
  }

  /** Libellé produit transmis à Mollie (jamais de donnée de cheval). */
  private description(tier: TierPayant): string {
    return `Horse Performance Tracker — ${tier === 'pro' ? 'Pro' : 'Premium'}`;
  }
}
