import { type HeatmapDto, heatmapSchema } from '@hpt/shared';
import type { ApiClient } from '../auth/api-client';

/**
 * Surface `analytics` câblée sur l'API du lot 5.1 (`analytics.controller.ts`).
 * Tous les DTO viennent de `@hpt/shared` — aucun type dupliqué (Architecture
 * §1/§2). Les requêtes passent par le client **authentifié** (access token +
 * interceptor 401 de 1.4) ; le serveur scope au compte, vérifie la propriété du
 * cheval (404 si étranger) **et** gate premium/pro (403 au gratuit — autorité
 * serveur, 4.1). L'app ne fait que **griser** (verrou 4.2) ; elle n'est **pas**
 * la source de vérité.
 *
 * La heatmap n'a **que scalaires/tableaux** (aucune `Date`) : on **re-valide** la
 * réponse par `heatmapSchema` au bord de l'app (le contrat est garanti des deux
 * côtés), comme l'entitlement (4.1).
 */
export interface HeatmapApi {
  getHeatmap(chevalId: string): Promise<HeatmapDto>;
}

export function createHeatmapApi(client: ApiClient): HeatmapApi {
  return {
    getHeatmap: async (chevalId) =>
      heatmapSchema.parse(
        await client.request<unknown>(`/horses/${chevalId}/heatmap`, { method: 'GET' }),
      ),
  };
}
