import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type {
  BilanAugmentéGénéré,
  ContexteBilanIA,
  MistralPort,
} from '../../src/ai-bilan/mistral.port';
import { MISTRAL } from '../../src/ai-bilan/mistral.port';

/**
 * Preuve **de bout en bout** de la DoD du lot 4.5 (module `ai-bilan` : le
 * **bilan augmenté** par l'assistant IA) sur un Postgres réel. On enregistre des
 * séances via l'API 2.2, puis on exerce `/sessions/:id/ai-bilan` et
 * `/horses/:id/ai-bilan`, avec le **client Mistral moqué** (consigne : le sandbox
 * n'atteint pas Mistral, et on veut **compter les appels IA**). On vérifie :
 *
 *  - **générer sur demande** (premium/pro) un bilan augmenté **persisté**, avec
 *    **modèle + version épinglés** enregistrés et **disclaimer** présent ;
 *  - **relire sans régénérer** : GET et re-POST ne déclenchent **aucun** nouvel
 *    appel IA (compteur du client moqué inchangé) ;
 *  - **refusé au gratuit** (garde 4.1, capacité `bilan_augmenté`) → 403 ;
 *  - **slot ✦** : `/horses/:id/ai-bilan` liste **uniquement** les séances qui ont
 *    un bilan ;
 *  - **rate limiting** effectif (429 au-delà du plafond par utilisateur) ;
 *  - la sortie **n'alimente aucune métrique** (séances + métriques inchangées) ;
 *  - **autorisation** : séance/cheval d'un autre compte → 404 ; sans jeton → 401.
 *
 * Hors `pnpm test` (exige une base) : tourne via `pnpm db:verify`.
 */

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://hpt:hpt@localhost:5432/hpt';
process.env.DATABASE_URL = DATABASE_URL;
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret';
// Rate limit bas pour prouver le garde-fou sans générer des dizaines de séances.
process.env.AI_BILAN_RATE_LIMIT = '2';

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));
const pool = new Pool({ connectionString: DATABASE_URL });

let app: INestApplication;

/**
 * **Client Mistral moqué** — implémente le port, **compte les appels** (preuve
 * « relire sans régénérer ») et renvoie un modèle/version épinglés + un texte
 * déterministe. Aucun réseau (comme le stub, mais instrumenté pour le test).
 */
class CountingMistral implements MistralPort {
  appels = 0;
  async générerBilan(contexte: ContexteBilanIA): Promise<BilanAugmentéGénéré> {
    this.appels += 1;
    return {
      modèle: 'mistral-small',
      version: 'mistral-small-2409',
      analyse: `Analyse de la séance ${contexte.dernière.type} (appel #${this.appels}).`,
      recommandations: 'Recommandation pour la prochaine séance.',
    };
  }
}
const fakeMistral = new CountingMistral();

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

async function createSession(a: TestAccount, chevalId: string): Promise<string> {
  const res = await (await http())
    .post(`/horses/${chevalId}/sessions`)
    .set('Authorization', `Bearer ${a.accessToken}`)
    .send({
      idempotency_key: randomUUID(),
      type: 'Gymnastique',
      obstacles: [{ type: 'Oxer', hauteur: 110, répétitions: 5, barres: 0, refus: 0 }],
    })
    .expect(201);
  // Décale légèrement les dates métier pour un ordre stable de l'historique.
  await new Promise((r) => setTimeout(r, 15));
  return res.body.id as string;
}

beforeAll(async () => {
  await pool.query('DROP SCHEMA IF EXISTS public CASCADE;');
  await pool.query('CREATE SCHEMA public;');
  await pool.query('DROP SCHEMA IF EXISTS drizzle CASCADE;');
  await migrate(drizzle(pool), { migrationsFolder });

  const { AppModule } = await import('../../src/app.module');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    // Client IA **moqué** (consigne) : instrumenté pour compter les appels.
    .overrideProvider(MISTRAL)
    .useValue(fakeMistral)
    .compile();
  app = moduleRef.createNestApplication();
  await app.init();
}, 60000);

afterAll(async () => {
  await app?.close();
  await pool.end();
});

describe('POST /sessions/:id/ai-bilan — générer sur demande, persisté, relu sans régénérer (DoD)', () => {
  it('génère (premium), persiste modèle+version+disclaimer, et NE régénère PAS à la relecture', async () => {
    const a = await registerWithTier('ai-premium@hpt.test', 'premium');
    const chevalId = await createHorse(a, 'Quibelle');
    const seanceId = await createSession(a, chevalId);

    const avant = fakeMistral.appels;

    // Génération à la demande.
    const gen = await (await http())
      .post(`/sessions/${seanceId}/ai-bilan`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .expect(201);
    expect(fakeMistral.appels).toBe(avant + 1); // un appel IA

    // Contenu consultatif + modèle/version ÉPINGLÉS persistés + disclaimer présent.
    expect(gen.body.seance_id).toBe(seanceId);
    expect(gen.body.modèle).toBe('mistral-small');
    expect(gen.body.version).toBe('mistral-small-2409');
    expect(gen.body.version).not.toContain('latest');
    expect(gen.body.contenu.analyse).toContain('Analyse');
    expect(gen.body.contenu.recommandations.length).toBeGreaterThan(0);
    expect(typeof gen.body.disclaimer).toBe('string');
    expect(gen.body.disclaimer).toMatch(/IA/);
    expect(gen.body.disclaimer).toMatch(/vétérinaire/);

    // Persisté en base (une ligne pour la séance).
    const rows = await pool.query(
      'SELECT modele, version FROM bilan_augmente WHERE seance_id = $1',
      [seanceId],
    );
    expect(rows.rowCount).toBe(1);
    expect(rows.rows[0].modele).toBe('mistral-small');
    expect(rows.rows[0].version).toBe('mistral-small-2409');

    // Relecture GET : aucun nouvel appel IA (Spec §7.3).
    const relu = await (await http())
      .get(`/sessions/${seanceId}/ai-bilan`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .expect(200);
    expect(relu.body.contenu.analyse).toBe(gen.body.contenu.analyse);
    expect(fakeMistral.appels).toBe(avant + 1); // toujours un seul appel

    // Re-POST (get-or-create) : renvoie l'existant, toujours aucun nouvel appel.
    const regen = await (await http())
      .post(`/sessions/${seanceId}/ai-bilan`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .expect(201);
    expect(regen.body.id).toBe(gen.body.id);
    expect(fakeMistral.appels).toBe(avant + 1);
  });

  it('la sortie n’alimente AUCUNE métrique (séances & métriques inchangées)', async () => {
    const a = await registerWithTier('ai-nometric@hpt.test', 'premium');
    const chevalId = await createHorse(a, 'Isard');
    const seanceId = await createSession(a, chevalId);

    const sessionsAvant = await (await http())
      .get(`/horses/${chevalId}/sessions`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .expect(200);
    const metricsAvant = await (await http())
      .get(`/horses/${chevalId}/metrics`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .expect(200);

    await (await http())
      .post(`/sessions/${seanceId}/ai-bilan`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .expect(201);

    const sessionsAprès = await (await http())
      .get(`/horses/${chevalId}/sessions`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .expect(200);
    const metricsAprès = await (await http())
      .get(`/horses/${chevalId}/metrics`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .expect(200);

    // Aucune séance créée par la génération ; métriques identiques (texte ≠ agrégat).
    expect(sessionsAprès.body).toHaveLength(sessionsAvant.body.length);
    expect(metricsAprès.body.maîtrise.courante).toBe(metricsAvant.body.maîtrise.courante);
  });
});

describe('GET /horses/:id/ai-bilan — disponibilité (slot ✦ de l’Historique)', () => {
  it('ne liste que les séances possédant un bilan augmenté', async () => {
    const a = await registerWithTier('ai-availability@hpt.test', 'pro');
    const chevalId = await createHorse(a, 'Sirocco');
    const avecBilan = await createSession(a, chevalId);
    const sansBilan = await createSession(a, chevalId);

    await (await http())
      .post(`/sessions/${avecBilan}/ai-bilan`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .expect(201);

    const dispo = await (await http())
      .get(`/horses/${chevalId}/ai-bilan`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .expect(200);

    expect(dispo.body.cheval_id).toBe(chevalId);
    expect(dispo.body.seance_ids).toContain(avecBilan);
    expect(dispo.body.seance_ids).not.toContain(sansBilan);
  });
});

describe('ai-bilan — rate limiting (garde-fou de coût, Stack §3.6)', () => {
  it('refuse au-delà du plafond par utilisateur (429), la relecture restant possible', async () => {
    const a = await registerWithTier('ai-ratelimit@hpt.test', 'pro');
    const chevalId = await createHorse(a, 'Vahiné');
    const s1 = await createSession(a, chevalId);
    const s2 = await createSession(a, chevalId);
    const s3 = await createSession(a, chevalId);

    // Plafond = 2 générations : s1, s2 OK ; s3 → 429.
    await (await http())
      .post(`/sessions/${s1}/ai-bilan`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .expect(201);
    await (await http())
      .post(`/sessions/${s2}/ai-bilan`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .expect(201);
    await (await http())
      .post(`/sessions/${s3}/ai-bilan`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .expect(429);

    // Une relecture ne consomme rien : s1 reste lisible malgré le plafond atteint.
    await (await http())
      .get(`/sessions/${s1}/ai-bilan`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .expect(200);
  });
});

describe('ai-bilan — gating & autorisation', () => {
  it('refuse le compte GRATUIT (garde 4.1, capacité bilan_augmenté) → 403', async () => {
    const gratuit = await registerAndLogin('ai-gratuit@hpt.test');
    const chevalId = await createHorse(gratuit, 'Gratos');
    const seanceId = await createSession(gratuit, chevalId);

    await (await http())
      .post(`/sessions/${seanceId}/ai-bilan`)
      .set('Authorization', `Bearer ${gratuit.accessToken}`)
      .expect(403);
    await (await http())
      .get(`/sessions/${seanceId}/ai-bilan`)
      .set('Authorization', `Bearer ${gratuit.accessToken}`)
      .expect(403);
    await (await http())
      .get(`/horses/${chevalId}/ai-bilan`)
      .set('Authorization', `Bearer ${gratuit.accessToken}`)
      .expect(403);
  });

  it('404 pour une séance qui n’a pas de bilan (relecture)', async () => {
    const a = await registerWithTier('ai-404@hpt.test', 'premium');
    const chevalId = await createHorse(a, 'Neige');
    const seanceId = await createSession(a, chevalId);
    await (await http())
      .get(`/sessions/${seanceId}/ai-bilan`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .expect(404);
  });

  it('exige un jeton (401) et refuse la séance/le cheval d’un autre compte (404)', async () => {
    const a = await registerWithTier('ai-owner@hpt.test', 'premium');
    const b = await registerWithTier('ai-intrus@hpt.test', 'premium');
    const chevalId = await createHorse(a, 'AChev');
    const seanceId = await createSession(a, chevalId);

    await (await http()).post(`/sessions/${seanceId}/ai-bilan`).expect(401);
    await (await http())
      .post(`/sessions/${seanceId}/ai-bilan`)
      .set('Authorization', `Bearer ${b.accessToken}`)
      .expect(404);
    await (await http())
      .get(`/horses/${chevalId}/ai-bilan`)
      .set('Authorization', `Bearer ${b.accessToken}`)
      .expect(404);
  });
});
