import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../auth/api-client';
import { createSharingApi } from './sharing-api';

/**
 * Test **pur** de la surface `sharing` (lot 3.3) : `getCard` appelle le client
 * authentifié sur le bon chemin et la bonne méthode HTTP. Le client est un faux
 * (pas de réseau) — la logique HTTP réelle (auth, interceptor 401) est couverte
 * ailleurs (`api-client.test.ts`).
 */
function fakeClient() {
  const request = vi.fn(async () => undefined as unknown);
  const client: ApiClient = { request: request as ApiClient['request'] };
  return { client, request };
}

describe('createSharingApi', () => {
  it('getCard → GET /sessions/:id/card', async () => {
    const { client, request } = fakeClient();
    await createSharingApi(client).getCard('s1');
    expect(request).toHaveBeenCalledWith('/sessions/s1/card', { method: 'GET' });
  });
});
