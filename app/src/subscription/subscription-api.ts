import {
  type AbonnementStatutSortie,
  abonnementStatutSortieSchema,
  type CheckoutSortie,
  checkoutSortieSchema,
  type OffresSortie,
  offresSortieSchema,
  type TierPayant,
} from '@hpt/shared';
import type { ApiClient } from '../auth/api-client';

/**
 * Surface `subscription` câblée sur l'API du lot 4.2 (`/me/subscription/*`).
 * Les DTO viennent de `@hpt/shared` — aucun type dupliqué (Architecture §1/§2).
 * Toutes les requêtes passent par le client **authentifié** (access token +
 * interceptor 401) ; le serveur lit le compte du principal.
 *
 * Comme l'entitlement (4.1), ces sorties n'ont que des scalaires/booléens : on
 * **re-valide** au bord de l'app par les schémas `shared`. Le **gating reste
 * l'autorité serveur** — l'app n'utilise ces données que pour afficher le
 * paywall, l'état *pending* et le déverrouillage (qui dépend du **webhook**).
 */
export interface SubscriptionApi {
  /** Offres tarifaires (premium/pro) — montants lus de la config serveur. */
  getOffres(): Promise<OffresSortie>;
  /** Démarre un checkout Mollie pour le tier choisi ; renvoie l'URL à ouvrir. */
  createCheckout(tierCible: TierPayant): Promise<CheckoutSortie>;
  /**
   * **Passer à Pro** (changement de formule premium→pro, MOD-001) : démarre le
   * paiement pro **sur le mandat réutilisé** (résilie le premium côté serveur au
   * webhook) ; renvoie l'URL à ouvrir. Réservé aux comptes premium (garde serveur).
   */
  changerFormule(): Promise<CheckoutSortie>;
  /** État d'abonnement courant (+ URL de gestion Mollie). */
  getStatut(): Promise<AbonnementStatutSortie>;
  /** Résilie l'abonnement courant ; renvoie le nouvel état. */
  annuler(): Promise<AbonnementStatutSortie>;
}

export function createSubscriptionApi(client: ApiClient): SubscriptionApi {
  return {
    getOffres: async () =>
      offresSortieSchema.parse(
        await client.request<unknown>('/me/subscription/offres', { method: 'GET' }),
      ),
    createCheckout: async (tierCible) =>
      checkoutSortieSchema.parse(
        await client.request<unknown>('/me/subscription/checkout', {
          method: 'POST',
          body: { tier_cible: tierCible },
        }),
      ),
    changerFormule: async () =>
      checkoutSortieSchema.parse(
        await client.request<unknown>('/me/subscription/changer-formule', { method: 'POST' }),
      ),
    getStatut: async () =>
      abonnementStatutSortieSchema.parse(
        await client.request<unknown>('/me/subscription', { method: 'GET' }),
      ),
    annuler: async () =>
      abonnementStatutSortieSchema.parse(
        await client.request<unknown>('/me/subscription/annuler', { method: 'POST' }),
      ),
  };
}
