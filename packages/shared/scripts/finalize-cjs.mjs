import { writeFileSync } from 'node:fs';

/**
 * Le package `@hpt/shared` est `"type": "module"` : sans marqueur, Node lirait
 * les `.js` de `dist/cjs/` comme de l'ESM et casserait les `require(...)` émis
 * par le build CommonJS. On dépose donc un `package.json` local qui requalifie
 * ce sous-dossier en CommonJS — c'est ce que `require('@hpt/shared')` charge
 * (condition d'export `require`), notamment depuis l'`api` NestJS (compilée en
 * CommonJS) à l'exécution. Voir le journal de build, lot 1.1.
 */
writeFileSync(
  new URL('../dist/cjs/package.json', import.meta.url),
  `${JSON.stringify({ type: 'commonjs' }, null, 2)}\n`,
);
