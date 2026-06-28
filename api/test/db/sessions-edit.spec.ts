import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { type SéanceSortie, tauxObstacleSimple } from '@hpt/shared';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Preuve **de bout en bout** de la DoD du lot 2.4 (édition / suppression de
 * séance — module `sessions`, Spec §3.7, Modèle §2/§9/§10) sur un Postgres réel.
 * On applique les migrations (socle 0.3 + auth 1.x + idempotence 2.2), on démarre
 * l'app NestJS, puis on exerce les chemins d'édition et de suppression :
 *
 *  - **Édition** : `PATCH /sessions/:id` remplace le contenu mutable, **pose
 *    `date_modification`** (visible) et laisse la **`date` d'origine inchangée**
 *    ainsi que `provenance` ; le `type` est éditable (la structure suit) ;
 *  - **Idempotence (2.2)** : un re-`POST` (même clé) **ne contourne pas l'édition**
 *    (renvoie la séance existante inchangée) — modifier passe par `PATCH` ;
 *  - **Déclaratif** : une séance `déclarative` s'édite aux mêmes règles ;
 *  - **Suppression** : `DELETE /sessions/:id` **purge en cascade** la séance et
 *    ses enfants (aucune ligne résiduelle) ;
 *  - **Contribution retirée** : une métrique **calculée via `shared`** sur
 *    l'historique courant reflète mécaniquement la suppression — **aucun agrégat
 *    stocké** (on recalcule depuis l'API à chaque fois) ;
 *  - **Autorisation** : éditer/supprimer la séance d'un autre compte ⇒ 404 ;
 *    non authentifié ⇒ 401 ; `:id` malformé ⇒ 400.
 *
 * Hors `pnpm test` (exige une base) : tourne via `pnpm db:verify`, comme les
 * preuves des lots 0.3 / 1.x / 2.x.
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

describe('PATCH /sessions/:id (édition jamais silencieuse)', () => {
  it('édite la collection, pose date_modification (visible) et laisse date d’origine + provenance inchangées', async () => {
    const a = await registerAndLogin('e-edit@hpt.test');
    const chevalId = await createHorse(a, 'Eclipse');

    const created = await (await http())
      .post(`/horses/${chevalId}/sessions`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({
        type: 'Parcours',
        idempotency_key: randomUUID(),
        obstacles: [{ type: 'Oxer', hauteur: 110, répétitions: 4, barres: 2, refus: 0 }],
      })
      .expect(201);
    expect(created.body.date_modification).toBeNull();
    const originalDate: string = created.body.date;

    const edited = await (await http())
      .patch(`/sessions/${created.body.id}`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({
        type: 'Parcours',
        obstacles: [
          { type: 'Vertical', hauteur: 115, répétitions: 5, barres: 0, refus: 0 },
          { type: 'Mur', hauteur: 120, répétitions: 2, barres: 1, refus: 0 },
        ],
      })
      .expect(200);

    // Modifications persistées (collection remplacée).
    expect(edited.body.id).toBe(created.body.id);
    expect(edited.body.obstacles).toHaveLength(2);
    expect(edited.body.obstacles[0].type).toBe('Vertical');
    // date_modification posée et visible ; date d'origine immuable ; provenance idem.
    expect(edited.body.date_modification).not.toBeNull();
    expect(edited.body.date).toBe(originalDate);
    expect(edited.body.provenance).toBe('live');

    // État DB : date inchangée, date_modification renseignée.
    expect(
      await count(
        'SELECT count(*)::text AS n FROM seance WHERE id = $1 AND date = $2 AND date_modification IS NOT NULL',
        [created.body.id, originalDate],
      ),
    ).toBe(1);
    // L'ancienne collection a bien été remplacée (aucun obstacle orphelin).
    expect(
      await count('SELECT count(*)::text AS n FROM obstacle WHERE seance_id = $1', [
        created.body.id,
      ]),
    ).toBe(2);
  });

  it('le type est éditable : passer Parcours → Concours remplace obstacles par tours', async () => {
    const a = await registerAndLogin('e-type@hpt.test');
    const chevalId = await createHorse(a, 'Pampa');

    const created = await (await http())
      .post(`/horses/${chevalId}/sessions`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({
        type: 'Parcours',
        idempotency_key: randomUUID(),
        obstacles: [{ type: 'Oxer', hauteur: 110, répétitions: 3, barres: 0, refus: 0 }],
      })
      .expect(201);

    const edited = await (await http())
      .patch(`/sessions/${created.body.id}`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ type: 'Concours', tours: [{ hauteur: 120, barres: 0, refus: 0 }] })
      .expect(200);

    expect(edited.body.type).toBe('Concours');
    expect(edited.body.tours).toHaveLength(1);
    expect(edited.body.obstacles).toHaveLength(0);
    expect(
      await count('SELECT count(*)::text AS n FROM obstacle WHERE seance_id = $1', [
        created.body.id,
      ]),
    ).toBe(0);
  });

  it('édite le contexte (remplacement) : contexte absent ⇒ retiré', async () => {
    const a = await registerAndLogin('e-ctx@hpt.test');
    const chevalId = await createHorse(a, 'Filou');

    const created = await (await http())
      .post(`/horses/${chevalId}/sessions`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({
        type: 'Plat',
        idempotency_key: randomUUID(),
        contexte: { ressenti_global: 4, note: 'au top' },
      })
      .expect(201);
    expect(created.body.contexte).not.toBeNull();

    const edited = await (await http())
      .patch(`/sessions/${created.body.id}`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ type: 'Plat' })
      .expect(200);
    expect(edited.body.contexte).toBeNull();
    expect(
      await count('SELECT count(*)::text AS n FROM contexte WHERE seance_id = $1', [
        created.body.id,
      ]),
    ).toBe(0);
  });

  it('une séance déclarative s’édite aux mêmes règles (date_modification posée, provenance conservée)', async () => {
    const a = await registerAndLogin('e-decl@hpt.test');
    const chevalId = await createHorse(a, 'Vieux');

    const created = await (await http())
      .post(`/horses/${chevalId}/sessions`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ type: 'Plat', provenance: 'déclaratif', idempotency_key: randomUUID() })
      .expect(201);

    const edited = await (await http())
      .patch(`/sessions/${created.body.id}`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ type: 'Gymnastique', obstacles: [{ type: 'Croix', hauteur: 90 }] })
      .expect(200);

    expect(edited.body.provenance).toBe('déclaratif');
    expect(edited.body.date_modification).not.toBeNull();
    expect(edited.body.type).toBe('Gymnastique');
  });

  it('rejette une édition incohérente type↔structure (400)', async () => {
    const a = await registerAndLogin('e-bad@hpt.test');
    const chevalId = await createHorse(a, 'Mix');
    const created = await (await http())
      .post(`/horses/${chevalId}/sessions`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ type: 'Plat', idempotency_key: randomUUID() })
      .expect(201);

    await (await http())
      .patch(`/sessions/${created.body.id}`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ type: 'Parcours', tours: [{ hauteur: 120, barres: 0, refus: 0 }] })
      .expect(400);
  });

  it('un :id malformé est rejeté en 400 (avant la base)', async () => {
    const a = await registerAndLogin('e-uuid@hpt.test');
    await (await http())
      .patch('/sessions/pas-un-uuid')
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ type: 'Plat' })
      .expect(400);
  });
});

describe('idempotence (2.2) ne contourne pas l’édition', () => {
  it('un re-POST même clé renvoie la séance inchangée ; seul PATCH édite', async () => {
    const a = await registerAndLogin('e-idem@hpt.test');
    const chevalId = await createHorse(a, 'Idem');
    const key = randomUUID();

    const first = await (await http())
      .post(`/horses/${chevalId}/sessions`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({
        type: 'Parcours',
        idempotency_key: key,
        obstacles: [{ type: 'Oxer', hauteur: 110, répétitions: 4, barres: 0, refus: 0 }],
      })
      .expect(201);

    // Re-POST même clé avec un corps DIFFÉRENT : renvoie la séance existante,
    // sans rien éditer (l'idempotence dédoublonne la création, elle n'édite pas).
    const replay = await (await http())
      .post(`/horses/${chevalId}/sessions`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({
        type: 'Parcours',
        idempotency_key: key,
        obstacles: [
          { type: 'Vertical', hauteur: 150, répétitions: 9, barres: 0, refus: 0 },
          { type: 'Mur', hauteur: 140, répétitions: 9, barres: 0, refus: 0 },
        ],
      })
      .expect(201);
    expect(replay.body.id).toBe(first.body.id);
    expect(replay.body.obstacles).toHaveLength(1); // toujours la collection d'origine
    expect(replay.body.obstacles[0].hauteur).toBe(110);
    expect(replay.body.date_modification).toBeNull(); // jamais édité par un rejeu

    // Seul PATCH édite réellement.
    const edited = await (await http())
      .patch(`/sessions/${first.body.id}`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({
        type: 'Parcours',
        obstacles: [{ type: 'Vertical', hauteur: 150, répétitions: 9, barres: 0, refus: 0 }],
      })
      .expect(200);
    expect(edited.body.obstacles[0].hauteur).toBe(150);
    expect(edited.body.date_modification).not.toBeNull();
  });
});

describe('DELETE /sessions/:id (purge cascade)', () => {
  it('supprime la séance et tous ses enfants (aucune ligne résiduelle)', async () => {
    const a = await registerAndLogin('e-del@hpt.test');
    const chevalId = await createHorse(a, 'Suppr');

    const created = await (await http())
      .post(`/horses/${chevalId}/sessions`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({
        type: 'Parcours',
        idempotency_key: randomUUID(),
        obstacles: [
          { type: 'Oxer', hauteur: 110, répétitions: 3, barres: 0, refus: 0 },
          { type: 'Vertical', hauteur: 115, répétitions: 2, barres: 1, refus: 0 },
        ],
        contexte: { ressenti_global: 3, note: 'à revoir' },
      })
      .expect(201);
    const id = created.body.id as string;

    await (await http())
      .delete(`/sessions/${id}`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .expect(204);

    // Séance + enfants purgés (cascade 0.3).
    expect(await count('SELECT count(*)::text AS n FROM seance WHERE id = $1', [id])).toBe(0);
    expect(await count('SELECT count(*)::text AS n FROM obstacle WHERE seance_id = $1', [id])).toBe(
      0,
    );
    expect(await count('SELECT count(*)::text AS n FROM contexte WHERE seance_id = $1', [id])).toBe(
      0,
    );

    // La séance n'est plus lisible.
    await (await http())
      .get(`/sessions/${id}`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .expect(404);
  });
});

describe('contribution retirée — par construction (aucun agrégat stocké)', () => {
  /**
   * Métrique **calculée via `shared`** (Modèle §7/§9) : taux de réussite agrégé
   * d'un obstacle (type × hauteur) sur l'**historique courant** du cheval — on
   * additionne les efforts/fautes des obstacles correspondants puis on appelle
   * `tauxObstacleSimple`. Rien n'est stocké : on recalcule depuis l'API.
   */
  function tauxAgrégé(sessions: SéanceSortie[], type: string, hauteur: number): number | null {
    let répétitions = 0;
    let barres = 0;
    let refus = 0;
    for (const s of sessions) {
      for (const o of s.obstacles) {
        if (o.type === type && o.hauteur === hauteur) {
          répétitions += o.répétitions;
          barres += o.barres;
          refus += o.refus;
        }
      }
    }
    return tauxObstacleSimple({ répétitions, barres, refus });
  }

  async function listSessions(a: TestAccount, chevalId: string): Promise<SéanceSortie[]> {
    const res = await (await http())
      .get(`/horses/${chevalId}/sessions`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .expect(200);
    return res.body as SéanceSortie[];
  }

  it('supprimer une séance retire mécaniquement sa contribution au prochain calcul', async () => {
    const a = await registerAndLogin('e-contrib@hpt.test');
    const chevalId = await createHorse(a, 'Calc');

    // Séance 1 : Oxer 110, 4 efforts propres.
    await (await http())
      .post(`/horses/${chevalId}/sessions`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({
        type: 'Parcours',
        idempotency_key: randomUUID(),
        obstacles: [{ type: 'Oxer', hauteur: 110, répétitions: 4, barres: 0, refus: 0 }],
      })
      .expect(201);

    // Séance 2 : Oxer 110, 4 efforts tous fautés (tire le taux agrégé vers le bas).
    const s2 = await (await http())
      .post(`/horses/${chevalId}/sessions`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({
        type: 'Parcours',
        idempotency_key: randomUUID(),
        obstacles: [{ type: 'Oxer', hauteur: 110, répétitions: 4, barres: 4, refus: 0 }],
      })
      .expect(201);

    // Avant suppression : (8 − 4) / 8 = 0.5.
    expect(tauxAgrégé(await listSessions(a, chevalId), 'Oxer', 110)).toBe(0.5);

    await (await http())
      .delete(`/sessions/${s2.body.id}`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .expect(204);

    // Après suppression : (4 − 0) / 4 = 1 — la contribution de S2 a disparu,
    // sans aucun agrégat à décrémenter (le calcul dérive de l'historique courant).
    expect(tauxAgrégé(await listSessions(a, chevalId), 'Oxer', 110)).toBe(1);
  });
});

describe('autorisation (isolation entre comptes)', () => {
  it('exige l’authentification (401 sans jeton) sur PATCH et DELETE', async () => {
    const a = await registerAndLogin('e-auth@hpt.test');
    const chevalId = await createHorse(a, 'AuthChev');
    const created = await (await http())
      .post(`/horses/${chevalId}/sessions`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ type: 'Plat', idempotency_key: randomUUID() })
      .expect(201);

    await (await http()).patch(`/sessions/${created.body.id}`).send({ type: 'Plat' }).expect(401);
    await (await http()).delete(`/sessions/${created.body.id}`).expect(401);
  });

  it('refuse d’éditer / supprimer la séance d’un autre compte (404, sans effet)', async () => {
    const a = await registerAndLogin('e-owner@hpt.test');
    const b = await registerAndLogin('e-intrus@hpt.test');
    const chevalId = await createHorse(a, 'AChev');
    const created = await (await http())
      .post(`/horses/${chevalId}/sessions`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({
        type: 'Parcours',
        idempotency_key: randomUUID(),
        obstacles: [{ type: 'Oxer', hauteur: 110, répétitions: 4, barres: 0, refus: 0 }],
      })
      .expect(201);

    // B ne peut ni éditer ni supprimer la séance de A.
    await (await http())
      .patch(`/sessions/${created.body.id}`)
      .set('Authorization', `Bearer ${b.accessToken}`)
      .send({ type: 'Plat' })
      .expect(404);
    await (await http())
      .delete(`/sessions/${created.body.id}`)
      .set('Authorization', `Bearer ${b.accessToken}`)
      .expect(404);

    // Rien n'a changé côté A : séance toujours là, non éditée, enfant intact.
    const mine = await (await http())
      .get(`/sessions/${created.body.id}`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .expect(200);
    expect(mine.body.date_modification).toBeNull();
    expect(mine.body.obstacles).toHaveLength(1);
  });
});
