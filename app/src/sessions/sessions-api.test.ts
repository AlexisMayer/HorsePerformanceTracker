import type { SéanceCréerDto } from '@hpt/shared';
import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../auth/api-client';
import { createSessionsApi } from './sessions-api';

/**
 * Tests **purs** de la surface `sessions` (lot 2.3) : chaque méthode appelle le
 * client authentifié avec le bon chemin, la bonne méthode HTTP et le bon corps.
 * Le client est un faux (pas de réseau) — la logique HTTP réelle (auth,
 * interceptor 401, réessai) est couverte ailleurs (`api-client.test.ts`,
 * `submit.test.ts`).
 */
function fakeClient() {
  const request = vi.fn(async () => undefined as unknown);
  const client: ApiClient = { request: request as ApiClient['request'] };
  return { client, request };
}

const DTO: SéanceCréerDto = {
  type: 'Parcours',
  idempotency_key: '11111111-1111-4111-8111-111111111111',
  provenance: 'live',
  obstacles: [{ type: 'Oxer', hauteur: 110, répétitions: 4, barres: 0, refus: 0 }],
};

describe('createSessionsApi', () => {
  it('create → POST /horses/:id/sessions avec le corps du DTO', async () => {
    const { client, request } = fakeClient();
    await createSessionsApi(client).create('h1', DTO);
    expect(request).toHaveBeenCalledWith('/horses/h1/sessions', { method: 'POST', body: DTO });
  });

  it('listForHorse → GET /horses/:id/sessions', async () => {
    const { client, request } = fakeClient();
    request.mockResolvedValueOnce([]);
    await createSessionsApi(client).listForHorse('h1');
    expect(request).toHaveBeenCalledWith('/horses/h1/sessions', { method: 'GET' });
  });
});
