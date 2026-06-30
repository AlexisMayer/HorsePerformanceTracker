import { Logger } from '@nestjs/common';
import type {
  CheckoutCree,
  CreerAbonnementParams,
  CreerCheckoutParams,
  MetadonneesAbonnement,
  MolliePort,
  PaiementMollie,
  StatutPaiementMollie,
} from './mollie.port';

/**
 * Adaptateur **réel** du port Mollie (lot 4.2) — l'implémentation concrète
 * derrière `MolliePort`, parlant à l'**API Mollie v2** en **mode test** (clé
 * `test_…`). Fin et isolé : toute l'orchestration (création d'abonnement,
 * réconciliation, autorité du tier) est dans `subscriptions.service` (testée
 * avec le **fake**). Ce fichier n'est **jamais** importé par un test — couvert
 * par `tsc` (même posture que les adaptateurs natifs de l'app, 2.3/3.3).
 *
 * Flux (Stack §6) : client + **premier paiement** (`sequenceType: first`,
 * **SEPA Direct Debit** privilégié) pour établir le **mandat**, puis abonnement
 * récurrent sur ce mandat une fois le paiement honoré. **RGPD** : seul l'e-mail
 * est transmis (jamais de donnée de cheval) ; les métadonnées ne portent que nos
 * identifiants internes.
 */
const MOLLIE_API_BASE = 'https://api.mollie.com/v2';

interface MollieCustomer {
  id: string;
}

interface MolliePayment {
  id: string;
  status: string;
  mandateId?: string | null;
  customerId?: string | null;
  metadata?: unknown;
  _links?: { checkout?: { href?: string } };
}

interface MollieSubscription {
  id: string;
}

const STATUTS_CONNUS: readonly StatutPaiementMollie[] = [
  'open',
  'pending',
  'authorized',
  'paid',
  'failed',
  'canceled',
  'expired',
];

export class MollieHttpClient implements MolliePort {
  private readonly logger = new Logger(MollieHttpClient.name);

  constructor(private readonly apiKey: string) {}

  async créerCheckout(params: CreerCheckoutParams): Promise<CheckoutCree> {
    const customer = await this.post<MollieCustomer>('/customers', { email: params.email });

    const payment = await this.post<MolliePayment>('/payments', {
      amount: params.montant,
      description: params.description,
      redirectUrl: params.redirectUrl,
      webhookUrl: params.webhookUrl,
      customerId: customer.id,
      sequenceType: 'first',
      metadata: params.metadata,
    });

    const checkoutUrl = payment._links?.checkout?.href;
    if (!checkoutUrl) {
      throw new Error('Mollie: URL de checkout absente de la réponse du paiement.');
    }
    return { paymentId: payment.id, customerId: customer.id, checkoutUrl };
  }

  async lirePaiement(paymentId: string): Promise<PaiementMollie> {
    const payment = await this.get<MolliePayment>(`/payments/${encodeURIComponent(paymentId)}`);
    return {
      id: payment.id,
      statut: this.mapStatut(payment.status),
      customerId: payment.customerId ?? null,
      mandateId: payment.mandateId ?? null,
      metadata: this.mapMetadata(payment.metadata),
    };
  }

  async créerAbonnement(params: CreerAbonnementParams): Promise<{ subscriptionId: string }> {
    const sub = await this.post<MollieSubscription>(
      `/customers/${encodeURIComponent(params.customerId)}/subscriptions`,
      {
        amount: params.montant,
        interval: params.intervalle,
        description: params.description,
        webhookUrl: params.webhookUrl,
        ...(params.mandateId ? { mandateId: params.mandateId } : {}),
        metadata: params.metadata,
      },
    );
    return { subscriptionId: sub.id };
  }

  async annulerAbonnement(params: { customerId: string; subscriptionId: string }): Promise<void> {
    await this.send(
      'DELETE',
      `/customers/${encodeURIComponent(params.customerId)}/subscriptions/${encodeURIComponent(
        params.subscriptionId,
      )}`,
    );
  }

  private mapStatut(status: string): StatutPaiementMollie {
    const connu = STATUTS_CONNUS.find((s) => s === status);
    if (connu) return connu;
    // Statut inattendu : on ne l'interprète jamais comme « payé » (sûreté).
    this.logger.warn(`Statut Mollie inconnu « ${status} » → traité comme « failed ».`);
    return 'failed';
  }

  private mapMetadata(metadata: unknown): Partial<MetadonneesAbonnement> | null {
    const obj = typeof metadata === 'string' ? safeParse(metadata) : metadata;
    if (!obj || typeof obj !== 'object') return null;
    const m = obj as Record<string, unknown>;
    return {
      ...(typeof m.abonnementId === 'string' ? { abonnementId: m.abonnementId } : {}),
      ...(typeof m.compteId === 'string' ? { compteId: m.compteId } : {}),
      ...(m.tierCible === 'premium' || m.tierCible === 'pro' ? { tierCible: m.tierCible } : {}),
    };
  }

  private get<T>(path: string): Promise<T> {
    return this.send('GET', path);
  }

  private post<T>(path: string, body: unknown): Promise<T> {
    return this.send('POST', path, body);
  }

  private async send<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${MOLLIE_API_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      // Détail journalisé côté serveur ; jamais propagé tel quel au client.
      this.logger.error(`Mollie ${method} ${path} → ${response.status}: ${detail}`);
      throw new Error(`Mollie ${method} ${path} a échoué (${response.status}).`);
    }
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }
}

/** Parse JSON sans lever (métadonnées Mollie potentiellement absentes/malformées). */
function safeParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
