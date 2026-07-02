import {
  type AbonnementStatutSortie,
  abonnementStatutSortieSchema,
  type CheckoutSortie,
  checkoutSortieSchema,
  type OffresSortie,
  offresSortieSchema,
  TIERS_PAYANTS,
  type Tier,
  type TierPayant,
} from '@hpt/shared';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm';
import { type Database, DRIZZLE } from '../db/database.module';
import { abonnement, compte } from '../db/schema';
import { AbonnementDéjàEnCoursError, ChangementFormuleInvalideError } from './entitlements.errors';
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
 *
 * **MOD-001 — changement de formule premium→pro** (distinct de la souscription
 * neuve) : `changerFormule` **résilie** l'abonnement premium et **crée** l'abonnement
 * pro en **réutilisant le mandat SEPA existant** (attaché au **client** Mollie, pas
 * à l'abonnement), **sans proration** (Stack §6). La bascule de tier reste au
 * **webhook** (aucune perte d'accès : le compte **conserve premium** tant que la
 * formule pro n'est pas confirmée). Le lien `abonnement.remplace_abonnement_id`
 * porte le premium à résilier — c'est **le** signal qui distingue ce flux de la
 * souscription neuve (dont le chemin reste **inchangé**). En miroir, `créerCheckout`
 * **refuse** un compte qui a déjà un abonnement actif/en cours : la souscription
 * neuve reste réservée aux comptes sans abonnement — garde anti double-facturation.
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
    // **Garde anti double-facturation** (MOD-001) : la souscription **neuve** est
    // réservée aux comptes **sans** abonnement en cours. Un compte déjà premium/pro
    // (ou dont le paiement est en attente) ne repasse **jamais** par ici — sinon il
    // créerait un **second** abonnement Mollie (double prélèvement). Le passage
    // premium→pro emprunte `changerFormule` (réutilise le mandat, résilie l'ancien).
    await this.assertPasDéjàAbonné(compteId);

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
   * **Changement de formule premium→pro** (MOD-001, Spec §9.3) — le chemin *distinct*
   * de la souscription neuve. Réservé aux comptes **déjà premium** (garde 4.1, tri sur
   * le tier du principal) portant un **mandat SEPA réutilisable**. Il :
   *  1. retrouve l'abonnement **premium** porteur du mandat (actif **ou** résiliation
   *     déjà programmée — le mandat vit sur le **client** Mollie, pas sur l'abonnement) ;
   *  2. crée la ligne pro `en_attente`, **réutilisant** `customer`+`mandate`, et la lie
   *     au premium via `remplace_abonnement_id` ;
   *  3. déclenche le **paiement de la formule pro** sur ce mandat existant (aucun
   *     nouveau client/mandat) — **sans proration** (Stack §6).
   *
   * **N'élève pas** le tier et **ne résilie pas** encore le premium : tout se joue au
   * **webhook** (`réconcilier`). Jusque-là, `compte.tier` **reste premium** → **aucune
   * perte d'accès** pendant la bascule ; l'app affiche un état *pending* honnête
   * au-dessus de l'accès premium conservé. **RGPD** : le client Mollie (donc l'e-mail)
   * est **déjà** établi — ce flux ne transmet **rien de plus** (pas de param e-mail ici).
   */
  async changerFormule(compteId: string, tier: Tier): Promise<CheckoutSortie> {
    // Garde (autorité serveur) : gratuit → doit *souscrire* ; déjà pro → rien à faire
    // (downgrade hors périmètre). Seul un **premium** change de formule.
    if (tier !== 'premium') {
      throw new ChangementFormuleInvalideError(`tier « ${tier} » (attendu : premium)`);
    }

    // Abonnement premium **porteur du mandat** à réutiliser : le plus récent, qu'il
    // soit `actif` ou `annulé` (résiliation programmée × upgrade — croisement traité).
    const [premium] = await this.db
      .select()
      .from(abonnement)
      .where(
        and(
          eq(abonnement.compte_id, compteId),
          eq(abonnement.tier_cible, 'premium'),
          isNotNull(abonnement.mollie_customer_id),
          isNotNull(abonnement.mollie_mandate_id),
        ),
      )
      .orderBy(desc(abonnement.created_at))
      .limit(1);

    if (!premium?.mollie_customer_id) {
      throw new ChangementFormuleInvalideError('aucun abonnement premium avec mandat réutilisable');
    }

    // Ligne pro `en_attente` : **réutilise** client + mandat, et **référence** le
    // premium à résilier au webhook (le signal qui distingue le changement de formule).
    const [pro] = await this.db
      .insert(abonnement)
      .values({
        compte_id: compteId,
        tier_cible: 'pro',
        statut: 'en_attente',
        mollie_customer_id: premium.mollie_customer_id,
        mollie_mandate_id: premium.mollie_mandate_id,
        remplace_abonnement_id: premium.id,
      })
      .returning({ id: abonnement.id });

    // Paiement de la formule pro **sur le mandat existant** (aucun nouveau client/mandat).
    const checkout = await this.mollie.créerPaiementChangement({
      customerId: premium.mollie_customer_id,
      mandateId: premium.mollie_mandate_id,
      montant: { value: this.config.offres.pro.montant, currency: this.config.devise },
      description: this.description('pro'),
      redirectUrl: this.config.redirectUrl,
      webhookUrl: this.config.webhookUrl,
      metadata: { abonnementId: pro.id, compteId, tierCible: 'pro' },
    });

    await this.db
      .update(abonnement)
      .set({ mollie_payment_id: checkout.paymentId })
      .where(eq(abonnement.id, pro.id));

    return checkoutSortieSchema.parse({
      checkout_url: checkout.checkoutUrl,
      abonnement_id: pro.id,
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
   *
   * **Changement de formule** (MOD-001) : si la ligne confirmée **remplace** un
   * abonnement premium (`remplace_abonnement_id`), l'abonnement pro est créé sur le
   * **mandat réutilisé** puis le premium est **résilié** — le swap est atomique côté
   * webhook (premium `annulé` + pro `actif` + `compte.tier`→pro), d'où **un seul
   * abonnement actif** à l'issue (pas de double facturation) et **aucune perte
   * d'accès** (la bascule est instantanée). Pour une souscription **neuve**
   * (`remplace_abonnement_id` nul), le chemin est **inchangé**.
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
      // Mandat : celui du paiement, ou — **changement de formule** — le mandat
      // **réutilisé** déjà porté par la ligne (établi par le premier paiement premium).
      const mandateId = paiement.mandateId ?? row.mollie_mandate_id;
      let subscriptionId = row.mollie_subscription_id;

      // Crée l'abonnement récurrent **une seule fois** (sur le mandat — neuf ou réutilisé).
      if (!subscriptionId && customerId) {
        const sub = await this.mollie.créerAbonnement({
          customerId,
          montant: { value: this.config.offres[tierCible].montant, currency: this.config.devise },
          intervalle: this.config.intervalle,
          description: this.description(tierCible),
          webhookUrl: this.config.webhookUrl,
          mandateId,
          metadata: { abonnementId: row.id, compteId: row.compte_id, tierCible },
        });
        subscriptionId = sub.subscriptionId;
      }

      // **Changement de formule** : résilie le premium remplacé **avant** d'élever le
      // tier → jamais deux abonnements actifs (pas de double facturation). Souscription
      // neuve (`remplace_abonnement_id` nul) : branche ignorée, chemin inchangé.
      if (row.remplace_abonnement_id) {
        await this.résilierRemplacé(row.remplace_abonnement_id);
      }

      await this.db
        .update(abonnement)
        .set({
          statut: 'actif',
          mollie_subscription_id: subscriptionId,
          mollie_mandate_id: mandateId,
          mollie_customer_id: customerId,
        })
        .where(eq(abonnement.id, row.id));

      // **Autorité serveur** : c'est ICI — et seulement ici — que le tier s'élève
      // (premium→pro pour un changement de formule, l'accès premium n'ayant jamais cessé).
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

  /**
   * **Garde anti double-facturation** (MOD-001) : refuse une souscription **neuve**
   * si le compte a déjà un abonnement `actif` **ou** `en_attente` (paiement en cours).
   * Les états terminaux (`échoué`/`annulé`) ne bloquent pas (re-souscription légitime).
   * Le passage premium→pro n'emprunte **pas** ce chemin (il passe par `changerFormule`).
   */
  private async assertPasDéjàAbonné(compteId: string): Promise<void> {
    const [existant] = await this.db
      .select({ id: abonnement.id })
      .from(abonnement)
      .where(
        and(
          eq(abonnement.compte_id, compteId),
          inArray(abonnement.statut, ['actif', 'en_attente']),
        ),
      )
      .limit(1);
    if (existant) {
      throw new AbonnementDéjàEnCoursError();
    }
  }

  /**
   * **Résilie l'abonnement premium remplacé** par un changement de formule (MOD-001),
   * au moment où le pro s'active. S'il est encore `actif`, on annule le récurrent chez
   * Mollie (le **mandat**, lui, reste sur le client → réutilisé par le pro) ; s'il était
   * déjà `annulé` (résiliation programmée × upgrade), on n'appelle pas Mollie deux fois
   * — on garantit seulement qu'il finit `annulé`. Jamais d'ambiguïté « premium résilié
   * ↔ pro actif » : le premium est explicitement clos.
   */
  private async résilierRemplacé(remplaceId: string): Promise<void> {
    const [remplacé] = await this.db
      .select()
      .from(abonnement)
      .where(eq(abonnement.id, remplaceId))
      .limit(1);
    if (!remplacé) return;

    if (
      remplacé.statut === 'actif' &&
      remplacé.mollie_subscription_id &&
      remplacé.mollie_customer_id
    ) {
      await this.mollie.annulerAbonnement({
        customerId: remplacé.mollie_customer_id,
        subscriptionId: remplacé.mollie_subscription_id,
      });
    }
    if (remplacé.statut !== 'annulé') {
      await this.db
        .update(abonnement)
        .set({ statut: 'annulé' })
        .where(eq(abonnement.id, remplacé.id));
    }
  }

  /** Libellé produit transmis à Mollie (jamais de donnée de cheval). */
  private description(tier: TierPayant): string {
    return `Horse Performance Tracker — ${tier === 'pro' ? 'Pro' : 'Premium'}`;
  }
}
