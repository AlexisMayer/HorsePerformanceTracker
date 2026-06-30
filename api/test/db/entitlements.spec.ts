import { fileURLToPath } from 'node:url';
import { PLAFOND_COMBINAISONS_GRATUIT } from '@hpt/shared';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Preuve **de bout en bout** du lot 4.1 côté **lecture de l'entitlement**
 * (Spec §9.3) et de la **garde de capacité** : `GET /me/entitlement` projette le
 * tier + capacités + quotas depuis la politique `@hpt/shared`, et **reflète le
 * tier au login** (un upgrade pris en compte après reconnexion). Le refus d'un
 * sous-tier sur la garde est prouvé en **unitaire** (`entitlement.guard.spec.ts`,
 * sans base) ; l'enforcement de quota est prouvé dans `horses`/`combinations`.
 *
 * Hors `pnpm test` (exige une base) : tourne via `pnpm db:verify`.
 */

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://hpt:hpt@localhost:5432/hpt';
process.env.DATABASE_URL = DATABASE_URL;
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret';

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));
const pool = new Pool({ connectionString: DATABASE_URL });
const PASSWORD = 'motdepasse-solide';

let app: INestApplication;

async function http() {
  return request(app.getHttpServer());
}

interface TestAccount {
  compteId: string;
  accessToken: string;
}

async function registerAndLogin(email: string): Promise<TestAccount> {
  const reg = await (await http())
    .post('/auth/register')
    .send({ email, nom: 'Cavalier', password: PASSWORD, type: 'amateur' })
    .expect(201);
  const login = await (await http())
    .post('/auth/login')
    .send({ email, password: PASSWORD })
    .expect(200);
  return { compteId: reg.body.id as string, accessToken: login.body.access_token as string };
}

function auth(a: TestAccount) {
  return { Authorization: `Bearer ${a.accessToken}` };
}

beforeAll(async () => {
  await pool.query('DROP SCHEMA IF EXISTS public CASCADE;');
  await pool.query('CREATE SCHEMA public;');
  await pool.query('DROP SCHEMA IF EXISTS drizzle CASCADE;');
  await migrate(drizzle(pool), { migrationsFolder });

  const { AppModule } = await import('../../src/app.module');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
}, 60000);

afterAll(async () => {
  await app?.close();
  await pool.end();
});

describe('GET /me/entitlement (lecture de l’entitlement, Spec §9.3)', () => {
  it('exige l’authentification (401 sans jeton)', async () => {
    await (await http()).get('/me/entitlement').expect(401);
  });

  it('gratuit : capacités payantes refusées, quotas 1 cheval / plafond combinaisons', async () => {
    const a = await registerAndLogin('ent-gratuit@hpt.test');
    const res = await (await http()).get('/me/entitlement').set(auth(a)).expect(200);

    expect(res.body.tier).toBe('gratuit');
    expect(res.body.capacités).toEqual({
      analytique_diagnostic: false,
      bilan_augmenté: false,
      bilan_progression: false,
      multi_chevaux: false,
      comptes_invité: false,
    });
    expect(res.body.quotas).toEqual({ chevaux: 1, combinaisons: PLAFOND_COMBINAISONS_GRATUIT });
  });

  it('premium : analytique + bilans déverrouillés, combinaisons illimitées, 1 cheval', async () => {
    const email = 'ent-premium@hpt.test';
    await registerAndLogin(email);
    await pool.query('UPDATE compte SET tier = $1 WHERE email = $2', ['premium', email]);
    const relog = await (await http())
      .post('/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);

    const res = await (await http())
      .get('/me/entitlement')
      .set('Authorization', `Bearer ${relog.body.access_token}`)
      .expect(200);
    expect(res.body.tier).toBe('premium');
    expect(res.body.capacités.analytique_diagnostic).toBe(true);
    expect(res.body.capacités.bilan_augmenté).toBe(true);
    expect(res.body.capacités.multi_chevaux).toBe(false); // multi = pro
    expect(res.body.quotas).toEqual({ chevaux: 1, combinaisons: null });
  });

  it('reflète le tier AU LOGIN : un passage en pro est pris en compte après reconnexion', async () => {
    const email = 'ent-upgrade@hpt.test';
    const gratuit = await registerAndLogin(email);

    // Avant : le claim du login initial porte « gratuit ».
    const avant = await (await http()).get('/me/entitlement').set(auth(gratuit)).expect(200);
    expect(avant.body.tier).toBe('gratuit');
    expect(avant.body.capacités.multi_chevaux).toBe(false);

    // Upgrade (4.2 fera le checkout Mollie ; ici on pose le tier sur Compte) puis
    // **reconnexion** → le nouveau claim porte « pro » (entitlement lu au login).
    await pool.query('UPDATE compte SET tier = $1 WHERE id = $2', ['pro', gratuit.compteId]);
    const relog = await (await http())
      .post('/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);

    const après = await (await http())
      .get('/me/entitlement')
      .set('Authorization', `Bearer ${relog.body.access_token}`)
      .expect(200);
    expect(après.body.tier).toBe('pro');
    expect(après.body.capacités).toEqual({
      analytique_diagnostic: true,
      bilan_augmenté: true,
      bilan_progression: true,
      multi_chevaux: true,
      comptes_invité: true,
    });
    expect(après.body.quotas).toEqual({ chevaux: null, combinaisons: null });
  });
});
