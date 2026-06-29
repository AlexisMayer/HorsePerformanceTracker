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
 * Preuve **de bout en bout** de la DoD du lot 3.1 (module `feed` : composition du
 * fil mono-cheval) sur un Postgres réel. On enregistre des séances via l'API 2.2,
 * puis on lit `GET /horses/:id/feed` et on vérifie :
 *
 *  - **chaque séance** apparaît comme une entrée (faits objectifs en avant,
 *    contexte en légende) ;
 *  - **un record génère un jalon** injecté ; une séance **`déclaratif`** apparaît
 *    mais **ne génère pas** de jalon (§2) ;
 *  - un **Plat** (0 obstacle) apparaît comme **entrée de régularité** (sans
 *    hauteur/fautes) ;
 *  - **état vide = fil vide** (l'invitation est côté app) ; **fonctionne dès la
 *    séance n°1** ;
 *  - **pagination simple** (curseur `before` + `limit`) ;
 *  - **autorisation** : fil d'un cheval d'un autre compte refusé (404) ; sans
 *    jeton ⇒ 401.
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

// biome-ignore lint/suspicious/noExplicitAny: entrées de feed typées au runtime.
async function getFeed(a: TestAccount, chevalId: string, query = ''): Promise<any> {
  const res = await (await http())
    .get(`/horses/${chevalId}/feed${query}`)
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

describe('GET /horses/:id/feed — état vide & séance n°1', () => {
  it('renvoie un fil vide (invitation côté app) quand aucune séance', async () => {
    const a = await registerAndLogin('f-empty@hpt.test');
    const chevalId = await createHorse(a, 'Vide');
    const fil = await getFeed(a, chevalId);
    expect(fil.cheval_id).toBe(chevalId);
    expect(fil.entrées).toHaveLength(0);
    expect(fil.has_more).toBe(false);
    expect(fil.next_before).toBeNull();
  });

  it('fonctionne dès la séance n°1 : une entrée séance + un jalon record', async () => {
    const a = await registerAndLogin('f-first@hpt.test');
    const chevalId = await createHorse(a, 'Premier');
    const sId = await createSession(a, chevalId, {
      type: 'Parcours',
      obstacles: [{ type: 'Oxer', hauteur: 110, répétitions: 4, barres: 1, refus: 0 }],
      contexte: { ressenti_global: 4, note: 'en forme' },
    });

    const fil = await getFeed(a, chevalId);
    const séance = fil.entrées.find((e: { kind: string }) => e.kind === 'séance');
    expect(séance.seance_id).toBe(sId);
    // Faits objectifs en avant (hauteur, efforts propres/total, taux), §1/§7.
    expect(séance.faits.hauteur_max).toBe(110);
    expect(séance.faits.efforts_totaux).toBe(4);
    expect(séance.faits.efforts_propres).toBe(3);
    expect(séance.faits.taux_réussite).toBeCloseTo(0.75, 10);
    expect(séance.faits.sans_faute).toBe(false);
    // Contexte en légende (jamais agrégé, §1).
    expect(séance.contexte.ressenti_global).toBe(4);
    expect(séance.contexte.note).toBe('en forme');
    // Jalon record injecté (110 cm), rattaché à la séance.
    const jalon = fil.entrées.find((e: { kind: string }) => e.kind === 'jalon');
    expect(jalon.type_jalon).toBe('record');
    expect(jalon.hauteur).toBe(110);
    expect(jalon.seance_id).toBe(sId);
  });
});

describe('GET /horses/:id/feed — record, régularité & provenance (DoD)', () => {
  it('injecte un jalon pour un record live, aucun pour une séance déclarative', async () => {
    const a = await registerAndLogin('f-dod@hpt.test');
    const chevalId = await createHorse(a, 'Quibelle');

    // A — live, propre à 110 ⇒ record@110.
    const aId = await createSession(a, chevalId, {
      type: 'Parcours',
      obstacles: [{ type: 'Oxer', hauteur: 110, répétitions: 1, barres: 0, refus: 0 }],
    });
    // B — Plat (0 obstacle) ⇒ entrée de régularité, aucun jalon.
    const bId = await createSession(a, chevalId, { type: 'Plat' });
    // C — déclaratif, propre à 130 : APPARAÎT mais NE génère AUCUN jalon (§2),
    // même si 130 > 110 (les jalons sont réservés au live).
    const cId = await createSession(a, chevalId, {
      type: 'Parcours',
      provenance: 'déclaratif',
      obstacles: [{ type: 'Vertical', hauteur: 130, répétitions: 1, barres: 0, refus: 0 }],
    });

    const fil = await getFeed(a, chevalId);

    // Récent → ancien : C (déclaratif) en tête, puis B (régularité), puis A + jalon.
    const kinds = fil.entrées.map((e: { kind: string }) => e.kind);
    expect(kinds).toEqual(['séance', 'régularité', 'séance', 'jalon']);

    const parId = (id: string) =>
      fil.entrées.filter((e: { seance_id: string }) => e.seance_id === id);

    // C : entrée séance déclarative, marquée comme telle, SANS jalon.
    const cEntries = parId(cId);
    expect(cEntries).toHaveLength(1);
    expect(cEntries[0].kind).toBe('séance');
    expect(cEntries[0].provenance).toBe('déclaratif');
    expect(cEntries[0].faits.hauteur_max).toBe(130);

    // B : entrée de régularité (Plat) — pas de faits (ni hauteur ni fautes).
    const bEntries = parId(bId);
    expect(bEntries).toHaveLength(1);
    expect(bEntries[0].kind).toBe('régularité');
    expect(bEntries[0]).not.toHaveProperty('faits');

    // A : séance + son unique jalon record@110.
    const aEntries = parId(aId);
    expect(aEntries.map((e: { kind: string }) => e.kind)).toEqual(['séance', 'jalon']);
    expect(aEntries[1].type_jalon).toBe('record');
    expect(aEntries[1].hauteur).toBe(110);

    // Aucun jalon nulle part pour le déclaratif (preuve directe de la DoD).
    const jalonsDéclaratif = fil.entrées.filter(
      (e: { kind: string; seance_id: string }) => e.kind === 'jalon' && e.seance_id === cId,
    );
    expect(jalonsDéclaratif).toHaveLength(0);
  });
});

describe('GET /horses/:id/feed — pagination simple (curseur)', () => {
  it('plafonne par limit et pagine avec before (récent → ancien)', async () => {
    const a = await registerAndLogin('f-page@hpt.test');
    const chevalId = await createHorse(a, 'Pagineur');
    // 3 séances live de Plat (entrées de régularité simples, sans jalon) — dates
    // espacées par createSession pour un ordre stable.
    const s1 = await createSession(a, chevalId, { type: 'Plat' });
    const s2 = await createSession(a, chevalId, { type: 'Plat' });
    const s3 = await createSession(a, chevalId, { type: 'Plat' });

    // Page 1 : limit=2 ⇒ les 2 plus récentes (s3, s2), has_more, curseur posé.
    const page1 = await getFeed(a, chevalId, '?limit=2');
    expect(page1.entrées.map((e: { seance_id: string }) => e.seance_id)).toEqual([s3, s2]);
    expect(page1.has_more).toBe(true);
    expect(page1.next_before).not.toBeNull();

    // Page 2 : before = curseur ⇒ la plus ancienne (s1), fin de fil.
    const page2 = await getFeed(
      a,
      chevalId,
      `?limit=2&before=${encodeURIComponent(page1.next_before)}`,
    );
    expect(page2.entrées.map((e: { seance_id: string }) => e.seance_id)).toEqual([s1]);
    expect(page2.has_more).toBe(false);
    expect(page2.next_before).toBeNull();
  });
});

describe('GET /horses/:id/feed — autorisation (isolation entre comptes)', () => {
  it('exige un jeton (401) et refuse le cheval d’un autre compte (404)', async () => {
    const a = await registerAndLogin('f-owner@hpt.test');
    const b = await registerAndLogin('f-intrus@hpt.test');
    const chevalId = await createHorse(a, 'AChev');
    await createSession(a, chevalId, { type: 'Plat' });

    await (await http()).get(`/horses/${chevalId}/feed`).expect(401);
    await (await http())
      .get(`/horses/${chevalId}/feed`)
      .set('Authorization', `Bearer ${b.accessToken}`)
      .expect(404);

    // Le propriétaire voit bien son fil.
    const fil = await getFeed(a, chevalId);
    expect(fil.entrées.length).toBeGreaterThan(0);
  });
});
