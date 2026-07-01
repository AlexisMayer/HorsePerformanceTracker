import { type BenchmarkListeDto, type BenchmarkSérieDto, benchmarkListeSchema } from '@hpt/shared';
import type { ApiClient } from '../auth/api-client';

/**
 * Surface `analytics` — **benchmark à combinaison constante** (lot 5.2), câblée sur
 * les endpoints frères de la heatmap (`analytics.controller.ts`). Tous les DTO
 * viennent de `@hpt/shared` — aucun type dupliqué (Architecture §1/§2). Les
 * requêtes passent par le client **authentifié** ; le serveur scope au compte,
 * vérifie la propriété du cheval **et** de la combinaison (404 sinon) **et** gate
 * premium/pro (403 au gratuit — autorité serveur, 4.1). L'app ne fait que **griser**
 * (verrou 4.2) ; elle n'est **pas** la source de vérité.
 *
 * Deux surfaces : la **liste** (que scalaires/entiers → **re-validée** par
 * `benchmarkListeSchema` au bord, comme la heatmap) et la **série** (porte des
 * `date` → **castée** ; le JSON rend les dates en chaînes ISO, l'affichage n'en
 * dépend pas — courbe positionnée par ordre chronologique, cf. `metrics` 3.2).
 */
export interface BenchmarkApi {
  listBenchmarkables(chevalId: string): Promise<BenchmarkListeDto>;
  getSérie(chevalId: string, combinaisonRef: string): Promise<BenchmarkSérieDto>;
}

/**
 * `basePath` (lot 4.6) sélectionne la **portée** : `/horses` (défaut, gaté
 * premium/pro) ou `/guest-access/horses` (invité — même benchmark, scopé par
 * l'octroi ; l'invité n'est **pas** gaté par son tier, `read-scope`).
 */
export function createBenchmarkApi(client: ApiClient, basePath = '/horses'): BenchmarkApi {
  return {
    listBenchmarkables: async (chevalId) =>
      benchmarkListeSchema.parse(
        await client.request<unknown>(`${basePath}/${chevalId}/benchmark`, { method: 'GET' }),
      ),
    getSérie: (chevalId, combinaisonRef) =>
      client.request<BenchmarkSérieDto>(`${basePath}/${chevalId}/benchmark/${combinaisonRef}`, {
        method: 'GET',
      }),
  };
}
