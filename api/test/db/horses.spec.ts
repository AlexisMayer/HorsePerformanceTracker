import { fileURLToPath } from 'node:url';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Preuve **de bout en bout** de la DoD du lot 2.1 (module `horses` : CRUD de la
 * fiche cheval, scopé au compte) sur un Postgres réel. On applique les
 * migrations (socle 0.3 + tables auth 1.1/1.2), on démarre l'app NestJS, puis on
 * exerce les cinq routes via HTTP :
 *
 *  - **Création / liste / détail** scopés au compte courant ;
 *  - **Édition** (`niveau` borné à `amateur | pro`, effacement de champs
 *    facultatifs) ;
 *  - **Isolation entre comptes** : un compte ne peut lire/éditer/supprimer le
 *    cheval d'un autre (404 sans fuite d'existence) ;
 *  - **Suppression = purge cascade** : le cheval et tout son historique
 *    (séances, obstacles, tours, contexte) disparaissent, aucune ligne
 *    résiduelle.
 *
 * Hors `pnpm test` (exige une base) : tourne via `pnpm db:verify`, comme les
 * preuves des lots 0.3 / 1.x.
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

/** Inscrit puis connecte un compte ; renvoie son id et un access token. */
async function registerAndLogin(email: string): Promise<TestAccount> {
  const password = 'motdepasse-solide';
  const reg = await (await http())
    .post('/auth/register')
    .send({ email, nom: 'Cavalier', password, type: 'amateur' })
    .expect(201);
  const login = await (await http()).post('/auth/login').send({ email, password }).expect(200);
  return { compteId: reg.body.id as string, accessToken: login.body.access_token as string };
}

async function count(sql: string, params: unknown[]): Promise<number> {
  const { rows } = await pool.query<{ n: string }>(sql, params);
  return Number(rows[0].n);
}

/**
 * Rattache un arbre de séances à un cheval **directement en base** (pas
 * d'endpoint séance avant la Phase 2.2) : une séance live avec obstacle +
 * contexte, une séance concours avec tour. Sert à prouver la **purge cascade**.
 */
async function seedHistory(chevalId: string): Promise<{ seanceIds: string[] }> {
  const { rows: sLive } = await pool.query<{ id: string }>(
    `INSERT INTO seance (cheval_id, type, date, provenance, idempotency_key)
     VALUES ($1, 'Parcours', now(), 'live', gen_random_uuid()) RETURNING id`,
    [chevalId],
  );
  const seanceLive = sLive[0].id;
  await pool.query(`INSERT INTO obstacle (seance_id, type, hauteur) VALUES ($1, 'Oxer', 110)`, [
    seanceLive,
  ]);
  await pool.query(`INSERT INTO contexte (seance_id, ressenti_global, note) VALUES ($1, 4, 'ok')`, [
    seanceLive,
  ]);

  const { rows: sDecl } = await pool.query<{ id: string }>(
    `INSERT INTO seance (cheval_id, type, date, provenance, idempotency_key)
     VALUES ($1, 'Concours', now(), 'déclaratif', gen_random_uuid()) RETURNING id`,
    [chevalId],
  );
  const seanceDecl = sDecl[0].id;
  await pool.query(`INSERT INTO tour (seance_id, hauteur) VALUES ($1, 120)`, [seanceDecl]);

  return { seanceIds: [seanceLive, seanceDecl] };
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

describe('POST /horses (création scopée au compte)', () => {
  it('exige l’authentification (401 sans jeton)', async () => {
    await (await http())
      .post('/horses')
      .send({ nom: 'Eclipse', niveau: 'amateur', hauteur_de_référence: 110 })
      .expect(401);
  });

  it('crée un cheval lié au compte courant et renvoie sa projection', async () => {
    const a = await registerAndLogin('create@hpt.test');
    const res = await (await http())
      .post('/horses')
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ nom: 'Eclipse', niveau: 'amateur', hauteur_de_référence: 110, âge: 8, race: 'SF' })
      .expect(201);

    expect(res.body.compte_id).toBe(a.compteId);
    expect(res.body.nom).toBe('Eclipse');
    expect(res.body.niveau).toBe('amateur');
    expect(res.body.hauteur_de_référence).toBe(110);
    expect(res.body.âge).toBe(8);
    expect(res.body.race).toBe('SF');
    expect(typeof res.body.id).toBe('string');
  });

  it('rend null les champs facultatifs omis (âge / race)', async () => {
    const a = await registerAndLogin('create-min@hpt.test');
    const res = await (await http())
      .post('/horses')
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ nom: 'Pampa', niveau: 'pro', hauteur_de_référence: 130 })
      .expect(201);
    expect(res.body.âge).toBeNull();
    expect(res.body.race).toBeNull();
  });

  it('rejette un niveau hors amateur | pro (400)', async () => {
    const a = await registerAndLogin('create-bad-niveau@hpt.test');
    await (await http())
      .post('/horses')
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ nom: 'X', niveau: 'expert', hauteur_de_référence: 110 })
      .expect(400);
  });

  it('rejette une hauteur de référence hors référentiel (400)', async () => {
    const a = await registerAndLogin('create-bad-hauteur@hpt.test');
    await (await http())
      .post('/horses')
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ nom: 'X', niveau: 'amateur', hauteur_de_référence: 111 })
      .expect(400);
  });
});

describe('GET /horses (liste du compte courant uniquement)', () => {
  it('ne renvoie que les chevaux du compte appelant', async () => {
    const a = await registerAndLogin('list-a@hpt.test');
    const b = await registerAndLogin('list-b@hpt.test');

    for (const nom of ['A1', 'A2']) {
      await (await http())
        .post('/horses')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ nom, niveau: 'amateur', hauteur_de_référence: 100 })
        .expect(201);
    }
    await (await http())
      .post('/horses')
      .set('Authorization', `Bearer ${b.accessToken}`)
      .send({ nom: 'B1', niveau: 'amateur', hauteur_de_référence: 100 })
      .expect(201);

    const listA = await (await http())
      .get('/horses')
      .set('Authorization', `Bearer ${a.accessToken}`)
      .expect(200);
    expect(listA.body).toHaveLength(2);
    expect(listA.body.map((c: { nom: string }) => c.nom).sort()).toEqual(['A1', 'A2']);
    for (const c of listA.body) expect(c.compte_id).toBe(a.compteId);

    const listB = await (await http())
      .get('/horses')
      .set('Authorization', `Bearer ${b.accessToken}`)
      .expect(200);
    expect(listB.body).toHaveLength(1);
    expect(listB.body[0].nom).toBe('B1');
  });
});

describe('GET /horses/:id (détail, isolation)', () => {
  it('renvoie le détail d’un cheval du compte', async () => {
    const a = await registerAndLogin('detail-a@hpt.test');
    const created = await (await http())
      .post('/horses')
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ nom: 'Detail', niveau: 'amateur', hauteur_de_référence: 110 })
      .expect(201);

    const res = await (await http())
      .get(`/horses/${created.body.id}`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .expect(200);
    expect(res.body.id).toBe(created.body.id);
    expect(res.body.nom).toBe('Detail');
  });

  it('renvoie 404 (pas 403) pour le cheval d’un autre compte — aucune fuite', async () => {
    const a = await registerAndLogin('detail-owner@hpt.test');
    const b = await registerAndLogin('detail-intrus@hpt.test');
    const created = await (await http())
      .post('/horses')
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ nom: 'Secret', niveau: 'amateur', hauteur_de_référence: 110 })
      .expect(201);

    await (await http())
      .get(`/horses/${created.body.id}`)
      .set('Authorization', `Bearer ${b.accessToken}`)
      .expect(404);
  });

  it('rejette un id malformé à la frontière (400)', async () => {
    const a = await registerAndLogin('detail-badid@hpt.test');
    await (await http())
      .get('/horses/pas-un-uuid')
      .set('Authorization', `Bearer ${a.accessToken}`)
      .expect(400);
  });
});

describe('PATCH /horses/:id (édition, isolation)', () => {
  it('met à jour les champs et n’accepte que amateur | pro pour le niveau', async () => {
    const a = await registerAndLogin('patch-a@hpt.test');
    const created = await (await http())
      .post('/horses')
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ nom: 'Avant', niveau: 'amateur', hauteur_de_référence: 110, âge: 7, race: 'SF' })
      .expect(201);

    const ok = await (await http())
      .patch(`/horses/${created.body.id}`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ nom: 'Après', niveau: 'pro', hauteur_de_référence: 130, âge: null, race: null })
      .expect(200);
    expect(ok.body.nom).toBe('Après');
    expect(ok.body.niveau).toBe('pro');
    expect(ok.body.hauteur_de_référence).toBe(130);
    expect(ok.body.âge).toBeNull();
    expect(ok.body.race).toBeNull();

    await (await http())
      .patch(`/horses/${created.body.id}`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ niveau: 'expert' })
      .expect(400);
  });

  it('rejette un corps vide à la frontière Zod (400)', async () => {
    const a = await registerAndLogin('patch-empty@hpt.test');
    const created = await (await http())
      .post('/horses')
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ nom: 'X', niveau: 'amateur', hauteur_de_référence: 110 })
      .expect(201);
    await (await http())
      .patch(`/horses/${created.body.id}`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({})
      .expect(400);
  });

  it('refuse d’éditer le cheval d’un autre compte (404) et ne le modifie pas', async () => {
    const a = await registerAndLogin('patch-owner@hpt.test');
    const b = await registerAndLogin('patch-intrus@hpt.test');
    const created = await (await http())
      .post('/horses')
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ nom: 'Intouchable', niveau: 'amateur', hauteur_de_référence: 110 })
      .expect(201);

    await (await http())
      .patch(`/horses/${created.body.id}`)
      .set('Authorization', `Bearer ${b.accessToken}`)
      .send({ nom: 'Piraté' })
      .expect(404);

    const still = await (await http())
      .get(`/horses/${created.body.id}`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .expect(200);
    expect(still.body.nom).toBe('Intouchable');
  });
});

describe('DELETE /horses/:id (purge cascade, isolation)', () => {
  it('refuse de supprimer le cheval d’un autre compte (404) et le laisse intact', async () => {
    const a = await registerAndLogin('delete-owner@hpt.test');
    const b = await registerAndLogin('delete-intrus@hpt.test');
    const created = await (await http())
      .post('/horses')
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ nom: 'Garde', niveau: 'amateur', hauteur_de_référence: 110 })
      .expect(201);

    await (await http())
      .delete(`/horses/${created.body.id}`)
      .set('Authorization', `Bearer ${b.accessToken}`)
      .expect(404);

    expect(
      await count('SELECT count(*)::text AS n FROM cheval WHERE id = $1', [created.body.id]),
    ).toBe(1);
  });

  it('purge le cheval ET tout son historique (cascade) — aucune ligne résiduelle', async () => {
    const a = await registerAndLogin('delete-cascade@hpt.test');
    const created = await (await http())
      .post('/horses')
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ nom: 'Purge', niveau: 'amateur', hauteur_de_référence: 110 })
      .expect(201);
    const chevalId = created.body.id as string;
    const { seanceIds } = await seedHistory(chevalId);

    // Pré-condition : l'historique existe bien avant la suppression.
    expect(
      await count('SELECT count(*)::text AS n FROM seance WHERE cheval_id = $1', [chevalId]),
    ).toBe(2);

    await (await http())
      .delete(`/horses/${chevalId}`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .expect(204);

    // Le cheval et toute sa descendance ont disparu (Modèle §3, cascade 0.3).
    expect(
      await count('SELECT count(*)::text AS n FROM cheval WHERE id = $1', [chevalId]),
      'cheval',
    ).toBe(0);
    expect(
      await count('SELECT count(*)::text AS n FROM seance WHERE cheval_id = $1', [chevalId]),
      'seance',
    ).toBe(0);
    for (const table of ['obstacle', 'tour', 'contexte']) {
      expect(
        await count(`SELECT count(*)::text AS n FROM ${table} WHERE seance_id = ANY($1)`, [
          seanceIds,
        ]),
        table,
      ).toBe(0);
    }
  });

  it('supprimer un cheval ne touche pas les autres chevaux du compte', async () => {
    const a = await registerAndLogin('delete-isole@hpt.test');
    const garder = await (await http())
      .post('/horses')
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ nom: 'Reste', niveau: 'amateur', hauteur_de_référence: 110 })
      .expect(201);
    const jeter = await (await http())
      .post('/horses')
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ nom: 'Part', niveau: 'amateur', hauteur_de_référence: 110 })
      .expect(201);

    await (await http())
      .delete(`/horses/${jeter.body.id}`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .expect(204);

    const list = await (await http())
      .get('/horses')
      .set('Authorization', `Bearer ${a.accessToken}`)
      .expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(garder.body.id);
  });
});
