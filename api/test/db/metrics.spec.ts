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
 * Preuve **de bout en bout** de la DoD du lot 3.2 (module `metrics` : composition
 * des **deux graphes héros**) sur un Postgres réel. On enregistre des séances via
 * l'API 2.2, puis on lit `GET /horses/:id/metrics` et on vérifie :
 *
 *  - la **courbe de hauteur maîtrisée** + le **chiffre courant** reflètent les
 *    séances `live` (§10 : ≥ 3 franchissements propres sur ≥ 2 séances) ;
 *  - la **vitrine** réutilise la détection record/jalon de 3.1 ; le **record
 *    absolu** est gravé ;
 *  - le **plancher conservateur reste sous le record** (la maîtrisée n'efface pas
 *    le record — §5.5) ;
 *  - le **Plat** (0 hauteur) et le **`déclaratif`** sont **exclus des agrégats**
 *    (Modèle §2) ;
 *  - **autorisation** : métriques d'un cheval d'un autre compte refusées (404) ;
 *    sans jeton ⇒ 401.
 *
 * La **régression dans le temps** (la maîtrisée qui redescend) exige des dates
 * espacées d'une fenêtre ; elle est prouvée par le test unitaire pur de `shared`
 * (`hauteur-maitrisee.test.ts`), les séances créées ici étant toutes horodatées
 * « maintenant » côté serveur. Ici on prouve le pendant e2e : **plancher < record**.
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

// biome-ignore lint/suspicious/noExplicitAny: réponse métriques typée au runtime.
async function getMetrics(a: TestAccount, chevalId: string): Promise<any> {
  const res = await (await http())
    .get(`/horses/${chevalId}/metrics`)
    .set('Authorization', `Bearer ${a.accessToken}`)
    .expect(200);
  return res.body;
}

/** Un obstacle propre : `répétitions` franchissements propres à `hauteur`. */
function propre(hauteur: number, répétitions: number) {
  return { type: 'Oxer', hauteur, répétitions, barres: 0, refus: 0 };
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

describe('GET /horses/:id/metrics — état vide', () => {
  it('renvoie des héros vides quand aucune séance (rien à célébrer encore)', async () => {
    const a = await registerAndLogin('m-empty@hpt.test');
    const chevalId = await createHorse(a, 'Vide');
    const m = await getMetrics(a, chevalId);
    expect(m.cheval_id).toBe(chevalId);
    expect(m.maîtrise).toEqual({ courante: null, record: null, série: [] });
    expect(m.vitrine).toEqual({ record: null, jalons: [] });
  });
});

describe('GET /horses/:id/metrics — maîtrisée, record & honnêteté (DoD)', () => {
  it('compose la maîtrisée (§10) et la vitrine ; le plancher reste sous le record', async () => {
    const a = await registerAndLogin('m-dod@hpt.test');
    const chevalId = await createHorse(a, 'Quibelle');

    // Maîtrise à 115 : 2 + 2 = 4 franchissements propres sur 2 séances (§10).
    await createSession(a, chevalId, { type: 'Gymnastique', obstacles: [propre(115, 2)] });
    await createSession(a, chevalId, { type: 'Gymnastique', obstacles: [propre(115, 2)] });
    // Exploit ponctuel à 125 (un seul franchissement) → record, jamais maîtrisé.
    const recId = await createSession(a, chevalId, {
      type: 'Parcours',
      obstacles: [propre(125, 1)],
    });

    const m = await getMetrics(a, chevalId);

    // Héros 1 — chiffre courant maîtrisé = 115 ; le record (référence laiton) = 125.
    expect(m.maîtrise.courante).toBe(115);
    expect(m.maîtrise.record).toBe(125);
    // La courbe a un point par séance live ; le dernier = le chiffre courant.
    expect(m.maîtrise.série).toHaveLength(3);
    expect(m.maîtrise.série.at(-1).hauteur).toBe(115);

    // Le plancher conservateur reste STRICTEMENT sous le record gravé (§5.5).
    expect(m.maîtrise.courante).toBeLessThan(m.maîtrise.record);

    // Héros 2 — vitrine : record absolu gravé à 125, rattaché à sa séance.
    expect(m.vitrine.record.type).toBe('record');
    expect(m.vitrine.record.hauteur).toBe(125);
    expect(m.vitrine.record.seance_id).toBe(recId);
    // Jalons records injectés (115 puis 125), réutilisant la détection de 3.1.
    const recordsVitrine = m.vitrine.jalons
      .filter((j: { type: string }) => j.type === 'record')
      .map((j: { hauteur: number }) => j.hauteur);
    expect(recordsVitrine).toEqual([115, 125]);
  });
});

describe('GET /horses/:id/metrics — Plat & déclaratif exclus des agrégats (Modèle §2)', () => {
  it('le Plat ne porte aucune hauteur ; le déclaratif n’alimente ni maîtrisée ni record', async () => {
    const a = await registerAndLogin('m-exclus@hpt.test');
    const chevalId = await createHorse(a, 'Sobre');

    // Maîtrise live à 110 (2 + 1 = 3 franchissements sur 2 séances).
    await createSession(a, chevalId, { type: 'Gymnastique', obstacles: [propre(110, 2)] });
    await createSession(a, chevalId, { type: 'Gymnastique', obstacles: [propre(110, 1)] });
    // Plat (0 obstacle) : régularité, aucune hauteur — n'entre pas dans les héros.
    await createSession(a, chevalId, { type: 'Plat' });
    // Déclaratif « propre » à 140 : APPARAÎT dans le feed (3.1) mais reste EXCLU
    // des agrégats — il ne doit ni maîtriser 140 ni devenir le record (§2).
    await createSession(a, chevalId, {
      type: 'Parcours',
      provenance: 'déclaratif',
      obstacles: [propre(140, 3)],
    });

    const m = await getMetrics(a, chevalId);

    // Maîtrisée et record restent à 110 : ni le Plat ni le déclaratif@140 ne comptent.
    expect(m.maîtrise.courante).toBe(110);
    expect(m.maîtrise.record).toBe(110);
    expect(m.vitrine.record.hauteur).toBe(110);
    // Aucune trace de 140 dans la vitrine (le déclaratif ne génère aucun jalon).
    const hauteurs = m.vitrine.jalons.map((j: { hauteur: number }) => j.hauteur);
    expect(hauteurs).not.toContain(140);
    // La série ne compte que les séances live (les 2 obstacles + le Plat) : 3 points.
    expect(m.maîtrise.série).toHaveLength(3);
  });
});

describe('GET /horses/:id/metrics — autorisation (isolation entre comptes)', () => {
  it('exige un jeton (401) et refuse le cheval d’un autre compte (404)', async () => {
    const a = await registerAndLogin('m-owner@hpt.test');
    const b = await registerAndLogin('m-intrus@hpt.test');
    const chevalId = await createHorse(a, 'AChev');
    await createSession(a, chevalId, { type: 'Gymnastique', obstacles: [propre(110, 2)] });

    await (await http()).get(`/horses/${chevalId}/metrics`).expect(401);
    await (await http())
      .get(`/horses/${chevalId}/metrics`)
      .set('Authorization', `Bearer ${b.accessToken}`)
      .expect(404);

    // Le propriétaire voit bien ses métriques.
    const m = await getMetrics(a, chevalId);
    expect(m.cheval_id).toBe(chevalId);
  });
});
