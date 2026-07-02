import { fileURLToPath } from 'node:url';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Preuve **de bout en bout** du lot 4.2 — **upgrade in-app & Mollie**. On prouve
 * la DoD :
 *  - un gratuit **souscrit** premium/pro depuis l'app (checkout en **mode test /
 *    fake**), et au **retour** (re-login = re-lecture du claim) **le tier est
 *    déverrouillé** — mais **seulement après le webhook** ;
 *  - **le webhook est l'autorité** : un retour client **sans** webhook confirmé
 *    **n'élève pas** le tier (état `en_attente`/pending) ; le webhook honoré
 *    **l'élève** ; un paiement **en attente** (SEPA) reste pending ; un paiement
 *    **échoué** n'élève pas ;
 *  - **montants paramétrables** : les offres reflètent la **config** (env).
 *
 * On pilote le `FakeMollie` (récupéré via le jeton `MOLLIE`) pour simuler ce que
 * ferait Mollie, puis on poste le **vrai** endpoint webhook : c'est lui qui
 * réconcilie et élève le tier (jamais le retour client).
 *
 * Hors `pnpm test` (exige une base) : tourne via `pnpm db:verify`.
 */

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://hpt:hpt@localhost:5432/hpt';
process.env.DATABASE_URL = DATABASE_URL;
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret';
// Montants **paramétrés** pour la preuve « lus de la config » (et mode fake : pas de clé).
process.env.SUBSCRIPTION_PREMIUM_AMOUNT = '14.00';
process.env.SUBSCRIPTION_PRO_AMOUNT = '28.00';
process.env.SUBSCRIPTION_CURRENCY = 'EUR';
process.env.MOLLIE_BILLING_URL = 'https://my.mollie.com/dashboard';
process.env.MOLLIE_API_KEY = '';

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));
const pool = new Pool({ connectionString: DATABASE_URL });
const PASSWORD = 'motdepasse-solide';

let app: INestApplication;
// Type minimal du FakeMollie (sans importer le module api ici) : levier de simulation
// + journaux d'appels (MOD-001) pour prouver « mandat réutilisé » et « premium résilié ».
let fakeMollie: {
  simulerPaiement: (id: string, statut?: string) => boolean;
  abonnementsCréés: Array<{
    customerId: string;
    mandateId: string | null;
    metadata: { abonnementId: string; tierCible: string };
  }>;
  abonnementsAnnulés: Array<{ customerId: string; subscriptionId: string }>;
};

async function http() {
  return request(app.getHttpServer());
}

interface TestAccount {
  compteId: string;
  email: string;
  accessToken: string;
}

async function registerAndLogin(email: string): Promise<TestAccount> {
  const reg = await (await http())
    .post('/auth/register')
    .send({ email, nom: 'Cavalier', password: PASSWORD, type: 'amateur' })
    .expect(201);
  const access = await loginToken(email);
  return { compteId: reg.body.id as string, email, accessToken: access };
}

async function loginToken(email: string): Promise<string> {
  const login = await (await http())
    .post('/auth/login')
    .send({ email, password: PASSWORD })
    .expect(200);
  return login.body.access_token as string;
}

function bearer(token: string) {
  return { Authorization: `Bearer ${token}` };
}

/** Lance un checkout et renvoie l'abonnement + le paymentId (extrait de l'URL fake). */
async function lancerCheckout(token: string, tier: 'premium' | 'pro') {
  const res = await (await http())
    .post('/me/subscription/checkout')
    .set(bearer(token))
    .send({ tier_cible: tier })
    .expect(200);
  expect(res.body.checkout_url).toContain('/webhooks/mollie/dev/checkout/');
  expect(res.body.abonnement_id).toMatch(/[0-9a-f-]{36}/);
  const paymentId = String(res.body.checkout_url).split('/').pop() as string;
  return { abonnementId: res.body.abonnement_id as string, paymentId };
}

async function entitlement(token: string) {
  const res = await (await http()).get('/me/entitlement').set(bearer(token)).expect(200);
  return res.body as {
    tier: string;
    capacités: Record<string, boolean>;
    quotas: Record<string, number | null>;
  };
}

async function statutAbonnement(token: string) {
  const res = await (await http()).get('/me/subscription').set(bearer(token)).expect(200);
  return res.body as {
    abonnement: { statut: string; tier_cible: string } | null;
    gestion_url: string | null;
  };
}

/** Souscrit un tier (souscription neuve) + webhook honoré ; renvoie un jeton **frais** (claim à jour). */
async function souscrireEtConfirmer(
  account: TestAccount,
  tier: 'premium' | 'pro',
): Promise<string> {
  const { paymentId } = await lancerCheckout(account.accessToken, tier);
  fakeMollie.simulerPaiement(paymentId, 'paid');
  await (await http()).post('/webhooks/mollie').send({ id: paymentId }).expect(200);
  return loginToken(account.email);
}

/** Déclenche le changement de formule premium→pro ; renvoie l'abonnement pro + le paymentId. */
async function lancerChangementFormule(token: string) {
  const res = await (await http())
    .post('/me/subscription/changer-formule')
    .set(bearer(token))
    .expect(200);
  expect(res.body.checkout_url).toContain('/webhooks/mollie/dev/checkout/');
  expect(res.body.abonnement_id).toMatch(/[0-9a-f-]{36}/);
  const paymentId = String(res.body.checkout_url).split('/').pop() as string;
  return { abonnementId: res.body.abonnement_id as string, paymentId };
}

/** Lignes `abonnement` du compte (lecture directe DB) — pour prouver l'état du swap. */
async function abonnementRows(compteId: string) {
  const { rows } = await pool.query(
    `SELECT id, tier_cible, statut, mollie_customer_id, mollie_subscription_id,
            mollie_mandate_id, remplace_abonnement_id
       FROM abonnement WHERE compte_id = $1 ORDER BY created_at ASC`,
    [compteId],
  );
  return rows as Array<{
    id: string;
    tier_cible: string;
    statut: string;
    mollie_customer_id: string | null;
    mollie_subscription_id: string | null;
    mollie_mandate_id: string | null;
    remplace_abonnement_id: string | null;
  }>;
}

beforeAll(async () => {
  await pool.query('DROP SCHEMA IF EXISTS public CASCADE;');
  await pool.query('CREATE SCHEMA public;');
  await pool.query('DROP SCHEMA IF EXISTS drizzle CASCADE;');
  await migrate(drizzle(pool), { migrationsFolder });

  const { AppModule } = await import('../../src/app.module');
  const { MOLLIE } = await import('../../src/entitlements/mollie/mollie.port');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
  fakeMollie = app.get(MOLLIE);
}, 60000);

afterAll(async () => {
  await app?.close();
  await pool.end();
});

describe('GET /me/subscription/offres (montants paramétrables, lus de la config)', () => {
  it('exige l’authentification', async () => {
    await (await http()).get('/me/subscription/offres').expect(401);
  });

  it('reflète les montants configurés (env), jamais des valeurs en dur', async () => {
    const a = await registerAndLogin('sub-offres@hpt.test');
    const res = await (await http())
      .get('/me/subscription/offres')
      .set(bearer(a.accessToken))
      .expect(200);

    const offres = res.body.offres as Array<{ tier: string; montant: string; devise: string }>;
    const premium = offres.find((o) => o.tier === 'premium');
    const pro = offres.find((o) => o.tier === 'pro');
    expect(premium?.montant).toBe('14.00');
    expect(pro?.montant).toBe('28.00');
    expect(premium?.devise).toBe('EUR');
  });
});

describe('Le webhook est l’autorité du tier (Stack §6)', () => {
  it('un retour client SANS webhook confirmé N’ÉLÈVE PAS le tier (pending honnête)', async () => {
    const a = await registerAndLogin('sub-authority@hpt.test');
    expect((await entitlement(a.accessToken)).tier).toBe('gratuit');

    // Souscription lancée → abonnement en_attente, paiement Mollie ouvert (non confirmé).
    await lancerCheckout(a.accessToken, 'pro');

    // « Retour client » : re-lecture de l'état + re-login (claim frais). Le tier
    // ne doit PAS bouger tant que le webhook n'a pas confirmé.
    const statut = await statutAbonnement(a.accessToken);
    expect(statut.abonnement).toEqual({ statut: 'en_attente', tier_cible: 'pro' });

    const apresRelogin = await entitlement(await loginToken(a.email));
    expect(apresRelogin.tier).toBe('gratuit');
    expect(apresRelogin.capacités.multi_chevaux).toBe(false);
  });

  it('le webhook honoré ÉLÈVE le tier (déverrouillage au retour, après re-login)', async () => {
    const a = await registerAndLogin('sub-upgrade-pro@hpt.test');
    const { paymentId } = await lancerCheckout(a.accessToken, 'pro');

    // Mollie marque le paiement payé (mandat établi), PUIS poste le webhook.
    expect(fakeMollie.simulerPaiement(paymentId, 'paid')).toBe(true);
    await (await http()).post('/webhooks/mollie').send({ id: paymentId }).expect(200);

    // L'abonnement est actif ; au retour (re-login = re-lecture du claim), le tier est PRO.
    expect((await statutAbonnement(a.accessToken)).abonnement?.statut).toBe('actif');
    const ent = await entitlement(await loginToken(a.email));
    expect(ent.tier).toBe('pro');
    expect(ent.capacités).toMatchObject({
      analytique_diagnostic: true,
      multi_chevaux: true,
      comptes_invité: true,
    });
    expect(ent.quotas).toEqual({ chevaux: null, combinaisons: null });
  });

  it('premium : analytique/bilans déverrouillés, multi-chevaux toujours pro', async () => {
    const a = await registerAndLogin('sub-upgrade-premium@hpt.test');
    const { paymentId } = await lancerCheckout(a.accessToken, 'premium');

    fakeMollie.simulerPaiement(paymentId, 'paid');
    await (await http()).post('/webhooks/mollie').send({ id: paymentId }).expect(200);

    const ent = await entitlement(await loginToken(a.email));
    expect(ent.tier).toBe('premium');
    expect(ent.capacités.analytique_diagnostic).toBe(true);
    expect(ent.capacités.bilan_augmenté).toBe(true);
    expect(ent.capacités.multi_chevaux).toBe(false);
    expect(ent.quotas).toEqual({ chevaux: 1, combinaisons: null });
  });

  it('paiement EN ATTENTE (SEPA) : reste pending, tier inchangé', async () => {
    const a = await registerAndLogin('sub-pending@hpt.test');
    const { paymentId } = await lancerCheckout(a.accessToken, 'premium');

    // Webhook reçu mais paiement encore « pending » (mandat SEPA non confirmé).
    fakeMollie.simulerPaiement(paymentId, 'pending');
    await (await http()).post('/webhooks/mollie').send({ id: paymentId }).expect(200);

    expect((await statutAbonnement(a.accessToken)).abonnement?.statut).toBe('en_attente');
    expect((await entitlement(await loginToken(a.email))).tier).toBe('gratuit');
  });

  it('paiement ÉCHOUÉ : abonnement échoué, tier inchangé', async () => {
    const a = await registerAndLogin('sub-failed@hpt.test');
    const { paymentId } = await lancerCheckout(a.accessToken, 'pro');

    fakeMollie.simulerPaiement(paymentId, 'failed');
    await (await http()).post('/webhooks/mollie').send({ id: paymentId }).expect(200);

    expect((await statutAbonnement(a.accessToken)).abonnement?.statut).toBe('échoué');
    expect((await entitlement(await loginToken(a.email))).tier).toBe('gratuit');
  });
});

describe('Webhook : robustesse', () => {
  it('est public (pas d’auth) et acquitte un paiement inconnu sans élever quoi que ce soit', async () => {
    await (await http()).post('/webhooks/mollie').send({ id: 'tr_inexistant' }).expect(200);
    await (await http()).post('/webhooks/mollie').send({}).expect(200);
  });

  it('est idempotent : re-livrer le webhook ne casse rien et garde le tier', async () => {
    const a = await registerAndLogin('sub-idempotent@hpt.test');
    const { paymentId } = await lancerCheckout(a.accessToken, 'premium');
    fakeMollie.simulerPaiement(paymentId, 'paid');

    await (await http()).post('/webhooks/mollie').send({ id: paymentId }).expect(200);
    await (await http()).post('/webhooks/mollie').send({ id: paymentId }).expect(200); // re-livraison

    expect((await statutAbonnement(a.accessToken)).abonnement?.statut).toBe('actif');
    expect((await entitlement(await loginToken(a.email))).tier).toBe('premium');
  });
});

describe('GET /me/subscription & résiliation', () => {
  it('renvoie l’URL de gestion Mollie (renvoi résiliation, Spec §9.3)', async () => {
    const a = await registerAndLogin('sub-gestion@hpt.test');
    expect((await statutAbonnement(a.accessToken)).gestion_url).toBe(
      'https://my.mollie.com/dashboard',
    );
  });

  it('résilier un abonnement actif le passe en « annulé »', async () => {
    const a = await registerAndLogin('sub-cancel@hpt.test');
    const { paymentId } = await lancerCheckout(a.accessToken, 'pro');
    fakeMollie.simulerPaiement(paymentId, 'paid');
    await (await http()).post('/webhooks/mollie').send({ id: paymentId }).expect(200);

    const res = await (await http())
      .post('/me/subscription/annuler')
      .set(bearer(a.accessToken))
      .expect(200);
    expect(res.body.abonnement.statut).toBe('annulé');
  });
});

describe('Page de simulation dev (webhooks simulables localement, mode fake)', () => {
  it('GET …/dev/checkout/:id simule le paiement, réconcilie et redirige', async () => {
    const a = await registerAndLogin('sub-devpage@hpt.test');
    const { paymentId } = await lancerCheckout(a.accessToken, 'pro');

    // Ouvrir l'URL de checkout fake = simuler le paiement + réconcilier (comme le webhook).
    const res = await (await http()).get(`/webhooks/mollie/dev/checkout/${paymentId}`).expect(302);
    expect(res.headers.location).toBe('hpt://upgrade-return');

    expect((await entitlement(await loginToken(a.email))).tier).toBe('pro');
  });
});

/**
 * Preuve **de bout en bout** du **changement de formule premium→pro** (MOD-001).
 * On prouve la DoD : un premium **change de formule** (résiliation premium +
 * création pro, **mandat réutilisé**), **pas** de second abonnement en doublon ;
 * le **webhook fait foi** (avant lui, tier premium/pending ; après, pro) ; **un
 * seul abonnement actif** à l'issue ; **accès premium conservé** pendant la
 * fenêtre pending ; la **garde** refuse un non-premium ; la souscription neuve
 * refuse un déjà-abonné (anti double-facturation).
 */
describe('Changement de formule premium→pro (MOD-001)', () => {
  it('premium → pro : mandat réutilisé, premium résilié, un seul actif, webhook fait foi', async () => {
    const a = await registerAndLogin('cf-upgrade@hpt.test');
    const premiumToken = await souscrireEtConfirmer(a, 'premium');
    expect((await entitlement(premiumToken)).tier).toBe('premium');

    const [premiumAvant] = await abonnementRows(a.compteId);
    expect(premiumAvant.statut).toBe('actif');
    expect(premiumAvant.mollie_mandate_id).toBeTruthy();
    expect(premiumAvant.mollie_subscription_id).toBeTruthy();

    // Déclenche le changement de formule (paiement pro sur le mandat existant).
    const { paymentId, abonnementId: proId } = await lancerChangementFormule(premiumToken);

    // AVANT webhook pro : tier RESTE premium (accès conservé) ; état pending honnête.
    expect((await entitlement(await loginToken(a.email))).tier).toBe('premium');
    expect((await statutAbonnement(premiumToken)).abonnement).toEqual({
      statut: 'en_attente',
      tier_cible: 'pro',
    });
    // Le premium n'est PAS encore résilié tant que le pro n'est pas confirmé.
    const proAvant = (await abonnementRows(a.compteId)).find((r) => r.id === proId);
    expect(proAvant?.remplace_abonnement_id).toBe(premiumAvant.id);
    expect((await abonnementRows(a.compteId)).find((r) => r.id === premiumAvant.id)?.statut).toBe(
      'actif',
    );

    // Webhook pro confirmé → autorité du tier.
    fakeMollie.simulerPaiement(paymentId, 'paid');
    await (await http()).post('/webhooks/mollie').send({ id: paymentId }).expect(200);

    // APRÈS webhook : tier PRO (au re-login = claim frais).
    const proEnt = await entitlement(await loginToken(a.email));
    expect(proEnt.tier).toBe('pro');
    expect(proEnt.capacités).toMatchObject({ multi_chevaux: true, comptes_invité: true });

    // Un seul abonnement actif : premium annulé, pro actif.
    const rows = await abonnementRows(a.compteId);
    const premiumFinal = rows.find((r) => r.tier_cible === 'premium');
    const proFinal = rows.find((r) => r.tier_cible === 'pro');
    expect(premiumFinal?.statut).toBe('annulé');
    expect(proFinal?.statut).toBe('actif');
    expect(rows.filter((r) => r.statut === 'actif')).toHaveLength(1);

    // Mandat & client RÉUTILISÉS (pas un second mandat créé).
    expect(proFinal?.mollie_mandate_id).toBe(premiumAvant.mollie_mandate_id);
    expect(proFinal?.mollie_customer_id).toBe(premiumAvant.mollie_customer_id);

    // Côté Mollie : abonnement pro créé sur le mandat réutilisé ; premium résilié.
    const proSub = fakeMollie.abonnementsCréés.find((s) => s.metadata.abonnementId === proId);
    expect(proSub?.mandateId).toBe(premiumAvant.mollie_mandate_id);
    expect(proSub?.customerId).toBe(premiumAvant.mollie_customer_id);
    expect(fakeMollie.abonnementsAnnulés).toContainEqual({
      customerId: premiumAvant.mollie_customer_id,
      subscriptionId: premiumAvant.mollie_subscription_id,
    });
  });

  it('paiement pro EN ATTENTE (SEPA) : reste pending, accès premium conservé (jamais gratuit)', async () => {
    const a = await registerAndLogin('cf-pending@hpt.test');
    const premiumToken = await souscrireEtConfirmer(a, 'premium');
    const { paymentId } = await lancerChangementFormule(premiumToken);

    // Webhook reçu mais paiement pro encore « pending ».
    fakeMollie.simulerPaiement(paymentId, 'pending');
    await (await http()).post('/webhooks/mollie').send({ id: paymentId }).expect(200);

    // Toujours pending, et l'entitlement effectif reste PREMIUM (jamais gratuit/verrouillé).
    expect((await statutAbonnement(premiumToken)).abonnement?.statut).toBe('en_attente');
    const ent = await entitlement(await loginToken(a.email));
    expect(ent.tier).toBe('premium');
    expect(ent.capacités.analytique_diagnostic).toBe(true);
    // Le premium n'est pas résilié tant que le pro n'a pas basculé.
    const rows = await abonnementRows(a.compteId);
    expect(rows.find((r) => r.tier_cible === 'premium')?.statut).toBe('actif');
  });

  it('la garde refuse le changement de formule à un GRATUIT (403) — il doit souscrire', async () => {
    const a = await registerAndLogin('cf-gratuit@hpt.test');
    await (await http())
      .post('/me/subscription/changer-formule')
      .set(bearer(a.accessToken))
      .expect(403);
    expect(await abonnementRows(a.compteId)).toHaveLength(0);
  });

  it('la garde refuse le changement de formule à un PRO (403) — downgrade hors périmètre', async () => {
    const a = await registerAndLogin('cf-deja-pro@hpt.test');
    const proToken = await souscrireEtConfirmer(a, 'pro');
    expect((await entitlement(proToken)).tier).toBe('pro');
    await (await http()).post('/me/subscription/changer-formule').set(bearer(proToken)).expect(403);
  });

  it('un premium ne peut PAS créer une souscription NEUVE (409) — anti double-facturation', async () => {
    const a = await registerAndLogin('cf-nodup@hpt.test');
    const premiumToken = await souscrireEtConfirmer(a, 'premium');

    // Chemin de souscription neuve « pro » = celui qui doublerait l'abonnement → refusé.
    await (await http())
      .post('/me/subscription/checkout')
      .set(bearer(premiumToken))
      .send({ tier_cible: 'pro' })
      .expect(409);

    // Toujours un seul abonnement (le premium) : aucun doublon créé.
    expect(await abonnementRows(a.compteId)).toHaveLength(1);
  });

  it('croisement : résiliation premium programmée PUIS upgrade → cohérent (premium annulé, pro actif)', async () => {
    const a = await registerAndLogin('cf-cross@hpt.test');
    const premiumToken = await souscrireEtConfirmer(a, 'premium');

    // Résiliation premium programmée (renvoi/annulation in-app de 4.2).
    await (await http()).post('/me/subscription/annuler').set(bearer(premiumToken)).expect(200);
    expect((await abonnementRows(a.compteId))[0].statut).toBe('annulé');
    const annulésAvant = fakeMollie.abonnementsAnnulés.length;

    // Le compte est encore premium (tier non redescendu) → upgrade possible et cohérent.
    expect((await entitlement(await loginToken(a.email))).tier).toBe('premium');
    const { paymentId } = await lancerChangementFormule(await loginToken(a.email));
    fakeMollie.simulerPaiement(paymentId, 'paid');
    await (await http()).post('/webhooks/mollie').send({ id: paymentId }).expect(200);

    // Cohérent : pro actif, premium reste annulé (pas de double résiliation Mollie), tier pro.
    expect((await entitlement(await loginToken(a.email))).tier).toBe('pro');
    const rows = await abonnementRows(a.compteId);
    expect(rows.find((r) => r.tier_cible === 'premium')?.statut).toBe('annulé');
    expect(rows.find((r) => r.tier_cible === 'pro')?.statut).toBe('actif');
    expect(rows.filter((r) => r.statut === 'actif')).toHaveLength(1);
    // Premium déjà résilié → aucune nouvelle annulation Mollie émise au webhook.
    expect(fakeMollie.abonnementsAnnulés.length).toBe(annulésAvant);
  });

  it('le changement de formule est authentifié (401 sans jeton)', async () => {
    await (await http()).post('/me/subscription/changer-formule').expect(401);
  });
});
