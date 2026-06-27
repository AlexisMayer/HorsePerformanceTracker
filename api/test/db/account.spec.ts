import { fileURLToPath } from 'node:url';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Preuve **de bout en bout** de la DoD du lot 1.3 (RGPD compte : suppression &
 * export) sur un Postgres réel. On applique les migrations (socle 0.3 + tables
 * auth 1.1/1.2), on démarre l'app NestJS, puis on exerce les deux droits via
 * HTTP :
 *
 *  - **Export** (`GET /account/export`) : JSON complet des données de
 *    l'utilisateur (compte + chevaux + séances + obstacles/tours/contexte,
 *    `live` ET `déclaratif`), **sans aucun secret** (ni `password_hash`, ni
 *    refresh tokens, ni jetons de vérification).
 *  - **Suppression** (`DELETE /account`) : exige l'authentification **et** la
 *    confirmation par mot de passe, puis **purge en cascade** — on prouve
 *    qu'**aucune ligne** rattachée au compte ne subsiste, jusque dans les tables
 *    techniques d'auth.
 *
 * Hors `pnpm test` (exige une base) : tourne via `pnpm db:verify`, comme les
 * preuves des lots 0.3, 1.1 et 1.2.
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

interface SeededAccount {
  compteId: string;
  accessToken: string;
  password: string;
  chevalIds: string[];
  seanceIds: string[];
}

/**
 * Crée un compte (inscription HTTP → jeton de vérification ; login → refresh
 * token) et lui rattache un arbre de données via la base (pas d'endpoint chevaux
 * /séances avant la Phase 2). Couvre obstacles, tours, contexte et **les deux
 * provenances**.
 */
async function seedAccount(email: string): Promise<SeededAccount> {
  const password = 'motdepasse-solide';
  const reg = await (await http())
    .post('/auth/register')
    .send({ email, nom: 'RGPD', password, type: 'amateur' })
    .expect(201);
  const compteId = reg.body.id as string;

  const login = await (await http()).post('/auth/login').send({ email, password }).expect(200);
  const accessToken = login.body.access_token as string;

  const { rows: h } = await pool.query<{ id: string }>(
    `INSERT INTO cheval (compte_id, nom, niveau, hauteur_de_reference, age, race)
     VALUES ($1, 'Eclipse', 'amateur', 110, 8, 'SF') RETURNING id`,
    [compteId],
  );
  const chevalId = h[0].id;

  // Séance d'entraînement (live) avec obstacle + contexte.
  const { rows: sLive } = await pool.query<{ id: string }>(
    `INSERT INTO seance (cheval_id, type, date, provenance)
     VALUES ($1, 'Parcours', now(), 'live') RETURNING id`,
    [chevalId],
  );
  const seanceLive = sLive[0].id;
  await pool.query(`INSERT INTO obstacle (seance_id, type, hauteur) VALUES ($1, 'Oxer', 110)`, [
    seanceLive,
  ]);
  await pool.query(`INSERT INTO contexte (seance_id, ressenti_global, note) VALUES ($1, 4, 'ok')`, [
    seanceLive,
  ]);

  // Séance de concours (déclaratif) avec tour — l'export inclut le déclaratif.
  const { rows: sDecl } = await pool.query<{ id: string }>(
    `INSERT INTO seance (cheval_id, type, date, provenance)
     VALUES ($1, 'Concours', now(), 'déclaratif') RETURNING id`,
    [chevalId],
  );
  const seanceDecl = sDecl[0].id;
  await pool.query(`INSERT INTO tour (seance_id, hauteur) VALUES ($1, 120)`, [seanceDecl]);

  return {
    compteId,
    accessToken,
    password,
    chevalIds: [chevalId],
    seanceIds: [seanceLive, seanceDecl],
  };
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

describe('cascade des tables auth depuis le compte (vérification lot 1.3)', () => {
  it('refresh_token.compte_id et verification_token.compte_id sont ON DELETE CASCADE', async () => {
    const { rows } = await pool.query<{ table_name: string; delete_rule: string }>(
      `SELECT tc.table_name, rc.delete_rule
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
       JOIN information_schema.referential_constraints rc
         ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema
       WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
         AND kcu.column_name = 'compte_id'
         AND tc.table_name IN ('refresh_token', 'verification_token')`,
    );
    const byTable = Object.fromEntries(rows.map((r) => [r.table_name, r.delete_rule]));
    expect(byTable.refresh_token).toBe('CASCADE');
    expect(byTable.verification_token).toBe('CASCADE');
  });
});

describe('GET /account/export (portabilité)', () => {
  it('exige l’authentification (401 sans jeton)', async () => {
    await (await http()).get('/account/export').expect(401);
  });

  it('renvoie l’arbre complet du compte, live ET déclaratif, sans aucun secret', async () => {
    const seed = await seedAccount('export@hpt.test');

    const res = await (await http())
      .get('/account/export')
      .set('Authorization', `Bearer ${seed.accessToken}`)
      .expect(200);

    // Structure : exactement compte + chevaux + métadonnée, rien d'autre.
    expect(Object.keys(res.body).sort()).toEqual(['chevaux', 'compte', 'exported_at']);

    // Compte sans secret.
    expect(res.body.compte.email).toBe('export@hpt.test');
    expect(res.body.compte).not.toHaveProperty('password_hash');

    // Arbre : 1 cheval, 2 séances, obstacle + tour + contexte présents.
    expect(res.body.chevaux).toHaveLength(1);
    const seances = res.body.chevaux[0].seances;
    expect(seances).toHaveLength(2);
    const provenances = seances.map((s: { provenance: string }) => s.provenance).sort();
    expect(provenances).toEqual(['déclaratif', 'live']);

    const live = seances.find((s: { provenance: string }) => s.provenance === 'live');
    const decl = seances.find((s: { provenance: string }) => s.provenance === 'déclaratif');
    expect(live.obstacles).toHaveLength(1);
    expect(live.obstacles[0].type).toBe('Oxer');
    expect(live.contexte.ressenti_global).toBe(4);
    expect(decl.tours).toHaveLength(1);
    expect(decl.tours[0].hauteur).toBe(120);

    // Aucune trace de secret nulle part dans le payload sérialisé : ni hash de
    // mot de passe, ni hash de jeton (refresh / vérification), ni refresh/jeton.
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain('password_hash');
    expect(serialized).not.toContain('token_hash');
    expect(serialized.toLowerCase()).not.toContain('refresh_token');
    expect(serialized.toLowerCase()).not.toContain('verification_token');

    // Les jetons existent bien en base (preuve qu'ils ont été *exclus*, pas absents).
    expect(
      await count('SELECT count(*)::text AS n FROM refresh_token WHERE compte_id = $1', [
        seed.compteId,
      ]),
    ).toBeGreaterThan(0);
    expect(
      await count('SELECT count(*)::text AS n FROM verification_token WHERE compte_id = $1', [
        seed.compteId,
      ]),
    ).toBeGreaterThan(0);
  });
});

describe('DELETE /account (droit à l’effacement)', () => {
  it('exige l’authentification (401 sans jeton)', async () => {
    await (await http()).delete('/account').send({ password: 'peu-importe' }).expect(401);
  });

  it('refuse une confirmation par mot de passe erronée (401)', async () => {
    const seed = await seedAccount('wrongpw@hpt.test');
    await (await http())
      .delete('/account')
      .set('Authorization', `Bearer ${seed.accessToken}`)
      .send({ password: 'mauvais-mot-de-passe' })
      .expect(401);

    // Le compte est intact après l'échec de confirmation.
    expect(
      await count('SELECT count(*)::text AS n FROM compte WHERE id = $1', [seed.compteId]),
    ).toBe(1);
  });

  it('rejette une entrée sans mot de passe à la frontière Zod (400)', async () => {
    const seed = await seedAccount('nopw@hpt.test');
    await (await http())
      .delete('/account')
      .set('Authorization', `Bearer ${seed.accessToken}`)
      .send({})
      .expect(400);
  });

  it('purge le compte ET toute sa descendance, jetons inclus — aucune ligne résiduelle', async () => {
    const seed = await seedAccount('purge@hpt.test');
    const { compteId, chevalIds, seanceIds } = seed;

    await (await http())
      .delete('/account')
      .set('Authorization', `Bearer ${seed.accessToken}`)
      .send({ password: seed.password })
      .expect(204);

    // Le compte lui-même a disparu.
    expect(await count('SELECT count(*)::text AS n FROM compte WHERE id = $1', [compteId])).toBe(0);

    // Descendance de propriété (Modèle §3) : rattachée par compte / cheval / séance.
    expect(
      await count('SELECT count(*)::text AS n FROM cheval WHERE compte_id = $1', [compteId]),
      'cheval',
    ).toBe(0);
    expect(
      await count('SELECT count(*)::text AS n FROM seance WHERE cheval_id = ANY($1)', [chevalIds]),
      'seance',
    ).toBe(0);
    for (const table of ['obstacle', 'tour', 'contexte']) {
      expect(
        await count(`SELECT count(*)::text AS n FROM ${table} WHERE seance_id = ANY($1)`, [
          seanceIds,
        ]),
        `${table}`,
      ).toBe(0);
    }

    // Tables techniques d'auth (1.1 / 1.2) : purgées par la même cascade.
    expect(
      await count('SELECT count(*)::text AS n FROM refresh_token WHERE compte_id = $1', [compteId]),
      'refresh_token',
    ).toBe(0);
    expect(
      await count('SELECT count(*)::text AS n FROM verification_token WHERE compte_id = $1', [
        compteId,
      ]),
      'verification_token',
    ).toBe(0);
  });
});
