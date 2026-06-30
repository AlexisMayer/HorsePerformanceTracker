import { Injectable } from '@nestjs/common';
import type {
  CheckoutCree,
  CreerAbonnementParams,
  CreerCheckoutParams,
  MolliePort,
  PaiementMollie,
  StatutPaiementMollie,
} from './mollie.port';

/**
 * Adaptateur **fake** du port Mollie (lot 4.2) — in-memory, **déterministe**,
 * utilisé en dev **sans clé** (`MOLLIE_API_KEY` absente) et par les tests. Il
 * rend le flux Mollie **simulable localement** (Stack §6) sans réseau :
 *
 *  - `créerCheckout` enregistre un paiement `open` et renvoie une URL de checkout
 *    qui pointe vers la **page de simulation dev** de notre API
 *    (`/webhooks/mollie/dev/checkout/:id`) — donc cliquable de bout en bout en
 *    local : l'ouvrir marque le paiement payé puis déclenche la réconciliation ;
 *  - `simulerPaiement(id, statut)` (hors interface du port) est le **levier de
 *    simulation** : il fait avancer un paiement (ex. → `paid` + mandat), comme le
 *    ferait Mollie. Les tests l'appellent, puis postent le **webhook** : c'est ce
 *    dernier qui élève le tier (autorité serveur).
 *
 * **Aucune autorité ici** : le fake ne touche jamais au tier ; il ne fait que
 * refléter l'état d'un paiement, exactement comme l'API réelle.
 */
@Injectable()
export class FakeMollie implements MolliePort {
  private readonly paiements = new Map<string, PaiementMollie>();
  private readonly checkoutUrls = new Map<string, string>();
  private compteur = 0;

  async créerCheckout(params: CreerCheckoutParams): Promise<CheckoutCree> {
    this.compteur += 1;
    const paymentId = `tr_fake_${this.compteur}`;
    const customerId = `cst_fake_${this.compteur}`;
    this.paiements.set(paymentId, {
      id: paymentId,
      statut: 'open',
      customerId,
      mandateId: null,
      metadata: params.metadata,
    });
    // URL cliquable en dev : la visiter simule le paiement + déclenche le webhook
    // (cf. MollieWebhookController). En test, on ne l'ouvre pas (on pilote le fake).
    const checkoutUrl = `${params.webhookUrl}/dev/checkout/${paymentId}`;
    this.checkoutUrls.set(paymentId, checkoutUrl);
    return { paymentId, customerId, checkoutUrl };
  }

  async lirePaiement(paymentId: string): Promise<PaiementMollie> {
    const paiement = this.paiements.get(paymentId);
    if (!paiement) {
      // Mollie renverrait 404 ; on rend un état « expiré » neutre (jamais d'élévation).
      return {
        id: paymentId,
        statut: 'expired',
        customerId: null,
        mandateId: null,
        metadata: null,
      };
    }
    return { ...paiement };
  }

  async créerAbonnement(_params: CreerAbonnementParams): Promise<{ subscriptionId: string }> {
    this.compteur += 1;
    return { subscriptionId: `sub_fake_${this.compteur}` };
  }

  async annulerAbonnement(_params: { customerId: string; subscriptionId: string }): Promise<void> {
    // No-op : rien à appeler côté PSP en fake.
  }

  /**
   * **Levier de simulation** (dev/test, hors `MolliePort`) — fait avancer un
   * paiement comme le ferait Mollie. `paid`/`authorized` posent un **mandat**
   * (le tier ne s'élèvera qu'au webhook, qui lira ce mandat). Renvoie `false` si
   * le paiement est inconnu.
   */
  simulerPaiement(
    paymentId: string,
    statut: StatutPaiementMollie = 'paid',
    options: { mandateId?: string } = {},
  ): boolean {
    const paiement = this.paiements.get(paymentId);
    if (!paiement) return false;
    const honoré = statut === 'paid' || statut === 'authorized';
    this.paiements.set(paymentId, {
      ...paiement,
      statut,
      mandateId: honoré ? (options.mandateId ?? `mdt_fake_${paymentId}`) : null,
    });
    return true;
  }

  /** Vrai si le paiement existe (utilitaire dev pour la page de simulation). */
  connaîtPaiement(paymentId: string): boolean {
    return this.paiements.has(paymentId);
  }
}
