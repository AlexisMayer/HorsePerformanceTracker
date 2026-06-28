import type { SéanceCréerDto, SéanceSortie } from '@hpt/shared';
import type { ApiClient } from '../auth/api-client';

/**
 * Surface `sessions` câblée sur l'API du lot 2.2 (`sessions.controller.ts`).
 * Tous les DTO viennent de `@hpt/shared` — aucun type dupliqué (Architecture
 * §1/§2). Les requêtes passent par le client **authentifié** (access token +
 * interceptor 401 de 1.4) ; le serveur scope au compte courant et vérifie la
 * propriété du cheval.
 *
 * Périmètre 2.3 : **création** (saisie rapide) + **lecture** de la dernière
 * séance d'un cheval (pour la duplication, Spec §3.4). On ne consomme **que** ce
 * dont l'UX a besoin — l'édition/suppression est le lot 2.4.
 *
 * Note transport : `SéanceSortie` type ses dates en `Date`, mais le JSON les
 * rend en chaînes ISO. L'aperçu des taux se calcule sur les **nombres du
 * brouillon** (jamais sur la réponse), donc on ne re-valide pas par Zod côté app
 * (l'autorité reste le serveur, frontière `sessions`).
 */
export interface SessionsApi {
  create(chevalId: string, dto: SéanceCréerDto): Promise<SéanceSortie>;
  listForHorse(chevalId: string): Promise<SéanceSortie[]>;
}

export function createSessionsApi(client: ApiClient): SessionsApi {
  return {
    create: (chevalId, dto) =>
      client.request<SéanceSortie>(`/horses/${chevalId}/sessions`, { method: 'POST', body: dto }),
    listForHorse: (chevalId) =>
      client.request<SéanceSortie[]>(`/horses/${chevalId}/sessions`, { method: 'GET' }),
  };
}
