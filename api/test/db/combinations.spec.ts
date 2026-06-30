import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PLAFOND_COMBINAISONS_GRATUIT, tauxCombinaison } from '@hpt/shared';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Preuve **de bout en bout** de la DoD du lot 2.5 (module `combinations` :
 * bibliothèque réutilisable au niveau du compte + instanciation depuis une
 * séance) sur un Postgres réel. On applique les migrations (socle 0.3 + auth
 * 1.1/1.2 + idempotence 2.2 + **combinaisons 0004**), on démarre l'app NestJS,
 * puis on exerce :
 *
 *  - **Enregistrer** une réutilisable (depuis un détail / directement), scopée
 *    au **compte** ; auto-nommage ;
 *  - **Instancier** dans une séance en **ne saisissant que la hauteur** :
 *    `éléments` **hérités** (null inline), `nombre_d_éléments` **copié inline**,
 *    **taux combinaison exact** (formule §7) ;
 *  - **Modifier = nouvelle** : l'ancienne reste inchangée (identité stable) ;
 *  - **Portée compte** : une même réutilisable instanciée sur **deux chevaux** ;
 *  - **Liste triée par usage** (anti-bloat) ;
 *  - **Suppression** → obstacles liés **`SET NULL`** sans casser leur taux ;
 *  - **Autorisation** : pas d'instanciation/lecture/édition d'un autre compte ;
 *  - **Migration additive** (table + colonne + FK) appliquée.
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

/**
 * Inscrit un compte **à un tier donné** (on pose `tier` sur Compte après
 * l'inscription, faute d'endpoint d'upgrade avant 4.2) puis connecte → le claim
 * d'access **porte le tier** (entitlement lu au login). Pour les scénarios pro
 * (plusieurs chevaux) et de plafond de bibliothèque (premium/pro illimités).
 */
async function registerWithTier(email: string, tier: 'premium' | 'pro'): Promise<TestAccount> {
  const password = 'motdepasse-solide';
  const reg = await (await http())
    .post('/auth/register')
    .send({ email, nom: 'Cavalier', password, type: 'amateur' })
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

function auth(a: TestAccount) {
  return { Authorization: `Bearer ${a.accessToken}` };
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

describe('migration 0004 (combinaisons) appliquée', () => {
  it('crée la table combinaison avec ses colonnes (techniques + domaine + usage)', async () => {
    const { rows } = await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'combinaison'`,
    );
    const present = rows.map((r) => r.column_name);
    for (const c of [
      'id',
      'created_at',
      'updated_at',
      'compte_id',
      'nom',
      'nombre_d_elements',
      'elements',
      'usage_count',
      'last_used_at',
    ]) {
      expect(present, `combinaison.${c}`).toContain(c);
    }
  });

  it('ajoute obstacle.combinaison_ref (nullable)', async () => {
    const { rows } = await pool.query<{ is_nullable: string }>(
      `SELECT is_nullable FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'obstacle' AND column_name = 'combinaison_ref'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].is_nullable).toBe('YES');
  });

  it('câble combinaison.compte_id en CASCADE et obstacle.combinaison_ref en SET NULL', async () => {
    const { rows } = await pool.query<{
      table_name: string;
      column_name: string;
      foreign_table_name: string;
      delete_rule: string;
    }>(
      `SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table_name, rc.delete_rule
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
       JOIN information_schema.referential_constraints rc
         ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema
       JOIN information_schema.constraint_column_usage ccu
         ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
       WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
         AND ((tc.table_name = 'combinaison' AND kcu.column_name = 'compte_id')
           OR (tc.table_name = 'obstacle' AND kcu.column_name = 'combinaison_ref'))`,
    );
    const combo = rows.find((r) => r.table_name === 'combinaison');
    expect(combo?.foreign_table_name).toBe('compte');
    expect(combo?.delete_rule).toBe('CASCADE');
    const obst = rows.find((r) => r.table_name === 'obstacle');
    expect(obst?.foreign_table_name).toBe('combinaison');
    expect(obst?.delete_rule).toBe('SET NULL');
  });
});

describe('POST /combinations (bibliothèque de compte)', () => {
  it('exige l’authentification (401 sans jeton)', async () => {
    await (await http())
      .post('/combinations')
      .send({ nombre_d_éléments: 2, éléments: ['Vertical', 'Oxer'] })
      .expect(401);
  });

  it('enregistre une réutilisable scopée au compte, auto-nommée si nom absent', async () => {
    const a = await registerAndLogin('cb-create@hpt.test');
    const res = await (await http())
      .post('/combinations')
      .set(auth(a))
      .send({ nombre_d_éléments: 3, éléments: ['Oxer', 'Oxer', 'Oxer'] })
      .expect(201);

    expect(res.body.compte_id).toBe(a.compteId);
    expect(res.body.nom).toBe('Triple oxer'); // auto-nommage (Spec §4.3)
    expect(res.body.nombre_d_éléments).toBe(3);
    expect(res.body.éléments).toEqual(['Oxer', 'Oxer', 'Oxer']);
    expect(res.body.usage_count).toBe(0);
  });

  it('respecte un nom fourni et exige une structure cohérente', async () => {
    const a = await registerAndLogin('cb-name@hpt.test');
    const named = await (await http())
      .post('/combinations')
      .set(auth(a))
      .send({ nom: 'Mon combo', nombre_d_éléments: 2, éléments: ['Vertical', 'Mur'] })
      .expect(201);
    expect(named.body.nom).toBe('Mon combo');

    // Cardinalité incohérente → 400 à la frontière Zod.
    await (await http())
      .post('/combinations')
      .set(auth(a))
      .send({ nombre_d_éléments: 3, éléments: ['Vertical', 'Mur'] })
      .expect(400);
  });
});

describe('instanciation dans une séance (on ne saisit que la hauteur)', () => {
  it('copie nombre_d_éléments inline, hérite éléments (null), garde un taux exact', async () => {
    const a = await registerAndLogin('cb-inst@hpt.test');
    const chevalId = await createHorse(a, 'Eclipse');
    const combo = await (await http())
      .post('/combinations')
      .set(auth(a))
      .send({ nombre_d_éléments: 2, éléments: ['Vertical', 'Oxer'] })
      .expect(201);

    // « On ne renseigne que la hauteur (+ répétitions, fautes) » — pas de
    // nombre_d_éléments ni éléments dans le corps de l'obstacle.
    const séance = await (await http())
      .post(`/horses/${chevalId}/sessions`)
      .set(auth(a))
      .send({
        type: 'Parcours',
        idempotency_key: randomUUID(),
        obstacles: [
          {
            type: 'Combinaison',
            hauteur: 115,
            répétitions: 3,
            barres: 2,
            refus: 0,
            combinaison_ref: combo.body.id,
          },
        ],
      })
      .expect(201);

    const obst = séance.body.obstacles[0];
    expect(obst.combinaison_ref).toBe(combo.body.id);
    expect(obst.nombre_d_éléments).toBe(2); // copié inline depuis la réutilisable
    expect(obst.éléments).toBeNull(); // hérité via la ref (non dupliqué)

    // Taux exact (formule §7) : (rép×éléments − barres − refus)/(rép×éléments)
    //                          = (3×2 − 2 − 0)/(3×2) = 4/6.
    const attendu = tauxCombinaison({ répétitions: 3, nombre_d_éléments: 2, barres: 2, refus: 0 });
    expect(attendu).toBeCloseTo(4 / 6, 10);
    const taux = tauxCombinaison({
      répétitions: obst.répétitions,
      nombre_d_éléments: obst.nombre_d_éléments,
      barres: obst.barres,
      refus: obst.refus,
    });
    expect(taux).toBeCloseTo(4 / 6, 10);
  });

  it('refuse une structure inline fournie avec une combinaison_ref (400)', async () => {
    const a = await registerAndLogin('cb-inst-bad@hpt.test');
    const chevalId = await createHorse(a, 'Pampa');
    const combo = await (await http())
      .post('/combinations')
      .set(auth(a))
      .send({ nombre_d_éléments: 2, éléments: ['Vertical', 'Oxer'] })
      .expect(201);

    await (await http())
      .post(`/horses/${chevalId}/sessions`)
      .set(auth(a))
      .send({
        type: 'Parcours',
        idempotency_key: randomUUID(),
        obstacles: [
          {
            type: 'Combinaison',
            hauteur: 115,
            combinaison_ref: combo.body.id,
            nombre_d_éléments: 2, // interdit : copié par le serveur
          },
        ],
      })
      .expect(400);
  });
});

describe('portée compte : une réutilisable instanciée sur plusieurs chevaux', () => {
  it('rejoue la même combinaison sur deux chevaux du compte (usage += 2)', async () => {
    // Deux chevaux sur un même compte ⇒ pro (multi-chevaux, quota 4.1).
    const a = await registerWithTier('cb-scope@hpt.test', 'pro');
    const chevalA = await createHorse(a, 'ChevalA');
    const chevalB = await createHorse(a, 'ChevalB');
    const combo = await (await http())
      .post('/combinations')
      .set(auth(a))
      .send({ nom: 'Double partagé', nombre_d_éléments: 2, éléments: ['Croix', 'Vertical'] })
      .expect(201);

    for (const chevalId of [chevalA, chevalB]) {
      await (await http())
        .post(`/horses/${chevalId}/sessions`)
        .set(auth(a))
        .send({
          type: 'Parcours',
          idempotency_key: randomUUID(),
          obstacles: [{ type: 'Combinaison', hauteur: 110, combinaison_ref: combo.body.id }],
        })
        .expect(201);
    }

    // Deux obstacles, sur deux chevaux distincts, pointent la même réutilisable.
    expect(
      await count(
        `SELECT count(DISTINCT s.cheval_id)::text AS n FROM obstacle o
         JOIN seance s ON s.id = o.seance_id WHERE o.combinaison_ref = $1`,
        [combo.body.id],
      ),
    ).toBe(2);

    // L'usage a été compté deux fois (anti-bloat).
    const list = await (await http()).get('/combinations').set(auth(a)).expect(200);
    const seen = list.body.find((c: { id: string }) => c.id === combo.body.id);
    expect(seen.usage_count).toBe(2);
  });
});

describe('GET /combinations triée par usage (anti-bloat, Spec §4.3)', () => {
  it('classe les plus utilisées d’abord, puis les récemment créées', async () => {
    const a = await registerAndLogin('cb-sort@hpt.test');
    const chevalId = await createHorse(a, 'Trieur');
    const mk = async (nom: string) =>
      (
        await (
          await http()
        )
          .post('/combinations')
          .set(auth(a))
          .send({ nom, nombre_d_éléments: 2, éléments: ['Vertical', 'Oxer'] })
          .expect(201)
      ).body.id as string;

    const peu = await mk('Peu utilisée');
    const beaucoup = await mk('Beaucoup utilisée');
    const jamais = await mk('Jamais utilisée');

    const instancier = async (ref: string) =>
      (await http())
        .post(`/horses/${chevalId}/sessions`)
        .set(auth(a))
        .send({
          type: 'Parcours',
          idempotency_key: randomUUID(),
          obstacles: [{ type: 'Combinaison', hauteur: 110, combinaison_ref: ref }],
        })
        .expect(201);

    await instancier(peu); // usage 1
    await instancier(beaucoup); // usage 1
    await instancier(beaucoup); // usage 2
    await instancier(beaucoup); // usage 3

    const list = await (await http()).get('/combinations').set(auth(a)).expect(200);
    const ids = list.body.map((c: { id: string }) => c.id);
    // beaucoup (3) > peu (1) > jamais (0, mais créée en dernier → tête de bloc 0).
    expect(ids.indexOf(beaucoup)).toBeLessThan(ids.indexOf(peu));
    expect(ids.indexOf(peu)).toBeLessThan(ids.indexOf(jamais));
  });
});

describe('modification = nouvelle (identité stable, Modèle §8)', () => {
  it('PATCH crée une nouvelle combinaison ; l’ancienne reste inchangée', async () => {
    const a = await registerAndLogin('cb-mod@hpt.test');
    const ancienne = await (await http())
      .post('/combinations')
      .set(auth(a))
      .send({ nom: 'Originale', nombre_d_éléments: 2, éléments: ['Vertical', 'Oxer'] })
      .expect(201);

    const nouvelle = await (await http())
      .patch(`/combinations/${ancienne.body.id}`)
      .set(auth(a))
      .send({ éléments: ['Oxer', 'Oxer', 'Mur'], nombre_d_éléments: 3 })
      .expect(200);

    // Nouvelle identité, nouvelle structure, usage repart de zéro.
    expect(nouvelle.body.id).not.toBe(ancienne.body.id);
    expect(nouvelle.body.nombre_d_éléments).toBe(3);
    expect(nouvelle.body.usage_count).toBe(0);

    // L'ancienne est INTACTE en base (id, structure) — benchmark fiable (5.2).
    const { rows } = await pool.query<{ nombre_d_elements: number; elements: string[] }>(
      'SELECT nombre_d_elements, elements FROM combinaison WHERE id = $1',
      [ancienne.body.id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].nombre_d_elements).toBe(2);
    expect(rows[0].elements).toEqual(['Vertical', 'Oxer']);
    // Les deux coexistent dans la bibliothèque.
    expect(
      await count('SELECT count(*)::text AS n FROM combinaison WHERE compte_id = $1', [a.compteId]),
    ).toBe(2);
  });

  it('un renommage seul dérive aussi une nouvelle (l’ancienne garde son nom)', async () => {
    const a = await registerAndLogin('cb-rename@hpt.test');
    const ancienne = await (await http())
      .post('/combinations')
      .set(auth(a))
      .send({ nom: 'Avant', nombre_d_éléments: 2, éléments: ['Croix', 'Croix'] })
      .expect(201);
    const nouvelle = await (await http())
      .patch(`/combinations/${ancienne.body.id}`)
      .set(auth(a))
      .send({ nom: 'Après' })
      .expect(200);
    expect(nouvelle.body.id).not.toBe(ancienne.body.id);
    expect(nouvelle.body.nom).toBe('Après');
    expect(nouvelle.body.éléments).toEqual(['Croix', 'Croix']); // structure héritée
    const { rows } = await pool.query<{ nom: string }>(
      'SELECT nom FROM combinaison WHERE id = $1',
      [ancienne.body.id],
    );
    expect(rows[0].nom).toBe('Avant'); // ancienne intacte
  });
});

describe('suppression → obstacles liés SET NULL (taux préservé)', () => {
  it('dé-lie l’obstacle sans casser ses valeurs ni son taux', async () => {
    const a = await registerAndLogin('cb-del@hpt.test');
    const chevalId = await createHorse(a, 'Delie');
    const combo = await (await http())
      .post('/combinations')
      .set(auth(a))
      .send({ nombre_d_éléments: 2, éléments: ['Vertical', 'Oxer'] })
      .expect(201);
    const séance = await (await http())
      .post(`/horses/${chevalId}/sessions`)
      .set(auth(a))
      .send({
        type: 'Parcours',
        idempotency_key: randomUUID(),
        obstacles: [
          {
            type: 'Combinaison',
            hauteur: 120,
            répétitions: 3,
            barres: 2,
            refus: 0,
            combinaison_ref: combo.body.id,
          },
        ],
      })
      .expect(201);
    const obstacleId = séance.body.obstacles[0].id;

    const tauxAvant = tauxCombinaison({
      répétitions: 3,
      nombre_d_éléments: 2,
      barres: 2,
      refus: 0,
    });

    // Supprime la réutilisable.
    await (await http()).delete(`/combinations/${combo.body.id}`).set(auth(a)).expect(204);

    // L'obstacle subsiste, dé-lié (SET NULL), avec ses valeurs et donc son taux.
    const { rows } = await pool.query<{
      combinaison_ref: string | null;
      nombre_d_elements: number;
      repetitions: number;
      barres: number;
      refus: number;
    }>(
      'SELECT combinaison_ref, nombre_d_elements, repetitions, barres, refus FROM obstacle WHERE id = $1',
      [obstacleId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].combinaison_ref).toBeNull(); // lien perdu
    expect(rows[0].nombre_d_elements).toBe(2); // valeur conservée (taux self-contained)
    const tauxAprès = tauxCombinaison({
      répétitions: rows[0].repetitions,
      nombre_d_éléments: rows[0].nombre_d_elements,
      barres: rows[0].barres,
      refus: rows[0].refus,
    });
    expect(tauxAprès).toBe(tauxAvant); // taux inchangé après dé-liaison
    // La réutilisable, elle, a bien disparu.
    expect(
      await count('SELECT count(*)::text AS n FROM combinaison WHERE id = $1', [combo.body.id]),
    ).toBe(0);
  });
});

describe('autorisation (isolation entre comptes)', () => {
  it('refuse d’instancier la réutilisable d’un autre compte (404, sans fuite)', async () => {
    const a = await registerAndLogin('cb-owner-inst@hpt.test');
    const b = await registerAndLogin('cb-intrus-inst@hpt.test');
    const combo = await (await http())
      .post('/combinations')
      .set(auth(a))
      .send({ nombre_d_éléments: 2, éléments: ['Vertical', 'Oxer'] })
      .expect(201);
    const chevalB = await createHorse(b, 'ChevalB');

    await (await http())
      .post(`/horses/${chevalB}/sessions`)
      .set(auth(b))
      .send({
        type: 'Parcours',
        idempotency_key: randomUUID(),
        obstacles: [{ type: 'Combinaison', hauteur: 110, combinaison_ref: combo.body.id }],
      })
      .expect(404);

    // Rien n'a été écrit côté B (la transaction n'a jamais démarré).
    expect(
      await count(`SELECT count(*)::text AS n FROM seance WHERE cheval_id = $1`, [chevalB]),
    ).toBe(0);
  });

  it('refuse de lister/éditer/supprimer la réutilisable d’un autre compte', async () => {
    const a = await registerAndLogin('cb-owner-crud@hpt.test');
    const b = await registerAndLogin('cb-intrus-crud@hpt.test');
    const combo = await (await http())
      .post('/combinations')
      .set(auth(a))
      .send({ nom: 'À moi', nombre_d_éléments: 2, éléments: ['Vertical', 'Oxer'] })
      .expect(201);

    // B ne voit pas la bibliothèque de A.
    const listB = await (await http()).get('/combinations').set(auth(b)).expect(200);
    expect(listB.body).toHaveLength(0);

    // B ne peut ni éditer ni supprimer la réutilisable de A → 404 (pas de fuite).
    await (await http())
      .patch(`/combinations/${combo.body.id}`)
      .set(auth(b))
      .send({ nom: 'Volée' })
      .expect(404);
    await (await http()).delete(`/combinations/${combo.body.id}`).set(auth(b)).expect(404);

    // La réutilisable de A est intacte.
    const { rows } = await pool.query<{ nom: string }>(
      'SELECT nom FROM combinaison WHERE id = $1',
      [combo.body.id],
    );
    expect(rows[0].nom).toBe('À moi');
  });

  it('purge la bibliothèque à la suppression du compte (cascade RGPD)', async () => {
    const a = await registerAndLogin('cb-rgpd@hpt.test');
    await (await http())
      .post('/combinations')
      .set(auth(a))
      .send({ nombre_d_éléments: 2, éléments: ['Vertical', 'Oxer'] })
      .expect(201);
    expect(
      await count('SELECT count(*)::text AS n FROM combinaison WHERE compte_id = $1', [a.compteId]),
    ).toBe(1);

    // Suppression directe du compte → cascade (support structurel RGPD, lot 1.3).
    await pool.query('DELETE FROM compte WHERE id = $1', [a.compteId]);
    expect(
      await count('SELECT count(*)::text AS n FROM combinaison WHERE compte_id = $1', [a.compteId]),
    ).toBe(0);
  });
});

describe('plafond de bibliothèque (gating 4.1 — autorité serveur, Spec §4.4/§8)', () => {
  /** Requête de création d'une réutilisable pour `a` (à compléter par `.expect(...)`). */
  const créer = (a: TestAccount) =>
    request(app.getHttpServer())
      .post('/combinations')
      .set(auth(a))
      .send({ nombre_d_éléments: 2, éléments: ['Vertical', 'Oxer'] });

  it('gratuit : création jusqu’au plafond, au-delà REFUSÉE côté serveur (403)', async () => {
    const a = await registerAndLogin('cb-quota-gratuit@hpt.test');
    for (let i = 0; i < PLAFOND_COMBINAISONS_GRATUIT; i++) {
      await créer(a).expect(201);
    }
    // La (plafond + 1)-ième est refusée.
    await créer(a).expect(403);

    // Refus réel : la bibliothèque reste au plafond, pas de création fantôme.
    const list = await (await http()).get('/combinations').set(auth(a)).expect(200);
    expect(list.body).toHaveLength(PLAFOND_COMBINAISONS_GRATUIT);
  });

  it('gratuit : « modifier = nouvelle » est aussi plafonné (pas de contournement)', async () => {
    const a = await registerAndLogin('cb-quota-patch@hpt.test');
    let dernier = '';
    for (let i = 0; i < PLAFOND_COMBINAISONS_GRATUIT; i++) {
      dernier = (await créer(a).expect(201)).body.id;
    }
    // Au plafond, dériver une nouvelle (PATCH) ajouterait une ligne → refusé.
    await (await http())
      .patch(`/combinations/${dernier}`)
      .set(auth(a))
      .send({ nom: 'Renommée' })
      .expect(403);
    const list = await (await http()).get('/combinations').set(auth(a)).expect(200);
    expect(list.body).toHaveLength(PLAFOND_COMBINAISONS_GRATUIT);
  });

  it('premium & pro : bibliothèque illimitée (au-delà du plafond gratuit → 201)', async () => {
    for (const tier of ['premium', 'pro'] as const) {
      const a = await registerWithTier(`cb-quota-${tier}@hpt.test`, tier);
      const cible = PLAFOND_COMBINAISONS_GRATUIT + 2;
      for (let i = 0; i < cible; i++) {
        await créer(a).expect(201);
      }
      const list = await (await http()).get('/combinations').set(auth(a)).expect(200);
      expect(list.body).toHaveLength(cible);
    }
  });
});
