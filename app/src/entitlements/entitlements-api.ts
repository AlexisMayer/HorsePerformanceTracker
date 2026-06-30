import { type EntitlementSortie, entitlementSortieSchema } from '@hpt/shared';
import type { ApiClient } from '../auth/api-client';

/**
 * Surface `entitlements` câblée sur l'API du lot 4.1 (`GET /me/entitlement`).
 * Le DTO vient de `@hpt/shared` — aucun type dupliqué (Architecture §1/§2). La
 * requête passe par le client **authentifié** (access token + interceptor 401) ;
 * le serveur lit le tier du principal.
 *
 * Contrairement aux fiches (dates `Date`), l'entitlement n'a **que des scalaires
 * et booléens** : on **re-valide** donc la réponse par `entitlementSortieSchema`
 * au bord de l'app (le contrat est garanti des deux côtés). Le gating reste
 * malgré tout l'**autorité serveur** — l'app ne s'en sert que pour afficher /
 * (plus tard) griser (UI/UX §5, 4.2).
 */
export interface EntitlementsApi {
  get(): Promise<EntitlementSortie>;
}

export function createEntitlementsApi(client: ApiClient): EntitlementsApi {
  return {
    get: async () =>
      entitlementSortieSchema.parse(
        await client.request<unknown>('/me/entitlement', { method: 'GET' }),
      ),
  };
}
