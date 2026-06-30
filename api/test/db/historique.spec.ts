import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Preuve **de bout en bout** de la DoD du lot 3.4 (onglet Historique) sur un
 * Postgres réel. L'historique est une **surface app sans module backend dédié** :
 * le seul ajout côté `sessions` est l'endpoint **paginé**
 * `GET /horses/:id/sessions/history`. On enregistre des séances via l'API 2.2,
 * puis on lit l'historique et on vérifie :
 *
 *  - **parcourir les séances passées** : récent → ancien, séances brutes
 *    (la composition — faits, mois, badges — est côté app) ;
 *  - **pagination simple** (curseur `before` + `limit`) ;
 *  - **cohérence après suppression** (2.4) : une séance supprimée **disparaît** ;
 *  - **état vide** = page vide (l'invitation est côté app) ;
 *  - **autorisation** : historique d'un cheval d'un autre compte refusé (404) ;
 *    sans jeton ⇒ 401.
 *
 * La **ré-ouverture du bilan simple** réutilise `GET /sessions/:id/card` (3.3,
 * couvert par `sharing.spec.ts`) — l'historique n'ajoute aucun endpoint de carte.
 *
 * Hors `pnpm test` (exige une base) : tourne via `pnpm db:verify`.
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

interface TestAccount {
  compteId: string;
  accessToken: string;
}

async function registerAndLogin(email: string): Promise<TestAccount> {
  const password = 'motdepasse-solide';
  const reg = await (await http())
    .post('/auth/register')
    .send({ email, nom: 'Cavalier', password, type: 'amateur' })
    .expect(201);
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
  // Espace les horodatages (date = new Date() côté serveur) pour un ordre stable.
  await new Promise((r) => setTimeout(r, 15));
  return res.body.id as string;
}

// biome-ignore lint/suspicious/noExplicitAny: page d'historique typée au runtime.
async function getHistory(a: TestAccount, chevalId: string, query = ''): Promise<any> {
  const res = await (await http())
    .get(`/horses/${chevalId}/sessions/history${query}`)
    .set('Authorization', `Bearer ${a.accessToken}`)
    .expect(200);
  return res.body;
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

describe('GET /horses/:id/sessions/history — état vide & parcours', () => {
  it('renvoie une page vide (invitation côté app) quand aucune séance', async () => {
    const a = await registerAndLogin('h-empty@hpt.test');
    const chevalId = await createHorse(a, 'Vide');
    const page = await getHistory(a, chevalId);
    expect(page.cheval_id).toBe(chevalId);
    expect(page.séances).toHaveLength(0);
    expect(page.has_more).toBe(false);
    expect(page.next_before).toBeNull();
  });

  it('liste les séances passées récent → ancien, avec de quoi dériver les faits', async () => {
    const a = await registerAndLogin('h-parcours@hpt.test');
    const chevalId = await createHorse(a, 'Quibelle');

    // Trois types distincts : entraînement (obstacles), concours (tours), Plat (0).
    const parcours = await createSession(a, chevalId, {
      type: 'Parcours',
      obstacles: [{ type: 'Oxer', hauteur: 110, répétitions: 4, barres: 1, refus: 0 }],
    });
    const concours = await createSession(a, chevalId, {
      type: 'Concours',
      tours: [{ hauteur: 115, barres: 0, refus: 0 }],
    });
    const plat = await createSession(a, chevalId, { type: 'Plat' });

    const page = await getHistory(a, chevalId);
    // Récent → ancien : Plat, Concours, Parcours.
    expect(page.séances.map((s: { id: string }) => s.id)).toEqual([plat, concours, parcours]);

    // Les séances sont brutes : l'app dérive les faits (hauteur, taux) via `shared`.
    const p = page.séances.find((s: { id: string }) => s.id === parcours);
    expect(p.type).toBe('Parcours');
    expect(p.obstacles).toHaveLength(1);
    expect(p.obstacles[0].hauteur).toBe(110);
    // Un Plat n'a aucun franchissement (l'app le rend comme « régularité »).
    const pl = page.séances.find((s: { id: string }) => s.id === plat);
    expect(pl.obstacles).toHaveLength(0);
    expect(pl.tours).toHaveLength(0);
    // La clé d'idempotence technique n'est jamais projetée.
    expect(p).not.toHaveProperty('idempotency_key');
  });
});

describe('GET /horses/:id/sessions/history — pagination simple (curseur)', () => {
  it('plafonne par limit et pagine avec before (récent → ancien)', async () => {
    const a = await registerAndLogin('h-page@hpt.test');
    const chevalId = await createHorse(a, 'Pagineur');
    const s1 = await createSession(a, chevalId, { type: 'Plat' });
    const s2 = await createSession(a, chevalId, { type: 'Plat' });
    const s3 = await createSession(a, chevalId, { type: 'Plat' });

    // Page 1 : limit=2 ⇒ les 2 plus récentes (s3, s2), has_more, curseur posé.
    const page1 = await getHistory(a, chevalId, '?limit=2');
    expect(page1.séances.map((s: { id: string }) => s.id)).toEqual([s3, s2]);
    expect(page1.has_more).toBe(true);
    expect(page1.next_before).not.toBeNull();

    // Page 2 : before = curseur ⇒ la plus ancienne (s1), fin de fil.
    const page2 = await getHistory(
      a,
      chevalId,
      `?limit=2&before=${encodeURIComponent(page1.next_before)}`,
    );
    expect(page2.séances.map((s: { id: string }) => s.id)).toEqual([s1]);
    expect(page2.has_more).toBe(false);
    expect(page2.next_before).toBeNull();
  });
});

describe('GET /horses/:id/sessions/history — cohérence après suppression (2.4)', () => {
  it('une séance supprimée disparaît de l’historique', async () => {
    const a = await registerAndLogin('h-suppr@hpt.test');
    const chevalId = await createHorse(a, 'Cohérent');
    const gardée = await createSession(a, chevalId, { type: 'Plat' });
    const supprimée = await createSession(a, chevalId, {
      type: 'Parcours',
      obstacles: [{ type: 'Vertical', hauteur: 105, répétitions: 1, barres: 0, refus: 0 }],
    });

    // Présente avant suppression.
    const avant = await getHistory(a, chevalId);
    expect(avant.séances.map((s: { id: string }) => s.id)).toContain(supprimée);

    // Suppression via l'endpoint d'édition/suppression existant (2.4).
    await (await http())
      .delete(`/sessions/${supprimée}`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .expect(204);

    // Disparue de l'historique ; la séance gardée reste.
    const après = await getHistory(a, chevalId);
    const ids = après.séances.map((s: { id: string }) => s.id);
    expect(ids).not.toContain(supprimée);
    expect(ids).toEqual([gardée]);
  });
});

describe('GET /horses/:id/sessions/history — autorisation (isolation entre comptes)', () => {
  it('exige un jeton (401) et refuse le cheval d’un autre compte (404)', async () => {
    const a = await registerAndLogin('h-owner@hpt.test');
    const b = await registerAndLogin('h-intrus@hpt.test');
    const chevalId = await createHorse(a, 'AChev');
    await createSession(a, chevalId, { type: 'Plat' });

    await (await http()).get(`/horses/${chevalId}/sessions/history`).expect(401);
    await (await http())
      .get(`/horses/${chevalId}/sessions/history`)
      .set('Authorization', `Bearer ${b.accessToken}`)
      .expect(404);

    // Le propriétaire voit bien son historique.
    const page = await getHistory(a, chevalId);
    expect(page.séances.length).toBeGreaterThan(0);
  });
});
