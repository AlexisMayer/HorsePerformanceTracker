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
 * Preuve **de bout en bout** de la DoD du lot 5.1 (module `analytics` : la
 * **heatmap type × hauteur**) sur un Postgres réel. On enregistre des séances via
 * l'API 2.2, puis on lit `GET /horses/:id/heatmap` et on vérifie :
 *
 *  - chaque cellule `(type, hauteur)` porte le **taux §7 exact agrégé** (Σ efforts
 *    propres / Σ efforts totaux) ; une **Combinaison à 3 éléments** est **sa
 *    propre ligne** au bon dénominateur (× éléments) ;
 *  - **cellule vide ≠ taux nul** : une case sans donnée est **absente** ; une case
 *    à 0 % est **présente** (`taux = 0`) — distinguées ;
 *  - **périmètre** : **Plat, Concours et `déclaratif`** sont **exclus** ; la
 *    **couche contexte** (ressenti/énergie/note) n'est **jamais agrégée** ;
 *  - **refusé au gratuit** (garde 4.1, capacité `analytique_diagnostic`) → 403 ;
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
  await new Promise((r) => setTimeout(r, 5));
  return res.body.id as string;
}

interface CelluleHeatmap {
  type: string;
  hauteur: number;
  taux: number;
  efforts_propres: number;
  efforts_totaux: number;
  n_obstacles: number;
}

// biome-ignore lint/suspicious/noExplicitAny: réponse heatmap typée au runtime.
async function getHeatmap(a: TestAccount, chevalId: string): Promise<any> {
  const res = await (await http())
    .get(`/horses/${chevalId}/heatmap`)
    .set('Authorization', `Bearer ${a.accessToken}`)
    .expect(200);
  return res.body;
}

/** Retrouve la cellule `(type, hauteur)`, ou `undefined` si pas de donnée. */
function cellule(
  cells: CelluleHeatmap[],
  type: string,
  hauteur: number,
): CelluleHeatmap | undefined {
  return cells.find((c) => c.type === type && c.hauteur === hauteur);
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

describe('GET /horses/:id/heatmap — état vide', () => {
  it('renvoie une heatmap vide quand aucune séance à obstacle', async () => {
    const a = await registerWithTier('h-empty@hpt.test', 'premium');
    const chevalId = await createHorse(a, 'Vide');
    const h = await getHeatmap(a, chevalId);
    expect(h).toEqual({ cheval_id: chevalId, types: [], hauteurs: [], cellules: [] });
  });
});

describe('GET /horses/:id/heatmap — taux §7 exact, Combinaison sa propre ligne (DoD)', () => {
  it('agrège le taux exact par cellule et sort la Combinaison au bon dénominateur', async () => {
    const a = await registerWithTier('h-dod@hpt.test', 'premium');
    const chevalId = await createHorse(a, 'Quibelle');

    // Oxer 100 sur deux obstacles/séances : propres (4−1)+2 = 5 ; totaux 4+2 = 6.
    await createSession(a, chevalId, {
      type: 'Gymnastique',
      obstacles: [{ type: 'Oxer', hauteur: 100, répétitions: 4, barres: 1, refus: 0 }],
    });
    await createSession(a, chevalId, {
      type: 'Parcours',
      obstacles: [{ type: 'Oxer', hauteur: 100, répétitions: 2, barres: 0, refus: 0 }],
    });
    // Vertical 110 entièrement fauté → présent, taux 0 (0 % ≠ pas de donnée).
    await createSession(a, chevalId, {
      type: 'Gymnastique',
      obstacles: [{ type: 'Vertical', hauteur: 110, répétitions: 3, barres: 3, refus: 0 }],
    });
    // Combinaison à 3 éléments @120 : dénominateur = 2×3 = 6 ; propres = 6−1 = 5.
    await createSession(a, chevalId, {
      type: 'Parcours',
      obstacles: [
        {
          type: 'Combinaison',
          hauteur: 120,
          répétitions: 2,
          barres: 1,
          refus: 0,
          nombre_d_éléments: 3,
        },
      ],
    });

    const h = await getHeatmap(a, chevalId);
    const cells = h.cellules as CelluleHeatmap[];

    // Cellule Oxer/100 : taux exact 5/6, volume agrégé (2 obstacles, 6 efforts).
    const oxer = cellule(cells, 'Oxer', 100);
    expect(oxer).toMatchObject({ efforts_propres: 5, efforts_totaux: 6, n_obstacles: 2 });
    expect(oxer?.taux).toBeCloseTo(5 / 6, 10);

    // Combinaison = **sa propre ligne**, dénominateur × éléments (6), taux 5/6.
    const combi = cellule(cells, 'Combinaison', 120);
    expect(combi).toMatchObject({ efforts_propres: 5, efforts_totaux: 6, n_obstacles: 1 });
    expect(combi?.taux).toBeCloseTo(5 / 6, 10);

    // Lignes = types présents (référentiel : Combinaison en dernier) ; colonnes croissantes.
    expect(h.types).toEqual(['Vertical', 'Oxer', 'Combinaison']);
    expect(h.hauteurs).toEqual([100, 110, 120]);
  });
});

describe('GET /horses/:id/heatmap — cellule vide ≠ taux nul (DoD)', () => {
  it('distingue une case à 0 % (présente) d’une case sans donnée (absente)', async () => {
    const a = await registerWithTier('h-zero@hpt.test', 'premium');
    const chevalId = await createHorse(a, 'Sobre');
    await createSession(a, chevalId, {
      type: 'Gymnastique',
      obstacles: [{ type: 'Vertical', hauteur: 110, répétitions: 3, barres: 3, refus: 0 }],
    });

    const h = await getHeatmap(a, chevalId);
    const cells = h.cellules as CelluleHeatmap[];

    // 0 % : cellule **présente** avec de la donnée (n_obstacles ≥ 1), taux 0.
    const zéro = cellule(cells, 'Vertical', 110);
    expect(zéro?.taux).toBe(0);
    expect(zéro?.n_obstacles).toBe(1);
    // Pas de donnée : la case n'existe pas (l'UI rendra « — »).
    expect(cellule(cells, 'Oxer', 150)).toBeUndefined();
  });
});

describe('GET /horses/:id/heatmap — périmètre : Plat/Concours/déclaratif exclus, contexte jamais agrégé', () => {
  it('n’agrège que les obstacles d’entraînement `live`, contexte ignoré', async () => {
    const a = await registerWithTier('h-scope@hpt.test', 'premium');
    const chevalId = await createHorse(a, 'Cadre');

    // Entraînement live @100 AVEC un contexte (ressenti/énergie/note) : la donnée
    // objective compte, la couche contexte ne doit RIEN changer (Modèle §1).
    await createSession(a, chevalId, {
      type: 'Gymnastique',
      obstacles: [{ type: 'Oxer', hauteur: 100, répétitions: 2, barres: 0, refus: 0 }],
      contexte: { ressenti_global: 5, énergie: 4, note: 'super forme' },
    });
    // Plat : régularité seule, 0 obstacle → aucune cellule.
    await createSession(a, chevalId, { type: 'Plat' });
    // Concours @130 : des **tours** (pas de type d'obstacle) → hors heatmap.
    await createSession(a, chevalId, {
      type: 'Concours',
      tours: [{ hauteur: 130, barres: 0, refus: 0 }],
    });
    // Déclaratif d'entraînement @140 : nourrit le feed mais EXCLU des agrégats (§2).
    await createSession(a, chevalId, {
      type: 'Parcours',
      provenance: 'déclaratif',
      obstacles: [{ type: 'Oxer', hauteur: 140, répétitions: 3, barres: 0, refus: 0 }],
    });

    const h = await getHeatmap(a, chevalId);
    const cells = h.cellules as CelluleHeatmap[];

    // Seul l'Oxer 100 live figure : une cellule, taux 1 (2/2), contexte sans effet.
    expect(cells).toHaveLength(1);
    const oxer = cellule(cells, 'Oxer', 100);
    expect(oxer).toMatchObject({ taux: 1, efforts_propres: 2, efforts_totaux: 2, n_obstacles: 1 });
    // Ni le Concours @130 ni le déclaratif @140 n'apparaissent en colonne.
    expect(h.hauteurs).toEqual([100]);
    expect(h.types).toEqual(['Oxer']);
  });
});

describe('GET /horses/:id/heatmap — gating & autorisation', () => {
  it('refuse le compte GRATUIT (garde 4.1, capacité analytique_diagnostic) → 403', async () => {
    const gratuit = await registerAndLogin('h-gratuit@hpt.test');
    const chevalId = await createHorse(gratuit, 'Gratos');
    await createSession(gratuit, chevalId, {
      type: 'Gymnastique',
      obstacles: [{ type: 'Oxer', hauteur: 100, répétitions: 2, barres: 0, refus: 0 }],
    });

    await (await http())
      .get(`/horses/${chevalId}/heatmap`)
      .set('Authorization', `Bearer ${gratuit.accessToken}`)
      .expect(403);
  });

  it('exige un jeton (401) et refuse le cheval d’un autre compte (404)', async () => {
    const a = await registerWithTier('h-owner@hpt.test', 'premium');
    const b = await registerWithTier('h-intrus@hpt.test', 'premium');
    const chevalId = await createHorse(a, 'AChev');
    await createSession(a, chevalId, {
      type: 'Gymnastique',
      obstacles: [{ type: 'Oxer', hauteur: 100, répétitions: 2, barres: 0, refus: 0 }],
    });

    await (await http()).get(`/horses/${chevalId}/heatmap`).expect(401);
    await (await http())
      .get(`/horses/${chevalId}/heatmap`)
      .set('Authorization', `Bearer ${b.accessToken}`)
      .expect(404);

    // Le propriétaire premium voit bien sa heatmap.
    const h = await getHeatmap(a, chevalId);
    expect(h.cheval_id).toBe(chevalId);
  });
});
