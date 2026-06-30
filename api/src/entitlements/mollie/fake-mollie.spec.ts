import { describe, expect, it } from 'vitest';
import { FakeMollie } from './fake-mollie';
import type { CreerCheckoutParams } from './mollie.port';

/**
 * Adaptateur fake Mollie (lot 4.2) — déterministe, **sans autorité** : il
 * reflète l'état d'un paiement comme l'API réelle, mais n'élève jamais le tier
 * (c'est le webhook, réconcilié par le service, qui le fait). On prouve ici la
 * mécanique de simulation que le test e2e du webhook utilise.
 */
function params(over: Partial<CreerCheckoutParams> = {}): CreerCheckoutParams {
  return {
    email: 'rider@hpt.test',
    montant: { value: '9.99', currency: 'EUR' },
    description: 'HPT Premium',
    redirectUrl: 'hpt://upgrade-return',
    webhookUrl: 'http://localhost:3000/webhooks/mollie',
    metadata: { abonnementId: 'ab-1', compteId: 'co-1', tierCible: 'premium' },
    ...over,
  };
}

describe('FakeMollie', () => {
  it('créerCheckout enregistre un paiement « open » + une URL de checkout cliquable', async () => {
    const mollie = new FakeMollie();
    const checkout = await mollie.créerCheckout(params());

    expect(checkout.paymentId).toMatch(/^tr_fake_/);
    expect(checkout.customerId).toMatch(/^cst_fake_/);
    expect(checkout.checkoutUrl).toContain(`/webhooks/mollie/dev/checkout/${checkout.paymentId}`);

    const paiement = await mollie.lirePaiement(checkout.paymentId);
    expect(paiement.statut).toBe('open');
    expect(paiement.mandateId).toBeNull();
    expect(paiement.metadata).toEqual({
      abonnementId: 'ab-1',
      compteId: 'co-1',
      tierCible: 'premium',
    });
  });

  it('simulerPaiement(paid) honore le paiement et pose un mandat', async () => {
    const mollie = new FakeMollie();
    const { paymentId } = await mollie.créerCheckout(params());

    expect(mollie.simulerPaiement(paymentId, 'paid')).toBe(true);
    const paiement = await mollie.lirePaiement(paymentId);
    expect(paiement.statut).toBe('paid');
    expect(paiement.mandateId).toMatch(/^mdt_fake_/);
  });

  it('simulerPaiement(failed) ne pose aucun mandat', async () => {
    const mollie = new FakeMollie();
    const { paymentId } = await mollie.créerCheckout(params());

    mollie.simulerPaiement(paymentId, 'failed');
    const paiement = await mollie.lirePaiement(paymentId);
    expect(paiement.statut).toBe('failed');
    expect(paiement.mandateId).toBeNull();
  });

  it('un paiement inconnu est « expired » (jamais une élévation)', async () => {
    const mollie = new FakeMollie();
    expect(mollie.simulerPaiement('tr_inconnu')).toBe(false);
    const paiement = await mollie.lirePaiement('tr_inconnu');
    expect(paiement.statut).toBe('expired');
    expect(paiement.mandateId).toBeNull();
  });
});
