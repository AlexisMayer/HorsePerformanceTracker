import type { ChevalCréerDto, ChevalModifierDto, ChevalSortie } from '@hpt/shared';
import type { ApiClient } from '../auth/api-client';

/**
 * Surface `horses` câblée sur l'API du lot 2.1 (`horses.controller.ts`). Tous
 * les DTO viennent de `@hpt/shared` — aucun type dupliqué (Architecture §1/§2).
 * Toutes les requêtes passent par le client **authentifié** (access token +
 * interceptor 401 de 1.4) ; le serveur scope au compte courant.
 *
 * Note sur les dates : `ChevalSortie` type ses `created_at`/`updated_at` en
 * `Date`, mais le transport JSON les rend en chaînes ISO. Les écrans de ce lot
 * n'affichent que des champs scalaires (`nom`, `niveau`, `hauteur_de_référence`,
 * `âge`, `race`) ; on ne re-valide donc pas par Zod côté app (qui attend des
 * `Date`) — la validation autoritaire est au serveur (frontière `horses`).
 */
export interface HorsesApi {
  list(): Promise<ChevalSortie[]>;
  get(id: string): Promise<ChevalSortie>;
  create(dto: ChevalCréerDto): Promise<ChevalSortie>;
  update(id: string, dto: ChevalModifierDto): Promise<ChevalSortie>;
  remove(id: string): Promise<void>;
  /** Archive un cheval (lot 4.3) — lecture seule, hors quota, réversible. */
  archive(id: string): Promise<ChevalSortie>;
  /** Désarchive un cheval (lot 4.3) — quota-gardé côté serveur (403 si plafond atteint). */
  unarchive(id: string): Promise<ChevalSortie>;
}

export function createHorsesApi(client: ApiClient): HorsesApi {
  return {
    list: () => client.request<ChevalSortie[]>('/horses', { method: 'GET' }),
    get: (id) => client.request<ChevalSortie>(`/horses/${id}`, { method: 'GET' }),
    create: (dto) => client.request<ChevalSortie>('/horses', { method: 'POST', body: dto }),
    update: (id, dto) =>
      client.request<ChevalSortie>(`/horses/${id}`, { method: 'PATCH', body: dto }),
    remove: (id) => client.request<void>(`/horses/${id}`, { method: 'DELETE' }),
    archive: (id) => client.request<ChevalSortie>(`/horses/${id}/archive`, { method: 'POST' }),
    unarchive: (id) => client.request<ChevalSortie>(`/horses/${id}/unarchive`, { method: 'POST' }),
  };
}
