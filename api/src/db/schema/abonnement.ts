import { index, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { champsTechniques } from './champs-techniques';
import { compte } from './compte';
import { abonnementStatutEnum, abonnementTierEnum } from './enums';

/**
 * **Abonnement** persisté côté serveur (lot 4.2) — **écart assumé vs le Modèle
 * de données** (entités socle 0.3), au même titre que `refresh_token` (1.1) :
 * l'intégration Mollie impose un état serveur (lien compte ↔ paiement/mandat,
 * statut du cycle SEPA) absent du modèle métier. Ajout par **migration Drizzle
 * additive**. Voir le journal 4.2.
 *
 * **Autorité du tier = le webhook** (Stack §6) : cette table trace l'état de
 * l'abonnement ; c'est en la réconciliant (au webhook Mollie) qu'on élève le
 * `tier` du `compte`. Le retour client ne fait que **re-lire**. Tant que le
 * mandat SEPA n'est pas confirmé, l'abonnement reste `en_attente` (état
 * *pending* honnête), et `compte.tier` **n'est pas** touché.
 *
 * **RGPD / minimisation** (Stack §6/§7.2) : on ne stocke que des **références
 * opaques Mollie** (customer/payment/subscription/mandate). Aucune donnée de
 * cheval, aucun moyen de paiement — ceux-ci restent chez Mollie (sous-traitant
 * UE). L'e-mail transmis à Mollie vit déjà sur `compte` (1.1) ; il n'est pas
 * dupliqué ici.
 *
 * - FK `compte` en **`ON DELETE CASCADE`** : support structurel de la purge
 *   RGPD (lot 1.3), cohérent avec la cascade descendante du socle (0.3).
 */
export const abonnement = pgTable(
  'abonnement',
  {
    ...champsTechniques,
    compte_id: uuid('compte_id')
      .notNull()
      .references(() => compte.id, { onDelete: 'cascade' }),
    /** Tier visé par cet abonnement (premium/pro) — jamais `gratuit`. */
    tier_cible: abonnementTierEnum('tier_cible').notNull(),
    /** Statut du cycle (en_attente → actif | échoué | annulé). Défaut `en_attente`. */
    statut: abonnementStatutEnum('statut').notNull().default('en_attente'),
    /** Réf. opaque du client Mollie (porte l'e-mail côté Mollie, pas ici). */
    mollie_customer_id: text('mollie_customer_id'),
    /** Réf. du **premier paiement** (établit le mandat SEPA/carte) — clé du webhook. */
    mollie_payment_id: text('mollie_payment_id'),
    /** Réf. de l'**abonnement récurrent** Mollie, posée une fois le mandat valide. */
    mollie_subscription_id: text('mollie_subscription_id'),
    /** Réf. du **mandat** (SEPA/carte) confirmé — présent quand le paiement est honoré. */
    mollie_mandate_id: text('mollie_mandate_id'),
  },
  (table) => [
    index('abonnement_compte_id_idx').on(table.compte_id),
    // Le webhook ne connaît que l'id de paiement → on retrouve la ligne par lui.
    index('abonnement_mollie_payment_id_idx').on(table.mollie_payment_id),
  ],
);
