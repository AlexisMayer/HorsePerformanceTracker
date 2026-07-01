import type { BilanAugmentéSortie, BilansAugmentésDisponibles } from '@hpt/shared';
import type { ApiClient } from '../auth/api-client';

/**
 * Surface `ai-bilan` câblée sur l'API du lot 4.5 (`ai-bilan.controller.ts`). Tous
 * les DTO viennent de `@hpt/shared` — aucun type dupliqué (Architecture §1/§2).
 * La requête passe par le client **authentifié** (access token + interceptor 401
 * de 1.4) ; le serveur **scope au compte**, vérifie la propriété (404 sans fuite)
 * et **garde la capacité** `bilan_augmenté` (403 au gratuit — autorité serveur
 * 4.1). L'invité (4.6) n'y a pas accès.
 *
 * Trois actions :
 *  - `générer` (**POST**) — génération **à la demande** (get-or-create côté
 *    serveur : relit sans régénérer si déjà présent) ;
 *  - `relire` (**GET**) — relecture du bilan persisté, **sans appel IA** (404 si
 *    aucun) ;
 *  - `disponibles` (**GET**) — séances d'un cheval qui ont un bilan (**slot ✦**).
 *
 * Note transport : `date_génération` est typée `Date` mais rendue en chaîne ISO
 * par le JSON (comme `metrics`/`progression-report`) — l'affichage la formate de
 * façon tolérante.
 */
export interface AiBilanApi {
  générer(seanceId: string): Promise<BilanAugmentéSortie>;
  relire(seanceId: string): Promise<BilanAugmentéSortie>;
  disponibles(chevalId: string): Promise<BilansAugmentésDisponibles>;
}

export function createAiBilanApi(client: ApiClient): AiBilanApi {
  return {
    générer: (seanceId) =>
      client.request<BilanAugmentéSortie>(`/sessions/${seanceId}/ai-bilan`, { method: 'POST' }),
    relire: (seanceId) =>
      client.request<BilanAugmentéSortie>(`/sessions/${seanceId}/ai-bilan`, { method: 'GET' }),
    disponibles: (chevalId) =>
      client.request<BilansAugmentésDisponibles>(`/horses/${chevalId}/ai-bilan`, { method: 'GET' }),
  };
}
