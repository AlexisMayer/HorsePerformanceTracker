import { describe, expect, it, vi } from 'vitest';
import type { CheckoutNavigateurPort, RésultatNavigateurCheckout } from './checkout-browser-port';
import { lancerUpgrade } from './upgrade-flow';

/**
 * Test **pur** de l'orchestration d'upgrade (lot 4.2) — avec ports faux (api +
 * navigateur), sans réseau ni navigateur réel. On prouve l'**ordre** et surtout
 * que **le retour ne décide pas du tier** : la re-lecture (`rafraîchir`) a
 * **toujours** lieu, succès **comme** fermeture (le déverrouillage est l'autorité
 * serveur, via le webhook).
 */
function fakeApi(checkoutUrl = 'https://www.mollie.com/checkout/test/abc') {
  const createCheckout = vi.fn(async () => ({
    checkout_url: checkoutUrl,
    abonnement_id: '11111111-1111-1111-1111-111111111111',
  }));
  return { createCheckout };
}

function fakeNavigateur(résultat: RésultatNavigateurCheckout): CheckoutNavigateurPort & {
  ouvrir: ReturnType<typeof vi.fn>;
} {
  const ouvrir = vi.fn(async () => résultat);
  return { ouvrir };
}

describe('lancerUpgrade', () => {
  it('crée le checkout, ouvre le navigateur, puis re-lit (rafraîchir) au retour', async () => {
    const api = fakeApi('https://www.mollie.com/checkout/test/xyz');
    const navigateur = fakeNavigateur('terminé');
    const rafraîchir = vi.fn(async () => {});

    const res = await lancerUpgrade(
      { api, navigateur, rafraîchir, retourUrl: 'hpt://upgrade-return' },
      'pro',
    );

    expect(api.createCheckout).toHaveBeenCalledWith('pro');
    expect(navigateur.ouvrir).toHaveBeenCalledWith(
      'https://www.mollie.com/checkout/test/xyz',
      'hpt://upgrade-return',
    );
    expect(rafraîchir).toHaveBeenCalledTimes(1);
    expect(res.retour).toBe('terminé');
  });

  it('re-lit AUSSI quand l’utilisateur ferme le navigateur (retour ≠ décision de tier)', async () => {
    const api = fakeApi();
    const navigateur = fakeNavigateur('fermé');
    const rafraîchir = vi.fn(async () => {});

    const res = await lancerUpgrade(
      { api, navigateur, rafraîchir, retourUrl: 'hpt://upgrade-return' },
      'premium',
    );

    expect(rafraîchir).toHaveBeenCalledTimes(1); // re-lecture même sur fermeture
    expect(res.retour).toBe('fermé');
  });

  it('n’ouvre pas le navigateur si le checkout échoue (et ne re-lit pas)', async () => {
    const createCheckout = vi.fn(async () => {
      throw new Error('réseau');
    });
    const navigateur = fakeNavigateur('terminé');
    const rafraîchir = vi.fn(async () => {});

    await expect(
      lancerUpgrade(
        { api: { createCheckout }, navigateur, rafraîchir, retourUrl: 'hpt://x' },
        'pro',
      ),
    ).rejects.toThrow('réseau');
    expect(navigateur.ouvrir).not.toHaveBeenCalled();
    expect(rafraîchir).not.toHaveBeenCalled();
  });
});
