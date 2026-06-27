import { fileURLToPath } from 'node:url';
import {
  NIVEAUX_CHEVAL,
  PROVENANCES,
  TIERS,
  TYPES_COMPTE,
  TYPES_OBSTACLE,
  TYPES_SEANCE,
} from '@hpt/shared';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Preuve par test de la DoD du lot 0.3 : sur un Postgres **réel** (docker-compose
 * du lot 0.1), on **réinitialise** le schéma, on **applique la migration**
 * générée, puis on **constate** la présence des tables, colonnes, enums et des
 * FK en cascade. Un test fonctionnel vérifie enfin que la cascade purge bien
 * toute la descendance d'un compte (support structurel RGPD, lot 1.3).
 *
 * Ce fichier n'est PAS dans `pnpm test` (il exige une base) : il tourne via
 * `pnpm db:verify` (config `vitest.db.config.ts`) et en CI sur le job Postgres.
 */

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://hpt:hpt@localhost:5432/hpt';
const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));

const pool = new Pool({ connectionString: DATABASE_URL });

/** Tables socle attendues + leurs colonnes physiques (noms désaccentués). */
const TABLES: Record<string, string[]> = {
  compte: [
    'id',
    'created_at',
    'updated_at',
    'email',
    'nom',
    'password_hash',
    'email_verified',
    'type',
    'tier',
  ],
  cheval: [
    'id',
    'created_at',
    'updated_at',
    'compte_id',
    'nom',
    'niveau',
    'hauteur_de_reference',
    'age',
    'race',
  ],
  seance: [
    'id',
    'created_at',
    'updated_at',
    'cheval_id',
    'type',
    'date',
    'date_modification',
    'provenance',
  ],
  obstacle: [
    'id',
    'created_at',
    'updated_at',
    'seance_id',
    'type',
    'hauteur',
    'repetitions',
    'barres',
    'refus',
    'difficulte',
    'nombre_d_elements',
    'elements',
  ],
  tour: ['id', 'created_at', 'updated_at', 'seance_id', 'hauteur', 'barres', 'refus'],
  contexte: ['id', 'created_at', 'updated_at', 'seance_id', 'ressenti_global', 'energie', 'note'],
};

/** Enums Postgres attendus, valeurs reprises du référentiel `@hpt/shared`. */
const ENUMS: Record<string, readonly string[]> = {
  compte_type: TYPES_COMPTE,
  compte_tier: TIERS,
  cheval_niveau: NIVEAUX_CHEVAL,
  seance_type: TYPES_SEANCE,
  seance_provenance: PROVENANCES,
  obstacle_type: TYPES_OBSTACLE,
};

/** FK socle attendues, toutes en `ON DELETE CASCADE` (propriété vers le bas). */
const CASCADE_FKS = [
  { table: 'cheval', column: 'compte_id', foreign: 'compte' },
  { table: 'seance', column: 'cheval_id', foreign: 'cheval' },
  { table: 'obstacle', column: 'seance_id', foreign: 'seance' },
  { table: 'tour', column: 'seance_id', foreign: 'seance' },
  { table: 'contexte', column: 'seance_id', foreign: 'seance' },
];

beforeAll(async () => {
  // Application *à partir de zéro* : on prouve que la migration CRÉE le schéma.
  await pool.query('DROP SCHEMA IF EXISTS public CASCADE;');
  await pool.query('CREATE SCHEMA public;');
  await pool.query('DROP SCHEMA IF EXISTS drizzle CASCADE;'); // tracking de migration

  const db = drizzle(pool);
  await migrate(db, { migrationsFolder });
});

afterAll(async () => {
  await pool.end();
});

describe('migration 0.3 appliquée sur Postgres local', () => {
  it('crée les 6 tables socle', async () => {
    const { rows } = await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
    );
    const present = rows.map((r) => r.table_name);
    for (const table of Object.keys(TABLES)) {
      expect(present, `table ${table}`).toContain(table);
    }
  });

  it('crée toutes les colonnes attendues (champs techniques + domaine)', async () => {
    for (const [table, columns] of Object.entries(TABLES)) {
      const { rows } = await pool.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1`,
        [table],
      );
      const present = rows.map((r) => r.column_name);
      for (const column of columns) {
        expect(present, `${table}.${column}`).toContain(column);
      }
    }
  });

  it('crée les 6 enums Postgres avec les valeurs du référentiel `shared`', async () => {
    for (const [name, values] of Object.entries(ENUMS)) {
      const { rows } = await pool.query<{ enumlabel: string }>(
        `SELECT e.enumlabel FROM pg_type t
         JOIN pg_enum e ON e.enumtypid = t.oid
         WHERE t.typname = $1
         ORDER BY e.enumsortorder`,
        [name],
      );
      expect(
        rows.map((r) => r.enumlabel),
        `enum ${name}`,
      ).toEqual([...values]);
    }
  });

  it('câble les FK socle en ON DELETE CASCADE', async () => {
    const { rows } = await pool.query<{
      table_name: string;
      column_name: string;
      foreign_table_name: string;
      delete_rule: string;
    }>(
      `SELECT tc.table_name,
              kcu.column_name,
              ccu.table_name AS foreign_table_name,
              rc.delete_rule
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
       JOIN information_schema.referential_constraints rc
         ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema
       JOIN information_schema.constraint_column_usage ccu
         ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
       WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'`,
    );
    for (const fk of CASCADE_FKS) {
      const match = rows.find((r) => r.table_name === fk.table && r.column_name === fk.column);
      expect(match, `FK ${fk.table}.${fk.column}`).toBeDefined();
      expect(match?.foreign_table_name).toBe(fk.foreign);
      expect(match?.delete_rule).toBe('CASCADE');
    }
  });

  it('encode l’inviolabilité : seance.date NOT NULL, date_modification nullable', async () => {
    const { rows } = await pool.query<{ column_name: string; is_nullable: string }>(
      `SELECT column_name, is_nullable FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'seance'
         AND column_name IN ('date', 'date_modification')`,
    );
    const byName = Object.fromEntries(rows.map((r) => [r.column_name, r.is_nullable]));
    expect(byName.date).toBe('NO');
    expect(byName.date_modification).toBe('YES');
  });

  it('garantit Contexte 0..1 via UNIQUE(seance_id)', async () => {
    const { rows } = await pool.query(
      `SELECT 1 FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
       WHERE tc.table_schema = 'public' AND tc.table_name = 'contexte'
         AND tc.constraint_type = 'UNIQUE' AND kcu.column_name = 'seance_id'`,
    );
    expect(rows.length).toBe(1);
  });

  it('purge toute la descendance d’un compte (ON DELETE CASCADE de bout en bout)', async () => {
    const { rows: c } = await pool.query<{ id: string }>(
      `INSERT INTO compte (email, nom, password_hash, type)
       VALUES ('cascade@hpt.test', 'Cascade', 'x', 'amateur') RETURNING id`,
    );
    const compteId = c[0].id;
    const { rows: h } = await pool.query<{ id: string }>(
      `INSERT INTO cheval (compte_id, nom, niveau, hauteur_de_reference)
       VALUES ($1, 'Eclipse', 'amateur', 110) RETURNING id`,
      [compteId],
    );
    const chevalId = h[0].id;
    const { rows: s } = await pool.query<{ id: string }>(
      `INSERT INTO seance (cheval_id, type, date, provenance, idempotency_key)
       VALUES ($1, 'Parcours', now(), 'live', gen_random_uuid()) RETURNING id`,
      [chevalId],
    );
    const seanceId = s[0].id;
    await pool.query(`INSERT INTO obstacle (seance_id, type, hauteur) VALUES ($1, 'Oxer', 110)`, [
      seanceId,
    ]);
    await pool.query(`INSERT INTO tour (seance_id, hauteur) VALUES ($1, 110)`, [seanceId]);
    await pool.query(`INSERT INTO contexte (seance_id, ressenti_global) VALUES ($1, 4)`, [
      seanceId,
    ]);

    await pool.query(`DELETE FROM compte WHERE id = $1`, [compteId]);

    for (const table of ['cheval', 'seance', 'obstacle', 'tour', 'contexte']) {
      const { rows } = await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM ${table}`);
      expect(rows[0].n, `${table} vidé par la cascade`).toBe('0');
    }
  });
});
