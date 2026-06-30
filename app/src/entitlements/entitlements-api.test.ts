import type { EntitlementSortie } from '@hpt/shared';
import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../auth/api-client';
import { createEntitlementsApi } from './entitlements-api';

/**
 * Tests **purs** de la surface `entitlements` (lot 4.1) : on vérifie le bon
 * chemin/verbe HTTP **et** la re-validation Zod de la réponse au bord de l'app
 * (le DTO n'a que des scalaires/booléens). Le client est un faux (pas de réseau).
 */

function fakeClient() {
  const request = vi.fn(async () => undefined as unknown);
  const client: ApiClient = { request: request as ApiClient['request'] };
  return { client, request };
}

const ENTITLEMENT_PRO: EntitlementSortie = {
  tier: 'pro',
  capacités: {
    analytique_diagnostic: true,
    bilan_augmenté: true,
    bilan_progression: true,
    multi_chevaux: true,
    comptes_invité: true,
  },
  quotas: { chevaux: null, combinaisons: null },
};

describe('createEntitlementsApi', () => {
  it('get → GET /me/entitlement et renvoie l’entitlement validé', async () => {
    const { client, request } = fakeClient();
    request.mockResolvedValueOnce(ENTITLEMENT_PRO);
    const result = await createEntitlementsApi(client).get();
    expect(request).toHaveBeenCalledWith('/me/entitlement', { method: 'GET' });
    expect(result).toEqual(ENTITLEMENT_PRO);
  });

  it('rejette une réponse non conforme au schéma partagé', async () => {
    const { client, request } = fakeClient();
    // `quotas.chevaux` doit être un nombre ou null — une chaîne est rejetée.
    request.mockResolvedValueOnce({ ...ENTITLEMENT_PRO, quotas: { chevaux: 'beaucoup' } });
    await expect(createEntitlementsApi(client).get()).rejects.toThrow();
  });
});
