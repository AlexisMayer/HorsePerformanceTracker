import { fileURLToPath } from 'node:url';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Preuve **de bout en bout** de la DoD du lot 1.1 sur un Postgres réel
 * (docker-compose / service CI). On réinitialise + applique les migrations
 * (dont la table `refresh_token` additive), on démarre l'app NestJS, puis on
 * exerce inscription, connexion, rotation (avec détection de réutilisation) et
 * déconnexion via HTTP.
 *
 * Hors `pnpm test` (exige une base) : tourne via `pnpm db:verify`, comme la
 * preuve de schéma du lot 0.3.
 */

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://hpt:hpt@localhost:5432/hpt';
process.env.DATABASE_URL = DATABASE_URL;
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret';

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));
const pool = new Pool({ connectionString: DATABASE_URL });

let app: INestApplication;

async function http() {
  return request(app.getHttpServer());
}

beforeAll(async () => {
  await pool.query('DROP SCHEMA IF EXISTS public CASCADE;');
  await pool.query('CREATE SCHEMA public;');
  await pool.query('DROP SCHEMA IF EXISTS drizzle CASCADE;');
  await migrate(drizzle(pool), { migrationsFolder });

  // Import tardif : l'app lit DATABASE_URL à l'instanciation du module DB.
  const { AppModule } = await import('../../src/app.module');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
}, 60000);

afterAll(async () => {
  await app?.close();
  await pool.end();
});

describe('POST /auth/register', () => {
  it('crée un compte (gratuit, non vérifié) et ne renvoie aucun secret', async () => {
    const res = await (await http())
      .post('/auth/register')
      .send({
        email: 'alice@hpt.test',
        nom: 'Alice',
        password: 'motdepasse-solide',
        type: 'amateur',
      })
      .expect(201);

    expect(res.body).toMatchObject({
      email: 'alice@hpt.test',
      nom: 'Alice',
      type: 'amateur',
      tier: 'gratuit',
      email_verified: false,
    });
    expect(res.body).not.toHaveProperty('password_hash');
    expect(res.body).not.toHaveProperty('password');

    // En base, le mot de passe est haché argon2 — jamais en clair.
    const { rows } = await pool.query<{ password_hash: string }>(
      'SELECT password_hash FROM compte WHERE email = $1',
      ['alice@hpt.test'],
    );
    expect(rows[0].password_hash.startsWith('$argon2id$')).toBe(true);
    expect(rows[0].password_hash).not.toContain('motdepasse-solide');
  });

  it('refuse un e-mail déjà utilisé (409)', async () => {
    await (await http())
      .post('/auth/register')
      .send({
        email: 'alice@hpt.test',
        nom: 'Alice2',
        password: 'autre-mot-de-passe',
        type: 'coach',
      })
      .expect(409);
  });

  it('rejette une entrée invalide à la frontière Zod (400)', async () => {
    await (await http())
      .post('/auth/register')
      .send({ email: 'pas-un-mail', nom: '', password: 'court', type: 'amateur' })
      .expect(400);
  });
});

describe('POST /auth/login', () => {
  it('rejette de mauvais identifiants (401)', async () => {
    await (await http())
      .post('/auth/login')
      .send({ email: 'alice@hpt.test', password: 'mauvais' })
      .expect(401);
    await (await http())
      .post('/auth/login')
      .send({ email: 'inconnu@hpt.test', password: 'motdepasse-solide' })
      .expect(401);
  });

  it('renvoie un couple access + refresh sur identifiants valides', async () => {
    const res = await (await http())
      .post('/auth/login')
      .send({ email: 'alice@hpt.test', password: 'motdepasse-solide' })
      .expect(200);

    expect(typeof res.body.access_token).toBe('string');
    expect(typeof res.body.refresh_token).toBe('string');
    expect(res.body.token_type).toBe('Bearer');
    expect(res.body.expires_in).toBe(15 * 60);
    expect(res.body).not.toHaveProperty('password_hash');
  });
});

describe('GET /auth/me (garde JWT d’accès)', () => {
  it('refuse sans jeton (401) et avec un jeton invalide (401)', async () => {
    await (await http()).get('/auth/me').expect(401);
    await (await http()).get('/auth/me').set('Authorization', 'Bearer nimporte.quoi').expect(401);
  });

  it('renvoie le compte courant avec un access token valide (sans secret)', async () => {
    const login = await (await http())
      .post('/auth/login')
      .send({ email: 'alice@hpt.test', password: 'motdepasse-solide' })
      .expect(200);

    const res = await (await http())
      .get('/auth/me')
      .set('Authorization', `Bearer ${login.body.access_token}`)
      .expect(200);

    expect(res.body.email).toBe('alice@hpt.test');
    expect(res.body).not.toHaveProperty('password_hash');
  });
});

describe('POST /auth/refresh (rotation + détection de réutilisation)', () => {
  it('renvoie un nouveau couple et invalide l’ancien refresh (rotation prouvée)', async () => {
    const login = await (await http())
      .post('/auth/login')
      .send({ email: 'alice@hpt.test', password: 'motdepasse-solide' })
      .expect(200);
    const oldRefresh = login.body.refresh_token as string;

    const rotated = await (await http())
      .post('/auth/refresh')
      .send({ refresh_token: oldRefresh })
      .expect(200);
    const newRefresh = rotated.body.refresh_token as string;

    // Nouveau couple : le refresh est bien renouvelé (l'access, signé avec le
    // même payload dans la même seconde, peut être identique — non significatif).
    expect(newRefresh).not.toBe(oldRefresh);
    expect(typeof rotated.body.access_token).toBe('string');
    expect(rotated.body.access_token.length).toBeGreaterThan(0);

    // Réutiliser l'ANCIEN refresh échoue (il a été tourné)…
    await (await http()).post('/auth/refresh').send({ refresh_token: oldRefresh }).expect(401);

    // …et déclenche la révocation de la famille : le successeur est tué aussi.
    await (await http()).post('/auth/refresh').send({ refresh_token: newRefresh }).expect(401);
  });
});

describe('POST /auth/logout', () => {
  it('révoque le refresh courant (204), qui ne peut plus être rafraîchi', async () => {
    await (await http())
      .post('/auth/register')
      .send({ email: 'bob@hpt.test', nom: 'Bob', password: 'motdepasse-solide', type: 'coach' })
      .expect(201);
    const login = await (await http())
      .post('/auth/login')
      .send({ email: 'bob@hpt.test', password: 'motdepasse-solide' })
      .expect(200);
    const refresh = login.body.refresh_token as string;

    await (await http()).post('/auth/logout').send({ refresh_token: refresh }).expect(204);
    await (await http()).post('/auth/refresh').send({ refresh_token: refresh }).expect(401);
  });
});
