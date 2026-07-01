import type { PageHistorique } from '@hpt/shared';
import type { ApiClient } from '../auth/api-client';

/**
 * Surface `history` câblée sur l'endpoint **paginé** ajouté au service `sessions`
 * en 3.4 (`GET /horses/:id/sessions/history`). Le DTO vient de `@hpt/shared` —
 * aucun type dupliqué (Architecture §1/§2). La requête passe par le client
 * **authentifié** (access token + interceptor 401 de 1.4) ; le serveur scope au
 * compte courant et vérifie la propriété du cheval (404 si étranger).
 *
 * Lecture seule : l'historique **parcourt** les séances passées (récent → ancien)
 * et **ré-ouvre** leur bilan simple via `sharing` (3.3, `GET /sessions/:id/card`)
 * — il n'écrit rien et n'est **jamais verrouillé** (historique conservé, gratuit,
 * Spec §8). Pagination simple par curseur (`before` ISO + `limit`), **comme le
 * fil**. Note transport : `PageHistorique` type les dates en `Date`, mais le JSON
 * les rend en chaînes ISO — l'affichage passe par des formateurs tolérants
 * (`history-format`), et `next_before` est déjà une chaîne ISO.
 */
export interface HistoryQueryParams {
  /** Curseur : ne renvoie que les séances strictement plus anciennes (ISO). */
  before?: string;
  /** Plafond de séances par page. */
  limit?: number;
}

export interface HistoryApi {
  getHistory(chevalId: string, params?: HistoryQueryParams): Promise<PageHistorique>;
}

/**
 * `basePath` (lot 4.6) sélectionne la **portée** : `/horses` (défaut) ou
 * `/guest-access/horses` (invité — même historique paginé, scopé par l'octroi).
 * Le suffixe `…/sessions/history` est identique des deux côtés (`read-scope`).
 */
export function createHistoryApi(client: ApiClient, basePath = '/horses'): HistoryApi {
  return {
    getHistory: (chevalId, params = {}) => {
      const search = new URLSearchParams();
      if (params.before) search.set('before', params.before);
      if (params.limit != null) search.set('limit', String(params.limit));
      const qs = search.toString();
      return client.request<PageHistorique>(
        `${basePath}/${chevalId}/sessions/history${qs ? `?${qs}` : ''}`,
        { method: 'GET' },
      );
    },
  };
}
