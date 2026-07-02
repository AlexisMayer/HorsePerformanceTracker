import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../auth/api-client';
import { createSubscriptionApi } from './subscription-api';

/**
 * Test **pur** de la surface `subscription` (lot 4.2) : chaque méthode appelle le
 * client authentifié sur le bon chemin/méthode et **re-valide** la réponse par
 * les schémas `shared`. Le client est un faux (pas de réseau).
 */
function fakeClient(response: unknown) {
  const request = vi.fn(async () => response);
  const client: ApiClient = {
    request: request as ApiClient['request'],
    refreshSession: async () => true,
  };
  return { client, request };
}

describe('createSubscriptionApi', () => {
  it('getOffres → GET /me/subscription/offres (et valide les offres)', async () => {
    const { client, request } = fakeClient({
      offres: [{ tier: 'premium', montant: '9.99', devise: 'EUR', intervalle: '1 month' }],
    });
    const res = await createSubscriptionApi(client).getOffres();
    expect(request).toHaveBeenCalledWith('/me/subscription/offres', { method: 'GET' });
    expect(res.offres[0].montant).toBe('9.99');
  });

  it('createCheckout → POST /me/subscription/checkout avec le tier cible', async () => {
    const { client, request } = fakeClient({
      checkout_url: 'https://www.mollie.com/checkout/test/abc',
      abonnement_id: '11111111-1111-1111-1111-111111111111',
    });
    const res = await createSubscriptionApi(client).createCheckout('pro');
    expect(request).toHaveBeenCalledWith('/me/subscription/checkout', {
      method: 'POST',
      body: { tier_cible: 'pro' },
    });
    expect(res.checkout_url).toContain('mollie');
  });

  it('changerFormule → POST /me/subscription/changer-formule (upgrade premium→pro)', async () => {
    const { client, request } = fakeClient({
      checkout_url: 'https://www.mollie.com/checkout/test/def',
      abonnement_id: '22222222-2222-2222-2222-222222222222',
    });
    const res = await createSubscriptionApi(client).changerFormule();
    expect(request).toHaveBeenCalledWith('/me/subscription/changer-formule', { method: 'POST' });
    expect(res.checkout_url).toContain('mollie');
    expect(res.abonnement_id).toBe('22222222-2222-2222-2222-222222222222');
  });

  it('getStatut → GET /me/subscription (statut + gestion)', async () => {
    const { client, request } = fakeClient({
      abonnement: { statut: 'en_attente', tier_cible: 'premium' },
      gestion_url: null,
    });
    const res = await createSubscriptionApi(client).getStatut();
    expect(request).toHaveBeenCalledWith('/me/subscription', { method: 'GET' });
    expect(res.abonnement?.statut).toBe('en_attente');
  });

  it('annuler → POST /me/subscription/annuler', async () => {
    const { client, request } = fakeClient({ abonnement: null, gestion_url: null });
    await createSubscriptionApi(client).annuler();
    expect(request).toHaveBeenCalledWith('/me/subscription/annuler', { method: 'POST' });
  });

  it('rejette une réponse non conforme au schéma (re-validation au bord)', async () => {
    const { client } = fakeClient({ offres: [{ tier: 'gratuit', montant: 9.99 }] });
    await expect(createSubscriptionApi(client).getOffres()).rejects.toThrow();
  });
});
