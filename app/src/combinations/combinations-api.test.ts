import type { CombinaisonCréerDto, CombinaisonSortie } from '@hpt/shared';
import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../auth/api-client';
import { createCombinationsApi } from './combinations-api';

/**
 * Tests **purs** de la surface `combinations` (lot 2.5) : chaque méthode appelle
 * le client authentifié avec le bon chemin, la bonne méthode HTTP et le bon
 * corps. Le client est un faux (pas de réseau) — la logique HTTP réelle (auth,
 * interceptor 401) est couverte par `api-client.test.ts`.
 */

function fakeClient() {
  const request = vi.fn(async () => undefined as unknown);
  const client: ApiClient = { request: request as ApiClient['request'] };
  return { client, request };
}

const SAMPLE: CombinaisonSortie = {
  id: 'k1',
  created_at: new Date(),
  updated_at: new Date(),
  compte_id: 'c1',
  nom: 'Triple oxer',
  nombre_d_éléments: 3,
  éléments: ['Oxer', 'Oxer', 'Oxer'],
  usage_count: 2,
};

describe('createCombinationsApi', () => {
  it('list → GET /combinations', async () => {
    const { client, request } = fakeClient();
    request.mockResolvedValueOnce([SAMPLE]);
    const result = await createCombinationsApi(client).list();
    expect(request).toHaveBeenCalledWith('/combinations', { method: 'GET' });
    expect(result).toEqual([SAMPLE]);
  });

  it('create → POST /combinations avec le corps du DTO', async () => {
    const { client, request } = fakeClient();
    const dto: CombinaisonCréerDto = { nombre_d_éléments: 2, éléments: ['Vertical', 'Oxer'] };
    await createCombinationsApi(client).create(dto);
    expect(request).toHaveBeenCalledWith('/combinations', { method: 'POST', body: dto });
  });

  it('update → PATCH /combinations/:id (modification = nouvelle)', async () => {
    const { client, request } = fakeClient();
    const dto = { nom: 'Renommée' };
    await createCombinationsApi(client).update('k1', dto);
    expect(request).toHaveBeenCalledWith('/combinations/k1', { method: 'PATCH', body: dto });
  });

  it('remove → DELETE /combinations/:id', async () => {
    const { client, request } = fakeClient();
    await createCombinationsApi(client).remove('k1');
    expect(request).toHaveBeenCalledWith('/combinations/k1', { method: 'DELETE' });
  });
});
