import type { ChevalSortie } from '@hpt/shared';
import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../auth/api-client';
import { createHorsesApi } from './horses-api';

/**
 * Tests **purs** de la surface `horses` (lot 2.1) : on vérifie que chaque méthode
 * appelle le client authentifié avec le bon chemin, la bonne méthode HTTP et le
 * bon corps. Le client est un faux (pas de réseau) — la logique HTTP réelle
 * (auth, interceptor 401) est couverte par `api-client.test.ts`.
 */

function fakeClient() {
  const request = vi.fn(async () => undefined as unknown);
  const client: ApiClient = { request: request as ApiClient['request'] };
  return { client, request };
}

const SAMPLE: ChevalSortie = {
  id: 'h1',
  created_at: new Date(),
  updated_at: new Date(),
  compte_id: 'c1',
  nom: 'Eclipse',
  niveau: 'amateur',
  hauteur_de_référence: 110,
  âge: 8,
  race: null,
};

describe('createHorsesApi', () => {
  it('list → GET /horses', async () => {
    const { client, request } = fakeClient();
    request.mockResolvedValueOnce([SAMPLE]);
    const result = await createHorsesApi(client).list();
    expect(request).toHaveBeenCalledWith('/horses', { method: 'GET' });
    expect(result).toEqual([SAMPLE]);
  });

  it('get → GET /horses/:id', async () => {
    const { client, request } = fakeClient();
    await createHorsesApi(client).get('h1');
    expect(request).toHaveBeenCalledWith('/horses/h1', { method: 'GET' });
  });

  it('create → POST /horses avec le corps du DTO', async () => {
    const { client, request } = fakeClient();
    const dto = { nom: 'Pampa', niveau: 'pro' as const, hauteur_de_référence: 130 };
    await createHorsesApi(client).create(dto);
    expect(request).toHaveBeenCalledWith('/horses', { method: 'POST', body: dto });
  });

  it('update → PATCH /horses/:id avec le corps du DTO (null efface)', async () => {
    const { client, request } = fakeClient();
    const dto = { nom: 'Renommé', âge: null, race: null };
    await createHorsesApi(client).update('h1', dto);
    expect(request).toHaveBeenCalledWith('/horses/h1', { method: 'PATCH', body: dto });
  });

  it('remove → DELETE /horses/:id', async () => {
    const { client, request } = fakeClient();
    await createHorsesApi(client).remove('h1');
    expect(request).toHaveBeenCalledWith('/horses/h1', { method: 'DELETE' });
  });
});
