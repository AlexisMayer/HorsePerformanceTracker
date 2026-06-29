import type { Métriques } from '@hpt/shared';
import type { ApiClient } from '../auth/api-client';

/**
 * Surface `metrics` câblée sur l'API du lot 3.2 (`metrics.controller.ts`). Tous
 * les DTO viennent de `@hpt/shared` — aucun type dupliqué (Architecture §1/§2).
 * Les requêtes passent par le client **authentifié** (access token + interceptor
 * 401 de 1.4) ; le serveur scope au compte courant et vérifie la propriété du
 * cheval (404 si étranger).
 *
 * Lecture seule : `metrics` **compose** les deux graphes héros (courbe de hauteur
 * maîtrisée + vitrine à records) — il n'écrit rien et n'est **jamais verrouillé**
 * (gratuit). Note transport : `Métriques` type ses dates en `Date`, mais le JSON
 * les rend en chaînes ISO — l'affichage n'en dépend pas (barres positionnées par
 * ordre chronologique, pas par date).
 */
export interface MetricsApi {
  getMetrics(chevalId: string): Promise<Métriques>;
}

export function createMetricsApi(client: ApiClient): MetricsApi {
  return {
    getMetrics: (chevalId) =>
      client.request<Métriques>(`/horses/${chevalId}/metrics`, { method: 'GET' }),
  };
}
