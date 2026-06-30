import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../auth/api-client';
import { createHistoryApi } from './history-api';

/**
 * Test **pur** de la surface `history` (lot 3.4) : `getHistory` appelle le client
 * authentifié sur le bon chemin (endpoint paginé de `sessions`) et compose la
 * query (`before` + `limit`). Le client est un faux (pas de réseau) — la logique
 * HTTP réelle (auth, interceptor 401) est couverte ailleurs (`api-client.test`).
 */
function fakeClient() {
  const request = vi.fn(async () => undefined as unknown);
  const client: ApiClient = {
    request: request as ApiClient['request'],
    refreshSession: async () => true,
  };
  return { client, request };
}

describe('createHistoryApi', () => {
  it('getHistory sans params → GET /horses/:id/sessions/history', async () => {
    const { client, request } = fakeClient();
    await createHistoryApi(client).getHistory('cheval-1');
    expect(request).toHaveBeenCalledWith('/horses/cheval-1/sessions/history', { method: 'GET' });
  });

  it('getHistory compose la query (before + limit)', async () => {
    const { client, request } = fakeClient();
    await createHistoryApi(client).getHistory('cheval-1', {
      before: '2026-03-12T10:00:00.000Z',
      limit: 20,
    });
    expect(request).toHaveBeenCalledWith(
      '/horses/cheval-1/sessions/history?before=2026-03-12T10%3A00%3A00.000Z&limit=20',
      { method: 'GET' },
    );
  });

  it('getHistory n’ajoute que les params fournis (limit seul)', async () => {
    const { client, request } = fakeClient();
    await createHistoryApi(client).getHistory('cheval-1', { limit: 10 });
    expect(request).toHaveBeenCalledWith('/horses/cheval-1/sessions/history?limit=10', {
      method: 'GET',
    });
  });
});
