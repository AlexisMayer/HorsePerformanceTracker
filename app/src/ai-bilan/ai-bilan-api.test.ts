import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../auth/api-client';
import { createAiBilanApi } from './ai-bilan-api';

/**
 * Test **pur** de la surface `ai-bilan` (lot 4.5) : chaque action appelle le
 * client authentifié sur le bon chemin et la bonne méthode. Le client est un faux
 * (pas de réseau) — la logique HTTP réelle (auth, interceptor 401) est couverte
 * ailleurs (`api-client.test`). Prouve notamment que `générer` est un **POST**
 * (action, §7.1) et `relire`/`disponibles` des **GET** (lecture, §7.3).
 */
function fakeClient() {
  const request = vi.fn(async () => undefined as unknown);
  const client: ApiClient = {
    request: request as ApiClient['request'],
    refreshSession: async () => true,
  };
  return { client, request };
}

describe('createAiBilanApi', () => {
  it('générer → POST /sessions/:id/ai-bilan (action à la demande)', async () => {
    const { client, request } = fakeClient();
    await createAiBilanApi(client).générer('seance-1');
    expect(request).toHaveBeenCalledWith('/sessions/seance-1/ai-bilan', { method: 'POST' });
  });

  it('relire → GET /sessions/:id/ai-bilan (relecture sans régénération)', async () => {
    const { client, request } = fakeClient();
    await createAiBilanApi(client).relire('seance-1');
    expect(request).toHaveBeenCalledWith('/sessions/seance-1/ai-bilan', { method: 'GET' });
  });

  it('disponibles → GET /horses/:id/ai-bilan (slot ✦)', async () => {
    const { client, request } = fakeClient();
    await createAiBilanApi(client).disponibles('cheval-1');
    expect(request).toHaveBeenCalledWith('/horses/cheval-1/ai-bilan', { method: 'GET' });
  });
});
