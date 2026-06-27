import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MAILER, type Mailer } from '../../src/auth-account/mailer/mailer';

/**
 * Preuve **de bout en bout** de la DoD du lot 1.2 (vérification d'e-mail &
 * réinitialisation de mot de passe) sur un Postgres réel. On applique les
 * migrations (dont `verification_token`, additive), on démarre l'app NestJS en
 * **remplaçant le port `Mailer`** par une capture (l'équivalent test des liens
 * « loggés en dev » du `ConsoleMailer`), puis on exerce les flux via HTTP.
 *
 * Hors `pnpm test` (exige une base) : tourne via `pnpm db:verify`, comme les
 * preuves des lots 0.3 et 1.1.
 */

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://hpt:hpt@localhost:5432/hpt';
process.env.DATABASE_URL = DATABASE_URL;
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret';

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));
const pool = new Pool({ connectionString: DATABASE_URL });

/** Liens capturés à la place de l'envoi réel (= ce que loggerait le stub dev). */
interface SentEmail {
  kind: 'verify' | 'reset';
  to: string;
  link: string;
}
const sent: SentEmail[] = [];
const captureMailer: Mailer = {
  async sendEmailVerification({ to, link }) {
    sent.push({ kind: 'verify', to, link });
  },
  async sendPasswordReset({ to, link }) {
    sent.push({ kind: 'reset', to, link });
  },
};

let app: INestApplication;

async function http() {
  return request(app.getHttpServer());
}

function tokenFromLink(link: string): string {
  const token = new URL(link).searchParams.get('token');
  if (!token) throw new Error(`lien sans jeton : ${link}`);
  return token;
}

function lastEmail(to: string, kind: SentEmail['kind']): SentEmail {
  const email = [...sent].reverse().find((e) => e.to === to && e.kind === kind);
  if (!email) throw new Error(`aucun e-mail ${kind} pour ${to}`);
  return email;
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

async function registerAndVerify(email: string, password: string): Promise<void> {
  await (await http())
    .post('/auth/register')
    .send({ email, nom: 'Test', password, type: 'amateur' })
    .expect(201);
  const token = tokenFromLink(lastEmail(email, 'verify').link);
  await (await http()).post('/auth/verify-email/confirm').send({ token }).expect(200);
}

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

beforeEach(() => {
  sent.length = 0;
});

describe('Vérification d’e-mail', () => {
  it('l’inscription émet un lien de vérification ; le confirmer passe email_verified à true', async () => {
    const reg = await (await http())
      .post('/auth/register')
      .send({
        email: 'verif@hpt.test',
        nom: 'Vera',
        password: 'motdepasse-solide',
        type: 'amateur',
      })
      .expect(201);
    expect(reg.body.email_verified).toBe(false);

    // Un lien de vérification a été émis pour le nouvel inscrit.
    const email = lastEmail('verif@hpt.test', 'verify');
    const token = tokenFromLink(email.link);

    const confirmed = await (await http())
      .post('/auth/verify-email/confirm')
      .send({ token })
      .expect(200);
    expect(confirmed.body.email_verified).toBe(true);
    expect(confirmed.body.email).toBe('verif@hpt.test');
    expect(confirmed.body).not.toHaveProperty('password_hash');
  });

  it('un jeton de vérification est à usage unique (réutilisation rejetée)', async () => {
    await (await http())
      .post('/auth/register')
      .send({ email: 'once@hpt.test', nom: 'Once', password: 'motdepasse-solide', type: 'amateur' })
      .expect(201);
    const token = tokenFromLink(lastEmail('once@hpt.test', 'verify').link);

    await (await http()).post('/auth/verify-email/confirm').send({ token }).expect(200);
    // Le même jeton ne peut pas resservir.
    await (await http()).post('/auth/verify-email/confirm').send({ token }).expect(400);
  });

  it('un jeton expiré est rejeté', async () => {
    await (await http())
      .post('/auth/register')
      .send({ email: 'exp@hpt.test', nom: 'Exp', password: 'motdepasse-solide', type: 'amateur' })
      .expect(201);
    const token = tokenFromLink(lastEmail('exp@hpt.test', 'verify').link);

    // On force l'expiration de ce jeton précis (sans attendre 24 h).
    await pool.query(
      "UPDATE verification_token SET expires_at = now() - interval '1 minute' WHERE token_hash = $1",
      [sha256Hex(token)],
    );
    await (await http()).post('/auth/verify-email/confirm').send({ token }).expect(400);
  });

  it('le renvoi (request) ré-émet un lien valide (anti-énumération : 200)', async () => {
    await (await http())
      .post('/auth/register')
      .send({ email: 'resend@hpt.test', nom: 'Re', password: 'motdepasse-solide', type: 'amateur' })
      .expect(201);

    sent.length = 0; // on ignore le lien d'inscription, on teste le renvoi.
    await (await http())
      .post('/auth/verify-email/request')
      .send({ email: 'resend@hpt.test' })
      .expect(200);

    const token = tokenFromLink(lastEmail('resend@hpt.test', 'verify').link);
    const confirmed = await (await http())
      .post('/auth/verify-email/confirm')
      .send({ token })
      .expect(200);
    expect(confirmed.body.email_verified).toBe(true);
  });

  it('le renvoi pour un e-mail inconnu ne fuit rien (200, aucun e-mail)', async () => {
    await (await http())
      .post('/auth/verify-email/request')
      .send({ email: 'fantome@hpt.test' })
      .expect(200);
    expect(sent).toHaveLength(0);
  });
});

describe('Réinitialisation de mot de passe', () => {
  it('demander un reset émet un lien ; le confirmer change le mot de passe (login OK/KO)', async () => {
    await registerAndVerify('reset@hpt.test', 'ancien-motdepasse');
    sent.length = 0;

    await (await http())
      .post('/auth/password-reset/request')
      .send({ email: 'reset@hpt.test' })
      .expect(200);
    const token = tokenFromLink(lastEmail('reset@hpt.test', 'reset').link);

    await (await http())
      .post('/auth/password-reset/confirm')
      .send({ token, new_password: 'nouveau-motdepasse' })
      .expect(204);

    // Login OK avec le nouveau, KO avec l'ancien.
    await (await http())
      .post('/auth/login')
      .send({ email: 'reset@hpt.test', password: 'nouveau-motdepasse' })
      .expect(200);
    await (await http())
      .post('/auth/login')
      .send({ email: 'reset@hpt.test', password: 'ancien-motdepasse' })
      .expect(401);
  });

  it('le reset révoque les refresh tokens : un ancien refresh échoue ensuite', async () => {
    await registerAndVerify('revoke@hpt.test', 'ancien-motdepasse');
    const login = await (await http())
      .post('/auth/login')
      .send({ email: 'revoke@hpt.test', password: 'ancien-motdepasse' })
      .expect(200);
    const oldRefresh = login.body.refresh_token as string;

    // Le refresh marche AVANT le reset (sanity)…
    // (non consommé ici pour ne pas le faire tourner — on le garde pour l'après-reset)
    sent.length = 0;
    await (await http())
      .post('/auth/password-reset/request')
      .send({ email: 'revoke@hpt.test' })
      .expect(200);
    const token = tokenFromLink(lastEmail('revoke@hpt.test', 'reset').link);
    await (await http())
      .post('/auth/password-reset/confirm')
      .send({ token, new_password: 'nouveau-motdepasse' })
      .expect(204);

    // …et échoue APRÈS (toutes les sessions ouvertes sont tombées).
    await (await http()).post('/auth/refresh').send({ refresh_token: oldRefresh }).expect(401);
  });

  it('un jeton de reset est à usage unique', async () => {
    await registerAndVerify('reset-once@hpt.test', 'ancien-motdepasse');
    sent.length = 0;
    await (await http())
      .post('/auth/password-reset/request')
      .send({ email: 'reset-once@hpt.test' })
      .expect(200);
    const token = tokenFromLink(lastEmail('reset-once@hpt.test', 'reset').link);

    await (await http())
      .post('/auth/password-reset/confirm')
      .send({ token, new_password: 'nouveau-motdepasse' })
      .expect(204);
    // Le même jeton ne peut pas resservir.
    await (await http())
      .post('/auth/password-reset/confirm')
      .send({ token, new_password: 'encore-un-autre' })
      .expect(400);
  });

  it('demander un reset sur un e-mail inconnu renvoie 200 sans fuite (aucun e-mail)', async () => {
    await (await http())
      .post('/auth/password-reset/request')
      .send({ email: 'inconnu@hpt.test' })
      .expect(200);
    expect(sent).toHaveLength(0);
  });

  it('un jeton de vérification ne vaut pas pour un reset (cloisonnement par type)', async () => {
    await (await http())
      .post('/auth/register')
      .send({ email: 'xtype@hpt.test', nom: 'X', password: 'motdepasse-solide', type: 'amateur' })
      .expect(201);
    const verifyToken = tokenFromLink(lastEmail('xtype@hpt.test', 'verify').link);

    // Présenter un jeton de vérification au reset → rejeté (mauvais type).
    await (await http())
      .post('/auth/password-reset/confirm')
      .send({ token: verifyToken, new_password: 'nouveau-motdepasse' })
      .expect(400);
  });
});
