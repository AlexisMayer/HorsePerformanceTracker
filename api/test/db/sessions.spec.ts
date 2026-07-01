import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SessionsService } from '../../src/sessions/sessions.service';

/**
 * Preuve **de bout en bout** de la DoD du lot 2.2 (module `sessions` :
 * enregistrement minimal d'une séance — inviolabilité, horodatage, provenance,
 * idempotence) sur un Postgres réel. On applique les migrations (socle 0.3 +
 * tables auth 1.1/1.2 + clé d'idempotence **0003**), on démarre l'app NestJS,
 * puis on exerce le chemin de création minimal via HTTP :
 *
 *  - **Entraînement** (avec obstacles), **Concours** (avec tours) et **Plat**
 *    (0 obstacle) — les deux structures supportées ;
 *  - **Horodatage** posé, **provenance** posée, **`date_modification` null** ;
 *  - **Idempotence** : un réessai (même clé) ne crée pas de doublon ;
 *  - **Atomicité** : un enfant invalide ⇒ rollback (rien n'est écrit) ;
 *  - **Autorisation** : créer/lire une séance sur le cheval d'un autre compte
 *    est refusé (404 sans fuite) ; non authentifié ⇒ 401.
 *
 * Hors `pnpm test` (exige une base) : tourne via `pnpm db:verify`, comme les
 * preuves des lots 0.3 / 1.x / 2.1.
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

async function count(sql: string, params: unknown[]): Promise<number> {
  const { rows } = await pool.query<{ n: string }>(sql, params);
  return Number(rows[0].n);
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

describe('migration 0003 (clé d’idempotence) appliquée', () => {
  it('crée la colonne idempotency_key NOT NULL', async () => {
    const { rows } = await pool.query<{ is_nullable: string }>(
      `SELECT is_nullable FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'seance' AND column_name = 'idempotency_key'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].is_nullable).toBe('NO');
  });

  it('crée la contrainte d’unicité scopée (cheval_id, idempotency_key)', async () => {
    const { rows } = await pool.query<{ def: string }>(
      `SELECT pg_get_constraintdef(con.oid) AS def
       FROM pg_constraint con JOIN pg_class rel ON rel.oid = con.conrelid
       WHERE rel.relname = 'seance' AND con.contype = 'u'
         AND con.conname = 'seance_cheval_idempotency_unique'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].def).toBe('UNIQUE (cheval_id, idempotency_key)');
  });
});

describe('POST /horses/:id/sessions (création minimale)', () => {
  it('exige l’authentification (401 sans jeton)', async () => {
    const a = await registerAndLogin('s-auth@hpt.test');
    const chevalId = await createHorse(a, 'Eclipse');
    await (await http())
      .post(`/horses/${chevalId}/sessions`)
      .send({ type: 'Plat', idempotency_key: randomUUID() })
      .expect(401);
  });

  it('enregistre un entraînement (obstacles) horodaté, provenance posée, date_modification null', async () => {
    const a = await registerAndLogin('s-train@hpt.test');
    const chevalId = await createHorse(a, 'Eclipse');

    const before = Date.now();
    const res = await (await http())
      .post(`/horses/${chevalId}/sessions`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({
        type: 'Parcours',
        idempotency_key: randomUUID(),
        obstacles: [
          { type: 'Oxer', hauteur: 110, répétitions: 4, barres: 1, refus: 0 },
          {
            type: 'Combinaison',
            hauteur: 115,
            nombre_d_éléments: 2,
            éléments: ['Vertical', 'Oxer'],
          },
        ],
        contexte: { ressenti_global: 4, note: 'séance solide' },
      })
      .expect(201);

    expect(res.body.cheval_id).toBe(chevalId);
    expect(res.body.type).toBe('Parcours');
    expect(res.body.provenance).toBe('live');
    expect(res.body.date_modification).toBeNull();
    // Horodatée à l'enregistrement (date métier ~ maintenant).
    expect(new Date(res.body.date).getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(res.body.obstacles).toHaveLength(2);
    expect(res.body.tours).toHaveLength(0);
    expect(res.body.contexte.ressenti_global).toBe(4);
    // La clé d'idempotence (technique) n'est jamais projetée.
    expect(res.body).not.toHaveProperty('idempotency_key');

    // Persistance prouvée : relecture brute + état DB (date_modification NULL).
    const detail = await (await http())
      .get(`/sessions/${res.body.id}`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .expect(200);
    expect(detail.body.id).toBe(res.body.id);
    expect(detail.body.obstacles).toHaveLength(2);
    expect(
      await count(
        'SELECT count(*)::text AS n FROM seance WHERE id = $1 AND date_modification IS NULL',
        [res.body.id],
      ),
    ).toBe(1);
  });

  it('enregistre un Concours (tours)', async () => {
    const a = await registerAndLogin('s-concours@hpt.test');
    const chevalId = await createHorse(a, 'Pampa');
    const res = await (await http())
      .post(`/horses/${chevalId}/sessions`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({
        type: 'Concours',
        idempotency_key: randomUUID(),
        tours: [
          { hauteur: 120, barres: 0, refus: 0 },
          { hauteur: 125, barres: 4, refus: 0 },
        ],
      })
      .expect(201);
    expect(res.body.type).toBe('Concours');
    expect(res.body.tours).toHaveLength(2);
    expect(res.body.obstacles).toHaveLength(0);
    expect(res.body.contexte).toBeNull();
  });

  it('enregistre un Plat à 0 obstacle (régularité — séance valide)', async () => {
    const a = await registerAndLogin('s-plat@hpt.test');
    const chevalId = await createHorse(a, 'Filou');
    const res = await (await http())
      .post(`/horses/${chevalId}/sessions`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ type: 'Plat', idempotency_key: randomUUID() })
      .expect(201);
    expect(res.body.type).toBe('Plat');
    expect(res.body.obstacles).toHaveLength(0);
    expect(res.body.tours).toHaveLength(0);
  });

  it('accepte une provenance déclaratif explicite (amorçage — flux 3.5 différé)', async () => {
    const a = await registerAndLogin('s-decl@hpt.test');
    const chevalId = await createHorse(a, 'Vieux');
    const res = await (await http())
      .post(`/horses/${chevalId}/sessions`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ type: 'Plat', provenance: 'déclaratif', idempotency_key: randomUUID() })
      .expect(201);
    expect(res.body.provenance).toBe('déclaratif');
  });

  it('rejette un entraînement qui porterait des tours (structure pilotée par le type, 400)', async () => {
    const a = await registerAndLogin('s-mix@hpt.test');
    const chevalId = await createHorse(a, 'Mix');
    await (await http())
      .post(`/horses/${chevalId}/sessions`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({
        type: 'Parcours',
        idempotency_key: randomUUID(),
        tours: [{ hauteur: 120, barres: 0, refus: 0 }],
      })
      .expect(400);
  });

  it('rejette une création sans clé d’idempotence (400)', async () => {
    const a = await registerAndLogin('s-nokey@hpt.test');
    const chevalId = await createHorse(a, 'NoKey');
    await (await http())
      .post(`/horses/${chevalId}/sessions`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ type: 'Plat' })
      .expect(400);
  });
});

describe('idempotence (réessai même clé ⇒ pas de doublon)', () => {
  it('renvoie la séance existante au réessai, sans créer de doublon', async () => {
    const a = await registerAndLogin('s-idem@hpt.test');
    const chevalId = await createHorse(a, 'Idem');
    const key = randomUUID();
    const body = {
      type: 'Parcours',
      idempotency_key: key,
      obstacles: [{ type: 'Vertical', hauteur: 100 }],
    };

    const first = await (await http())
      .post(`/horses/${chevalId}/sessions`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send(body)
      .expect(201);

    const retry = await (await http())
      .post(`/horses/${chevalId}/sessions`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send(body)
      .expect(201);

    // Même séance renvoyée, et une seule ligne en base pour cette clé.
    expect(retry.body.id).toBe(first.body.id);
    expect(
      await count(
        'SELECT count(*)::text AS n FROM seance WHERE cheval_id = $1 AND idempotency_key = $2',
        [chevalId, key],
      ),
    ).toBe(1);
    // Le réessai n'a pas dupliqué les enfants non plus.
    expect(
      await count('SELECT count(*)::text AS n FROM obstacle WHERE seance_id = $1', [first.body.id]),
    ).toBe(1);
  });
});

describe('atomicité (un enfant invalide ⇒ rien n’est écrit)', () => {
  it('rollback : un obstacle au type invalide annule toute l’écriture', async () => {
    const a = await registerAndLogin('s-rollback@hpt.test');
    const chevalId = await createHorse(a, 'Rollback');
    const key = randomUUID();

    // On passe par le service (la frontière Zod rejetterait un enfant invalide) :
    // un type d'obstacle hors enum fait échouer l'INSERT enfant dans la
    // transaction → la séance parente et l'obstacle valide doivent être annulés.
    const service = app.get(SessionsService);
    await expect(
      service.create(a.compteId, chevalId, {
        type: 'Parcours',
        idempotency_key: key,
        provenance: 'live',
        obstacles: [
          { type: 'Oxer', hauteur: 110, répétitions: 1, barres: 0, refus: 0 },
          // biome-ignore lint/suspicious/noExplicitAny: enum invalide volontaire (simulé hors Zod) pour prouver le rollback DB.
          { type: 'PasUnType' as any, hauteur: 110, répétitions: 1, barres: 0, refus: 0 },
        ],
      }),
    ).rejects.toBeDefined();

    // Tout ou rien : aucune séance, aucun obstacle pour cette clé.
    expect(
      await count('SELECT count(*)::text AS n FROM seance WHERE cheval_id = $1', [chevalId]),
      'seance',
    ).toBe(0);
    expect(
      await count(
        `SELECT count(*)::text AS n FROM obstacle o
         JOIN seance s ON s.id = o.seance_id WHERE s.cheval_id = $1`,
        [chevalId],
      ),
      'obstacle',
    ).toBe(0);
  });
});

describe('autorisation (isolation entre comptes)', () => {
  it('refuse de créer une séance sur le cheval d’un autre compte (404)', async () => {
    const a = await registerAndLogin('s-owner-create@hpt.test');
    const b = await registerAndLogin('s-intrus-create@hpt.test');
    const chevalId = await createHorse(a, 'AChev');

    await (await http())
      .post(`/horses/${chevalId}/sessions`)
      .set('Authorization', `Bearer ${b.accessToken}`)
      .send({ type: 'Plat', idempotency_key: randomUUID() })
      .expect(404);

    // Rien n'a été écrit pour le compte A.
    expect(
      await count('SELECT count(*)::text AS n FROM seance WHERE cheval_id = $1', [chevalId]),
    ).toBe(0);
  });

  it('refuse de lister les séances du cheval d’un autre compte (404)', async () => {
    const a = await registerAndLogin('s-owner-list@hpt.test');
    const b = await registerAndLogin('s-intrus-list@hpt.test');
    const chevalId = await createHorse(a, 'AList');
    await (await http())
      .post(`/horses/${chevalId}/sessions`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ type: 'Plat', idempotency_key: randomUUID() })
      .expect(201);

    await (await http())
      .get(`/horses/${chevalId}/sessions`)
      .set('Authorization', `Bearer ${b.accessToken}`)
      .expect(404);

    // Le propriétaire, lui, voit bien sa séance.
    const mine = await (await http())
      .get(`/horses/${chevalId}/sessions`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .expect(200);
    expect(mine.body).toHaveLength(1);
  });

  it('refuse de lire la séance d’un autre compte par son id (404, sans fuite)', async () => {
    const a = await registerAndLogin('s-owner-read@hpt.test');
    const b = await registerAndLogin('s-intrus-read@hpt.test');
    const chevalId = await createHorse(a, 'ARead');
    const created = await (await http())
      .post(`/horses/${chevalId}/sessions`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ type: 'Plat', idempotency_key: randomUUID() })
      .expect(201);

    await (await http())
      .get(`/sessions/${created.body.id}`)
      .set('Authorization', `Bearer ${b.accessToken}`)
      .expect(404);
  });
});

describe('cheval archivé = lecture seule (lot 4.3, Spec §9.2)', () => {
  it('écriture de séance refusée (409) sur un cheval archivé ; lecture toujours possible', async () => {
    const a = await registerAndLogin('s-archive@hpt.test');
    const chevalId = await createHorse(a, 'Archivé');

    // Une séance enregistrée **tant que le cheval est actif**.
    const s1 = await (await http())
      .post(`/horses/${chevalId}/sessions`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ type: 'Plat', idempotency_key: randomUUID() })
      .expect(201);

    // Archivage → lecture seule.
    await (await http())
      .post(`/horses/${chevalId}/archive`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .expect(200);

    // Lecture : l'historique reste consultable (figé, non purgé).
    const list = await (await http())
      .get(`/horses/${chevalId}/sessions`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .expect(200);
    expect(list.body).toHaveLength(1);
    await (await http())
      .get(`/sessions/${s1.body.id}`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .expect(200);

    // Écriture : création / édition / suppression de séance **refusées** (409).
    await (await http())
      .post(`/horses/${chevalId}/sessions`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ type: 'Plat', idempotency_key: randomUUID() })
      .expect(409);
    await (await http())
      .patch(`/sessions/${s1.body.id}`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ type: 'Plat' })
      .expect(409);
    await (await http())
      .delete(`/sessions/${s1.body.id}`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .expect(409);

    // La séance existe toujours (aucune écriture n'a abouti).
    expect(
      await count('SELECT count(*)::text AS n FROM seance WHERE cheval_id = $1', [chevalId]),
    ).toBe(1);
  });
});
