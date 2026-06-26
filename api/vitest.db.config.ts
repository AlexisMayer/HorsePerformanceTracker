import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * Config Vitest **dédiée aux tests de base de données** (lot 0.3). Séparée de
 * `vitest.config.ts` (tests unitaires, `src/**`) pour que `pnpm test` — donc la
 * CI sans Postgres — reste vert : ces specs requièrent une base réelle.
 *
 * Lancée par `pnpm db:verify` ; en CI, par le job doté du service Postgres.
 * `DATABASE_URL` pointe le Postgres du `docker-compose` (lot 0.1).
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/db/**/*.spec.ts'],
    root: './',
    // Reset + application de migration : on laisse de la marge.
    hookTimeout: 60000,
    testTimeout: 60000,
    // Une seule base partagée → pas de parallélisme entre fichiers.
    fileParallelism: false,
  },
  // SWC transpile les imports ESM (`@hpt/shared`) et les décorateurs comme au run.
  plugins: [swc.vite()],
});
