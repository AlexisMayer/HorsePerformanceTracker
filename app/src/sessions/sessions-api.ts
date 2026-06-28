import type { SéanceCréerDto, SéanceModifierDto, SéanceSortie } from '@hpt/shared';
import type { ApiClient } from '../auth/api-client';

/**
 * Surface `sessions` câblée sur l'API du lot 2.2 (`sessions.controller.ts`).
 * Tous les DTO viennent de `@hpt/shared` — aucun type dupliqué (Architecture
 * §1/§2). Les requêtes passent par le client **authentifié** (access token +
 * interceptor 401 de 1.4) ; le serveur scope au compte courant et vérifie la
 * propriété du cheval.
 *
 * Périmètre : **création** + **lecture** (saisie rapide & duplication, lot 2.3),
 * puis **édition** / **suppression** d'une séance (lot 2.4, Spec §3.7). La
 * `date`/`provenance` ne sont pas éditables ; le serveur pose `date_modification`
 * à l'édition et purge en cascade à la suppression.
 *
 * Note transport : `SéanceSortie` type ses dates en `Date`, mais le JSON les
 * rend en chaînes ISO. L'aperçu des taux se calcule sur les **nombres du
 * brouillon** (jamais sur la réponse), donc on ne re-valide pas par Zod côté app
 * (l'autorité reste le serveur, frontière `sessions`).
 */
export interface SessionsApi {
  create(chevalId: string, dto: SéanceCréerDto): Promise<SéanceSortie>;
  listForHorse(chevalId: string): Promise<SéanceSortie[]>;
  get(seanceId: string): Promise<SéanceSortie>;
  update(seanceId: string, dto: SéanceModifierDto): Promise<SéanceSortie>;
  remove(seanceId: string): Promise<void>;
}

export function createSessionsApi(client: ApiClient): SessionsApi {
  return {
    create: (chevalId, dto) =>
      client.request<SéanceSortie>(`/horses/${chevalId}/sessions`, { method: 'POST', body: dto }),
    listForHorse: (chevalId) =>
      client.request<SéanceSortie[]>(`/horses/${chevalId}/sessions`, { method: 'GET' }),
    get: (seanceId) => client.request<SéanceSortie>(`/sessions/${seanceId}`, { method: 'GET' }),
    update: (seanceId, dto) =>
      client.request<SéanceSortie>(`/sessions/${seanceId}`, { method: 'PATCH', body: dto }),
    remove: (seanceId) => client.request<void>(`/sessions/${seanceId}`, { method: 'DELETE' }),
  };
}
