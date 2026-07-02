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
 * Preuve **de bout en bout** de la DoD du lot 5.2 (module `analytics` : le
 * **benchmark à combinaison constante**) sur un Postgres réel. On enregistre une
 * **réutilisable** (2.5) puis on l'**instancie** sur plusieurs séances `live`
 * (2.2/2.5), et on lit `GET /horses/:id/benchmark` (liste) + `…/benchmark/:ref`
 * (série) pour vérifier :
 *
 *  - **progression d'une combinaison identifiée dans le temps** : la série ordonnée
 *    porte le **taux §7 combinaison** par date, hauteur en annotation, + tendance ;
 *  - **identité stable** : une combinaison **modifiée** (nouvelle identité, 2.5)
 *    produit une **série distincte** — **aucun** mélange de `combinaison_ref` ;
 *  - **per-cheval** : la série ne compte **que** les instanciations du cheval
 *    sélectionné ; **`déclaratif` exclu** ; **contexte jamais agrégé** ;
 *  - **mono-point** : une combinaison instanciée une fois → un point, `tendance = null` ;
 *  - **refusé au gratuit** (garde 4.1, capacité `analytique_diagnostic`) → 403 ;
 *  - **autorisation** : cheval **ou** combinaison étrangers → 404 ; sans jeton → 401.
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

/** Enregistre une réutilisable (2.5) et renvoie son `id` (l'identité benchmark). */
async function createCombination(
  a: TestAccount,
  éléments: string[] = ['Vertical', 'Oxer'],
): Promise<string> {
  const res = await (await http())
    .post('/combinations')
    .set('Authorization', `Bearer ${a.accessToken}`)
    .send({ nombre_d_éléments: éléments.length, éléments })
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
  // Distancie les `date` métier (ordre chronologique stable de la série).
  await new Promise((r) => setTimeout(r, 5));
  return res.body.id as string;
}

/**
 * Instancie une combinaison réutilisable **par sa seule hauteur** (Modèle §8) sur
 * une séance `live` : on ne saisit que hauteur + barres/refus (répétitions défaut
 * 1), la structure vient de la ref (`nombre_d_éléments` copié inline par le serveur).
 */
async function instancie(
  a: TestAccount,
  chevalId: string,
  ref: string,
  o: { hauteur: number; répétitions: number; barres: number; refus: number },
  opts: { provenance?: 'live' | 'déclaratif'; contexte?: unknown } = {},
): Promise<void> {
  await createSession(a, chevalId, {
    type: 'Parcours',
    provenance: opts.provenance ?? 'live',
    obstacles: [{ type: 'Combinaison', combinaison_ref: ref, ...o }],
    ...(opts.contexte ? { contexte: opts.contexte } : {}),
  });
}

interface PointBenchmark {
  date: string;
  taux: number;
  hauteur: number;
}

// biome-ignore lint/suspicious/noExplicitAny: réponses benchmark typées au runtime.
async function getList(a: TestAccount, chevalId: string): Promise<any> {
  return (
    await (
      await http()
    )
      .get(`/horses/${chevalId}/benchmark`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .expect(200)
  ).body;
}

// biome-ignore lint/suspicious/noExplicitAny: réponses benchmark typées au runtime.
async function getSérie(a: TestAccount, chevalId: string, ref: string): Promise<any> {
  return (
    await (
      await http()
    )
      .get(`/horses/${chevalId}/benchmark/${ref}`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .expect(200)
  ).body;
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

describe('GET /horses/:id/benchmark — progression d’une combinaison identifiée (DoD)', () => {
  it('série ordonnée par date : taux §7 par point, hauteur en annotation, tendance', async () => {
    const a = await registerWithTier('b-prog@hpt.test', 'premium');
    const chevalId = await createHorse(a, 'Quibelle');
    const ref = await createCombination(a); // Double (2 éléments)

    // Trois instanciations `live` de la MÊME identité (structure figée), le cheval
    // progresse : 1/2 → 3/4 → 4/4. La hauteur varie (110 → 115 → 120) : c'est une
    // annotation, jamais confondue avec le taux (la structure, elle, est constante).
    await instancie(a, chevalId, ref, { hauteur: 110, répétitions: 1, barres: 1, refus: 0 });
    await instancie(a, chevalId, ref, { hauteur: 115, répétitions: 2, barres: 1, refus: 0 });
    await instancie(a, chevalId, ref, { hauteur: 120, répétitions: 2, barres: 0, refus: 0 });

    // Liste benchmarkable : la réutilisable instanciée, n_points = 3.
    const liste = await getList(a, chevalId);
    expect(liste.combinaisons).toHaveLength(1);
    expect(liste.combinaisons[0]).toMatchObject({ combinaison_ref: ref, n_points: 3 });
    expect(typeof liste.combinaisons[0].nom).toBe('string');

    // Série : taux §7 combinaison par point, ordonnés par date ; hauteurs en annotation.
    const série = await getSérie(a, chevalId, ref);
    expect(série).toMatchObject({ cheval_id: chevalId, combinaison_ref: ref });
    expect(série.points.map((p: PointBenchmark) => p.taux)).toEqual([0.5, 0.75, 1]);
    expect(série.points.map((p: PointBenchmark) => p.hauteur)).toEqual([110, 115, 120]);
    // La courbe rend la tendance : progression ⇒ hausse.
    expect(série.tendance).toBe('hausse');
    // Dates strictement croissantes (axe temps).
    const dates = série.points.map((p: PointBenchmark) => new Date(p.date).getTime());
    expect(dates[0]).toBeLessThan(dates[1]);
    expect(dates[1]).toBeLessThan(dates[2]);
  });
});

describe('GET /horses/:id/benchmark — identité stable : modifier crée une série distincte (DoD)', () => {
  it('une combinaison modifiée (nouvelle identité, 2.5) ne mélange jamais les séries', async () => {
    const a = await registerWithTier('b-ident@hpt.test', 'premium');
    const chevalId = await createHorse(a, 'Vega');
    const refA = await createCombination(a, ['Vertical', 'Oxer']);
    await instancie(a, chevalId, refA, { hauteur: 110, répétitions: 2, barres: 0, refus: 0 });

    // « Modifier » la réutilisable = en créer une NOUVELLE (PATCH, 2.5) → identité
    // neuve (refB ≠ refA), l'ancienne intacte.
    const refB = (
      await (
        await http()
      )
        .patch(`/combinations/${refA}`)
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ nombre_d_éléments: 3, éléments: ['Vertical', 'Oxer', 'Vertical'] })
        .expect(200)
    ).body.id as string;
    expect(refB).not.toBe(refA);
    await instancie(a, chevalId, refB, { hauteur: 120, répétitions: 2, barres: 1, refus: 0 });

    // Deux séries **distinctes** — aucun mélange de `combinaison_ref`.
    const sérieA = await getSérie(a, chevalId, refA);
    const sérieB = await getSérie(a, chevalId, refB);
    expect(sérieA.points).toHaveLength(1);
    expect(sérieA.points[0]).toMatchObject({ hauteur: 110, taux: 1 });
    expect(sérieB.points).toHaveLength(1);
    // refB = 3 éléments : dénominateur 2×3 = 6, propres 6−1 = 5 → 5/6.
    expect(sérieB.points[0]).toMatchObject({ hauteur: 120 });
    expect(sérieB.points[0].taux).toBeCloseTo(5 / 6, 10);

    // La liste porte les DEUX identités (chacune benchmarkable séparément).
    const liste = await getList(a, chevalId);
    expect(
      liste.combinaisons.map((c: { combinaison_ref: string }) => c.combinaison_ref).sort(),
    ).toEqual([refA, refB].sort());
  });
});

describe('GET /horses/:id/benchmark — per-cheval, déclaratif exclu, contexte jamais agrégé (DoD)', () => {
  it('ne compte que les instanciations du cheval, en `live`, sans agréger le contexte', async () => {
    // Pro : `multi_chevaux` (deux chevaux) **et** `analytique_diagnostic` (4.1).
    const a = await registerWithTier('b-scope@hpt.test', 'pro');
    const h1 = await createHorse(a, 'Un');
    const h2 = await createHorse(a, 'Deux');
    const ref = await createCombination(a); // bibliothèque au niveau compte (partagée)

    // H1 : deux instanciations `live` (dont une AVEC contexte → ne change pas le taux)
    // + une `déclaratif` (EXCLUE de l'agrégat, §2).
    await instancie(a, h1, ref, { hauteur: 110, répétitions: 2, barres: 0, refus: 0 });
    await instancie(
      a,
      h1,
      ref,
      { hauteur: 110, répétitions: 2, barres: 1, refus: 0 },
      { contexte: { ressenti_global: 5, énergie: 4, note: 'en forme' } },
    );
    await instancie(
      a,
      h1,
      ref,
      { hauteur: 110, répétitions: 2, barres: 0, refus: 0 },
      { provenance: 'déclaratif' },
    );

    // H2 : une seule instanciation de la même réutilisable (portée compte).
    await instancie(a, h2, ref, { hauteur: 110, répétitions: 2, barres: 0, refus: 0 });

    // H1 : deux points `live` seulement (le déclaratif est exclu), contexte sans effet
    // (taux 1 puis 0.75, dérivés du §7, jamais de la couche qualitative).
    const s1 = await getSérie(a, h1, ref);
    expect(s1.points.map((p: PointBenchmark) => p.taux)).toEqual([1, 0.75]);
    expect((await getList(a, h1)).combinaisons[0]).toMatchObject({ n_points: 2 });

    // H2 : la série **ne compte que** les instanciations de H2 (une seule).
    const s2 = await getSérie(a, h2, ref);
    expect(s2.points).toHaveLength(1);
    expect((await getList(a, h2)).combinaisons[0]).toMatchObject({ n_points: 1 });
  });
});

describe('GET /horses/:id/benchmark — mono-point géré (DoD)', () => {
  it('une combinaison instanciée une seule fois affiche un point sans fausse tendance', async () => {
    const a = await registerWithTier('b-mono@hpt.test', 'premium');
    const chevalId = await createHorse(a, 'Seul');
    const ref = await createCombination(a);
    await instancie(a, chevalId, ref, { hauteur: 110, répétitions: 2, barres: 1, refus: 0 });

    const série = await getSérie(a, chevalId, ref);
    expect(série.points).toHaveLength(1);
    expect(série.points[0].taux).toBe(0.75);
    expect(série.tendance).toBeNull();
    // La liste signale une combinaison à rejouer (n_points = 1).
    expect((await getList(a, chevalId)).combinaisons[0]).toMatchObject({ n_points: 1 });
  });
});

describe('GET /horses/:id/benchmark — états vides (invitation)', () => {
  it('liste vide sans instanciation ; série vide pour une identité jamais instanciée', async () => {
    const a = await registerWithTier('b-vide@hpt.test', 'premium');
    const chevalId = await createHorse(a, 'Neuf');
    const ref = await createCombination(a); // créée mais jamais instanciée sur ce cheval

    expect(await getList(a, chevalId)).toEqual({ cheval_id: chevalId, combinaisons: [] });
    const série = await getSérie(a, chevalId, ref);
    expect(série).toMatchObject({
      cheval_id: chevalId,
      combinaison_ref: ref,
      points: [],
      tendance: null,
    });
  });
});

describe('GET /horses/:id/benchmark — gating & autorisation', () => {
  it('refuse le compte GRATUIT (garde 4.1, `analytique_diagnostic`) → 403', async () => {
    const gratuit = await registerAndLogin('b-gratuit@hpt.test');
    const chevalId = await createHorse(gratuit, 'Gratos');
    const ref = await createCombination(gratuit);
    await instancie(gratuit, chevalId, ref, { hauteur: 110, répétitions: 2, barres: 0, refus: 0 });

    await (await http())
      .get(`/horses/${chevalId}/benchmark`)
      .set('Authorization', `Bearer ${gratuit.accessToken}`)
      .expect(403);
    await (await http())
      .get(`/horses/${chevalId}/benchmark/${ref}`)
      .set('Authorization', `Bearer ${gratuit.accessToken}`)
      .expect(403);
  });

  it('exige un jeton (401), refuse un cheval (404) ou une combinaison (404) étrangers', async () => {
    const a = await registerWithTier('b-owner@hpt.test', 'premium');
    const b = await registerWithTier('b-intrus@hpt.test', 'premium');
    const chevalId = await createHorse(a, 'AChev');
    const ref = await createCombination(a);
    await instancie(a, chevalId, ref, { hauteur: 110, répétitions: 2, barres: 0, refus: 0 });
    const refÉtranger = await createCombination(b); // combinaison d'un AUTRE compte

    // Sans jeton → 401.
    await (await http()).get(`/horses/${chevalId}/benchmark`).expect(401);
    // Cheval d'un autre compte (l'intrus est premium — la garde passe, la propriété non) → 404.
    await (await http())
      .get(`/horses/${chevalId}/benchmark`)
      .set('Authorization', `Bearer ${b.accessToken}`)
      .expect(404);
    // Combinaison étrangère au compte (cheval OK) → 404 (scope `findForAccount`).
    await (await http())
      .get(`/horses/${chevalId}/benchmark/${refÉtranger}`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .expect(404);
    // `combinaison_ref` malformé → 400 (ParseUUIDPipe).
    await (await http())
      .get(`/horses/${chevalId}/benchmark/pas-un-uuid`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .expect(400);
  });
});
