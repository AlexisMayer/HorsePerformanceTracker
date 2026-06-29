import type { CombinaisonCréerDto, CombinaisonModifierDto, CombinaisonSortie } from '@hpt/shared';
import type { ApiClient } from '../auth/api-client';

/**
 * Surface `combinations` câblée sur l'API du lot 2.5 (`combinations.controller.ts`).
 * Tous les DTO viennent de `@hpt/shared` — aucun type dupliqué (Architecture
 * §1/§2). Les requêtes passent par le client **authentifié** (access token +
 * interceptor 401 de 1.4) ; le serveur scope au **compte courant** (la
 * bibliothèque est au niveau du compte) et trie la liste **par usage**.
 *
 * `update` reflète la sémantique serveur **« modification = nouvelle »** : il ne
 * mute pas la réutilisable ciblée mais renvoie une **nouvelle** combinaison
 * (l'ancienne reste intacte). `create` accepte un détail issu d'une séance ou
 * direct ; `remove` dé-lie les obstacles (`SET NULL`) sans casser leur taux.
 */
export interface CombinationsApi {
  list(): Promise<CombinaisonSortie[]>;
  create(dto: CombinaisonCréerDto): Promise<CombinaisonSortie>;
  /** « Édite » = crée une nouvelle réutilisable (l'ancienne intacte), renvoyée. */
  update(id: string, dto: CombinaisonModifierDto): Promise<CombinaisonSortie>;
  remove(id: string): Promise<void>;
}

export function createCombinationsApi(client: ApiClient): CombinationsApi {
  return {
    list: () => client.request<CombinaisonSortie[]>('/combinations', { method: 'GET' }),
    create: (dto) =>
      client.request<CombinaisonSortie>('/combinations', { method: 'POST', body: dto }),
    update: (id, dto) =>
      client.request<CombinaisonSortie>(`/combinations/${id}`, { method: 'PATCH', body: dto }),
    remove: (id) => client.request<void>(`/combinations/${id}`, { method: 'DELETE' }),
  };
}
