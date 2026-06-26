# Journal de build — Horse Performance Tracker

> Artefact du dépôt (distinct du cadrage). **Append-only** : une entrée par lot
> livré — lot · date · décisions tranchées (et pourquoi) · écarts vs cadrage ·
> points laissés ouverts. Sert la relecture et la continuité entre agents.

---

## Lot 0.1 — Monorepo & outillage · 2026-06-26

Fondation du dépôt : squelette monorepo + outillage. Aucune logique métier,
aucune entité, aucune auth — uniquement la fondation sur laquelle s'appuient les
lots suivants.

### Décisions tranchées (versions exactes)

- **Gestionnaire de paquets** : pnpm `10.33.0` (épinglé via `packageManager`),
  workspaces `app`, `api`, `packages/*` (`pnpm-workspace.yaml`).
- **Node** : cible **20 LTS** — `engines.node >=20`, `.nvmrc=20`, CI sur Node 20.
  (Le bac à sable de build tourne sous Node 22 ; la cible de dev/CI reste 20.)
- **TypeScript** : `6.0.3`, **unifié sur tout le monorepo**. C'est la ligne
  qu'épingle Expo SDK 56 ; l'unifier garantit que les `.d.ts` de React Native /
  Expo se parsent, et NestJS 11 compile sans souci une fois la résolution
  dépréciée évitée (voir plus bas).
- **Lint/format** : Biome `2.5.1`, config unique à la racine (`biome.json`),
  formatter (single quotes, trailing commas, largeur 100) + linter recommandé +
  organisation d'imports via `assist`. Respecte `.gitignore` (vcs.useIgnoreFile).
- **Tests** : Vitest `3.2.6`, une config par package (node env). L'API utilise
  `unplugin-swc` pour conserver les métadonnées de décorateurs Nest au test,
  comme au build.
- **API** : NestJS `11.1.27` (plateforme Express), module `health` →
  `GET /health` 200 `{ status: 'ok' }`, organisé **par domaine** (dossier
  `src/health/`, pas de découpage par couche). Build via `nest build`.
- **App** : Expo SDK `56.0.x` (React `19.2.3`, React Native `0.85.3`),
  **Expo Router** `56.x` (routes dans `src/app/`), **TanStack Query** v5 câblé
  dans le layout racine. Typecheck via `tsc --noEmit`.
- **Contrats** : `packages/shared` (`@hpt/shared`), package TS minimal exportant
  un placeholder + un test Vitest vert. Build `tsc` → `dist` (ESM + `.d.ts`).
- **Base de données dev** : PostgreSQL `16-alpine` via `docker-compose.yml`
  (user/db/pwd paramétrables, healthcheck `pg_isready`, volume nommé).

### Structure de dépôt retenue

- `app/` (Expo), `api/` (NestJS), `packages/shared/` (contrats) ; racine =
  outillage + scripts agrégés. Arbre volontairement **minimal** (pas d'arbre
  figé d'avance, pas de modules de domaine vides — créés avec leurs lots).
- **tsconfig** : base partagée `tsconfig.base.json` (strictness commune
  uniquement) ; chaque package fixe son `module`/`moduleResolution`
  (shared : ESNext + Bundler ; api : commonjs + décorateurs ; app : étend
  `expo/tsconfig.base`, la convention Expo).

### Choix de configuration notables

- **Scripts agrégés racine** : `lint`, `typecheck`, `test`, `build`
  (`pnpm -r run …`, ordre topologique). L'« install » de la DoD est couvert par
  le `pnpm install` natif — on **ne définit volontairement pas** de script npm
  `install` (ce serait un hook de cycle de vie qui se déclencherait en boucle).
- **`pnpm.onlyBuiltDependencies`** : pnpm 10 bloque par défaut les scripts de
  build des dépendances ; on autorise explicitement `@biomejs/biome`,
  `@swc/core`, `esbuild` (les binaires nécessaires à l'outillage).
- **`node-linker=hoisted`** (`.npmrc`) : node_modules à plat, pour la
  compatibilité Metro/React Native (chemin documenté côté Expo). Métro est en
  plus rendu monorepo-aware via `app/metro.config.js` (watchFolders + résolution
  vers la racine).
- **api `types: ["node"]`** : `nest build` exclut les specs ; sans inclusion
  explicite, `tsc` ne tirait `@types/node` que transitivement via les tests, et
  le build échouait sur `process`. L'inclusion explicite rend la résolution
  déterministe.
- **api : pas de `moduleResolution` explicite** : TS 6 déprécie et **erreure**
  sur `node10`/`node`/`classic` quand ils sont posés explicitement ; on laisse
  la valeur par défaut de `module: commonjs` (convention NestJS).
- **CI** (`.github/workflows/ci.yml`) : `install (frozen) → lint → typecheck →
  test → build`, Node 20 + pnpm via `pnpm/action-setup` (lit `packageManager`).
- `app/expo-env.d.ts` est **commité** (référence `expo/types`) pour que le
  typecheck/CI dispose des types ambiants Expo sans lancer Metro.

### Écarts vs cadrage

- **`docker compose up` non exécuté en live dans ce bac à sable** : le CDN du
  registry Docker (`production.cloudfront.docker.com`) est **refusé par la
  politique d'egress** de la session (403 au pull du blob). Le démon Docker
  tourne et `docker compose config` valide le fichier ; seul le pull d'image est
  bloqué. → **À confirmer par le validateur** d'un simple `docker compose up` sur
  une machine de dev / CI standard (registry accessible). Aucune autre DoD n'est
  affectée.
- **Versions plus récentes que ne le laissait supposer le cadrage** (Expo 56 /
  RN 0.85 / React 19 / TS 6 / Nest 11) : on suit « Node 20 LTS + les outils
  nommés » en prenant les majeures stables actuelles. Aucune décision figée n'a
  été réinterprétée.

### Points laissés ouverts (lots suivants)

- **Câblage `shared` ↔ `api`/`app`** non posé : les packages sont des coquilles
  **indépendantes** pour l'instant. Les imports croisés + le mapping
  `exports`/paths arrivent en **0.2**, quand `shared` exporte de vrais contrats
  (enums, types, Zod, fonctions de calcul).
- **Drizzle ORM, schéma DB & migrations** → **0.3**.
- **Modules de domaine vides** (`horses`, `sessions`, `metrics`, …) non créés
  (tolérés mais non requis) — posés avec leurs lots respectifs.
- **Auth, entités, écrans réels, intégrations** (Mollie, Mistral, e-mail TEM),
  stubs e-mail en dev, gestion réelle des secrets `.env`, build natif EAS de
  l'app → lots ultérieurs.
- **Démarrage Metro de l'app** prouvé par le typecheck + la résolution de
  `expo config` ; un bundle Metro complet n'a pas été exécuté dans le bac à
  sable.

### DoD — preuves

| Critère | Vérification | Statut |
|---|---|---|
| `pnpm install` | install workspace complet | ✅ vert |
| `pnpm lint` | `biome check .` | ✅ exit 0 |
| `pnpm typecheck` | `tsc --noEmit` (shared + api + app) | ✅ vert |
| `pnpm test` | Vitest (shared placeholder + smoke API) | ✅ 2/2 |
| `pnpm build` | shared (tsc) + api (nest) + app (typecheck) | ✅ vert |
| `GET /health` → 200 | smoke Vitest **et** boot réel (`{"status":"ok"}`) | ✅ |
| `docker compose up` Postgres | `docker compose config` validé ; pull bloqué par egress | ⚠️ à confirmer en local |
| CI | workflow `install→lint→typecheck→test→build` (Node 20) | ✅ posé |
