import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../auth/api-client';
import { createGuestAccessApi } from './guest-access-api';

/**
 * Tests **purs** de la surface `guest-access` (lot 4.6) : chaque méthode appelle
 * le client authentifié avec le bon chemin, la bonne méthode HTTP et le bon corps.
 * Le client est un faux (pas de réseau) — la logique HTTP réelle est couverte par
 * `api-client.test.ts`.
 */

function fakeClient() {
  const request = vi.fn(async () => undefined as unknown);
  const client: ApiClient = {
    request: request as ApiClient['request'],
    refreshSession: async () => true,
  };
  return { client, request };
}

describe('createGuestAccessApi', () => {
  it('inviter → POST /horses/:id/guest-access avec { email }', async () => {
    const { client, request } = fakeClient();
    await createGuestAccessApi(client).inviter('h1', 'client@hpt.test');
    expect(request).toHaveBeenCalledWith('/horses/h1/guest-access', {
      method: 'POST',
      body: { email: 'client@hpt.test' },
    });
  });

  it('lister → GET /horses/:id/guest-access', async () => {
    const { client, request } = fakeClient();
    request.mockResolvedValueOnce([]);
    await createGuestAccessApi(client).lister('h1');
    expect(request).toHaveBeenCalledWith('/horses/h1/guest-access', { method: 'GET' });
  });

  it('révoquer → DELETE /guest-access/:id', async () => {
    const { client, request } = fakeClient();
    await createGuestAccessApi(client).révoquer('g1');
    expect(request).toHaveBeenCalledWith('/guest-access/g1', { method: 'DELETE' });
  });

  it('accepter → POST /guest-access/accept avec { token }', async () => {
    const { client, request } = fakeClient();
    request.mockResolvedValueOnce({ cheval_id: 'h1', cheval_nom: 'Quibelle' });
    const res = await createGuestAccessApi(client).accepter('jeton-xyz');
    expect(request).toHaveBeenCalledWith('/guest-access/accept', {
      method: 'POST',
      body: { token: 'jeton-xyz' },
    });
    expect(res).toEqual({ cheval_id: 'h1', cheval_nom: 'Quibelle' });
  });

  it('mesAccès → GET /guest-access/me', async () => {
    const { client, request } = fakeClient();
    request.mockResolvedValueOnce([]);
    await createGuestAccessApi(client).mesAccès();
    expect(request).toHaveBeenCalledWith('/guest-access/me', { method: 'GET' });
  });
});
