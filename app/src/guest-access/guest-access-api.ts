import type { AccèsInvitéSortie, ChevalPartagé } from '@hpt/shared';
import type { ApiClient } from '../auth/api-client';

/**
 * Surface `guest-access` câblée sur l'API du lot 4.6. Tous les DTO viennent de
 * `@hpt/shared` — aucun type dupliqué (Architecture §1/§2). Les requêtes passent
 * par le client **authentifié** (access token + interceptor 401 de 1.4).
 *
 * Deux publics :
 *  - **coach** (Pro) : `inviter` / `lister` / `révoquer` les accès d'un cheval
 *    (le serveur gate `comptes_invité` — 403 sinon) ;
 *  - **invité** : `accepter` une invitation (jeton) et `mesAccès` (chevaux
 *    partagés). La **consultation** (feed/héros/historique/analytique) réutilise
 *    les surfaces existantes via leur `basePath` invité (`read-scope`).
 *
 * Note transport : `AccèsInvitéSortie` type `created_at` en `Date`, mais le JSON
 * le rend en chaîne ISO — la vue de gestion n'affiche que des scalaires (e-mail,
 * statut) ; on ne re-valide pas par Zod côté app (autorité au serveur).
 */
export interface GuestAccessApi {
  /** Le coach invite un client (par e-mail) sur un cheval. */
  inviter(chevalId: string, email: string): Promise<AccèsInvitéSortie>;
  /** Liste les accès (invités) d'un cheval du coach. */
  lister(chevalId: string): Promise<AccèsInvitéSortie[]>;
  /** Révoque un accès (par son id) — l'accès cesse immédiatement. */
  révoquer(accèsId: string): Promise<void>;
  /** L'invité accepte une invitation via le jeton reçu ; renvoie où atterrir. */
  accepter(token: string): Promise<ChevalPartagé>;
  /** Les chevaux partagés que l'invité peut consulter (accès actifs). */
  mesAccès(): Promise<ChevalPartagé[]>;
}

export function createGuestAccessApi(client: ApiClient): GuestAccessApi {
  return {
    inviter: (chevalId, email) =>
      client.request<AccèsInvitéSortie>(`/horses/${chevalId}/guest-access`, {
        method: 'POST',
        body: { email },
      }),
    lister: (chevalId) =>
      client.request<AccèsInvitéSortie[]>(`/horses/${chevalId}/guest-access`, { method: 'GET' }),
    révoquer: (accèsId) => client.request<void>(`/guest-access/${accèsId}`, { method: 'DELETE' }),
    accepter: (token) =>
      client.request<ChevalPartagé>('/guest-access/accept', { method: 'POST', body: { token } }),
    mesAccès: () => client.request<ChevalPartagé[]>('/guest-access/me', { method: 'GET' }),
  };
}
