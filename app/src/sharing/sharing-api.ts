import type { CarteBilan } from '@hpt/shared';
import type { ApiClient } from '../auth/api-client';

/**
 * Surface `sharing` câblée sur l'API du lot 3.3 (`sharing.controller.ts`). Le DTO
 * vient de `@hpt/shared` — aucun type dupliqué (Architecture §1/§2). La requête
 * passe par le client **authentifié** (access token + interceptor 401 de 1.4) ; le
 * serveur scope au compte courant et vérifie la propriété de la séance (404 si
 * étrangère).
 *
 * Lecture seule : `sharing` **compose** la carte de bilan d'une séance (récap +
 * record éventuel) — il n'écrit rien et n'est **jamais verrouillé** (carte simple
 * gratuite, §8). Note transport : `CarteBilan` type sa `date` en `Date`, mais le
 * JSON la rend en chaîne ISO — les helpers d'affichage (`card-format`) tolèrent
 * les deux.
 */
export interface SharingApi {
  getCard(seanceId: string): Promise<CarteBilan>;
}

export function createSharingApi(client: ApiClient): SharingApi {
  return {
    getCard: (seanceId) =>
      client.request<CarteBilan>(`/sessions/${seanceId}/card`, { method: 'GET' }),
  };
}
