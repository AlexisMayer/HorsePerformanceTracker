import type { Fil } from '@hpt/shared';
import type { ApiClient } from '../auth/api-client';

/**
 * Surface `feed` câblée sur l'API du lot 3.1 (`feed.controller.ts`). Tous les DTO
 * viennent de `@hpt/shared` — aucun type dupliqué (Architecture §1/§2). Les
 * requêtes passent par le client **authentifié** (access token + interceptor 401
 * de 1.4) ; le serveur scope au compte courant et vérifie la propriété du cheval.
 *
 * Lecture seule : le feed **compose** (faits objectifs, légendes contexte, jalons
 * injectés, entrées de régularité) — il n'écrit rien et n'est jamais verrouillé
 * (gratuit). Pagination simple par curseur (`before` ISO + `limit`).
 *
 * Note transport : `Fil` type ses dates en `Date`, mais le JSON les rend en
 * chaînes ISO — l'affichage passe par des formateurs tolérants (cf. `labels.ts`),
 * et le curseur `next_before` est déjà une chaîne ISO repassée telle quelle.
 */
export interface FeedQueryParams {
  /** Curseur : ne renvoie que les séances strictement plus anciennes (ISO). */
  before?: string;
  /** Plafond de séances par page. */
  limit?: number;
}

export interface FeedApi {
  getFeed(chevalId: string, params?: FeedQueryParams): Promise<Fil>;
}

/**
 * `basePath` (lot 4.6) sélectionne la **portée de lecture** : `/horses` (défaut,
 * propriétaire) ou `/guest-access/horses` (invité — même fil, scopé par l'octroi,
 * cf. `read-scope`). Le suffixe de route est identique des deux côtés.
 */
export function createFeedApi(client: ApiClient, basePath = '/horses'): FeedApi {
  return {
    getFeed: (chevalId, params = {}) => {
      const search = new URLSearchParams();
      if (params.before) search.set('before', params.before);
      if (params.limit != null) search.set('limit', String(params.limit));
      const qs = search.toString();
      return client.request<Fil>(`${basePath}/${chevalId}/feed${qs ? `?${qs}` : ''}`, {
        method: 'GET',
      });
    },
  };
}
