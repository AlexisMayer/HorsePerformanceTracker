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
 * Preuve **de bout en bout** de la DoD du lot 4.4 (module `progression-report` :
 * le **vrai générateur** de bilan de progression) sur un Postgres réel. On
 * enregistre des séances via l'API 2.2, puis on POST
 * `/horses/:id/progression-report` et on vérifie :
 *
 *  - un bilan **soigné** couvrant les **6 sections** (§6.2) est généré (artefact
 *    PDF/lien produit + sections composées) ;
 *  - **couche objective + `live` uniquement** : le `déclaratif` est **exclu** des
 *    agrégats (concours, niveau démontré, régularité) — jamais de ressenti ;
 *  - **réutilisation** de la maîtrisée (3.2) : le niveau démontré du bilan == le
 *    chiffre courant de `GET …/metrics` (pas de recalcul divergent) ;
 *  - **curation** (§6.3) : changer la **période** ou les **indicateurs** change le
 *    rapport, **sans altérer la donnée** (les séances restent intactes) ;
 *  - **refusé au gratuit** (garde 4.1, capacité `bilan_progression`) → 403 ;
 *  - **autorisation** : cheval d'un autre compte → 404 ; sans jeton → 401.
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

/** Inscrit un compte **à un tier donné** puis le connecte (claim `tier` à jour). */
async function registerWithTier(email: string, tier: 'premium' | 'pro'): Promise<TestAccount> {
  const password = 'motdepasse-solide';
  const reg = await (await http())
    .post('/auth/register')
    .send({ email, nom: 'Coach', password, type: 'coach' })
    .expect(201);
  await pool.query('UPDATE compte SET tier = $1 WHERE id = $2', [tier, reg.body.id]);
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
  await new Promise((r) => setTimeout(r, 15));
  return res.body.id as string;
}

// biome-ignore lint/suspicious/noExplicitAny: réponse bilan typée au runtime.
async function generate(a: TestAccount, chevalId: string, body: any = {}): Promise<any> {
  const res = await (await http())
    .post(`/horses/${chevalId}/progression-report`)
    .set('Authorization', `Bearer ${a.accessToken}`)
    .send(body)
    .expect(201);
  return res.body;
}

/** Un obstacle propre : `répétitions` franchissements propres à `hauteur`. */
function propre(hauteur: number, répétitions: number) {
  return { type: 'Oxer', hauteur, répétitions, barres: 0, refus: 0 };
}
/** Un tour de concours (sans-faute si barres/refus nuls). */
function tour(hauteur: number, barres = 0, refus = 0) {
  return { hauteur, barres, refus };
}

/** Peuple un cheval avec un historique riche (maîtrisée + concours + Plat + déclaratif). */
async function seedHistory(a: TestAccount, chevalId: string): Promise<void> {
  // Maîtrise à 110 : 2 + 1 = 3 franchissements propres sur 2 séances (§10).
  await createSession(a, chevalId, { type: 'Gymnastique', obstacles: [propre(110, 2)] });
  await createSession(a, chevalId, { type: 'Gymnastique', obstacles: [propre(110, 1)] });
  // Concours : 110 sans-faute, 120 fauté (une barre).
  await createSession(a, chevalId, { type: 'Concours', tours: [tour(110), tour(120, 1)] });
  // Concours : 115 sans-faute (plus haut SF concours attendu).
  await createSession(a, chevalId, { type: 'Concours', tours: [tour(115)] });
  // Plat : régularité seule (aucune hauteur).
  await createSession(a, chevalId, { type: 'Plat' });
  // Déclaratif « propre » à 140 : nourrit le feed mais EXCLU des agrégats (§2).
  await createSession(a, chevalId, {
    type: 'Concours',
    provenance: 'déclaratif',
    tours: [tour(140)],
  });
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

describe('POST /horses/:id/progression-report — bilan soigné, 6 sections (DoD)', () => {
  it('génère un bilan complet, live only, réutilisant la maîtrisée (3.2)', async () => {
    const a = await registerWithTier('bilan-premium@hpt.test', 'premium');
    const chevalId = await createHorse(a, 'Quibelle');
    await seedHistory(a, chevalId);

    const b = await generate(a, chevalId, { format: 'lien' });

    // Les 6 sections (§6.2) sont présentes.
    expect(b.cheval_id).toBe(chevalId);
    expect(b.sections.identité.nom).toBe('Quibelle');
    expect(b.sections.période.nb_séances).toBe(5); // 5 live ; le déclaratif est exclu
    expect(b.sections.niveau_démontré).toBeDefined();
    expect(b.sections.performance_concours).toBeDefined();
    expect(b.sections.régularité).toBeDefined();
    expect(b.sections.trajectoire).toBeDefined();

    // Réutilisation de la maîtrisée : le niveau démontré == le chiffre courant metrics.
    const metrics = await (await http())
      .get(`/horses/${chevalId}/metrics`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .expect(200);
    expect(b.sections.niveau_démontré.hauteur_maîtrisée).toBe(metrics.body.maîtrise.courante);
    expect(b.sections.niveau_démontré.hauteur_maîtrisée).toBe(110);

    // Plus haut sans-faute concours LIVE = 115 (120 fauté, 140 déclaratif exclu).
    expect(b.sections.niveau_démontré.record_sans_faute_concours).toBe(115);

    // Performance concours : 3 tours live (110, 120, 115), 2 sans-faute ; 140 exclu.
    expect(b.sections.performance_concours.total_tours).toBe(3);
    expect(b.sections.performance_concours.tours_sans_faute).toBe(2);
    expect(
      b.sections.performance_concours.par_hauteur.map((p: { hauteur: number }) => p.hauteur),
    ).toEqual([120, 115, 110]);

    // Régularité : 5 séances live (Plat inclus), déclaratif exclu.
    expect(b.sections.régularité.total_séances).toBe(5);

    // Artefact « lien » produit (fichier local) : livrable réel, pas un stub.
    expect(b.format).toBe('lien');
    expect(b.artefact.url.startsWith('file://')).toBe(true);
    expect(b.artefact.taille_octets).toBeGreaterThan(0);
    expect(b.artefact.stub).toBe(false);
  });

  it('le format pdf renvoie un artefact marqué stub en dev (chaîne prod différée infra)', async () => {
    const a = await registerWithTier('bilan-pdf@hpt.test', 'premium');
    const chevalId = await createHorse(a, 'Isard');
    await seedHistory(a, chevalId);

    const b = await generate(a, chevalId, { format: 'pdf' });
    expect(b.format).toBe('pdf');
    expect(b.artefact.stub).toBe(true);
  });
});

describe('POST /horses/:id/progression-report — curation (§6.3), donnée inviolable', () => {
  it('changer la période change le rapport, sans altérer les séances', async () => {
    const a = await registerWithTier('bilan-curation@hpt.test', 'pro');
    const chevalId = await createHorse(a, 'Sirocco');
    await seedHistory(a, chevalId);

    // Période dans le passé (avant toute séance) ⇒ rapport vide.
    const passé = await generate(a, chevalId, {
      période: { from: '2020-01-01T00:00:00.000Z', to: '2020-12-31T00:00:00.000Z' },
    });
    expect(passé.sections.période.nb_séances).toBe(0);
    expect(passé.sections.régularité.total_séances).toBe(0);
    expect(passé.sections.niveau_démontré.hauteur_maîtrisée).toBeNull();
    expect(passé.sections.performance_concours.total_tours).toBe(0);

    // Rapport complet (période ouverte) ⇒ tout est là : la donnée n'a pas bougé.
    const complet = await generate(a, chevalId, {});
    expect(complet.sections.période.nb_séances).toBe(5);

    // Inviolabilité : les séances sous-jacentes sont intactes (6 = 5 live + 1 décl.).
    const sessions = await (await http())
      .get(`/horses/${chevalId}/sessions`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .expect(200);
    expect(sessions.body).toHaveLength(6);
  });

  it('décocher un indicateur retire sa section (sans toucher la donnée)', async () => {
    const a = await registerWithTier('bilan-indic@hpt.test', 'premium');
    const chevalId = await createHorse(a, 'Vahiné');
    await seedHistory(a, chevalId);

    const b = await generate(a, chevalId, {
      indicateurs: { performance_concours: false, trajectoire: false },
    });
    // Sections décochées absentes ; identité + période + les autres présentes.
    expect(b.sections.performance_concours).toBeUndefined();
    expect(b.sections.trajectoire).toBeUndefined();
    expect(b.sections.régularité).toBeDefined();
    expect(b.sections.identité).toBeDefined();
    expect(b.sections.période).toBeDefined();
  });
});

describe('POST /horses/:id/progression-report — gating & autorisation', () => {
  it('refuse le compte GRATUIT (garde 4.1, capacité bilan_progression) → 403', async () => {
    const gratuit = await registerAndLogin('bilan-gratuit@hpt.test');
    const chevalId = await createHorse(gratuit, 'Gratos');

    await (await http())
      .post(`/horses/${chevalId}/progression-report`)
      .set('Authorization', `Bearer ${gratuit.accessToken}`)
      .send({})
      .expect(403);
  });

  it('exige un jeton (401) et refuse le cheval d’un autre compte (404)', async () => {
    const a = await registerWithTier('bilan-owner@hpt.test', 'premium');
    const b = await registerWithTier('bilan-intrus@hpt.test', 'premium');
    const chevalId = await createHorse(a, 'AChev');
    await seedHistory(a, chevalId);

    await (await http()).post(`/horses/${chevalId}/progression-report`).send({}).expect(401);
    await (await http())
      .post(`/horses/${chevalId}/progression-report`)
      .set('Authorization', `Bearer ${b.accessToken}`)
      .send({})
      .expect(404);
  });
});
