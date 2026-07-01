import type { BilanProgression, BilanProgressionParams } from '@hpt/shared';
import type { ApiClient } from '../auth/api-client';

/**
 * Surface `progression-report` câblée sur l'API du lot 4.4
 * (`progression-report.controller.ts`). Tous les DTO viennent de `@hpt/shared` —
 * aucun type dupliqué (Architecture §1/§2). La requête passe par le client
 * **authentifié** (access token + interceptor 401) ; le serveur **scope au
 * compte**, vérifie la propriété du cheval (404 si étranger) et **garde la
 * capacité** `bilan_progression` (403 au gratuit — autorité serveur 4.1).
 *
 * **Génération = action** (`POST`) portant la **curation** (période + indicateurs
 * + format) et renvoyant les **sections** composées + l'**artefact** (lien/PDF).
 * Note transport : `BilanProgression` type ses dates en `Date`, mais le JSON les
 * rend en chaînes ISO (comme `metrics`) — l'affichage n'en dépend pas (résumé
 * chiffré + lien d'artefact).
 */
export interface ProgressionReportApi {
  generate(chevalId: string, params: BilanProgressionParams): Promise<BilanProgression>;
}

export function createProgressionReportApi(client: ApiClient): ProgressionReportApi {
  return {
    generate: (chevalId, params) =>
      client.request<BilanProgression>(`/horses/${chevalId}/progression-report`, {
        method: 'POST',
        body: params,
      }),
  };
}
