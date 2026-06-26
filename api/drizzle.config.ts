import { defineConfig } from 'drizzle-kit';

/**
 * Configuration drizzle-kit (lot 0.3). `generate` lit le schéma et émet le SQL
 * dans `./drizzle` ; `migrate` applique les migrations sur la base pointée par
 * `DATABASE_URL`.
 *
 * En dev local, la base est le Postgres du `docker-compose` (lot 0.1) ; à
 * défaut de `DATABASE_URL`, on retombe sur l'URL de `.env.example` pour que les
 * commandes restent ergonomiques. Aucun secret n'est commité.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://hpt:hpt@localhost:5432/hpt',
  },
});
