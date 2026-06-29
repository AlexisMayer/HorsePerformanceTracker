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
 * Preuve **de bout en bout** de la DoD du lot 3.3 (module `sharing` : composition
 * de la **carte de bilan de séance simple**) sur un Postgres réel. On enregistre
 * des séances via l'API 2.2, puis on lit `GET /sessions/:id/card` et on vérifie :
 *
 *  - une séance ordinaire ⇒ **carte récap** (types, hauteurs, taux via `shared`)
 *    **sans record** (`record: null`) — pas de fausse célébration ;
 *  - une séance qui **bat un record** ⇒ carte avec **record mis en avant** ;
 *  - un **Plat** ⇒ carte de **régularité** (`faits: null`, pas de hauteur) ;
 *  - une séance **`déclaratif`** ⇒ **aucun record** (exclue des dérivés, §2) ;
 *  - le **taux** de la carte est **cohérent** avec `shared` (pas de recalcul
 *    divergent) ;
 *  - **autorisation** : carte d'une séance d'un autre compte refusée (404) ; sans
 *    jeton ⇒ 401 ; carte **gratuite** (jamais verrouillée, §8).
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

// biome-ignore lint/suspicious/noExplicitAny: réponse carte typée au runtime.
async function getCard(a: TestAccount, seanceId: string): Promise<any> {
  const res = await (await http())
    .get(`/sessions/${seanceId}/card`)
    .set('Authorization', `Bearer ${a.accessToken}`)
    .expect(200);
  return res.body;
}

/** Un obstacle propre : `répétitions` franchissements propres à `hauteur`. */
function propre(type: string, hauteur: number, répétitions: number) {
  return { type, hauteur, répétitions, barres: 0, refus: 0 };
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

describe('GET /sessions/:id/card — séance ordinaire (récap sans fausse célébration)', () => {
  it('compose le récap (types, hauteurs, taux via shared) et ne met aucun record en avant', async () => {
    const a = await registerAndLogin('s-ordinaire@hpt.test');
    const chevalId = await createHorse(a, 'Quibelle');

    // Record posé à 120 par une 1re séance ; la séance ciblée (110, plus bas) ne
    // bat aucun record → carte récap simple.
    await createSession(a, chevalId, { type: 'Parcours', obstacles: [propre('Oxer', 120, 1)] });
    const seanceId = await createSession(a, chevalId, {
      type: 'Parcours',
      obstacles: [propre('Oxer', 110, 4), propre('Vertical', 100, 1)],
    });

    const carte = await getCard(a, seanceId);

    expect(carte.seance_id).toBe(seanceId);
    expect(carte.cheval_id).toBe(chevalId);
    expect(carte.type).toBe('Parcours');
    // Types dédupliqués/ordonnés (référentiel : Vertical avant Oxer) et hauteurs triées.
    expect(carte.types_travaillés).toEqual(['Vertical', 'Oxer']);
    expect(carte.hauteurs).toEqual([100, 110]);
    // Taux cohérent avec shared : 5 efforts, 5 propres ⇒ 1 (pas de recalcul divergent).
    expect(carte.faits.hauteur_max).toBe(110);
    expect(carte.faits.efforts_totaux).toBe(5);
    expect(carte.faits.efforts_propres).toBe(5);
    expect(carte.faits.taux_réussite).toBe(1);
    // Pas de record battu par cette séance.
    expect(carte.record).toBeNull();
  });
});

describe('GET /sessions/:id/card — séance qui bat un record (carte de record)', () => {
  it('met le record en avant quand la séance dépasse strictement l’historique', async () => {
    const a = await registerAndLogin('s-record@hpt.test');
    const chevalId = await createHorse(a, 'Tonnerre');

    await createSession(a, chevalId, { type: 'Gymnastique', obstacles: [propre('Oxer', 110, 2)] });
    // Cette séance franchit proprement 125 → nouveau record absolu.
    const recId = await createSession(a, chevalId, {
      type: 'Parcours',
      obstacles: [propre('Oxer', 125, 1)],
    });

    const carte = await getCard(a, recId);
    expect(carte.record).toBe(125);
    expect(carte.faits.hauteur_max).toBe(125);
    expect(carte.faits.sans_faute).toBe(true);
  });
});

describe('GET /sessions/:id/card — Plat & déclaratif (pas de fausse célébration)', () => {
  it('un Plat ⇒ carte de régularité (faits null, pas de hauteur, pas de record)', async () => {
    const a = await registerAndLogin('s-plat@hpt.test');
    const chevalId = await createHorse(a, 'Sobre');
    const platId = await createSession(a, chevalId, { type: 'Plat' });

    const carte = await getCard(a, platId);
    expect(carte.type).toBe('Plat');
    expect(carte.faits).toBeNull();
    expect(carte.hauteurs).toEqual([]);
    expect(carte.types_travaillés).toEqual([]);
    expect(carte.record).toBeNull();
  });

  it('une séance déclaratif ⇒ aucun record (exclue des dérivés, §2)', async () => {
    const a = await registerAndLogin('s-decl@hpt.test');
    const chevalId = await createHorse(a, 'Mémoire');
    // Déclaratif propre à 140 : récap présent, mais aucun record (provenance exclue).
    const declId = await createSession(a, chevalId, {
      type: 'Parcours',
      provenance: 'déclaratif',
      obstacles: [propre('Oxer', 140, 2)],
    });

    const carte = await getCard(a, declId);
    expect(carte.faits.hauteur_max).toBe(140);
    expect(carte.record).toBeNull();
  });
});

describe('GET /sessions/:id/card — autorisation (isolation entre comptes)', () => {
  it('exige un jeton (401) et refuse la séance d’un autre compte (404)', async () => {
    const a = await registerAndLogin('s-owner@hpt.test');
    const b = await registerAndLogin('s-intrus@hpt.test');
    const chevalId = await createHorse(a, 'AChev');
    const seanceId = await createSession(a, chevalId, {
      type: 'Gymnastique',
      obstacles: [propre('Oxer', 110, 2)],
    });

    await (await http()).get(`/sessions/${seanceId}/card`).expect(401);
    await (await http())
      .get(`/sessions/${seanceId}/card`)
      .set('Authorization', `Bearer ${b.accessToken}`)
      .expect(404);

    // Le propriétaire voit bien la carte (gratuite, jamais verrouillée — §8).
    const carte = await getCard(a, seanceId);
    expect(carte.seance_id).toBe(seanceId);
  });
});
