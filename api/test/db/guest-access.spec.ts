import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MAILER, type Mailer } from '../../src/auth-account/mailer/mailer';

/**
 * Preuve **de bout en bout** de la DoD du lot 4.6 (module `guest-access` : comptes
 * invité — accès client en lecture seule) sur un Postgres réel. On applique les
 * migrations (dont `acces_invite`, additive), on démarre l'app NestJS en
 * **remplaçant le port `Mailer`** par une capture (l'équivalent test du lien
 * « loggé en dev » du `ConsoleMailer`), puis on exerce les flux via HTTP :
 *
 *  - **inviter un client** (Pro) qui **consulte** le cheval partagé en **lecture
 *    seule** : feed (3.1), héros (3.2), historique (3.4), **analytique (5.1)** —
 *    **même en tier gratuit** (portée = octroi, pas le tier de l'invité) ;
 *  - **scoping serveur strict** : l'invité **ne peut pas** lire un **autre** cheval
 *    (404) ni **écrire** quoi que ce soit (404 — aucune surface d'écriture) ;
 *  - **plusieurs invités** par cheval ; **révocable** → l'accès **cesse** (404) ;
 *  - **Pro uniquement** (garde 4.1 `comptes_invité`) : gratuit/premium → 403 ;
 *  - **onboarding invité** : l'invité **sans cheval possédé** atterrit sur le
 *    cheval partagé (`/guest-access/me`), il **saute la création de cheval**.
 *
 * Hors `pnpm test` (exige une base) : tourne via `pnpm db:verify`, comme les
 * preuves des lots antérieurs.
 */

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://hpt:hpt@localhost:5432/hpt';
process.env.DATABASE_URL = DATABASE_URL;
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret';

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));
const pool = new Pool({ connectionString: DATABASE_URL });

/** Liens d'invitation capturés à la place de l'envoi réel (= ce que loggerait le stub). */
const invitations: { to: string; link: string }[] = [];
const captureMailer: Mailer = {
  async sendEmailVerification() {},
  async sendPasswordReset() {},
  async sendGuestInvitation({ to, link }) {
    invitations.push({ to, link });
  },
};

let app: INestApplication;

async function http() {
  return request(app.getHttpServer());
}

interface TestAccount {
  compteId: string;
  accessToken: string;
}

async function registerAndLogin(
  email: string,
  type: 'amateur' | 'coach' = 'amateur',
): Promise<TestAccount> {
  const password = 'motdepasse-solide';
  const reg = await (await http())
    .post('/auth/register')
    .send({ email, nom: 'Client', password, type })
    .expect(201);
  const login = await (await http()).post('/auth/login').send({ email, password }).expect(200);
  return { compteId: reg.body.id as string, accessToken: login.body.access_token as string };
}

/** Inscrit un compte **à un tier donné** puis le connecte (claim `tier` à jour). */
async function registerWithTier(email: string, tier: 'premium' | 'pro'): Promise<TestAccount> {
  const password = 'motdepasse-solide';
  const reg = await (await http())
    .post('/auth/register')
    .send({ email, nom: 'Coach', password, type: 'coach' })
    .expect(201);
  await pool.query('UPDATE compte SET tier = $1 WHERE id = $2', [tier, reg.body.id]);
  const login = await (await http()).post('/auth/login').send({ email, password }).expect(200);
  return { compteId: reg.body.id as string, accessToken: login.body.access_token as string };
}

async function createHorse(a: TestAccount, nom: string): Promise<string> {
  const res = await (await http())
    .post('/horses')
    .set('Authorization', `Bearer ${a.accessToken}`)
    .send({ nom, niveau: 'amateur', hauteur_de_référence: 110 })
    .expect(201);
  return res.body.id as string;
}

// biome-ignore lint/suspicious/noExplicitAny: corps de séance libre dans le test.
async function createSession(a: TestAccount, chevalId: string, body: any): Promise<string> {
  const res = await (await http())
    .post(`/horses/${chevalId}/sessions`)
    .set('Authorization', `Bearer ${a.accessToken}`)
    .send({ idempotency_key: randomUUID(), ...body })
    .expect(201);
  await new Promise((r) => setTimeout(r, 5));
  return res.body.id as string;
}

/** Le coach invite `email` sur `chevalId` ; renvoie l'octroi + le jeton capturé. */
async function invite(
  coach: TestAccount,
  chevalId: string,
  email: string,
  // biome-ignore lint/suspicious/noExplicitAny: réponse d'octroi typée au runtime.
): Promise<{ grant: any; token: string }> {
  const res = await (await http())
    .post(`/horses/${chevalId}/guest-access`)
    .set('Authorization', `Bearer ${coach.accessToken}`)
    .send({ email })
    .expect(201);
  const invitation = [...invitations].reverse().find((m) => m.to === email.toLowerCase());
  if (!invitation) throw new Error(`aucune invitation capturée pour ${email}`);
  const token = new URL(invitation.link).searchParams.get('token');
  if (!token) throw new Error(`lien d'invitation sans jeton : ${invitation.link}`);
  return { grant: res.body, token };
}

/** Le client accepte via le jeton reçu ; renvoie le cheval partagé (atterrissage). */
// biome-ignore lint/suspicious/noExplicitAny: réponse typée au runtime.
async function accept(guest: TestAccount, token: string): Promise<any> {
  const res = await (await http())
    .post('/guest-access/accept')
    .set('Authorization', `Bearer ${guest.accessToken}`)
    .send({ token })
    .expect(200);
  return res.body;
}

/** Requête GET **authentifiée** (renvoie le `Test` supertest, chaînable `.expect`). */
function authGet(a: TestAccount, path: string) {
  return request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${a.accessToken}`);
}

/** Séance d'entraînement `live` : un Oxer propre → feed + jalon + maîtrise + heatmap. */
const OXER_PROPRE = {
  type: 'Gymnastique',
  obstacles: [{ type: 'Oxer', hauteur: 100, répétitions: 2, barres: 0, refus: 0 }],
};

beforeAll(async () => {
  await pool.query('DROP SCHEMA IF EXISTS public CASCADE;');
  await pool.query('CREATE SCHEMA public;');
  await pool.query('DROP SCHEMA IF EXISTS drizzle CASCADE;');
  await migrate(drizzle(pool), { migrationsFolder });

  const { AppModule } = await import('../../src/app.module');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MAILER)
    .useValue(captureMailer)
    .compile();
  app = moduleRef.createNestApplication();
  await app.init();
}, 60000);

afterAll(async () => {
  await app?.close();
  await pool.end();
});

describe('Garde Pro (4.1) — seul un compte pro crée des invitations', () => {
  it('refuse le gratuit et le premium (403), autorise le pro (201)', async () => {
    const gratuit = await registerAndLogin('ga-gratuit@hpt.test');
    const chevalGratuit = await createHorse(gratuit, 'Gratos');
    await (await http())
      .post(`/horses/${chevalGratuit}/guest-access`)
      .set('Authorization', `Bearer ${gratuit.accessToken}`)
      .send({ email: 'client@hpt.test' })
      .expect(403);

    const premium = await registerWithTier('ga-premium@hpt.test', 'premium');
    const chevalPremium = await createHorse(premium, 'Prem');
    await (await http())
      .post(`/horses/${chevalPremium}/guest-access`)
      .set('Authorization', `Bearer ${premium.accessToken}`)
      .send({ email: 'client@hpt.test' })
      .expect(403);

    const pro = await registerWithTier('ga-pro-guard@hpt.test', 'pro');
    const chevalPro = await createHorse(pro, 'Prodige');
    await (await http())
      .post(`/horses/${chevalPro}/guest-access`)
      .set('Authorization', `Bearer ${pro.accessToken}`)
      .send({ email: 'client@hpt.test' })
      .expect(201);
  });
});

describe('Inviter un client qui consulte le cheval en lecture seule (DoD)', () => {
  it('feed + héros + historique + analytique, même en tier gratuit ; onboarding = atterrissage', async () => {
    const coach = await registerWithTier('ga-coach@hpt.test', 'pro');
    const chevalId = await createHorse(coach, 'Quibelle');
    await createSession(coach, chevalId, OXER_PROPRE);
    await createSession(coach, chevalId, { type: 'Plat' });

    const { grant, token } = await invite(coach, chevalId, 'Cliente@HPT.test');
    // Projection de gestion : pas de secret, e-mail normalisé, en attente.
    expect(grant).toMatchObject({ statut: 'en_attente', invité_relié: false });
    expect(grant.invité_email).toBe('cliente@hpt.test');
    expect(grant).not.toHaveProperty('token_hash');
    expect(grant).not.toHaveProperty('compte_pro_id');

    // Le client (compte régulier gratuit) accepte → atterrit sur le cheval partagé.
    const guest = await registerAndLogin('cliente@hpt.test');
    const atterrissage = await accept(guest, token);
    expect(atterrissage).toEqual({ cheval_id: chevalId, cheval_nom: 'Quibelle' });

    // Onboarding invité : l'invité **ne possède aucun cheval**, mais atterrit sur
    // le cheval partagé (il **saute la création de cheval**, Spec §9.5).
    expect((await authGet(guest, '/horses')).body).toEqual([]);
    const me = (await authGet(guest, '/guest-access/me')).body;
    expect(me).toEqual([{ cheval_id: chevalId, cheval_nom: 'Quibelle' }]);

    // Feed (3.1) : la séance apparaît, avec son jalon de record injecté.
    const feed = (await authGet(guest, `/guest-access/horses/${chevalId}/feed`)).body;
    expect(feed.cheval_id).toBe(chevalId);
    expect(feed.entrées.some((e: { kind: string }) => e.kind === 'séance')).toBe(true);
    expect(feed.entrées.some((e: { kind: string }) => e.kind === 'jalon')).toBe(true);

    // Héros (3.2) : hauteur maîtrisée / record reflètent l'historique du coach.
    const metrics = (await authGet(guest, `/guest-access/horses/${chevalId}/metrics`)).body;
    expect(metrics.maîtrise.record).toBe(100);

    // Historique (3.4) : les séances passées (Oxer + Plat).
    const history = (await authGet(guest, `/guest-access/horses/${chevalId}/sessions/history`))
      .body;
    expect(history.cheval_id).toBe(chevalId);
    expect(history.séances.length).toBe(2);

    // Analytique (5.1) : la heatmap — **alors que l'invité est GRATUIT** (portée =
    // octroi, pas le tier ; la garde `analytique_diagnostic` ne s'applique PAS ici).
    const heatmap = (await authGet(guest, `/guest-access/horses/${chevalId}/heatmap`)).body;
    expect(heatmap.cellules).toHaveLength(1);
    expect(heatmap.cellules[0]).toMatchObject({ type: 'Oxer', hauteur: 100, taux: 1 });

    // Le même invité, via les routes **propriétaire**, reste **exclu** : la
    // heatmap y est gatée `analytique_diagnostic` (invité gratuit → **403**, garde
    // 4.1 avant même la propriété) ; le feed (non gaté) échoue sur la **propriété**
    // (**404**). La portée invité passe **uniquement** par l'octroi
    // (`/guest-access/...`) — jamais par le tier de l'invité ni les routes propriétaire.
    await authGet(guest, `/horses/${chevalId}/heatmap`).expect(403);
    await authGet(guest, `/horses/${chevalId}/feed`).expect(404);
  });
});

describe('Scoping serveur strict — ni autre cheval, ni écriture', () => {
  it('l’invité ne lit que le cheval partagé et ne peut rien écrire', async () => {
    const coach = await registerWithTier('ga-scope-coach@hpt.test', 'pro');
    const partagé = await createHorse(coach, 'Partagé');
    const autre = await createHorse(coach, 'Secret'); // même coach, NON partagé
    await createSession(coach, partagé, OXER_PROPRE);

    const stranger = await registerWithTier('ga-stranger@hpt.test', 'pro');
    const chevalStranger = await createHorse(stranger, 'Ailleurs');

    const { token } = await invite(coach, partagé, 'scope@hpt.test');
    const guest = await registerAndLogin('scope@hpt.test');
    await accept(guest, token);

    // Cheval partagé : OK.
    await authGet(guest, `/guest-access/horses/${partagé}/feed`).expect(200);

    // **Autre cheval du même coach** (non partagé) → 404 (aucun octroi).
    await authGet(guest, `/guest-access/horses/${autre}/feed`).expect(404);
    await authGet(guest, `/guest-access/horses/${autre}/metrics`).expect(404);
    await authGet(guest, `/guest-access/horses/${autre}/heatmap`).expect(404);
    await authGet(guest, `/guest-access/horses/${autre}/sessions/history`).expect(404);

    // **Cheval d'un tout autre compte** → 404.
    await authGet(guest, `/guest-access/horses/${chevalStranger}/feed`).expect(404);

    // **Aucune écriture** : viser les routes propriétaire (séance) est refusé —
    // l'invité ne possède pas le cheval → 404 (aucune fuite), rien n'est créé.
    await (await http())
      .post(`/horses/${partagé}/sessions`)
      .set('Authorization', `Bearer ${guest.accessToken}`)
      .send({ idempotency_key: randomUUID(), ...OXER_PROPRE })
      .expect(404);
    await (await http())
      .patch(`/horses/${partagé}`)
      .set('Authorization', `Bearer ${guest.accessToken}`)
      .send({ nom: 'Piraté' })
      .expect(404);
    // Et il ne peut pas **gérer** les invités (garde Pro `comptes_invité`) → 403.
    await (await http())
      .post(`/horses/${partagé}/guest-access`)
      .set('Authorization', `Bearer ${guest.accessToken}`)
      .send({ email: 'sous-invite@hpt.test' })
      .expect(403);

    // L'historique du cheval partagé est resté à 1 séance (aucune écriture n'a pris).
    const history = (await authGet(coach, `/horses/${partagé}/sessions/history`)).body;
    expect(history.séances.length).toBe(1);
  });
});

describe('Plusieurs invités par cheval ; révocable (l’accès cesse)', () => {
  it('deux invités lisent ; révoquer l’un coupe son accès sans toucher l’autre', async () => {
    const coach = await registerWithTier('ga-multi-coach@hpt.test', 'pro');
    const chevalId = await createHorse(coach, 'Duo');
    await createSession(coach, chevalId, OXER_PROPRE);

    // Propriétaire + cavalier (deux invités **différents**, Spec §9.5).
    const inv1 = await invite(coach, chevalId, 'proprietaire@hpt.test');
    const inv2 = await invite(coach, chevalId, 'cavalier@hpt.test');

    const g1 = await registerAndLogin('proprietaire@hpt.test');
    const g2 = await registerAndLogin('cavalier@hpt.test');
    await accept(g1, inv1.token);
    await accept(g2, inv2.token);

    // Le coach voit **deux** accès (actifs) sur son cheval.
    const liste = (await authGet(coach, `/horses/${chevalId}/guest-access`)).body;
    expect(liste).toHaveLength(2);
    expect(liste.every((a: { statut: string }) => a.statut === 'actif')).toBe(true);

    // Les deux consultent.
    await authGet(g1, `/guest-access/horses/${chevalId}/feed`).expect(200);
    await authGet(g2, `/guest-access/horses/${chevalId}/feed`).expect(200);

    // Révoquer l'accès de g1 (par son id).
    const grant1 = liste.find(
      (a: { invité_email: string }) => a.invité_email === 'proprietaire@hpt.test',
    );
    await (await http())
      .delete(`/guest-access/${grant1.id}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(204);

    // g1 : l'accès a **cessé** (feed 404, plus aucun cheval dans `me`).
    await authGet(g1, `/guest-access/horses/${chevalId}/feed`).expect(404);
    await authGet(g1, `/guest-access/horses/${chevalId}/heatmap`).expect(404);
    expect((await authGet(g1, '/guest-access/me')).body).toEqual([]);

    // g2 : **inchangé**, il consulte toujours.
    await authGet(g2, `/guest-access/horses/${chevalId}/feed`).expect(200);
    expect((await authGet(g2, '/guest-access/me')).body).toEqual([
      { cheval_id: chevalId, cheval_nom: 'Duo' },
    ]);
  });
});

describe('Invitations — doublon, ré-invitation après révocation, jeton invalide, non-authentifié', () => {
  it('refuse un doublon non révoqué (409) mais permet de ré-inviter après révocation', async () => {
    const coach = await registerWithTier('ga-dup-coach@hpt.test', 'pro');
    const chevalId = await createHorse(coach, 'Unique');
    const { grant } = await invite(coach, chevalId, 'dup@hpt.test');

    // Même e-mail, même cheval, octroi non révoqué → 409.
    await (await http())
      .post(`/horses/${chevalId}/guest-access`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ email: 'dup@hpt.test' })
      .expect(409);

    // Après révocation, ré-inviter la même adresse est permis (octroi neuf).
    await (await http())
      .delete(`/guest-access/${grant.id}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(204);
    await (await http())
      .post(`/horses/${chevalId}/guest-access`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ email: 'dup@hpt.test' })
      .expect(201);
  });

  it('refuse un jeton invalide (400), un cheval étranger (404) et l’absence de jeton (401)', async () => {
    const coach = await registerWithTier('ga-inv-coach@hpt.test', 'pro');
    const chevalId = await createHorse(coach, 'Chev');
    const stranger = await registerWithTier('ga-inv-stranger@hpt.test', 'pro');
    const guest = await registerAndLogin('ga-inv-guest@hpt.test');

    // Jeton bidon → 400.
    await (await http())
      .post('/guest-access/accept')
      .set('Authorization', `Bearer ${guest.accessToken}`)
      .send({ token: 'jeton-invalide' })
      .expect(400);

    // Inviter sur le cheval d'un **autre** coach → 404 (sans fuite d'existence).
    await (await http())
      .post(`/horses/${chevalId}/guest-access`)
      .set('Authorization', `Bearer ${stranger.accessToken}`)
      .send({ email: 'x@hpt.test' })
      .expect(404);

    // Sans jeton : gestion **et** consultation exigent l'authentification (401).
    await (await http()).get('/guest-access/me').expect(401);
    await (await http()).get(`/guest-access/horses/${chevalId}/feed`).expect(401);
    await (await http())
      .post(`/horses/${chevalId}/guest-access`)
      .send({ email: 'x@hpt.test' })
      .expect(401);
  });
});
