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

---

## Lot 0.2 — Contrats `shared` · 2026-06-26

Couche de contrats partagés dans `packages/shared/` : la colonne vertébrale du
projet (Architecture §2). Référentiel/enums, types de domaine des entités socle,
schémas Zod (DTO d'entrée/sortie), fonctions de calcul pures + tests. App et api
**importent** d'ici — aucun type dupliqué. **Aucune** DB/Drizzle (c'est 0.3) :
ici ce sont des types/contrats, pas le schéma.

### Structure de `shared` retenue

Quatre couches, une par responsabilité (dossiers/fichiers `kebab-case`,
re-exportés par des barrels jusqu'à `src/index.ts`) :

- **`enums/`** — référentiel figé (Modèle §0) : `hauteurs` (bornes 60→160,
  pas 5 + `HAUTEURS_CM` + `estHauteurValide`), `obstacle` (`TYPES_OBSTACLE`,
  `TYPES_OBSTACLE_SIMPLE`, `estCombinaison`), `seance` (`TYPES_SEANCE`,
  `PROVENANCES`, `estConcours`), `compte` (`TIERS`, `TYPES_COMPTE`), `cheval`
  (`NIVEAUX_CHEVAL`). Chaque enum = tuple `as const` + type `(typeof …)[number]`
  → **une** liste, réutilisée par les schémas Zod (`z.enum`).
- **`types/`** — formes de domaine des **6 entités socle** (Modèle §3/§5/§6) :
  `Compte`, `Cheval`, `Séance`, `Obstacle` (champs combinaison inline :
  `nombre_d_éléments`, `éléments`), `Tour`, `Contexte`. Champs techniques
  communs via `ChampsTechniques` (`id`, `created_at`, `updated_at`).
- **`schemas/`** — DTO Zod : `*CréerSchema` (entrée, validée au bord) +
  `compteSortieSchema` (sortie). Types inférés (`z.infer`).
- **`calc/`** — fonctions pures testées (Modèle §7) : `tauxObstacleSimple`,
  `tauxCombinaison`, `sansFaute`.

### Décisions tranchées (et pourquoi)

- **Types d'entité ≠ DTO.** Les `types/` sont des **interfaces hand-written**
  (forme du domaine). Les `schemas/` portent les **DTO** Zod + types inférés. La
  cascade de l'Architecture §2 (Drizzle → types → Zod) sera complétée en 0.3 :
  pour l'instant les types sont la **cible** à laquelle le schéma Drizzle devra
  se conformer (alignement vérifié au niveau type, voir « alignement 0.3 »).
- **Jamais de secret en sortie.** `Compte.password_hash` existe dans le domaine
  mais **aucun** DTO de sortie ne l'expose. `compteSortieSchema` ne déclare pas
  le champ ; le `.strip()` (défaut Zod) retire toute clé inconnue à la
  projection. Prouvé deux fois : test runtime (la clé disparaît) **et** garde de
  type (`expectTypeOf<CompteSortie>().not.toHaveProperty('password_hash')`). Le
  DTO d'entrée reçoit un `password` **en clair** (haché côté serveur en 1.1),
  jamais un hash.
- **Nommage fidèle au Modèle de données.** Types `PascalCase` **français** tels
  que listés (`Compte`, `Cheval`, `Séance`, `Obstacle`, `Tour`, `Contexte`) ;
  champs en **`snake_case` français avec accents** (`nombre_d_éléments`,
  `hauteur_de_référence`, `répétitions`, `created_at`…), copie 1:1 du Modèle
  §3/§6 — c'est l'ancrage pour les colonnes Drizzle de 0.3. Les identifiants
  accentués sont valides en TS/JS et passent lint+typecheck+build (prouvé par la
  CI). Convention §5 « variables camelCase » comprise comme s'appliquant au code
  impératif, pas aux **noms de champs de données** (qui suivent le Modèle/la DB).
- **Valeurs d'enum = libellés du référentiel.** Les unions portent directement
  les valeurs figées du Modèle §0 (`'Croix' | 'Vertical' | … | 'Combinaison'`,
  `'Plat' | … | 'Concours'`, `'gratuit' | 'premium' | 'pro'`, provenance
  `'live' | 'déclaratif'`). Pas de couche de traduction valeur↔libellé (pas
  d'abstraction prématurée, §5/§7-Archi) : 0.3 pourra mapper ces valeurs sur des
  `pgEnum` tels quels.
- **Calcul : retour `number | null`, borné [0,1], sans plantage.** `null` =
  non calculable (dénominateur ≤ 0 **ou** entrée invalide : non entière /
  négative / NaN). Une entrée incohérente (fautes > efforts) est **bornée à 0**,
  jamais négative. `tauxCombinaison` multiplie le dénominateur par
  `nombre_d_éléments` (efforts, pas passages — §7). **Une seule** implémentation,
  partagée app+api.
- **Élément de combinaison = obstacle simple.** `Obstacle.éléments` est typé
  `TypeObstacleSimple[]` (pas de combinaison imbriquée) — modélisation
  conservatrice cohérente avec « fautes au niveau de la combinaison, jamais par
  élément » (§0). Léger raffinement vs un « liste de types » générique.
- **Câblage `shared` ↔ `app`/`api` (point ouvert de 0.1, maintenant posé).**
  `@hpt/shared` ajouté en `workspace:*` aux deux ; `zod 3.25.76` (déjà au
  lockfile, transitif d'Expo) épinglé en **dépendance** de `shared`. Résolution
  via le champ `types`/`exports` du package (dist `.d.ts`), **pas** de mapping
  de paths : le consommateur voit un vrai package. Conséquence : `shared` doit
  être **bâti** avant le typecheck des consommateurs → le script racine
  `typecheck` fait désormais `pnpm --filter @hpt/shared build && pnpm -r run
  typecheck`. `build` (topologique) bâtit déjà `shared` en premier. `test` reste
  autonome (les specs ne traversent pas la frontière).
- **Import de démonstration = preuve de compilation, hors runtime de prod.**
  `api/src/contracts.demo.ts` et `app/src/contracts.demo.ts` importent enums +
  types + calc de `shared` et **compilent des deux côtés** (DoD). Côté api le
  fichier est **exclu du build** (`tsconfig.build.json` → `**/*.demo.ts`) pour
  ne pas embarquer de code mort dans `dist` (vérifié : aucun `require('@hpt/
  shared')` dans `api/dist`). Ce ne sont **pas** des modules de domaine (créés
  avec leurs lots).

### Comment 0.3 devra s'aligner

- Le schéma Drizzle des 6 entités socle (+ champs techniques) doit produire des
  lignes **assignables** aux types de `shared/types` : mêmes noms de champs
  (`snake_case` français), `id: string` (UUID), `created_at`/`updated_at` en
  `timestamp` → `Date`. Les `pgEnum` doivent reprendre **exactement** les tuples
  des `enums/` (réutiliser les constantes, ne pas les redéclarer).
- Les champs combinaison inline (`nombre_d_éléments`, `éléments`) et les
  optionnels (`difficulté`, `âge`, `race`, `date_modification`, contexte) sont
  nullable côté DB. `Obstacle`/`Tour`/`Contexte` portent une FK `seance_id` ;
  `Cheval` une FK `compte_id` ; `Séance` une FK `cheval_id`.
- Une fois Drizzle posé, la cascade §2 pourra **dériver** les types depuis le
  schéma ; les interfaces hand-written de 0.2 servent de spécification/garde
  d'alignement durant la transition.

### Écarts vs cadrage

- **Hors socle volontairement omis** (conforme au périmètre) : `Combinaison
  réutilisable` (2.5), `Accès invité` (4.6), `Bilan augmenté` (4.5), et la
  **hauteur maîtrisée** §10 (agrégation → 3.2). Seul le **strict inline** de la
  combinaison est présent.
- **Pas de DTO de sortie explicite** pour les entités sans secret (Cheval,
  Séance, Obstacle, Tour, Contexte) : leur projection = l'entité elle-même
  (aucun champ sensible). Seul `Compte` a un DTO de sortie dédié, là où la règle
  « jamais de secret » a une conséquence concrète. Les `*ModifierSchema`
  (update/PATCH) ne sont pas posés (aucun endpoint en 0.2) — ils arriveront avec
  les modules qui en ont besoin.
- **Identifiants accentués** dans le code (`Séance`, `nombre_d_éléments`…) :
  choix de fidélité au Modèle, validé par la CI. À garder en tête pour le
  mapping Drizzle (colonnes Postgres potentiellement désaccentuées via le
  nom de colonne explicite).

### Points laissés ouverts

- **`énergie` du contexte** : modélisée en échelle 1-5 (comme `ressenti_global`)
  faute de précision dans le Modèle §3 — à confirmer (libre ? échelle ?) au lot
  qui exploitera le contexte (feed 3.1).
- **Interop ESM/CJS `shared` → `api` au runtime** : `shared` est ESM, `api` est
  CommonJS. Sans incidence en 0.2 (l'import api de démonstration est exclu du
  build et jamais exécuté). À trancher en 0.3+ quand un module api consommera
  réellement `shared` à l'exécution (dual-build de `shared`, ou bascule api en
  ESM/`module: node16`).
- **Dérivation des types depuis Drizzle** (cascade §2 complète) : reportée à 0.3
  comme prévu.

### DoD — preuves

| Critère | Vérification | Statut |
|---|---|---|
| Enums & types importables app **et** api | `contracts.demo.ts` des deux côtés, compilés au `typecheck` | ✅ vert |
| Zod valide une entrée correcte / rejette une invalide | `schemas.test.ts` (compte, cheval, obstacle, séance, hauteur) | ✅ |
| Aucun secret en sortie (`password_hash`) | test runtime **+** garde de type (`expectTypeOf`) | ✅ |
| Taux « obstacle simple » correct (exemples connus) | `0.75`, `0.4`, `1`, `0` | ✅ |
| 3 fonctions de calcul testées, cas limites inclus | dénominateur 0, valeurs incohérentes, entrées invalides | ✅ |
| `pnpm lint` | `biome check .` | ✅ exit 0 |
| `pnpm typecheck` | build `shared` puis `tsc --noEmit` (shared + api + app) | ✅ vert |
| `pnpm test` | Vitest — 25 (shared) + 1 (api) | ✅ 26/26 |
| `pnpm build` | shared (tsc) + api (nest, demo exclu) + app (typecheck) | ✅ vert |

---

## Lot 0.3 — Schéma DB & migrations · 2026-06-26

Réalité en base des contrats du lot 0.2 : **schéma Drizzle** des 6 entités socle
(`Compte`, `Cheval`, `Séance`, `Obstacle`, `Tour`, `Contexte`) + leurs enums,
**migration générée** et **appliquée** sur le Postgres local (docker-compose,
0.1). Dernière brique des Fondations avant la Phase 1. **Aucune** couche métier,
auth, endpoint, repository rempli ou seed — uniquement le schéma + sa migration +
sa preuve.

### Emplacement (décision tranchée)

- **Schéma** : `api/src/db/schema/` — un fichier par entité (`compte.ts`,
  `cheval.ts`, `seance.ts`, `obstacle.ts`, `tour.ts`, `contexte.ts`), plus
  `enums.ts` (pgEnums), `champs-techniques.ts` (bag de colonnes communes) et un
  barrel `index.ts`. C'est l'api qui **possède la DB** (Architecture §1/§3) ;
  l'infra DB est **transverse**, donc placée dans un dossier `db/` plat, pas dans
  un module NestJS de domaine (les modules `sessions`/`horses`/… naissent avec
  **leurs** lots — pas d'abstraction prématurée, §6/§7-Archi).
- **Config** : `api/drizzle.config.ts` (dialect `postgresql`, `schema` → barrel,
  `out` → `./drizzle`, `url` depuis `DATABASE_URL` avec repli sur l'URL dev de
  `.env.example`).
- **Migrations** : `api/drizzle/` (SQL + `meta/` snapshot), **commitées**.

### Décisions tranchées (et pourquoi)

- **Enums Postgres (`pgEnum`), pas de `CHECK`** (décision figée). Chaque enum
  **réutilise** le tuple figé de `@hpt/shared` (`TYPES_COMPTE`, `TIERS`,
  `NIVEAUX_CHEVAL`, `TYPES_SEANCE`, `PROVENANCES`, `TYPES_OBSTACLE`) — jamais
  redéclaré : c'est la garantie que les libellés en base sont exactement ceux du
  domaine. Noms de **type** préfixés par l'entité (`compte_type`, `compte_tier`,
  `cheval_niveau`, `seance_type`, `seance_provenance`, `obstacle_type`) pour
  rester uniques. Les **valeurs** gardent leurs accents (libellés du référentiel
  §0 : `Rivière`, `déclaratif`) ; seuls les **identifiants** sont en ASCII.
- **Noms de colonnes physiques désaccentués**, clés TS accentuées. La **clé** de
  l'objet Drizzle reprend le nom de champ de `shared` (accentué : `répétitions`,
  `hauteur_de_référence`, `nombre_d_éléments`, `éléments`, `âge`, `énergie`) pour
  l'alignement de type ; le **nom de colonne** Postgres est ASCII-folded
  (`repetitions`, `hauteur_de_reference`, `nombre_d_elements`, `elements`, `age`,
  `energie`) pour la portabilité et la robustesse outillage. L'alignement se joue
  sur la clé TS, pas sur le nom physique — report anticipé par le journal 0.2.
- **`Contexte` = table séparée** (et non des colonnes sur `seance`). Deux
  raisons : (1) `Contexte` est une **entité** dans `shared`, portant ses propres
  champs techniques `id/created_at/updated_at` — une table la reflète
  directement (alignement de type) ; (2) isoler physiquement le **qualitatif** de
  la colonne vertébrale objective matérialise les « deux couches étanches » (§1)
  et la règle « jamais agrégé ». Cardinalité **0..1** garantie par
  `UNIQUE(seance_id)` + `ON DELETE CASCADE`.
- **`éléments` stocké en `jsonb`** (`$type<TypeObstacleSimple[]>`). Liste
  **ordonnée**, courte et sans-schéma : un `jsonb` préserve l'ordre et reste
  interrogeable, là où une table fille serait prématurée (le détail réutilisable
  arrive au lot 2.5). `nombre_d_éléments` + `éléments` sont **inline** sur
  l'obstacle et nullable (sens uniquement si `type = 'Combinaison'`).
- **Cascade `ON DELETE` orientée vers le bas** : `Compte → Cheval → Séance →
  {Obstacle, Tour, Contexte}`. Support **structurel** de la purge RGPD ; la
  *logique* de suppression de compte reste au lot 1.3. Prouvé de bout en bout par
  un test fonctionnel (suppression d'un compte → toute la descendance disparaît).
- **Inviolabilité encodée comme *forme*** (Modèle §2) : `seance.date` **`NOT
  NULL` sans défaut** (posée une fois, à la création ; peut différer de
  `created_at` pour le `déclaratif`), `date_modification` **nullable** (posée à
  l'édition), `provenance` enum **`live | déclaratif`**. L'**application runtime**
  de l'immuabilité (refus d'un UPDATE silencieux de `date`, pose automatique de
  `date_modification`/`provenance`) vit dans le **service `sessions`**
  (Architecture §3, lot 2.x), **pas** en base : pas de trigger ici (éviter la
  sur-ingénierie). Le schéma porte la forme, pas la garde.
- **Champs techniques** sur chaque table : `id` UUID PK `DEFAULT
  gen_random_uuid()` (PG ≥ 13, natif), `created_at`/`updated_at` `timestamptz
  DEFAULT now() NOT NULL`. `updated_at` reçoit un `$onUpdate` applicatif (reposé
  à chaque écriture Drizzle ; aucun impact SQL). Types inférés `string`/`Date` →
  alignés sur `ChampsTechniques`. `email` (compte) et `seance_id` (contexte) sont
  `UNIQUE`.
- **Mécanisme d'alignement Drizzle ↔ `shared` = assertion de type**
  (`api/src/db/alignment.spec.ts`). Pour chaque entité,
  `expectTypeOf<NullToOptional<typeof table.$inferSelect>>().toEqualTypeOf<T>()`.
  Le helper `NullToOptional` normalise le **seul** écart de représentation assumé
  entre les deux mondes : un champ optionnel du domaine (`x?: T`) est *nullable*
  en base (`T | null`) → `… | null` redevient `…?` avant comparaison. Vérifié à
  la fois par `pnpm typecheck` **et** par `pnpm test` (specs Vitest statiques,
  sans base).
- **Preuve d'application = test DB séparé** (`api/test/db/schema.spec.ts` +
  `vitest.db.config.ts`, commande `pnpm --filter @hpt/api db:verify`). Il
  **réinitialise** le schéma, **applique la migration** (migrator programmatique)
  puis **constate** : 6 tables, toutes les colonnes attendues, 6 enums (valeurs
  recoupées avec les constantes de `shared`), FK en `CASCADE`, `date` NOT NULL /
  `date_modification` nullable, `UNIQUE(contexte.seance_id)`, et la purge en
  cascade de bout en bout. **Volontairement hors `pnpm test`** (il exige une base
  → la CI principale sans Postgres reste verte). Un **job CI dédié** `db` (service
  `postgres:16-alpine`) exécute `db:migrate` (CLI drizzle-kit) **puis**
  `db:verify`.

### Écarts vs cadrage

- **Touche au package `shared` (0.2) : ajout d'une condition d'export
  `default`.** `packages/shared/package.json` exposait seulement `import` +
  `types` ; drizzle-kit (résolveur **CJS**) ne pouvait donc pas résoudre
  `@hpt/shared` (`ERR_PACKAGE_PATH_NOT_EXPORTED`). Ajout de `"default":
  "./dist/index.js"` comme **repli universel** — le chargement réel est fait par
  le loader esbuild de drizzle-kit (qui gère l'ESM). C'est exactement l'**interop
  ESM/CJS** que le journal 0.2 avait laissée « à trancher en 0.3+ quand un module
  consommera réellement `shared` » (ici, un consommateur **build-time**). **Aucun
  contrat modifié** (types/enums/Zod/calc inchangés) — seule la carte d'`exports`
  évolue. Conséquence assumée : un vrai `require()` CJS *résout* désormais le
  fichier ESM (et lèverait `ERR_REQUIRE_ESM` sous Node 20 **à l'exécution**) —
  sans incidence en 0.3, aucun code runtime ne consomme la couche DB.
- **Aucune divergence type `shared` ↔ schéma.** L'alignement passe intégralement
  au niveau type ; la seule différence de représentation (nullable DB ↔ optionnel
  domaine) est **assumée et normalisée** (`NullToOptional`), pas une divergence de
  contrat.

### Points laissés ouverts (reports explicites)

- **`combinaison_ref` sur `Obstacle` → reporté au lot 2.5** : la table cible
  `Combinaison réutilisable` n'existe pas encore. L'obstacle ne porte ici que
  `nombre_d_éléments` + `éléments` **inline**.
- **Clé d'idempotence sur `Séance` → reportée au lot 2.2** (flux de création) —
  non ajoutée ici.
- **Application runtime de l'immuabilité/horodatage** (refus d'UPDATE de `date`,
  pose auto de `date_modification`/`provenance`) → **service `sessions`** (2.x).
- **Interop ESM/CJS *runtime* complète** (dual-build de `shared` ou bascule api en
  ESM/`module: node16`) → au lot où l'api consommera le schéma **à l'exécution**.
  En 0.3, seul le besoin **build-time** est levé (condition `default`).
- **`énergie` du contexte** : échelle 1-5 (héritée de 0.2) — à confirmer au lot
  qui exploite le contexte (feed 3.1).
- Hors périmètre, conformes : pas de `Combinaison réutilisable` (2.5), `Accès
  invité` (4.6), `Bilan augmenté` (4.5) ; **aucun dérivé persisté**
  (`Record`/`Jalon`, `hauteur maîtrisée`, `sans_faute`, taux — Modèle §9/§10).

### DoD — preuves

| Critère | Vérification | Statut |
|---|---|---|
| Migration s'applique sur Postgres local | `drizzle-kit migrate` (CLI) + migrator programmatique sur PG 16 | ✅ |
| 6 tables socle + colonnes créées | `db:verify` constate tables + colonnes (techniques + domaine) | ✅ |
| 6 enums Postgres, valeurs = référentiel `shared` | `db:verify` recoupe `pg_enum` ↔ constantes `shared` | ✅ |
| FK en `ON DELETE CASCADE` (vers le bas) | `db:verify` lit `referential_constraints` (5 FK = CASCADE) + purge fonctionnelle | ✅ |
| Inviolabilité encodée | `date` NOT NULL, `date_modification` nullable, `UNIQUE(contexte.seance_id)` | ✅ |
| Alignement Drizzle ↔ `shared` au niveau type | `alignment.spec.ts` (`expectTypeOf` + `NullToOptional`) — 6 entités | ✅ |
| `pnpm lint` | `biome check .` (`api/drizzle` exclu du formatage : artefacts générés) | ✅ exit 0 |
| `pnpm typecheck` | build `shared` puis `tsc --noEmit` (shared + api + app) | ✅ vert |
| `pnpm test` | Vitest — 25 (shared) + 7 (api : 6 alignement + 1 health), **sans DB** | ✅ 32/32 |
| `pnpm build` | shared (tsc) + api (nest) + app (typecheck) | ✅ vert |
| `db:verify` (preuve schéma, Postgres requis) | Vitest dédié — 7 tests sur PG local | ✅ 7/7 |
| CI | job `ci` (sans DB) + job `db` (service `postgres:16`, `migrate` + `verify`) | ✅ posé |

---

## Lot 1.1 — Auth (inscription, login, JWT access/refresh, argon2) · 2026-06-27

Premier lot de **logique métier** : socle d'authentification du module
`auth-account` (Architecture §3). Inscription, connexion, JWT access/refresh
avec **rotation** + **détection de réutilisation**, mots de passe **argon2**.
Strictement le lot 1.1 : ni vérification e-mail (1.2), ni RGPD (1.3), ni UI
(1.4), ni gating d'entitlement (4.1).

### Emplacement (décision tranchée)

- **Module** : `api/src/auth-account/` (par domaine, pas par couche — §1/§3) :
  `auth.service` (domaine), `token.service` (cycle de vie des jetons),
  `password.service` (argon2), `auth.controller` (frontière HTTP),
  `jwt-access.strategy` + `jwt-access.guard` (Passport), `auth.errors`
  (erreurs de domaine typées), `current-user.decorator`, `auth.config`.
- **Schéma + migration** : `api/src/db/schema/refresh-token.ts` et
  `api/drizzle/0001_dazzling_mojo.sql` — **là où l'api possède la DB** (cohérent
  avec 0.3). Migration **additive** (CREATE TABLE seul, aucune table socle
  touchée).
- **Infra transverse** : `api/src/db/database.module.ts` (connexion runtime,
  cf. écarts) ; `api/src/common/` (`zod-validation.pipe`, `domain-error`,
  `domain-exception.filter`).
- **Contrats** : `packages/shared/src/schemas/auth.ts` (extension de 0.2).

### Décisions tranchées (et pourquoi)

- **argon2id, m = 19456 KiB (19 MiB), t = 2, p = 1** (recommandation OWASP
  *Password Storage Cheat Sheet*). Bon compromis coût/sécurité pour un serveur
  applicatif, reproductible en CI. Paramètres centralisés dans
  `auth.config.ts` (`ARGON2_OPTIONS`). Le hash encode ses paramètres → la
  vérification n'a pas à les repréciser. Login : comparaison **systématique**
  contre un hash factice quand l'e-mail est inconnu (pas d'oracle de timing).
- **Durées de jetons** (Setup roadmap, ajustables) : **access 15 min, refresh
  30 j**. `access` + `refresh` sont **deux JWT** signés avec des **secrets
  distincts** (`JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`) ; en prod via Secret
  Manager (Stack §3.5), repli dev ergonomique (même posture que `DATABASE_URL`
  en 0.3, jamais un secret réel commité).
- **Modèle de rotation + détection de réutilisation par famille.** Le refresh
  est un JWT dont le `jti` **est** l'`id` de la ligne `refresh_token`. On ne
  stocke que le **SHA-256** du token (jamais le clair) : le secret est de haute
  entropie (signature), un hash rapide suffit — argon2 reste réservé au mot de
  passe (faible entropie). À chaque rotation : la ligne courante est révoquée
  (`revoked_at` + `rotated_at` + `replaced_by`), un nouveau couple est émis dans
  la **même famille** (`family_id`). **Présenter un refresh déjà tourné**
  (`revoked_at` + `rotated_at` posés) = fuite probable → **révocation de toute
  la famille** (`RefreshTokenReuseError`). Un refresh révoqué par logout
  (`rotated_at` nul) est simplement rejeté, sans tuer la famille. Comparaison du
  hash en temps constant (`timingSafeEqual`).
- **Forme des DTO `shared`** (`schemas/auth.ts`) : entrées `registerSchema`
  (= `compteCréerSchema` **sans `tier`** : le tier est posé `gratuit` côté
  serveur, sans garde), `loginSchema`, `refreshSchema`, `logoutSchema` ; sortie
  `authTokensSchema` (`access_token`, `refresh_token`, `token_type: 'Bearer'`,
  `expires_in`). **Aucun type dupliqué** ; `register` renvoie la projection
  `compteSortieSchema` (0.2), `login`/`refresh` un `AuthTokens`. **Aucun secret
  en sortie** : `password_hash` n'apparaît dans aucun DTO (prouvé runtime +
  garde de type `expectTypeOf`).
- **Garde d'accès prouvée** : route protégée `GET /auth/me` (stratégie
  `jwt-access`, n'accepte que les jetons `typ: 'access'`) → renvoie le compte
  courant projeté sans secret. Le guard `JwtAccessGuard` est réutilisable par
  les modules des lots suivants.
- **Validation Zod à la frontière** via `ZodValidationPipe` (DTO de `shared`),
  **règles métier dans le service** `auth-account` ; **erreurs de domaine
  typées** (`DomainError` + `DomainExceptionFilter`) → réponses HTTP sobres,
  détail interne journalisé, jamais de fuite (Architecture §5).

### Écarts vs cadrage (consignés)

- **Table `refresh_token` hors Modèle de données.** La rotation impose une
  persistance serveur (révocation, détection de réutilisation) absente des
  entités socle (0.3). Ajout par **migration Drizzle additive** : FK `compte_id`
  en **`ON DELETE CASCADE`** (support structurel de la purge RGPD, lot 1.3),
  `family_id`, `token_hash` (SHA-256), `expires_at`, `revoked_at`, `rotated_at`,
  `replaced_by`, + index `compte_id` / `family_id`. Clés ASCII (table technique,
  pas une entité du domaine → pas d'alignement `shared`).
- **Dual-build de `@hpt/shared` (ESM + CJS).** Le point « interop ESM/CJS
  *runtime* » laissé ouvert en 0.2/0.3 se concrétise ici : l'`api` (CommonJS)
  consomme `shared` **à l'exécution** (schémas Zod aux frontières,
  `compteSortieSchema`). Le build ESM existant a des imports de répertoire sans
  extension (OK pour Metro/vite/esbuild, **pas** pour un `require`/`import` Node
  pur). Ajout d'un **build CJS** (`tsconfig.cjs.json` → `dist/cjs/` +
  `package.json` `type: commonjs` via `scripts/finalize-cjs.mjs`) et des
  conditions d'export `require`/`default`. **Aucun contrat modifié** (types,
  enums, Zod, calc inchangés). Prouvé : `node dist/main.js` démarre et exécute
  le flux register→login (require CJS de `shared` résolu).
- **Outillage Biome** : `unsafeParameterDecoratorsEnabled: true` (parser, pour
  les décorateurs de paramètres NestJS `@Inject`) + override `useImportType:
  off` sur `api/**` (la conversion en `import type` casse la DI réflexive de
  NestJS sous `emitDecoratorMetadata`). `onlyBuiltDependencies += argon2`
  (module natif, script de build autorisé). Aucune règle assouplie côté
  `shared`/`app`.
- **Connexion DB runtime** (`DatabaseModule`, jeton `DRIZZLE`, `@Global`) : 0.3
  n'avait posé que le schéma + migrations ; `auth-account` est le **premier**
  module à écrire en base à l'exécution. Module minimal (instance Drizzle typée
  sur le schéma, pool `pg` paresseux), **pas** de repository générique (pas
  d'abstraction prématurée).

### Hors périmètre — points explicitement non tranchés

- **`email_verified` au login** : `register` pose `email_verified = false` et
  **n'envoie aucun e-mail** ; le **login est autorisé indépendamment de
  `email_verified`**. Un éventuel gating sur la vérification est une **décision
  produit non tranchée** → laissée à 1.2 (e-mail) / produit.
- **Rate limiting** (anti-brute-force sur login/refresh) : **non implémenté** —
  **point ouvert** (garde transverse type `@nestjs/throttler` à poser plus tard ;
  pas trivial → consigné plutôt qu'improvisé).
- **Pruning des refresh tokens** expirés/révoqués (tâche de nettoyage) : non
  fait — **point ouvert** (la cascade RGPD les purge déjà à la suppression du
  compte).
- **Build ESM de `shared` non-Node-pur** (imports de répertoire sans extension) :
  inchangé, sans incidence (Metro/vite/esbuild gèrent) ; seul le **CJS** est
  requis pour le runtime `api`. Un alignement ESM strict reste possible plus tard.
- Conformes au périmètre : **aucun** e-mail/reset (1.2), **aucune** logique RGPD
  (1.3), **aucun** écran (1.4), **aucune** garde d'entitlement (4.1).

### DoD — preuves

| Critère | Vérification | Statut |
|---|---|---|
| S'inscrire crée un compte, mot de passe **haché argon2** (jamais en clair/sortie) | e2e : body sans `password_hash`/`password` ; DB : `password_hash` ∈ `$argon2id$…`, ≠ clair | ✅ |
| Se connecter renvoie access + refresh ; **identifiants invalides rejetés (401)** | e2e : couple + `Bearer`/`expires_in` ; mauvais mot de passe **et** e-mail inconnu → 401 | ✅ |
| Rafraîchir renvoie un **nouveau couple** et **invalide l'ancien** (rotation prouvée) | e2e : nouveau refresh ≠ ancien ; réutiliser l'ancien → 401 ; **famille révoquée** (successeur → 401) | ✅ |
| `logout` révoque le refresh courant | e2e : logout 204, puis refresh du même token → 401 | ✅ |
| Garde d'accès JWT sur route protégée | e2e `GET /auth/me` : 401 sans/with mauvais jeton, 200 avec access valide | ✅ |
| Aucun DTO de sortie ne contient `password_hash`/secret | Zod `compteSortie`/`authTokens` + tests runtime **et** `expectTypeOf` | ✅ |
| Validation Zod à la frontière | e2e : entrée invalide → 400 ; erreurs de domaine typées → 401/409 sobres | ✅ |
| Migration refresh token **s'applique** sur Postgres local | `drizzle-kit migrate` depuis zéro (0000 + 0001) ; FK `compte_id` = CASCADE | ✅ |
| `pnpm lint` | `biome check .` | ✅ exit 0 |
| `pnpm typecheck` | build `shared` (ESM+CJS) puis `tsc --noEmit` (shared + api + app) | ✅ vert |
| `pnpm test` (sans DB) | Vitest — 32 (shared, +7 auth) + 11 (api : 6 alignement + 4 argon2 + 1 health) | ✅ 43/43 |
| `pnpm build` | shared (tsc ESM+CJS) + api (nest) + app (typecheck) ; `node dist/main.js` boot OK | ✅ vert |
| `db:verify` (Postgres requis) | Vitest — 7 (schéma 0.3) + 9 (auth e2e 1.1) sur PG local | ✅ 16/16 |
| CI | job `ci` (sans DB : lint/typecheck/test/build) + job `db` (`migrate` + `verify`, auth e2e inclus) | ✅ |

---

## Lot 1.2 — Vérification e-mail & reset de mot de passe · 2026-06-27

Extension du module `auth-account` (Architecture §3) : **vérification d'e-mail**
et **réinitialisation de mot de passe** via des **liens à usage unique &
expirables**, envoyés par un **port `Mailer`** (stub console/log en dev ; TEM
prod différé). S'appuie sur la table `refresh_token` de 1.1 (révocation au
reset). Strictement le lot 1.2 : pas de RGPD (1.3), pas d'UI (1.4), pas de
gating sur `email_verified` (décision produit, laissée ouverte).

### Emplacement (décisions tranchées)

- **Schéma + migration** : `api/src/db/schema/verification-token.ts` +
  `api/drizzle/0002_aromatic_overlord.sql` — additive (CREATE TYPE enum + CREATE
  TABLE seuls, aucune table existante touchée).
- **Service de domaine** : `api/src/auth-account/verification.service.ts`
  (`VerificationService`) — émission/consommation des jetons, branchements reset
  + envoi. `auth.service.ts` (1.1) **étendu** : le `register` déclenche l'envoi.
- **Port e-mail** : `api/src/auth-account/mailer/` — `mailer.ts` (interface
  `Mailer` + jeton `MAILER` + `MailMessage`) et `console-mailer.ts`
  (`ConsoleMailer`, stub dev).
- **Config** : durées de vie + construction des liens dans `auth.config.ts`.
- **Erreurs** : `InvalidVerificationTokenError` dans `auth.errors.ts`.
- **Utilitaire** : `api/src/auth-account/sha256.ts` — `sha256Hex` partagé par
  `TokenService` (1.1, refactoré pour l'utiliser) et `VerificationService`.
- **Contrats** : `packages/shared/src/schemas/auth.ts` (extension de 1.1) ; la
  politique de mot de passe est extraite en `motDePasseSchema` (`schemas/
  compte.ts`), réutilisée par l'inscription **et** le reset (pas de règle dupliquée).

### Décisions tranchées (et pourquoi)

- **Une seule table `verification_token`** (vs deux tables) avec un enum `type`
  (`email_verification | password_reset`). Les deux usages partagent exactement
  la même mécanique — jeton hashé à usage unique, expiration, FK `compte` — donc
  une table unique évite la duplication de structure/code ; le `type` discrimine
  (et **cloisonne** : un jeton de vérification ne vaut pas pour un reset, vérifié
  par test). Colonnes : `compte_id` (FK **`ON DELETE CASCADE`** → support purge
  RGPD 1.3), `type`, `token_hash` (**UNIQUE**), `expires_at`, `consumed_at`
  (usage unique), + champs techniques. Clés ASCII, **table technique hors Modèle
  de données** (même posture que `refresh_token` en 1.1 → pas d'alignement
  `shared`). Enum `verification_token_type` défini côté `api` (technique), pas
  dans le référentiel `shared` (qui ne porte que des libellés métier).
- **Jeton jamais en clair.** Secret tiré au sort (`randomBytes(32)` → base64url,
  haute entropie) ; seul son **SHA-256 (hex)** est persisté. On retrouve la ligne
  par le hash du jeton présenté (colonne `UNIQUE`). Hash rapide (pas argon2) :
  cohérent avec le raisonnement entropie de 1.1 (argon2 réservé au mot de passe).
- **Consommation atomique = usage unique.** `consume()` fait **un seul** UPDATE
  conditionnel (`consumed_at IS NULL` **et** `expires_at > now()`) qui pose
  `consumed_at` et renvoie la ligne. Toute absence de ligne (inconnu / déjà
  consommé / expiré / mauvais type) → `InvalidVerificationTokenError` (400).
  L'atomicité ferme la fenêtre d'usage concurrent. **Émettre** un nouveau lien
  périme d'abord les jetons non consommés du même type (un seul lien actif).
- **Port `Mailer` étroit** (forme tranchée) : une méthode par e-mail
  transactionnel (`sendEmailVerification`, `sendPasswordReset`), chacune reçoit
  `{ to, link }`. Pas de moteur de templates ni de transport générique (pas
  d'abstraction prématurée — Archi §7). `ConsoleMailer` **logge** le lien
  (`Logger` Nest) — c'est le **seam** : l'implémentation Scaleway TEM (Stack
  §3.5) se branchera derrière la même interface, permutée dans le module.
- **Branchement sur le `register` de 1.1 = modification directe du flux** (vs
  event bus). `AuthService.register` appelle `verification.issueEmailVerification`
  après création du compte. Choix assumé : pas de bus d'événements (sur-ingénierie
  à cette échelle, dépendance acyclique `AuthService → VerificationService`).
- **Au reset : re-hash argon2 + révocation de TOUS les refresh tokens** du compte
  (`TokenService.revokeAllForAccount`, ajouté). Toute session ouverte tombe — un
  attaquant éventuellement actif ne survit pas au reset. Prouvé par test (ancien
  refresh → 401 après reset).
- **Anti-énumération** : `verify-email/request` et `password-reset/request`
  renvoient **200** (corps vide), que le compte existe ou non ; le lien n'est
  émis que si le compte existe (et, pour la vérification, n'est pas déjà vérifié).
  Aucune fuite d'existence (testé sur e-mail inconnu). Les *confirm* renvoient un
  résultat observable : `verify-email/confirm` → `CompteSortie` (`email_verified:
  true`) ; `password-reset/confirm` → 204.
- **Durées de vie** (ajustables, `auth.config.ts`) : vérification **24 h**, reset
  **1 h** (fenêtre courte par sécurité).

### Écarts vs cadrage (consignés)

- **Table `verification_token` hors Modèle de données** — comme `refresh_token`
  en 1.1 : besoin serveur (lien à usage unique, expirable) absent des entités
  socle. Ajout par **migration Drizzle additive**, FK CASCADE pour la purge RGPD.
- **Refactor mineur de 1.1** : `TokenService.sha256` délègue désormais à
  `sha256Hex` (déduplication, aucun changement de comportement). `schemas/
  compte.ts` expose `motDePasseSchema` (même valeur `min(8).max(200)`, factorisée).
  Aucun contrat existant modifié.
- **Pas de gating sur `email_verified`** : conformément au périmètre, le login
  reste autorisé indépendamment de la vérification (cf. point ouvert ci-dessous).

### Points laissés ouverts

- **Gating `email_verified`** : faut-il bloquer tout/partie de l'accès pour un
  compte non vérifié ? **Décision produit non tranchée** — non imposée ici (le
  login reste ouvert, comme posé en 1.1). À trancher côté produit / lot UI (1.4).
- **Implémentation TEM Scaleway** (Stack §3.5) : **différée** (prod). Le port
  `Mailer` est le seam ; en prod on permute `ConsoleMailer` → `ScalewayTemMailer`
  dans `auth-account.module.ts`, sans toucher au domaine. Délivrabilité réelle,
  templates HTML, gestion des bounces : hors lot 1.2.
- **Pruning des jetons** expirés/consommés (tâche de nettoyage) : non fait — la
  cascade RGPD les purge à la suppression du compte (même posture que les refresh
  en 1.1). Point ouvert transverse.
- **Forme finale des liens** (deep link app vs page web) : `APP_PUBLIC_URL` +
  chemins ; l'UI réelle des écrans de confirmation est le lot 1.4.

### DoD — preuves

| Critère | Vérification | Statut |
|---|---|---|
| L'inscription **logge un lien** de vérification (dev) | `node dist/main.js` + `POST /auth/register` → log `[Mailer] [email-verification] … token=…` | ✅ |
| **Confirmer** le lien passe `email_verified` à `true` | e2e : `verify-email/confirm` → `CompteSortie.email_verified = true` | ✅ |
| **Demander un reset** logge un lien ; **confirmer** change le mot de passe | e2e : login **OK** avec le nouveau, **KO** (401) avec l'ancien | ✅ |
| Jetons **à usage unique** : réutilisation rejetée | e2e : 2ᵉ confirm (vérif **et** reset) → 400 | ✅ |
| Jetons **expirables** : expiration rejetée | e2e : `expires_at` forcé au passé → confirm 400 | ✅ |
| Le reset **révoque les refresh tokens** | e2e : ancien refresh → 401 après reset | ✅ |
| Demande de reset / renvoi sur **e-mail inconnu** → **200 sans fuite** | e2e : 200, **aucun** e-mail émis | ✅ |
| Cloisonnement par `type` | e2e : jeton de vérification présenté au reset → 400 | ✅ |
| **Migration** `verification_token` s'applique sur Postgres local | `drizzle-kit migrate` depuis zéro (0000→0002) ; enum + FK CASCADE + UNIQUE constatés | ✅ |
| `pnpm lint` | `biome check .` | ✅ exit 0 |
| `pnpm typecheck` | build `shared` puis `tsc --noEmit` (shared + api + app) | ✅ vert |
| `pnpm test` (sans DB) | Vitest — 35 (shared, +3 schémas 1.2) + 13 (api, +2 ConsoleMailer) | ✅ 48/48 |
| `pnpm build` | shared + api (nest) + app ; `node dist/main.js` boot OK (liens loggés) | ✅ vert |
| `db:verify` (Postgres requis) | Vitest — 7 (schéma 0.3) + 9 (auth 1.1) + 10 (vérif/reset 1.2) | ✅ 26/26 |
| CI | job `ci` (sans DB) + job `db` (`migrate` 0→0002 + `verify`, e2e 1.2 inclus) | ✅ |

---

## Lot 1.3 — RGPD compte (suppression & export) · 2026-06-27

Dernier lot du module `auth-account` (Architecture §3 : c'est lui qui porte le
RGPD). Implémente les **droits des personnes au niveau compte** : **suppression**
(droit à l'effacement, Spec §9.1 / Stack §7.3) et **export complet** (droit à la
portabilité). Strictement le lot 1.3 : aucune UI (1.4), aucun cheval/séance
(Phase 2) — on n'ajoute que deux endpoints + leur tranche de contrat `shared`.

### Emplacement (décisions tranchées)

- **Service de domaine** : `api/src/auth-account/account.service.ts`
  (`AccountService`) — `deleteAccount` (purge cascade après confirmation) et
  `exportAccount` (assemblage de l'arbre + projection sans secret). Service
  **séparé** de `AuthService` (1.1) et `VerificationService` (1.2) : une
  responsabilité par service, comme le reste du module.
- **Frontière HTTP** : `api/src/auth-account/account.controller.ts`
  (`AccountController`, `@Controller('account')`, `@UseGuards(JwtAccessGuard)`
  au niveau classe) — `DELETE /account` et `GET /account/export`. Routes
  orientées ressource (Architecture §5), opérant **toujours sur le compte
  courant** (id issu de l'access token, jamais de l'URL : on ne supprime/exporte
  que soi).
- **Contrats `shared`** : `packages/shared/src/schemas/account-export.ts` —
  `accountDeleteSchema` (confirmation) + `accountExportSchema` et ses
  sous-schémas (`chevalExportSchema`, `seanceExportSchema`,
  `obstacleExportSchema`, `tourExportSchema`, `contexteExportSchema`). Aucun type
  dupliqué : le compte réutilise `compteSortieSchema` (0.2), les enums viennent
  du référentiel (`niveauChevalSchema`, `typeSéanceSchema`, …).
- **Aucune migration.** La vérification des cascades (ci-dessous) n'a révélé
  **aucun** FK manquant → pas de migration additive.

### Décisions tranchées (et pourquoi)

- **Suppression = purge dure en cascade, pas de soft delete** (décision figée,
  Spec §9.1 dit *purge*). `deleteAccount` fait un simple `DELETE FROM compte
  WHERE id = …` ; tout le reste tombe par `ON DELETE CASCADE`. **Portée exacte de
  la purge** : l'arbre de propriété du Modèle §3 (`Compte → Cheval → Séance →
  {Obstacle, Tour, Contexte}`) **et** les tables techniques d'auth
  (`refresh_token` du 1.1, `verification_token` du 1.2). Prouvé « aucune ligne
  résiduelle » par `account.spec.ts` (comptage par `compte_id` / `cheval_id` /
  `seance_id` après suppression → 0 partout, jetons inclus).
- **Vérification des cascades auth (DoD) : déjà conformes, rien à corriger.** Les
  deux tables ajoutées hors socle portaient **dès leur création** une FK
  `compte_id` en `ON DELETE CASCADE` (consigné aux journaux 1.1 et 1.2, « support
  structurel de la purge RGPD »). Confirmé à deux niveaux : lecture du SQL des
  migrations `0001`/`0002`, **et** assertion runtime sur
  `information_schema.referential_constraints` dans `account.spec.ts`
  (`refresh_token.compte_id` et `verification_token.compte_id` = `CASCADE`).
  **Aucune migration additive** n'a donc été nécessaire — l'anticipation des lots
  1.1/1.2 a payé.
- **Confirmation de suppression par mot de passe (recommandée → retenue).** La
  route est déjà authentifiée (garde JWT) ; on exige **en plus** le mot de passe
  courant (`accountDeleteSchema { password }`), re-vérifié via `PasswordService`
  (le même argon2 que le login). Raison : une suppression est **irréversible** —
  une re-vérification d'identité protège contre un access token volé/oublié sur
  un appareil. Compte introuvable **ou** mot de passe erroné → **401 générique**
  (pas d'oracle). Le mot de passe absent → **400** (frontière Zod).
- **Export = JSON structuré, synchrone** (échelle v1 ; pas d'asynchrone ni de
  fichier Object Storage — over-engineering hors périmètre). Lecture en
  **requêtes groupées** (une par niveau, `inArray`) puis assemblage en mémoire :
  pas de N+1, pas d'abstraction prématurée. **Format** : `{ exported_at, compte,
  chevaux[] }`, chaque cheval portant ses `seances[]`, chaque séance ses
  `obstacles[]` / `tours[]` / `contexte` (0..1). `exported_at` horodate le cliché
  (métadonnée de portabilité).
- **Exclusions de l'export (secrets) garanties par construction.** Le compte est
  projeté par `compteSortieSchema` (qui **ne déclare pas** `password_hash`) et
  tous les `.object()` Zod **strippent** les clés inconnues : même en passant la
  ligne brute de la base, le hash ne peut pas fuir (même posture qu'aux lots
  0.2/1.1, prouvée runtime **et** par garde de type `expectTypeOf`). Les tables
  techniques d'auth (`refresh_token`, `verification_token`) **ne sont pas
  exportées** : ce sont des artefacts de session/sécurité, pas des données de
  portabilité de l'utilisateur. Test : le payload sérialisé ne contient ni
  `password_hash`, ni `token_hash`, ni `refresh_token`/`verification_token`,
  **alors que** ces lignes existent bien en base au moment de l'export.
- **Inclusion `live` ET `déclaratif`** (décision figée) : l'export est la donnée
  *brute* de l'utilisateur ; la curation « live seul » est une affaire de
  **métrique/rapport** (Modèle §2), pas d'export. Prouvé : l'arbre exporté
  contient les deux provenances.

### Écarts vs cadrage (consignés)

- **Aucune migration, aucun nouveau type d'entité.** Le lot est purement additif
  en code applicatif (service + controller + contrats), sans toucher au schéma DB
  ni au Modèle de données — les cascades nécessaires existaient déjà.
- **Sous-schémas de sortie explicites pour Cheval/Séance/Obstacle/Tour/Contexte**
  (`*ExportSchema`). Le journal 0.2 avait noté « pas de DTO de sortie explicite »
  pour ces entités (leur projection = l'entité). L'export en a besoin pour
  **valider la frontière** (Architecture §5) et garantir le strip ; ils
  **n'altèrent aucun contrat existant** et restent fidèles aux types de `shared`
  (champs nullable de la base rendus en `null`, pas omis). Pas de duplication :
  les enums et le compte réutilisent les schémas existants.
- **Access token survivant à la suppression.** Le JWT d'access (sans état, TTL
  15 min) reste cryptographiquement valide après la purge, mais ne résout plus
  aucun compte (toute route le ré-résolvant échoue) ; les **refresh tokens sont
  purgés** par la cascade (plus de renouvellement possible). Acceptable en v1
  (cohérent avec le modèle JWT sans liste de révocation d'access — cf. point
  ouvert « rate limiting / révocation » du 1.1).

### Points laissés ouverts

- **Rétention légale future des données de paiement** : hors sujet aujourd'hui
  (Mollie = Phase 4, aucune donnée de paiement n'existe). Quand elle arrivera, la
  purge devra composer avec les **obligations de conservation comptable** (p. ex.
  factures à conserver N années) : la suppression de compte ne pourra pas
  forcément cascader *aveuglément* les futures tables de facturation — il faudra
  alors **anonymiser** plutôt que supprimer ces lignes, ou les détacher du
  compte. À trancher au lot qui introduit la facturation (Phase 4), **pas ici**.
- **Anonymisation partielle** : volontairement non faite (over-engineering en
  v1, hors périmètre). La purge dure suffit au droit à l'effacement tant qu'il
  n'y a pas de donnée à conservation obligatoire (cf. ci-dessus).
- **Pruning / révocation d'access token** : inchangé depuis 1.1 (point ouvert
  transverse) ; la suppression s'appuie sur la cascade + la courte durée de vie
  de l'access token plutôt que sur une liste de révocation.
- **Export — pagination / volumétrie** : synchrone et complet convient à
  l'échelle v1 (un utilisateur, ses chevaux). Si la volumétrie explose un jour
  (improbable pour un compte individuel), un export asynchrone + fichier serait à
  rouvrir — explicitement hors v1.

### DoD — preuves

| Critère | Vérification | Statut |
|---|---|---|
| Supprimer un compte **purge tout** (chevaux, séances, obstacles, tours, contexte **+ refresh tokens & jetons**) | e2e `account.spec.ts` : après `DELETE /account`, comptage par `compte_id`/`cheval_id`/`seance_id` = **0** partout (8 tables) | ✅ aucune ligne résiduelle |
| Cascades auth (1.1/1.2) effectives | e2e : `referential_constraints` → `refresh_token.compte_id` & `verification_token.compte_id` = `CASCADE` ; SQL `0001`/`0002` relu | ✅ (rien à corriger) |
| Export = JSON complet **sans secret** | e2e : arbre compte+chevaux+séances+obstacles/tours/contexte ; payload sérialisé **sans** `password_hash`/`token_hash`/refresh/jeton (alors qu'ils existent en base) | ✅ |
| Export inclut **live ET déclaratif** | e2e : les deux provenances présentes dans l'arbre | ✅ |
| Suppression **exige l'authentification** | e2e : `DELETE /account` sans jeton → **401** | ✅ |
| Suppression **exige la confirmation mot de passe** | e2e : bon jeton + mauvais mot de passe → **401** ; mot de passe absent → **400** (Zod) | ✅ |
| Aucun secret en sortie (garde de type) | `account-export.test.ts` : runtime (strip) **+** `expectTypeOf` (pas de `password_hash`, pas de structure de jetons) | ✅ |
| `pnpm lint` | `biome check .` | ✅ exit 0 |
| `pnpm typecheck` | build `shared` puis `tsc --noEmit` (shared + api + app) | ✅ vert |
| `pnpm test` (sans DB) | Vitest — 40 (shared, +5 export/delete) + 13 (api) | ✅ 53/53 |
| `pnpm build` | shared (ESM+CJS) + api (nest) + app ; app NestJS bootée par les e2e (require CJS de `shared` résolu) | ✅ vert |
| `db:verify` (Postgres requis) | Vitest — 7 (schéma 0.3) + 9 (auth 1.1) + 10 (vérif/reset 1.2) + **7 (RGPD 1.3)** | ✅ 33/33 |
| CI | job `ci` (sans DB) + job `db` (`migrate` + `verify`, e2e 1.3 inclus) — inchangée (aucune migration) | ✅ |

---

## Lot 1.4 — Coquille app & navigation · 2026-06-27

Première vraie tranche **`app`** (Architecture §4) : pose la **coquille de
navigation** (tab bar 4 onglets + FAB central), la **couche de tokens UI**
(UI/UX §3) et **câble les écrans d'auth** sur l'API de 1.1 (refresh en secure
storage, rafraîchissement auto sur 401). Strictement le lot 1.4 : aucun contenu
réel d'onglet (Feed 3.1, Historique 3.4, Analytique 5.1), aucune saisie
(2.2/2.3), aucun cheval (2.1), aucun gating/paywall (4.x).

### Structure retenue (décision tranchée)

Découpage de `app/src/` **par responsabilité**, sans arbre figé d'avance
(Architecture §6/§7) :

- **`theme/`** — tokens UI : `tokens.ts` (couleurs, espacements, rayons,
  ombres, cible tactile), `typography.ts` (polices + échelle), barrel.
- **`ui/`** — primitives réutilisables : `Text`/`StatText`, `Button`,
  `TextField`, `Screen`, `Card`, `Badge`, `EmptyState`, `SegmentedControl`,
  `ScreenHeader`.
- **`auth/`** — logique d'auth : `token-store.ts`, `api-client.ts`,
  `auth-api.ts`, `auth-context.tsx`, `error-messages.ts` (+ leurs tests).
- **`navigation/`** — `tabs.ts` (config pure, source unique) + `tab-bar.tsx`
  (bouton d'onglet & FAB).
- **`config.ts`** — URL d'API (env `EXPO_PUBLIC_API_URL`, repli localhost:3000).
- **`app/`** — routes Expo Router : groupe `(auth)` (login, register,
  forgot-password) et groupe `(tabs)` (index=Feed, historique, analytique,
  profil) + `_layout` racine (polices, fournisseurs, garde de session).

### Décisions tranchées (et pourquoi)

- **Navigation : Expo Router *headless tabs* (`expo-router/ui`)**, pas le
  `Tabs` classique (react-navigation). Raison : le FAB central est un **bouton
  hors-route** (placeholder), pas un onglet — la navigation headless
  (`<Tabs>` + `<TabSlot/>` + `<TabList>` + `<TabTrigger asChild>`) permet de
  rendre une barre 100 % maîtrisée (Vert sous-bois, cibles ≥ 44 px, FAB
  surélevé) avec les 4 routes **et** un bouton intercalé au centre, sans créer
  de route fantôme. La barre est pilotée par `TABS` (`navigation/tabs.ts`),
  **source unique** consommée aussi par le test. La racine reste un `Stack`
  (groupes `(auth)`/`(tabs)`).
- **Structure des tokens (UI/UX §3) : primitives typées, zéro hex dispersé.**
  `colors` indexe la palette « Écurie chaleureuse » **par rôle** (`primary`,
  `surface`, `danger`…), pas par teinte — la frontière stable est le rôle. Grille
  8 px (`spacing`, demi-pas 4 px), rayons 12–20 px, **ombres chaudes** (couleur =
  Cuir, jamais de gris froid), `minTouchTarget = 44`. **Mode clair uniquement**
  (`userInterfaceStyle: light` dans `app.json`, `StatusBar` sombre) — pas de dark
  mode (§8).
- **Typo chargée : Hanken Grotesk (display/chiffres) + Inter (corps)** via
  `@expo-google-fonts/*` + `useFonts` au démarrage (voile crème tant que les
  polices ne sont pas prêtes). Variantes numériques (`hero`, `stat`) en
  **chiffres tabulaires** (`fontVariant: ['tabular-nums']`) — §3.2/§8.
- **Gestion des jetons (Stack §3.4) : refresh en secure storage, access en
  mémoire.** `token-store.ts` injecte un backend `SecureStorageBackend` étroit
  (la prod passe le module `expo-secure-store` ; les tests un faux en mémoire) —
  la logique reste **testable sans natif**. L'access vit en variable de module
  (jamais persisté) ; le refresh va dans `expo-secure-store` (clé
  `hpt.refresh_token`). **Survit au redémarrage** : une nouvelle instance de
  store relit le refresh, l'access repart de zéro (prouvé par test).
- **Interceptor 401 single-flight (`api-client.ts`).** Une requête authentifiée
  qui prend un **401** déclenche **un** `POST /auth/refresh` (refresh de 1.1),
  persiste le nouveau couple, puis **rejoue** la requête. Plusieurs 401
  concurrents **partagent une seule rotation** (`refreshing` mutualisé) — sinon
  deux rotations parallèles tueraient la famille (détection de réutilisation de
  1.1). La réponse de refresh est validée par **`authTokensSchema` de
  `@hpt/shared`** (aucun type dupliqué). Refresh rejeté (expiré/révoqué/réuti­lisé)
  → purge locale + `onSessionExpired` → écran de connexion. Au **démarrage**, si
  un refresh existe, `GET /auth/me` part sans access → 401 → l'interceptor
  rafraîchit et rejoue : la session se restaure **sans code spécial**.
- **État serveur via TanStack Query (Stack §3.1).** Le compte (`/auth/me`) est
  une `useQuery` (cache, activée quand une session existe) ; `login`/`register`/
  `logout` sont des `useMutation`. `register` enchaîne une **connexion
  automatique** (l'API 1.1 ne renvoie pas de jetons à l'inscription). `status`
  (`loading`/`authenticated`/`unauthenticated`) dérive de l'amorçage + de la
  query ; le `_layout` racine **garde** la navigation (redirige `(auth)` ↔
  `(tabs)`).
- **Profil = état minimal du compte + déconnexion** (consigne). Affiche e-mail,
  `tier` (badge) et `type` (Cavalier/Coach) lus au login ; bouton **Se
  déconnecter** (révoque le refresh côté serveur puis purge local). Le `tier` est
  indicatif — le **gating reste l'autorité serveur** (Architecture §3), pas l'UI.
- **Câblage de 1.2 (intégré) : points d'entrée *request* seulement.** Sont
  câblés : **mot de passe oublié** (`/forgot-password` → `POST
  /auth/password-reset/request`, anti-énumération) et **renvoi du lien de
  vérification** depuis le Profil quand `email_verified = false` (`POST
  /auth/verify-email/request`). **Non câblés (différés)** : les écrans de
  *confirmation* par jeton (`verify-email/confirm`, `password-reset/confirm`),
  qui supposent un **deep link** porteur du jeton — hors surface de la DoD (1.1)
  et non trivial. Consigné comme point ouvert.
- **FAB et sélecteur de cheval = placeholders explicites.** Le **FAB central**
  est présent et proéminent mais **inactif** : il ouvre un message « la saisie
  arrive au prochain lot » (la saisie est 2.2/2.3). Le **sélecteur de cheval** en
  en-tête (Feed/Historique/Analytique) est rendu **inerte et désactivé** (« Aucun
  cheval ») : la coquille le *prévoit visuellement* sans **aucune** logique
  multi-cheval (aucun cheval avant 2.1) — conforme à la consigne « hors
  périmètre ».
- **Écrans d'onglets = invitations (UI/UX §7).** Feed/Historique/Analytique sont
  des `EmptyState` (icône + titre + invitation), jamais un vide muet ; leur vrai
  contenu vient avec leurs lots.

### Écarts vs cadrage (consignés)

- **Suppression de `app/src/contracts.demo.ts` (artefact du lot 0.2).** Sa
  raison d'être — prouver à la compilation que `@hpt/shared` est consommable
  côté app — est désormais **assurée par du code réel** (`api-client`,
  `auth-api`, `auth-context`, écrans importent les DTO/schémas de `shared`). Le
  démo était devenu du code mort ; retiré. Le pendant **api**
  (`api/src/contracts.demo.ts`) est **conservé** (aucune autre consommation
  runtime de `shared` n'a remplacé sa démonstration côté api à ce stade).
- **Nouvelles dépendances app** (versions alignées sur Expo SDK 56 via
  `bundledNativeModules`) : `expo-secure-store ~56.0.4`, `expo-font ~56.0.7`,
  `@expo/vector-icons ^15`, `@expo-google-fonts/hanken-grotesk`,
  `@expo-google-fonts/inter` ; `vitest` en dev. `app.json` déclare les plugins
  `expo-font` + `expo-secure-store` et fige le mode clair.
- **Tests app en Vitest *Node* (logique pure).** Pas de rendu React Native en
  test (toolchain RN+Vitest fragile) : on isole la **logique non triviale et
  critique** (token store, interceptor 401) dans des modules **purs et
  injectables**, couverts par Vitest. La **structure de navigation** est
  vérifiée via la config `TABS` (même source que l'UI). Le rendu/compilation des
  écrans est couvert par `tsc --noEmit` **et** par un **export Metro web réel**
  (voir DoD) qui bundle les 16 routes sans erreur. `pnpm -r run test` exécute
  désormais aussi le paquet `app` (script `test` ajouté).
- **`StyleSheet.absoluteFillObject` absent des types** de cette version RN →
  positionnement absolu écrit explicitement (sans incidence).

### Points laissés ouverts

- **Confirmation 1.2 par deep link** (`verify-email/confirm`,
  `password-reset/confirm`) : non câblée — nécessite la gestion d'un lien
  entrant (`expo-linking` + `APP_PUBLIC_URL`). À poser quand on traitera les
  liens entrants (probablement avec l'onboarding 3.5 ou un lot dédié).
- **Gating `email_verified`** (point ouvert hérité de 1.1/1.2) : le login reste
  ouvert ; le Profil **invite** seulement à vérifier (bandeau + renvoi). Aucune
  fonctionnalité n'est bloquée — décision produit non tranchée.
- **Brouillon + réessai d'enregistrement** (qualité de plancher, Stack §4) :
  hors périmètre 1.4 (rien à enregistrer encore) — viendra avec la saisie 2.2.
  L'**interceptor 401** pose déjà la brique « réessai transparent sur jeton
  expiré ».
- **Tests de rendu de composants** (RTL/`@testing-library/react-native`) : non
  introduits (coût d'outillage). À rouvrir si un lot front exige d'assert sur le
  rendu plutôt que sur la logique.
- **Rate limiting / révocation d'access** (transverse, hérité de 1.1) : inchangé.
- **Démarrage Metro natif** (iOS/Android) non exécuté dans le bac à sable ; la
  preuve runtime est l'**export web** (Metro, 1030 modules, 16 routes). Un
  `expo start` natif reste à confirmer côté validateur.

### DoD — preuves

| Critère | Vérification | Statut |
|---|---|---|
| Naviguer entre les **4 onglets** ; **FAB central** présent | `tabs.test.ts` (4 onglets ordonnés + FAB au centre) ; export Metro : routes `/`, `/historique`, `/analytique`, `/profil` + `(tabs)` rendues | ✅ |
| **Coquille de navigation** câblée | Export web : 16 routes statiques générées sans erreur (groupes `(auth)`/`(tabs)`) | ✅ |
| **S'inscrire / se connecter / se déconnecter** depuis l'app (API 1.1) | Écrans `register`/`login`/`profil` câblés sur `/auth/register`+`/auth/login`+`/auth/logout` via `auth-api`/`auth-context` ; typecheck + bundle verts | ✅ (parcours live = api+app, cf. compte rendu) |
| **Refresh en secure storage**, **survit au redémarrage** | `token-store.test.ts` : refresh persiste, relu par une nouvelle instance ; access (mémoire) perdu au « redémarrage » | ✅ |
| **Access expiré rafraîchi automatiquement** (interceptor 401) | `api-client.test.ts` : 401 → refresh → rejeu (200) ; single-flight ; échec → purge + `onSessionExpired` ; `auth:false` n'intercepte pas | ✅ 6/6 |
| Réponse de refresh **validée par le schéma partagé** | `api-client.test.ts` : `authTokensSchema` rejette une réponse non conforme | ✅ |
| **Tokens UI** appliqués (palette, typo, espacements, mode clair) | `theme/` consommé par toutes les primitives ; `app.json` `userInterfaceStyle: light` ; export web rend les écrans | ✅ |
| Aucun type d'API dupliqué | DTO/schémas importés de `@hpt/shared` (`AuthTokens`, `CompteSortie`, `authTokensSchema`, `LoginDto`, `RegisterDto`) | ✅ |
| `pnpm lint` | `biome check .` | ✅ exit 0 |
| `pnpm typecheck` | build `shared` puis `tsc --noEmit` (shared + api + app) | ✅ vert |
| `pnpm test` | Vitest — 40 (shared) + 13 (api) + **16 (app : 5 token-store + 6 interceptor + 5 nav)** | ✅ 69/69 |
| `pnpm build` | shared (ESM+CJS) + api (nest) + app (typecheck) ; **export Metro web** OK (1030 modules) | ✅ vert |
| CI | job `ci` (install→lint→typecheck→test→build) — couvre désormais les tests app | ✅ |

---

## Lot 2.1 — Cheval (CRUD fiche cheval) · 2026-06-27

Ouverture de la **Phase 2 (Capture)** : module **`horses`** (Architecture §3) —
**CRUD de la fiche cheval**, **scopé au compte authentifié**, + sa tranche front
(créer/éditer/supprimer un cheval depuis l'app). Première entité métier détenue
par l'utilisateur ; **dépend de `auth-account`** (1.1, garde JWT). On **ne
recrée pas** le schéma socle (`Cheval` posée en 0.3) : on remplit le module qui
l'expose. Strictement le lot 2.1 : ni séance/saisie (2.2/2.3), ni archivage
(4.3), ni quota/gating de tier (4.1), ni multi-cheval réel (Pro, 4.x), ni
onboarding (3.5).

### Emplacement (décisions tranchées)

- **Module API** : `api/src/horses/` (par domaine, §1/§3) — `horses.service`
  (domaine, CRUD scopé), `horses.controller` (frontière HTTP sous
  `JwtAccessGuard`), `horses.errors` (`ChevalNotFoundError` typée),
  `horses.module`. Enregistré dans `app.module.ts`. La DB vient du
  `DatabaseModule` `@Global` (1.1) ; `PassportModule` importé pour que la garde
  `jwt-access` (stratégie enregistrée par `auth-account`) protège les routes.
- **Contrats `shared`** : `packages/shared/src/schemas/cheval.ts` étendu —
  `chevalCréerSchema` (existait), **`chevalModifierSchema`** (PATCH partiel) et
  **`chevalSortieSchema`** (projection détail/liste) ajoutés + types inférés.
- **Tranche front** : `app/src/horses/` — `horses-api` (surface HTTP),
  `horses-context` (provider + `useHorses` : liste, mutations, **cheval
  courant**), `horse-form` (formulaire partagé création/édition), `horse-selector`
  (chip d'en-tête), `error-messages`, barrel. Écrans (routes Expo Router hors
  groupes, au Stack racine) : `app/horses/index` (liste « Mes chevaux »),
  `app/horses/new` (création), `app/horses/[id]` (édition + suppression). Primitive
  UI générique ajoutée : `ui/BackHeader` (en-tête des écrans poussés).

### Décisions tranchées (et pourquoi)

- **Forme des DTO `shared` chevaux.** Trois schémas, une responsabilité chacun :
  - `chevalCréerSchema` (entrée création) — `nom`, `niveau` (`amateur | pro`),
    `hauteur_de_référence` (sur un cran du référentiel §0), `âge`/`race`
    **optionnels**. `compte_id` **absent du corps** : posé par le serveur depuis
    le compte authentifié.
  - `chevalModifierSchema` (entrée PATCH) — **tous les champs optionnels** (un
    champ absent reste inchangé) ; `âge`/`race` acceptent **`null`** pour les
    **effacer**. Un `superRefine` **rejette un corps vide** (400) — pas de PATCH
    muet.
  - `chevalSortieSchema` (sortie détail & liste) — projection de la fiche
    (`âge`/`race` rendus `null`, pas omis) ; `.strip()` par défaut → parser la
    ligne brute ne peut **rien laisser fuir**. Distinct de `chevalExportSchema`
    (1.3) qui imbrique l'arbre des séances ; ce dernier **réutilise** désormais
    `chevalSortieSchema` (`.extend({ seances })`) — **aucune forme dupliquée**.
- **Modèle d'autorisation = scoping au compte dans la requête SQL.** Toute
  opération porte le `compteId` du jeton d'accès (`@CurrentUser`, jamais l'URL)
  et filtre par `compte_id` **dans le `WHERE`** (`and(eq(id), eq(compte_id))`).
  Un compte ne voit/édite/supprime que **ses** chevaux. Viser le cheval d'un
  autre compte → **404** (`ChevalNotFoundError`), **pas 403** : un 403
  révélerait l'existence ; le 404 ne fuite rien (décision : pas d'oracle
  d'existence). Les `:id` malformés sont rejetés en **400** par `ParseUUIDPipe`
  (avant la base). Validation Zod à la frontière, règles métier au service,
  erreurs de domaine typées (Architecture §5).
- **Suppression = purge dure en cascade**, en **réutilisant les cascades de
  0.3** (`Cheval → Séance → {Obstacle, Tour, Contexte}`). `DELETE` scopé au
  compte ; tout l'historique tombe par `ON DELETE CASCADE`. **Pas de soft
  delete** (cohérent avec 1.3). Prouvé « aucune ligne résiduelle » par e2e
  (comptage par `cheval_id`/`seance_id` après suppression → 0 partout). Supprimer
  un cheval **n'affecte pas** les autres chevaux du compte (testé).
- **Cheval courant & sélecteur d'en-tête (ce qui est posé).** `HorsesProvider`
  expose `currentHorse` = **premier (et unique en v1) cheval** du compte —
  suffisant pour que la coquille (Feed/Historique/Analytique) sache quoi
  afficher. Le **sélecteur d'en-tête** (`HorseSelector`) remplace le placeholder
  *inerte* de 1.4 : il affiche le nom du cheval courant (ou « Aucun cheval ») et
  **mène à la gestion** (`/horses`). Il **n'opère aucune bascule multi-cheval**
  (le dropdown entre plusieurs chevaux relève du Pro, 4.x). Mono-cheval suffit.
- **Client HTTP authentifié réutilisé, pas redupliqué.** `auth-context` **expose**
  désormais son `ApiClient` (access en mémoire + interceptor 401 de 1.4) ;
  `horses-context` consomme **le même** client (même session, même
  rafraîchissement) plutôt que d'en recréer un (qui ne partagerait pas l'access
  en mémoire). État serveur via **TanStack Query** (liste activée seulement si
  authentifié, clé portée par le compte ; mutations invalident la liste).
- **Formulaire minimal partagé** (création + édition) : `nom` + `niveau`
  (SegmentedControl) + `hauteur_de_référence` requis, `âge`/`race` facultatifs
  (Spec §2.2). Le **slider de hauteur** dédié est différé à la saisie (2.x) — ici
  un champ numérique validé sur le référentiel §0 (`estHauteurValide`) suffit ;
  le serveur reste l'autorité. **Suppression avec confirmation explicite**
  (`Alert` destructif rappelant la purge de l'historique) — qualité de plancher.
- **Aucun quota/tier dans `horses`.** Le plafond (1 en gratuit/premium, illimité
  en pro) **n'est pas** vérifié ici : c'est l'affaire de la **garde d'entitlement
  (4.1)**, autorité serveur. La capacité se construit ici, la garde la composera
  (même précédent que 1.1 : on ne disperse pas les checks de `tier`).

### Écarts vs cadrage (consignés)

- **Suppression d'un cheval AJOUTÉE — résolution du renvoi de 1.3.** Le journal
  1.3 renvoyait « suppression d'un cheval seul → 2.1 » ; c'est fait
  (`DELETE /horses/:id`). Cela **étend la DoD roadmap** du lot 2.1 (qui ne
  nommait que création/édition) — écart **assumé et consigné**, cohérent avec la
  purge dure de 1.3 (réutilisation des cascades 0.3, pas de soft delete).
- **Refactor mineur de 1.3 (dédup, aucun contrat changé).** `chevalExportSchema`
  passe de champs en clair à `chevalSortieSchema.extend({ seances })`. Forme et
  comportement **identiques** (mêmes champs, strip préservé) ; l'export reste
  prouvé par `account-export.test.ts` (inchangé, vert). Même esprit que
  l'extraction de `motDePasseSchema` en 1.2.
- **`auth-context` expose `ApiClient`** (champ `client` ajouté à
  `AuthContextValue`). Extension non destructive : aucun appelant existant n'est
  cassé ; elle évite de dupliquer le client/token-store côté `horses`.
- **`ScreenHeader` : `horseSelectorPlaceholder` → slot générique `right`.** Le
  placeholder inerte de 1.4 est remplacé par un emplacement droit agnostique que
  les onglets remplissent avec `HorseSelector` (logique de fonctionnalité hors
  `ui/`). Les 3 écrans d'onglet sont mis à jour en conséquence.
- **Pas de migration, pas de nouveau type d'entité.** Le schéma `Cheval` (0.3) et
  ses cascades suffisent ; le lot est purement additif en code applicatif
  (service + controller + contrats + front).

### Points laissés ouverts (reports explicites)

- **Quota de chevaux → lot 4.1.** Aucun plafond appliqué ici (gratuit/premium = 1,
  pro = illimité) : garde d'entitlement serveur, à composer par-dessus la
  capacité CRUD posée. (Même report que 1.1 pour le `tier`.)
- **Archivage d'un cheval (lecture seule, hors quota) → lot 4.3.** Aucune colonne
  `archivé` ni logique d'archivage ici — différé tel quel.
- **Bascule multi-cheval (Pro) → 4.x.** `currentHorse` est mono-cheval ; le
  sélecteur d'en-tête est *visuellement prévu* mais ne bascule pas entre plusieurs
  chevaux. Le câblage d'un vrai switcher (et la persistance du cheval choisi)
  viendra avec le multi-cheval réel.
- **Saisie / FAB** : inchangé — le **FAB reste placeholder** (la saisie est
  2.2/2.3) ; le cheval existe mais on ne loggue encore rien.
- **Onboarding guidé (3.5)** : réutilisera l'écran de création — non construit ici.

### DoD — preuves

| Critère | Vérification | Statut |
|---|---|---|
| **Créer** un cheval lié au compte authentifié | e2e `horses.spec.ts` : `POST /horses` 201, `compte_id` = compte courant, projection complète | ✅ |
| **Lister/lire** ne renvoie que **ses** chevaux | e2e : `GET /horses` du compte A = ses 2 chevaux (pas celui de B) ; détail scopé | ✅ |
| **Éditer** met à jour ; `niveau` ∈ `amateur \| pro` | e2e : PATCH nom/niveau/hauteur + effacement `âge`/`race` (null) ; `niveau` hors enum → 400 ; corps vide → 400 | ✅ |
| **Supprimer** purge le cheval **et** son historique (cascade) | e2e : seed séances/obstacles/tours/contexte → `DELETE` 204 → comptage = 0 partout ; autres chevaux intacts | ✅ |
| **Autorisation prouvée** (isolation entre comptes) | e2e : B lit/édite/supprime un cheval de A → **404** ; cheval de A inchangé ; `POST` sans jeton → 401 | ✅ |
| **Depuis l'app** : créer/éditer/supprimer (câblé API) | écrans `horses/new` · `horses/[id]` (édition + suppression confirmée) câblés via `horses-api`/`horses-context` ; typecheck + bundle verts | ✅ |
| Aucun type d'API dupliqué | DTO/schémas importés de `@hpt/shared` (`ChevalCréerDto`, `ChevalModifierDto`, `ChevalSortie`) ; `chevalExportSchema` réutilise `chevalSortieSchema` | ✅ |
| `pnpm lint` | `biome check .` | ✅ exit 0 |
| `pnpm typecheck` | build `shared` puis `tsc --noEmit` (shared + api + app) | ✅ vert |
| `pnpm test` (sans DB) | Vitest — 46 (shared, +6 cheval) + 13 (api) + **21 (app, +5 horses-api)** | ✅ 80/80 |
| `pnpm build` | shared (ESM+CJS) + api (nest) + app (typecheck) | ✅ vert |
| `db:verify` (Postgres requis) | Vitest — 7 (0.3) + 9 (1.1) + 10 (1.2) + 7 (1.3) + **15 (horses 2.1)** | ✅ 48/48 |
| CI | job `ci` (sans DB) + job `db` (`migrate` + `verify`, e2e 2.1 inclus) — inchangée (aucune migration) | ✅ |

---

## Lot 2.2 — Séance — modèle & création minimale · 2026-06-27

Module **`sessions`** (Architecture §3) : l'**enregistrement** d'une séance —
collection d'`Obstacle` **ou** de `Tour` selon le type, avec **horodatage**,
**provenance** et **clé d'idempotence** — par un **chemin de création minimal**
(API + test, pas l'UX). `sessions` est le **gardien de l'inviolabilité** : toute
écriture de séance passe par son service (Modèle §2). On **n'a pas** recréé le
schéma socle (tables `Séance/Obstacle/Tour/Contexte` posées en 0.3) ; on **écrit
dedans**. Strictement le lot 2.2 : ni saisie rapide/UX (2.3), ni
édition/suppression (2.4), ni combinaisons réutilisables / `combinaison_ref`
(2.5), ni métriques (3.2).

### Emplacement (décisions tranchées)

- **Module API** : `api/src/sessions/` (par domaine, §1/§3) — `sessions.service`
  (domaine, porteur de l'inviolabilité), `sessions.controller` (frontière HTTP
  sous `JwtAccessGuard`), `sessions.errors` (`SéanceNotFoundError` typée),
  `sessions.module`. Enregistré dans `app.module.ts`. La DB vient du
  `DatabaseModule` `@Global` (1.1) ; `PassportModule` importé pour la garde
  `jwt-access` ; **`HorsesModule` importé** pour consommer `HorsesService`.
- **`HorsesModule` exporte désormais `HorsesService`** (extension non
  destructive de 2.1) : `sessions` **dépend de `horses`** et vérifie la
  **propriété du cheval** via son service exposé, **jamais en lisant sa table**
  (Architecture §1).
- **Schéma + migration** : colonne `idempotency_key` ajoutée à
  `api/src/db/schema/seance.ts` + migration additive
  `api/drizzle/0003_romantic_iron_patriot.sql` — **là où l'api possède la DB**
  (cohérent avec 0.3).
- **Contrats `shared`** : `packages/shared/src/schemas/seance.ts` (entrée + sortie),
  `champs-techniques.ts` (brique de sortie partagée), sorties d'`obstacle.ts` /
  `tour.ts` / `contexte.ts` ; `account-export.ts` (1.3) **dédupliqué** pour les
  réutiliser.

### Décisions tranchées (et pourquoi)

- **Clé d'idempotence — forme & portée d'unicité.** `idempotency_key` est un
  **UUID généré côté client**, **fourni à la création** (requis dans le DTO),
  colonne **`uuid NOT NULL`** sur `Séance`. **Portée d'unicité =
  `UNIQUE(cheval_id, idempotency_key)`** (« minimum nécessaire ») : l'idempotence
  porte sur « créer CETTE séance pour CE cheval » ; scoper au cheval (lui-même
  scopé au compte par la propriété 2.1) **confine l'espace de noms de la clé au
  propriétaire** — une clé d'un tenant ne peut pas entrer en collision avec celle
  d'un autre (défense en profondeur, pas de DoS/fuite inter-comptes). Un UUID
  client rend toute collision dans ce scope effectivement impossible hors réessai
  légitime. **Hors Modèle de données socle** → clé ASCII, **exclue de
  l'alignement `shared`** (cf. écarts).
- **Idempotence applicative à deux niveaux.** (1) **Chemin rapide** : avant
  d'écrire, le service cherche une séance `(cheval_id, idempotency_key)` ; si elle
  existe, il la **renvoie** (pas de doublon). (2) **Filet de course concurrente** :
  l'INSERT est tenté quand même ; une **violation d'unicité** (SQLSTATE `23505`)
  est rattrapée → on relit et renvoie la séance gagnante. Robuste aux réessais
  *séquentiels* (réseau) **et** *concurrents*. Le réessai renvoie **201** comme
  la création (pas de cas particulier de statut — le corps prouve l'absence de
  doublon ; consigné comme point mineur).
- **Provenance — fournie & posée.** Le DTO d'entrée porte `provenance`
  (`live | déclaratif`), **défaut `live`** appliqué par Zod
  (`provenanceSchema.default('live')`). Le service **pose** la valeur à
  l'écriture (`provenance: dto.provenance`). Le chemin **accepte `déclaratif`**
  (amorçage) mais le **flux d'onboarding qui s'en sert est 3.5** (non construit).
  On **persiste** seulement : l'**exclusion du `déclaratif` des agrégats** est
  l'affaire des métriques (**3.2**), pas ici — rien n'est calculé.
- **Inviolabilité posée à l'enregistrement (Modèle §2).** Le service pose
  **`date = new Date()`** (horodatage), `provenance`, et laisse
  **`date_modification` à `null`** (colonne nullable, non renseignée à
  l'insert). La `date` métier est distincte des `created_at/updated_at`
  techniques. L'application de l'immuabilité à l'**édition** (refus d'UPDATE
  silencieux de `date`, pose auto de `date_modification`) reste pour **2.4** (pas
  d'édition ici).
- **Écriture transactionnelle (tout ou rien).** `Séance` + ses
  `Obstacle`/`Tour` + `Contexte` (0..1) sont écrits dans **une** transaction
  Drizzle (`db.transaction`). Insert parent → inserts enfants groupés → contexte.
  Un enfant invalide **annule tout** (rollback prouvé). Le **type pilote la
  structure** : `Concours` → tours, sinon obstacles ; **Plat = 0 obstacle**
  accepté (validé par Zod `superRefine`, rejeu côté service par construction).
- **Forme des DTO `shared` de séance.** *Entrée* `séanceCréerSchema`
  (refactor de 0.2) : **`cheval_id` retiré du corps** (il vient de l'URL
  `/horses/:id/sessions` et la propriété est vérifiée serveur — même posture que
  `chevalCréerSchema` avec `compte_id`), **`idempotency_key` (UUID) requis
  ajouté**, `provenance` défaut `live`, `obstacles[]` **ou** `tours[]`,
  `contexte` (0..1), `superRefine` type↔structure conservé. *Sortie*
  **`séanceSortieSchema`** (nouveau) : projection imbriquée
  (champs séance + `obstacles[]` + `tours[]` + `contexte`), `date_modification`
  nullable, **`idempotency_key` jamais projetée** (donnée technique ; `.strip()`
  Zod la retire — prouvé runtime + garde de type). Sorties d'unités ajoutées
  (`obstacleSortieSchema`, `tourSortieSchema`, `contexteSortieSchema`) sur une
  brique commune `champsTechniquesSortie`.
- **Contour exact du « chemin minimal ».** Trois routes ressource (Architecture
  §5), toutes sous garde JWT + scoping compte : `POST /horses/:id/sessions`
  (création transactionnelle, idempotente), `GET /horses/:id/sessions` (liste
  d'un cheval), `GET /sessions/:id` (détail). Lecture **brute** (arbre imbriqué)
  suffisante pour prouver la persistance — **le feed riche est 3.1**. **Pas** de
  FAB/saisie soignée, **pas** d'aperçu des taux, **pas** de duplication (2.3).
- **Autorisation = via le service `horses`, 404 sans fuite.** Création/liste
  vérifient `horses.findOne(compteId, chevalId)` (lève `ChevalNotFoundError` →
  404 si étranger). `GET /sessions/:id` lit la séance (table du module) puis
  vérifie la propriété du cheval via `horses` ; toute séance non possédée devient
  un **404 `SéanceNotFoundError`** (pas 403 : pas d'oracle d'existence, cohérent
  avec 2.1). `:id` malformé → **400** (`ParseUUIDPipe`). Validation Zod à la
  frontière, règles métier au service, erreurs de domaine typées.

### Écarts vs cadrage (consignés)

- **`idempotency_key` hors Modèle de données socle.** La table cible existe (0.3)
  mais cette colonne **n'est pas** dans le Modèle (doc 3) : c'est un besoin
  serveur (résilience d'enregistrement, Stack §4). Ajout par **migration Drizzle
  additive** (`0003`, `ADD COLUMN` + `ADD CONSTRAINT UNIQUE`). Comme les tables
  techniques `refresh_token`/`verification_token` (1.1/1.2) ne sont pas alignées
  sur `shared`, cette colonne technique est **exclue de l'alignement** : la garde
  `alignment.spec.ts` compare `NullToOptional<Omit<…seance, 'idempotency_key'>>`
  au type de domaine `Séance` (qui reste un miroir fidèle du Modèle). La forme de
  domaine `Séance` et la projection `séanceSortieSchema` **ne portent pas** la
  clé.
- **Refactor de `séanceCréerSchema` (0.2).** Le schéma de 0.2 portait `cheval_id`
  dans le corps et **n'était utilisé que par ses tests**. Recâblé pour la route
  ressource (cible dans l'URL, clé d'idempotence requise). Test `schemas.test.ts`
  mis à jour en conséquence.
- **Dédup de `account-export.ts` (1.3) — aucun contrat changé.** Les schémas de
  sortie de l'export (`obstacleExportSchema`, `tourExportSchema`,
  `contexteExportSchema`, `seanceExportSchema`) **réutilisent** désormais les
  nouvelles projections de sortie (`*SortieSchema`) au lieu de redéclarer leur
  forme — « aucune forme dupliquée » (Architecture §2), même esprit que le
  refactor `chevalExportSchema → chevalSortieSchema` de 2.1. Formes **identiques**
  → `account-export.test.ts` reste vert sans modification.
- **Seeds de séance des lots antérieurs corrigés.** `idempotency_key` étant
  `NOT NULL`, les `INSERT INTO seance (…)` directs des specs 0.3/1.3/2.1
  (`schema.spec`, `account.spec`, `horses.spec`) reçoivent un
  `gen_random_uuid()`. Changement de seed **non comportemental** (aucune
  assertion modifiée). *Note migration* : `ADD COLUMN … NOT NULL` sans défaut
  échouerait sur une table **peuplée** ; ici `seance` est vide en tout
  environnement (2.2 est le **premier** chemin d'écriture de séance) → sûr. À
  garder en tête si jamais un backfill devient nécessaire.

### Points laissés ouverts (reports explicites)

- **UX de saisie rapide → lot 2.3** : presets, sliders, compteurs « tap », chips,
  duplication d'obstacle (« +5 cm ») et de séance, aperçu des taux. **Le FAB
  reste placeholder** (1.4) ; ici seulement API + test.
- **Édition / suppression de séance → 2.4** : création uniquement. L'application
  *runtime* de l'immuabilité à l'édition (refus d'UPDATE de `date`, pose auto de
  `date_modification`) sera posée là, par-dessus la *forme* déjà encodée (0.3).
- **`combinaison_ref` & combinaisons réutilisables → 2.5** : l'obstacle de type
  Combinaison ne porte ici que l'**inline** `nombre_d_éléments` + `éléments`
  (détail saisi à la main), comme prévu en 0.3.
- **Exclusion du `déclaratif` des agrégats → 3.2** : la provenance est
  **persistée** ici ; la curation « live seul » est l'affaire des métriques.
  Idem `difficulté` d'obstacle = couche contexte (persistée, **jamais agrégée**,
  §1).
- **Réessai / brouillon côté app (Stack §4)** : la brique serveur (idempotence)
  est posée ; le brouillon local + réessai automatique de l'app viennent avec la
  saisie **2.3** (l'interceptor 401 de 1.4 pose déjà le réessai sur jeton).
- **Statut HTTP du réessai idempotent** : renvoie **201** (comme la création)
  plutôt que 200 — choix de simplicité, à reconsidérer si un client a besoin de
  distinguer création et rejeu.

### DoD — preuves

| Critère | Vérification | Statut |
|---|---|---|
| Enregistrer un entraînement (obstacles) **persisté & horodaté** ; `date_modification` null ; provenance posée | e2e `sessions.spec.ts` : `POST /horses/:id/sessions` 201 → `date` ~ now, `provenance: 'live'`, `date_modification: null` (corps **et** DB) ; relecture `GET /sessions/:id` | ✅ |
| Enregistrer un **Concours** (tours) **et** un **Plat** (0 obstacle) | e2e : Concours → `tours.length = 2`, `obstacles = 0` ; Plat → `obstacles = 0`, `tours = 0` | ✅ |
| **Réessai** même clé ⇒ **pas de doublon** (séance existante renvoyée) | e2e : 2ᵉ POST (même `idempotency_key`) → **même `id`** ; `count(seance) = 1`, `count(obstacle) = 1` | ✅ |
| **Écriture atomique** : un enfant invalide ⇒ **rollback** | e2e : `service.create` avec un obstacle au **type hors enum** → rejette ; `count(seance) = 0` **et** `count(obstacle) = 0` | ✅ |
| **Autorisation** : créer/lire la séance du cheval d'un **autre compte** refusé | e2e : B `POST`/`GET …/sessions`/`GET /sessions/:id` sur le cheval/la séance de A → **404** ; `POST` sans jeton → 401 ; rien d'écrit côté A | ✅ |
| **Migration** `idempotency_key` **s'applique** sur Postgres local | `drizzle-kit migrate` (0000→0003) + e2e : colonne `uuid NOT NULL`, contrainte `UNIQUE (cheval_id, idempotency_key)` constatées | ✅ |
| Aucun secret/technique en sortie | `séanceSortieSchema` strippe `idempotency_key` (runtime **+** `expectTypeOf`) | ✅ |
| Aucun type d'API dupliqué | DTO/schémas de `@hpt/shared` ; `account-export` réutilise les `*SortieSchema` | ✅ |
| `pnpm lint` | `biome check .` | ✅ exit 0 |
| `pnpm typecheck` | build `shared` puis `tsc --noEmit` (shared + api + app ; alignement `Séance` avec `Omit`) | ✅ vert |
| `pnpm test` (sans DB) | Vitest — 50 (shared, +4 séance) + 13 (api) + 21 (app) | ✅ 84/84 |
| `pnpm build` | shared (ESM+CJS) + api (nest) + app (typecheck) | ✅ vert |
| `db:verify` (Postgres requis) | Vitest — 7 (0.3) + 9 (1.1) + 10 (1.2) + 7 (1.3) + 15 (2.1) + **14 (sessions 2.2)** | ✅ 62/62 |
| CI | job `ci` (sans DB) + job `db` (`migrate` 0→0003 + `verify`, e2e 2.2 inclus) | ✅ |

---

## Lot 2.3 — Saisie rapide · 2026-06-28

Tranche **front** du module `sessions` (Architecture §4) : l'**UX de saisie
rapide** par-dessus l'API de création de 2.2. C'est le **cœur de produit**
(Spec §3, cible **< 30 s** sur une séance simple). On **active le FAB central**
(placeholder depuis 1.4) ; on construit l'écran `/capture` (presets de type,
chips d'obstacle, slider de hauteur, compteurs « tap », **duplication**
d'obstacle/de séance, **aperçu des taux** via `shared`) et l'**enregistrement
résilient** (clé d'idempotence client + brouillon local + réessai). Strictement
le lot 2.3 : ni édition/suppression (2.4), ni combinaisons réutilisables (2.5),
ni métriques/feed (3.x). **Zéro changement serveur ni `shared`** : l'API 2.2
suffit (la duplication lit la **dernière séance** via `GET /horses/:id/sessions`
existant).

### Emplacement (décisions tranchées)

- **Module app** : `app/src/sessions/` (par domaine, §1). Logique **pure**
  (`.ts`, testée Vitest en Node) séparée des composants (`.tsx`, couverts par
  `tsc` + export Metro) — même posture que 1.4 (RN+Vitest fragile au rendu) :
  - `idempotency.ts` — `newIdempotencyKey()` (UUID client) ;
  - `draft.ts` — modèle de brouillon + réducteur **pur** + projection vers le
    DTO `shared` + duplication + aperçu des taux ;
  - `submit.ts` — `submitSession()` (réessai/idempotence) ;
  - `draft-store.ts` — brouillon persistant (backend injectable) ;
  - `sessions-api.ts` — surface HTTP (création + lecture dernière séance) ;
  - composants : `chips.tsx` (`ChipGroup`), `height-bar.tsx`, `tap-counter.tsx`,
    `difficulty-marker.tsx`, `rate-preview.tsx`, `obstacle-editor.tsx`,
    `tour-editor.tsx` ; hook `use-session-capture.ts` ; `error-messages.ts`.
- **Route** : `app/src/app/capture.tsx` (`/capture`), poussée au Stack racine
  par le **FAB** ((tabs)/_layout `router.push('/capture')`).

### Décisions tranchées (et pourquoi)

- **Architecture de l'écran : un réducteur pur + un hook d'orchestration + des
  composants « bêtes ».** Tout l'état de saisie est un `SessionDraft` piloté par
  `draftReducer` (actions `addObstacle`/`updateObstacle`/`duplicateObstacle`/
  `setType`/…). Le hook `useSessionCapture` câble réducteur + persistance +
  duplication + mutation ; les composants ne font que **rendre** et
  **dispatcher**. Conséquence : la logique critique (projection DTO, duplication,
  aperçu, réessai) est **testable en Node** sans rendu RN.
- **Le type de séance pilote la structure, sans rien détruire.** `setType`
  **préserve** les deux collections (obstacles **et** tours) ; seule la
  collection pertinente au type est **projetée** dans le DTO (`Concours` →
  `tours`, sinon `obstacles`). Un aller-retour de type ne perd donc pas la
  saisie. **Plat** masque l'ajout d'obstacle (régularité, Spec §3.1) mais reste
  enregistrable à 0 obstacle.
- **Clé d'idempotence générée côté client, stable par brouillon.** `emptyDraft()`
  fixe un `idempotency_key` (UUID v4) **à la création** du brouillon ; il reste
  identique sur tous les réessais. `newIdempotencyKey()` préfère
  `crypto.randomUUID()` et **replie** sur un UUID v4 RFC 4122
  (`getRandomValues`, sinon `Math.random`) — toujours valide pour le
  `z.string().uuid()` du serveur, sans dépendance native ajoutée.
- **Brouillon + réessai (qualité de plancher, Stack §4) en deux temps.**
  (1) **Réessai** : `submitSession` rejoue la **même** requête (donc la même clé)
  sur erreur **transitoire** (réseau/`TypeError`, 5xx, 408, 429) avec **attente
  exponentielle** ; une erreur **définitive** (400/401/404) remonte tout de
  suite. Comme le serveur 2.2 dédoublonne sur `(cheval_id, idempotency_key)`, un
  réessai **ne crée jamais de doublon** (si le 1ᵉʳ essai a écrit avant que la
  réponse se perde, le rejeu renvoie la séance existante). (2) **Brouillon
  local** : `draftStore` mirroir le brouillon (scopé au cheval) sur le stockage
  appareil, réhydraté à l'ouverture, **effacé au succès** — « ne jamais perdre
  une saisie », même après fermeture de l'app. Le client `useMutation` ne
  re-réessaie pas (retry par défaut 0) : `submitSession` est l'unique pilote.
- **Aperçu des taux = fonctions pures de `shared` (0.2), une seule
  implémentation.** `obstaclePreviewRate` appelle `tauxObstacleSimple` /
  `tauxCombinaison` ; un test prouve l'**égalité stricte** aperçu ↔ `shared`. Le
  **dénominateur est exact** (répétitions, × `nombre_d_éléments` pour une
  combinaison). L'aperçu n'est **pas** une surface feed/métrique (3.x) : juste un
  retour local immédiat à la saisie.
- **Duplication séance/obstacle.** « **Même obstacle, +5 cm** » conserve
  type/répétitions/structure, monte d'un cran (borné 160), **repart à 0 faute**
  (nouvelle tentative) ; le clone s'insère juste **après** la source.
  **Duplication de la séance précédente** (`draftFromPreviousSession`) reprend
  type + structure (hauteurs, répétitions, structure de combinaison), **fautes à
  0**, **sans contexte**, et **clé d'idempotence neuve** (c'est une nouvelle
  séance, pas un réessai). La dernière séance vient de `listForHorse` (dernier
  élément de la liste ordonnée par `date`).
- **Périmètre « inline » de la combinaison.** Le type Combinaison ouvre le
  **compteur `nombre d'éléments`** (≥ 2) et, **au choix**, un **détail des
  types** saisi à la main (un `ChipGroup` par slot, `resizeÉléments` synchronise
  la longueur). Le détail n'est **émis au serveur que s'il est complet**
  (`éléments.length === nombre_d_éléments`, exigence du schéma 2.2) ; incomplet →
  omis, le dénominateur reste correct. **La sélection depuis une bibliothèque
  réutilisable (`combinaison_ref`) est le lot 2.5** — pas ici. Fautes **au niveau
  de la combinaison**.
- **Contexte hors chemin critique.** Ressenti/énergie (échelle 1-5,
  `DifficultyMarker` réutilisé) + note libre sont **repliés** derrière « Ajouter
  un ressenti (optionnel) », jamais bloquants, **teinte Cuir** pour les
  distinguer des faits objectifs (Vert sous-bois). Couche contexte, **jamais
  agrégée** (Modèle §1).
- **Voix d'interface (UI/UX §7).** Même mot du bouton à la confirmation :
  « Enregistrer » → écran « **Enregistré** ». La **proposition de carte
  partageable est le lot 3.3** : ici, simple confirmation puis « Terminé ».
- **Composants réutilisables, sans abstraction prématurée.** `ChipGroup`
  générique sert au **type de séance** et au **type d'obstacle/d'élément** ;
  `HeightBar`, `TapCounter`, `DifficultyMarker`, `RatePreview` sont autonomes et
  réutilisables (l'édition 2.4 les rejouera). `HeightBar` porte la **signature
  « hauteur-comme-barre »** (UI/UX §2 : barre qui se remplit en Vert sous-bois).
- **Aucun type dupliqué (Architecture §1/§2).** DTO d'entrée/sortie importés de
  `@hpt/shared` (`SéanceCréerDto`, `SéanceSortie`, `Type*`, calc). La projection
  brouillon → DTO est prouvée par des tests qui **re-valident avec
  `séanceCréerSchema`** (le schéma serveur lui-même).

### Écarts vs cadrage (consignés)

- **Slider de hauteur rendu en « pas ±5 » plutôt qu'en curseur glissé.** Le
  référentiel (60→160, pas de 5, gros chiffre tabulaire) et la signature barre
  sont respectés, mais le réglage se fait par **deux grandes cibles −5/+5**
  (≥ 48 px) au lieu d'un *thumb* glissé : plus robuste **terrain** (une main,
  gants — §8) et sans dépendance native (`@react-native-community/slider` non
  installé ; éviter un module natif fragile au build/web). La logique de pas est
  pure (`stepHauteur`/`clampHauteur`), testée.
- **Brouillon persistant sur `expo-secure-store` (backend injectable).** Réutilise
  l'interface étroite du store de jetons (1.4) ; en prod le brouillon va dans le
  secure storage. **Caveat consigné** : SecureStore déconseille les valeurs
  > 2048 octets sur Android — un brouillon riche (beaucoup d'obstacles + longue
  note) pourrait dépasser. L'écriture échoue alors **silencieusement** (capturée),
  mais le **brouillon en mémoire + le réessai** protègent toujours contre une
  coupure réseau ; seule la survie **au kill de l'app** se dégrade pour ces très
  gros brouillons. Backend futur (`AsyncStorage`/`expo-file-system`) → point
  ouvert.
- **Réessai idempotent côté client : 4 tentatives, backoff 500 ms × 2ⁿ.** Valeurs
  par défaut raisonnables, **injectables** (les tests passent un délai immédiat).
  Le `useMutation` ne double pas le réessai (retry 0).
- **Garde de plancher `canSave` plus stricte que le serveur.** Plat → toujours
  enregistrable ; Gym/Parcours → ≥ 1 obstacle ; Concours → ≥ 1 tour. Le schéma
  2.2 accepterait un entraînement non-Plat vide ; on **resserre côté client**
  (UX) tout en laissant le serveur autorité.
- **Tests app = logique pure (Node), pas de rendu RN.** Cohérent avec 1.4 : 42
  nouveaux tests (`draft` 24, `submit` 7, `draft-store` 5, `idempotency` 4,
  `sessions-api` 2). Le rendu/compilation des écrans est prouvé par `tsc` **et**
  l'**export Metro web** (route `/capture` générée, 1090 modules).

### Points laissés ouverts (reports explicites)

- **Sélection de combinaison réutilisable → 2.5** : ici, combinaison **inline**
  seulement (détail manuel). `combinaison_ref`, bibliothèque de compte, tri
  anti-bloat et « enregistrer depuis une séance » viendront avec `combinations`.
- **Proposition de carte partageable → 3.3** : l'enregistrement confirme
  « Enregistré » ; la carte (`react-native-view-shot`, record mis en avant) et la
  micro-célébration laiton sont le lot `sharing`.
- **Édition / suppression → 2.4** : création uniquement. Le mode édition
  **réutilisera ces composants** (éditeurs d'obstacle/tour, compteurs, slider) en
  pré-remplissant le brouillon depuis une `SéanceSortie` (proche de
  `draftFromPreviousSession`, mais en conservant clé/fautes/date) — l'application
  runtime de l'immuabilité (refus d'UPDATE de `date`, pose de `date_modification`)
  reste serveur.
- **Backend de brouillon hors secure-store** (taille Android) : à rouvrir si un
  brouillon volumineux doit survivre au kill de l'app (cf. écarts).
- **Onboarding guidé → 3.5** : réutilisera cet écran (séance duplicable) ; le
  tunnel pas-à-pas n'est pas construit ici.
- **Tests de rendu de composants** (RTL/`@testing-library/react-native`) :
  toujours non introduits (cohérent avec 1.4) — la logique critique est isolée et
  testée en pur.

### DoD — preuves

| Critère | Vérification | Statut |
|---|---|---|
| Saisir une séance multi-obstacles en quelques taps puis l'enregistrer | Écran `/capture` : chips type → `HeightBar` → `TapCounter` rép/barres/refus, « + Ajouter un obstacle », bouton **Enregistrer** → `submitSession` (API 2.2) | ✅ (logique testée ; route bundlée) |
| Taux par obstacle exacts (via `shared`) | `draft.test.ts` : `obstaclePreviewRate` **===** `tauxObstacleSimple`/`tauxCombinaison` | ✅ |
| Combinaison correctement dénombrée (dénom = rép × éléments) | `draft.test.ts` (combinaison 2×3, dénom 6) ; `nombre_d_éléments` émis, `éléments` omis si incomplet | ✅ |
| « Même obstacle, +5 cm » duplique en montant la hauteur | `draft.test.ts` : type/rép/structure gardés, +5 (borné 160), fautes à 0, clé locale neuve | ✅ |
| Duplication de la séance précédente pré-remplit | `draft.test.ts` : `draftFromPreviousSession` (obstacles & concours), fautes à 0, **clé neuve** | ✅ |
| Plat (0 obstacle) et Concours (tours) saisissables | `draft.test.ts` : `canSave`/`draftToCreateDto` Plat 0 obstacle, Concours tours ; UI bascule la structure | ✅ |
| Brouillon + réessai : coupure passagère ne perd pas la saisie ni ne crée de doublon | `submit.test.ts` : coupure ×2 puis succès, **même `idempotency_key`** à chaque tentative ; 400 non réessayé ; `draft-store.test.ts` : survit au « redémarrage » | ✅ |
| FAB central **actif** | `(tabs)/_layout.tsx` : `router.push('/capture')` ; export Metro : route `/capture` générée | ✅ |
| Accessibilité terrain : cibles ≥ 44 px, contraste AA+, chiffres tabulaires | Cibles `minTouchTarget`(+) sur compteurs/slider/chips ; tokens 1.4 ; `StatText` tabulaire | ✅ |
| Aucun type d'API dupliqué | DTO/calc importés de `@hpt/shared` ; projection re-validée par `séanceCréerSchema` | ✅ |
| `pnpm lint` | `biome check .` | ✅ exit 0 |
| `pnpm typecheck` | build `shared` puis `tsc --noEmit` (shared + api + app) | ✅ vert |
| `pnpm test` | Vitest — 50 (shared) + 13 (api) + **63 (app : 21 + 42 sessions)** | ✅ 126/126 |
| `pnpm build` | shared (ESM+CJS) + api (nest) + app (typecheck) ; **export Metro web** (20 routes, `/capture` incluse, 1090 modules) | ✅ vert |
| CI | job `ci` (install→lint→typecheck→test→build) — couvre les tests sessions app | ✅ |

---

## Lot 2.4 — Édition / suppression de séance · 2026-06-28

Extension du module **`sessions`** (API + tranche front) : **éditer** une séance
(jamais silencieusement — `date_modification` posée et visible) et la
**supprimer** (purge cascade, ses contributions disparaissent). Le service
`sessions` (2.2) reste le **gardien de l'inviolabilité** : toute écriture passe
par lui. On réutilise les **composants de saisie de 2.3** en mode édition.
Strictement le lot 2.4 : ni combinaisons réutilisables (2.5), ni
métriques/feed/records (3.x), ni historique riche (3.4).

### Emplacement (décisions tranchées)

- **API** : `api/src/sessions/sessions.service.ts` (méthodes `update` + `remove`,
  helpers privés `loadOwned` + `insertUnits` factorisés) et
  `sessions.controller.ts` (`PATCH /sessions/:id`, `DELETE /sessions/:id`). **Pas
  de migration** : on écrit dans le schéma 0.3 (cascades déjà posées) ; aucune
  colonne ajoutée.
- **Contrats `shared`** : `packages/shared/src/schemas/seance.ts` — `séanceModifierSchema`
  + `SéanceModifierDto`, et **extraction** de l'invariant `type ↔ structure`
  (`vérifieTypeStructure`) désormais **partagé** par création et édition (aucune
  règle dupliquée).
- **App** : `app/src/sessions/` — `draft.ts` (`draftFromSession`,
  `draftToModifierDto`, `formatDateModification`), `sessions-api.ts`
  (`get`/`update`/`remove`), `use-session-edit.ts` (hook d'orchestration) ;
  **écran** `app/src/app/sessions/[id]/edit.tsx` (route `/sessions/[id]/edit`).

### Décisions tranchées (et pourquoi)

- **Champs éditables vs immuables (liste exacte).** *Éditables* : `type`, la
  **collection** (`obstacles` **ou** `tours` selon le type) et le `contexte`
  (0..1). *Immuables, volontairement absents du DTO d'édition* : **`date`** (jamais
  réécrite, Modèle §2), **`provenance`**, `cheval_id`, `id`, `idempotency_key`. Le
  schéma Zod ne porte tout simplement pas ces clés — un client qui les enverrait
  les voit **strippées** (prouvé par test), jamais une voie détournée pour réécrire
  `date`/`provenance`. **Le `type` est éditable** (correction légitime : la
  structure suit — Parcours→Concours remplace obstacles par tours), sous le même
  invariant `type ↔ structure`.
- **`date_modification` posée par le service (édition jamais silencieuse).**
  `update` pose `date_modification = now` à chaque édition et **ne touche pas** à
  `date`/`provenance`/`idempotency_key`. La valeur n'est **jamais fournie par le
  client**. Le front la **rend visible** (« Modifié le … », libellé sobre via
  `formatDateModification` — UI/UX §7 : assumer sans dramatiser), à l'ouverture de
  l'écran d'édition **et** sur la confirmation post-édition.
- **Sémantique de remplacement, transactionnelle (cohérente avec 2.2).** L'édition
  **remplace** le contenu mutable d'un bloc : dans **une** transaction Drizzle, on
  purge les enfants (`obstacle`/`tour`/`contexte`) puis on réécrit la collection
  cible via le **même** `insertUnits` que la création (tout ou rien). Choix assumé
  vs un PATCH champ-à-champ : la collection est une **unité indivisible** (comme à
  la création), aucune route au niveau obstacle n'existe. `contexte` absent ⇒
  **retiré** (remplacement complet).
- **Comportement d'idempotence à l'édition (consigné).** L'idempotence de 2.2
  dédoublonne la **création** : un re-`POST` avec la même `(cheval_id,
  idempotency_key)` renvoie la séance **existante inchangée** — il **ne contourne
  pas** l'édition (prouvé : re-`POST` même clé + corps différent ⇒ séance d'origine,
  `date_modification` toujours `null`). **Modifier passe forcément par
  `PATCH /sessions/:id`.** L'`idempotency_key` reste la clé d'identité de la ligne
  (intouchée), pas un canal de mutation.
- **Suppression = purge dure en cascade, pas de soft delete.** `remove` vérifie la
  propriété puis `DELETE` la séance ; les FK `ON DELETE CASCADE` de 0.3 (`Séance →
  {Obstacle, Tour, Contexte}`) emportent les enfants. Cohérent avec 1.3 (RGPD,
  aucun soft delete). `204` au succès.
- **« Retire les contributions » est structurel — rien à recompute.** Les dérivés
  (taux, hauteur maîtrisée, records/jalons) **ne sont jamais stockés** (Modèle
  §9/§10) : supprimer (ou éditer) une séance **retire/ajuste mécaniquement** sa
  contribution au **prochain** calcul, qui dérive toujours de l'historique courant.
  **Aucun agrégat à décrémenter, aucune ligne d'agrégat à coder.** Prouvé par un
  test qui calcule un **taux agrégé via `shared`** (`tauxObstacleSimple` sur les
  efforts/fautes additionnés depuis l'API) **avant/après** suppression : `0.5 → 1`,
  sans rien de stocké (on recalcule depuis `GET /horses/:id/sessions`).
- **Autorisation scopée au compte (404 sans fuite).** `update`/`remove` passent par
  `loadOwned` : lecture de la séance puis vérification de la **propriété du cheval**
  via `HorsesService` (jamais en lisant sa table — Architecture §1). Une séance
  d'un autre compte ⇒ **404 `SéanceNotFoundError`** (pas 403 : pas d'oracle
  d'existence, cohérent 2.1/2.2). `:id` malformé ⇒ **400** (`ParseUUIDPipe`).
- **Séances `déclaratives` : mêmes règles.** Le schéma/le service ne distinguent
  pas la provenance (non éditable) — une `déclarative` s'édite et se supprime
  comme une `live` (prouvé : édition d'une `déclarative` ⇒ `date_modification`
  posée, `provenance` conservée).
- **Réutilisation des composants de saisie 2.3.** Le mode édition rejoue **tels
  quels** `ChipGroup`, `HeightBar`/`TapCounter` (via `ObstacleEditor`/`TourEditor`),
  `DifficultyMarker` et le **même `draftReducer`**. `draftFromSession` pré-remplit
  le brouillon **à l'identique** (≠ `draftFromPreviousSession` qui repart à 0
  faute) : type, **fautes**, difficulté, structure de combinaison **et** contexte
  conservés. `draftToModifierDto` projette vers `séanceModifierSchema` (re-validé
  par le schéma serveur dans les tests — aucun type dupliqué).
- **Point d'entrée front (minimal, consigné).** L'écran d'édition est atteint
  depuis la **confirmation d'enregistrement** de la saisie (2.3) : « Modifier la
  séance » → `/sessions/[id]/edit`. C'est le point d'entrée **minimal** voulu ;
  l'écran porte aussi la **suppression** (bouton dédié + `Alert` de confirmation
  explicite). L'**onglet Historique** reste le placeholder de 3.4 — l'entrée
  riche (liste, détail, bilan) y sera branchée là.

### Écarts vs cadrage (consignés)

- **Édition = remplacement de la collection (pas un PATCH partiel champ-à-champ).**
  Le `PATCH /sessions/:id` attend le **contenu mutable complet** (type +
  collection + contexte). Plus simple et non ambigu pour une **collection**
  (fusionner des sous-éléments imposerait des ids d'obstacle/tour adressables,
  absents de l'API — relèverait d'une granularité non requise ici). Les enfants
  reçoivent de **nouveaux ids** à l'édition (ils ne sont pas adressables
  individuellement) — sans incidence sur la séance (id/`date`/`idempotency_key`
  stables).
- **Aucune migration, aucun nouveau dérivé.** Conformément au hors-périmètre : on
  **ne recalcule ni ne stocke** aucun agrégat. Le test de « contribution retirée »
  réutilise la **fonction pure de `shared` (0.2)** ; aucune surface métrique/feed
  n'est introduite (3.x).
- **Tests app = logique pure (Node), pas de rendu RN** (cohérent 1.4/2.3) : la
  fidélité de `draftFromSession`, la projection `draftToModifierDto` et le câblage
  HTTP (`get`/`update`/`remove`) sont testés en pur ; l'écran d'édition est prouvé
  par `tsc` **et** l'**export Metro web** (route `/sessions/[id]/edit` générée).

### Points laissés ouverts (reports explicites)

- **Onglet Historique complet → 3.4** : liste des séances passées, détail, accès au
  bilan, et l'entrée « riche » vers édition/suppression. Ici, seul le point
  d'entrée **minimal** (depuis la confirmation de saisie) est posé.
- **Surfaces métriques / feed / records → 3.x** : elles **consommeront le calcul
  dérivé** (toujours sur l'historique courant) ; la suppression/édition y est déjà
  correctement reflétée **par construction** (rien à recoder côté agrégat). La
  curation « `live` seul » des agrégats reste l'affaire de **3.2** (non filtrée ici).
- **Combinaisons réutilisables / `combinaison_ref` → 2.5** : l'édition manipule la
  combinaison **inline** (comme 2.2/2.3), jamais une bibliothèque.
- **Statut HTTP du rejeu idempotent** : inchangé (201, cf. 2.2) — sans incidence sur
  l'édition (chemin distinct, `PATCH`/200).
- **Résilience de l'édition (réessai/brouillon)** : `submitSession` (réessai
  idempotent) reste réservé à la **création** ; l'édition est une mutation simple
  (l'interceptor 401 de 1.4 couvre la session tombée). À rouvrir si une UX hors
  ligne de l'édition devient nécessaire.

### DoD — preuves

| Critère | Vérification | Statut |
|---|---|---|
| **Éditer** : modifications persistées, `date_modification` **posée et visible**, `date` d'origine **inchangée** | e2e `sessions-edit.spec.ts` : `PATCH` ⇒ collection remplacée, `date_modification` non nul, `date === date` d'origine (corps **et** DB), `provenance` idem ; front affiche « Modifié le … » | ✅ |
| **Type éditable** (structure suit) | e2e : Parcours→Concours ⇒ `tours` peuplés, `obstacles = 0` | ✅ |
| **Idempotence ne contourne pas l'édition** | e2e : re-`POST` même clé + corps différent ⇒ séance d'origine, `date_modification` nul ; seul `PATCH` édite | ✅ |
| **Séances `déclaratives`** : mêmes règles | e2e : édition d'une `déclarative` ⇒ `date_modification` posée, `provenance` conservée | ✅ |
| **Supprimer** : séance + enfants **purgés** (aucune ligne résiduelle) | e2e : `DELETE` 204 ⇒ `count(seance/obstacle/contexte) = 0`, relecture 404 | ✅ |
| **Contribution retirée** via calcul **dérivé** (`shared`), **sans agrégat stocké** | e2e : taux agrégé (`tauxObstacleSimple` sur l'historique) `0.5` → `1` après suppression, recalculé depuis l'API | ✅ |
| **Autorisation** : éditer/supprimer la séance d'un **autre compte** refusé | e2e : B `PATCH`/`DELETE` ⇒ **404**, rien changé côté A ; sans jeton ⇒ 401 ; `:id` malformé ⇒ 400 | ✅ |
| **Réutilisation 2.3** : éditeurs/slider/compteurs pré-remplis ; aucun type dupliqué | `draft.test.ts` : `draftFromSession` (fautes/difficulté/contexte/combinaison conservés), `draftToModifierDto` re-validé par `séanceModifierSchema` ; écran réutilise `ObstacleEditor`/`TourEditor`/`ChipGroup`/`DifficultyMarker` | ✅ |
| `pnpm lint` | `biome check .` | ✅ exit 0 |
| `pnpm typecheck` | build `shared` puis `tsc --noEmit` (shared + api + app) | ✅ vert |
| `pnpm test` (sans DB) | Vitest — 54 (shared, +4 modifier) + 13 (api) + **73 (app : +7 draft, +3 api)** | ✅ 140/140 |
| `pnpm build` | shared (ESM+CJS) + api (nest) + app (typecheck) ; **export Metro web** (21 routes, `/sessions/[id]/edit` incluse) | ✅ vert |
| `db:verify` (Postgres requis) | Vitest — e2e `sessions-edit.spec.ts` (édition/suppression/contribution/autorisation) ajouté au job `db` | ✅ posé (CI) |
| CI | job `ci` (sans DB) + job `db` (`migrate` + `verify`, e2e 2.4 inclus) | ✅ |

---

## Lot 2.5 — Combinaisons réutilisables · 2026-06-29

**Dernière brique de la Phase 2 (Capture).** Module **`combinations`**
(Architecture §3) : une **bibliothèque au niveau du compte** de combinaisons
réutilisables, l'**enregistrement** d'une combinaison depuis une séance, et
l'**instanciation** dans une séance **en ne saisissant que la hauteur** (Modèle
§8, Spec §4). On crée l'entité `Combinaison réutilisable` (différée du socle
0.2/0.3) et on **branche `combinaison_ref`** sur `Obstacle` (reporté de 0.3).
Strictement le lot 2.5 : ni benchmark analytique (5.2), ni métriques/feed (3.x),
ni plafond de bibliothèque (4.1).

### Emplacement (décisions tranchées)

- **Module API** : `api/src/combinations/` (par domaine, §1/§3) —
  `combinations.service` (domaine, bibliothèque scopée compte + surface exposée à
  `sessions`), `combinations.controller` (frontière HTTP sous `JwtAccessGuard`),
  `combinations.errors` (`CombinaisonNotFoundError` 404, `CombinaisonInvalideError`
  400), `combinations.module`. Enregistré dans `app.module.ts` **avant**
  `SessionsModule`. DB via le `DatabaseModule` `@Global` (1.1) ; `PassportModule`
  importé pour la garde.
- **Schéma + migration** : `api/src/db/schema/combinaison.ts` (table) +
  `combinaison_ref` ajouté à `obstacle.ts` ; migration **additive**
  `api/drizzle/0004_combinations.sql` — **là où l'api possède la DB** (cohérent
  0.3). Alignement étendu (`alignment.spec.ts` : Combinaison + Obstacle).
- **Contrats `shared`** : `types/combinaison.ts` (`CombinaisonRéutilisable`),
  `schemas/combinaison.ts` (DTO Créer/Modifier/Sortie + `nomAutoCombinaison`),
  `combinaison_ref` ajouté à `types/obstacle.ts` et `schemas/obstacle.ts`
  (entrée + sortie). Barrels mis à jour.
- **Tranche front** : `app/src/combinations/` (`combinations-api`,
  `combinations-context` + `useCombinations`), écran **bibliothèque**
  `app/src/app/combinations/index.tsx`, **sélection / enregistrement** intégrés à
  `ObstacleEditor` (2.3) ; helpers purs (`selectReusable`, `unlinkReusable`,
  `obstacleToCombinaisonDto`, projection `combinaison_ref`) dans `sessions/draft.ts`.
  `CombinationsProvider` monté dans `_layout.tsx` ; entrée « Mes combinaisons »
  dans l'onglet **Profil**.

### Décisions tranchées (et pourquoi)

- **Schéma `combinaison` — portée compte, sans hauteur, + compteurs d'usage
  techniques.** Colonnes de domaine (Modèle §8) : **FK `compte_id` en `ON DELETE
  CASCADE`** (PAS un cheval — bibliothèque de compte ; purge RGPD structurelle,
  cohérent avec la cascade descendante du socle et `refresh_token`), `nom`,
  `nombre_d_éléments`, `éléments` (`jsonb` `NOT NULL`, liste **ordonnée** de types
  simples — même choix qu'`obstacle.éléments` en 0.3) ; **PAS de hauteur** (fournie
  à l'instanciation). Plus deux colonnes **techniques** du **tri anti-bloat** :
  `usage_count` (`int`, défaut 0) et `last_used_at` (`timestamptz` nullable),
  bumpées à l'instanciation. Hors Modèle de données ⇒ **exclues de l'alignement
  `shared`** (même posture que `idempotency_key` sur `Séance` en 2.2 :
  `NullToOptional<Omit<…, 'usage_count' | 'last_used_at'>>`). Clés ASCII, noms de
  colonnes désaccentués (`nombre_d_elements`, `elements`) comme en 0.3.
- **`combinaison_ref` sur `Obstacle` — ajouté ici, `ON DELETE SET NULL`.**
  Migration **additive** : colonne **nullable**, **FK vers `combinaison`**, **`ON
  DELETE SET NULL`**. Si une réutilisable est supprimée, l'obstacle **conserve**
  ses valeurs d'instanciation (`nombre_d_éléments` copié inline, hauteur,
  barres/refus) et donc son **taux** (§7, self-contained) ; il perd seulement le
  **lien nommé** et l'héritage des `éléments`. **Coût consigné pour 5.2** : un
  obstacle dé-lié rompt la **continuité de benchmark à combinaison constante**
  (son `combinaison_ref` devient `null` — il n'est plus rattaché à l'identité
  suivie). C'est le prix assumé du `SET NULL` (vs un `RESTRICT` qui interdirait la
  suppression, ou un `CASCADE` qui détruirait des séances historiques — tous deux
  pires). 5.2 devra traiter les obstacles `combinaison_ref IS NULL` comme des
  points hors-série du benchmark.
- **Instanciation : `nombre_d_éléments` copié inline (serveur) vs `éléments`
  hérité (ref).** « On ne saisit que la hauteur (+ rép/fautes) » (Modèle §8) :
  l'`obstacleCréerSchema` **interdit** `nombre_d_éléments` et `éléments` dans le
  corps **quand `combinaison_ref` est fourni** (sinon 400). Le **service
  `sessions`** valide la propriété de la ref, lit `nombre_d_éléments` sur la
  réutilisable et le **copie inline** sur la ligne obstacle (structurel, **requis
  par la formule §7** — garde le calcul self-contained, cohérent 2.2/2.3) ;
  `éléments` reste **`null` inline** (hérité via la ref, **non dupliqué**). Choix
  **« serveur copie »** (vs « client renvoie le nombre ») : fidèle au littéral du
  Modèle §8, et la copie est gratuite puisque la couture lit déjà la réutilisable
  pour valider la propriété. Conséquence prouvée : **taux exact** à
  l'instanciation **et** après dé-liaison (`SET NULL` laisse `nombre_d_éléments`).
- **Création depuis une séance.** Un obstacle Combinaison **détaillé inline** (2.3)
  se projette en `CombinaisonCréerDto` via `obstacleToCombinaisonDto`
  (`éléments` complet requis) ⇒ `POST /combinations` ⇒ l'obstacle est **lié** à la
  réutilisable créée (détail désormais hérité, suivi possible en 5.2). Création
  **directe** (sans séance) supportée par le même endpoint.
- **Modification = nouvelle (sémantique exposée par l'API).** `PATCH
  /combinations/:id` **ne mute pas** la ligne — il **dérive une nouvelle**
  combinaison (l'ancienne **intacte** : même `id`, mêmes obstacles liés, même
  `usage_count`) et la **renvoie** ; la nouvelle **repart d'un usage à zéro**
  (identité neuve). Pas de versioning, pas de colonne de lignée : l'identité
  (`id`) est stable → benchmark fiable (5.2). Le corps (partiel) est **fusionné**
  avec l'ancienne (un champ absent hérite) ; changer `nombre_d_éléments` **sans**
  fournir une liste `éléments` du même cardinal est rejeté
  (`CombinaisonInvalideError`, 400 — la liste ordonnée **est** la structure, on ne
  devine pas les types manquants).
- **Tri anti-bloat « par usage ».** `usage_count` est un compteur **monotone**
  d'instanciations (signal « plus utilisées »), bumpé par le service `combinations`
  **à la création de séance uniquement** (pas à l'édition — éditer une séance n'est
  pas une nouvelle réutilisation ; pas au rejeu idempotent — pas de double compte).
  `list` ordonne `usage_count DESC, last_used_at DESC NULLS LAST, created_at DESC` :
  les plus utilisées d'abord, puis les récemment utilisées, une jamais-utilisée
  tombant en bas (la plus récemment **créée** en tête de ce bloc). Compteur
  dénormalisé (vs comptage de références vivantes) : il survit au `SET NULL`, à
  l'édition de séance (réécriture des obstacles) et à « modification = nouvelle »
  (la nouvelle repart à 0) — il mesure « combien de fois j'ai **dégainé** ce
  modèle », exactement le signal anti-bloat voulu.
- **Auto-nommage** (`nomAutoCombinaison`, pur, dans `shared`) : libellé de
  cardinalité (« Double », « Triple », « Quadruple », sinon « Combinaison à N
  éléments ») suffixé du **type dominant** si tous les éléments sont identiques
  (« Triple oxer »). Posé par le service quand `nom` est absent ; **renommage
  optionnel** ; **noms non uniques** (l'identité est l'`id`, pas le nom).
- **Couture `sessions` ↔ `combinations` — via le service exposé (§1).**
  `CombinationsService` **exporté** ; `SessionsModule` importe `CombinationsModule`.
  `sessions` consomme **deux** méthodes : `findForAccount(compteId, ref)` (valide
  la propriété → 404 `CombinaisonNotFoundError`, renvoie la réutilisable pour la
  copie de `nombre_d_éléments`) et `recordUsage(compteId, ids)` (bump après une
  création réussie). **Jamais de lecture de la table `combinaison`** depuis
  `sessions` — seule la **FK de référence** traverse la frontière (dépendances
  orientées `sessions → combinations`, sans cycle : `combinations` ne dépend que
  d'`auth-account`).
- **Forme des DTO `shared`.** `combinaisonCréerSchema` (`nom?`,
  `nombre_d_éléments`, `éléments` requis ≥ 2, concordance vérifiée) ;
  `combinaisonModifierSchema` (tous optionnels, corps non vide, concordance si les
  deux fournis — sémantique « = nouvelle ») ; `combinaisonSortieSchema` (champs de
  domaine + **`usage_count` exposé** comme signal anti-bloat ; `last_used_at`
  **interne**, retiré par `.strip()`). `obstacleCréerSchema`/`obstacleSortieSchema`
  étendus de `combinaison_ref` (entrée : UUID optionnel, conditionnel au type
  Combinaison ; sortie : `string | null`). Aucun type dupliqué (app + api
  importent ces DTO).
- **Tranche front — sélection, enregistrement, bibliothèque.** `ObstacleEditor`
  (réutilisé par saisie 2.3 **et** édition 2.4) ouvre, pour une Combinaison : soit
  le **détail inline** + bouton **« Enregistrer cette combinaison »** (quand le
  détail est complet) ; soit, si la bibliothèque est non vide, une **sélection**
  d'une réutilisable (⇒ « hauteur seule », structure héritée affichée) avec
  **« Détacher »** pour repasser inline. La **bibliothèque** (`/combinations`) liste
  les réutilisables **dans l'ordre serveur** (déjà trié par usage) avec
  suppression confirmée. Logique critique **pure et testée** (`sessions/draft.ts`,
  `combinations-api`) ; composants couverts par `tsc` + **export Metro web**.

### Écarts vs cadrage (consignés)

- **Entité `Combinaison réutilisable` & `combinaison_ref` hors socle — ajoutés
  ici, comme prévu.** 0.2/0.3 avaient **explicitement différé** l'entité et la FK
  au lot 2.5 (cf. journaux). Ajout **purement additif** (nouvelle table + colonne
  nullable) : aucune table/contrat socle modifié dans sa forme.
- **`obstacleSortieSchema` gagne `combinaison_ref` (additif).** Conséquence : la
  projection de séance (`séanceSortieSchema`) et l'**export RGPD** (1.3, qui
  réutilise `obstacleSortieSchema`) incluent désormais `combinaison_ref` sur chaque
  obstacle — additif, bon pour la portabilité. Fixtures de test mises à jour
  (`account-export.test.ts`, `draft.test.ts` : `combinaison_ref: null` ajouté),
  **aucune assertion comportementale changée**.
- **Alignement Drizzle ↔ `shared` étendu.** `Combinaison` ajoutée (colonnes
  d'usage exclues, cf. supra) ; l'assertion `Obstacle` couvre maintenant
  `combinaison_ref` (nullable ⇒ optionnel via `NullToOptional`). `pnpm typecheck`
  **et** `pnpm test` le vérifient.
- **Bumps d'`updated_at` à `recordUsage`.** Le `$onUpdate` technique repose
  `updated_at` à chaque `recordUsage` : `updated_at` reflète donc aussi les
  instanciations, pas seulement les éditions de contenu. Sans incidence (le tri
  utilise `last_used_at`, pas `updated_at`) — consigné comme détail mineur.

### Points laissés ouverts (reports explicites)

- **Plafond de bibliothèque → lot 4.1.** Aucune limite appliquée ici (gratuit
  limité / premium-pro illimité, Spec §4.4) : c'est l'affaire de la **garde
  d'entitlement** (autorité serveur). **Aucun check de `tier` dispersé** dans
  `combinations` (même précédent que 1.1/2.1) — la capacité se construit ici, la
  garde la composera.
- **Continuité de benchmark sur obstacles dé-liés → lot 5.2.** Le `SET NULL`
  pose un **coût** : un obstacle dont la réutilisable a été supprimée perd son
  rattachement à l'identité suivie. 5.2 (analytics, « progression à combinaison
  constante ») devra exclure / marquer les obstacles `combinaison_ref IS NULL`.
  Ce que 5.2 **pourra exploiter** : le **lien** (`combinaison_ref`) et la
  **stabilité d'identité** (« modification = nouvelle ») posés ici rendent le
  benchmark possible ; reste à 5.2 d'**agréger/visualiser** (hors périmètre).
- **« Édition » de réutilisable côté front (rename/restructure) → différée.** La
  capacité API (`PATCH` = nouvelle) est **complète et prouvée** ; l'exposer dans
  la bibliothèque demande une UX honnête du *fork* (l'ancienne reste) — non
  construite ici pour éviter une UX ambiguë. La bibliothèque front v1 reste
  **consultable + suppression**. La **création** (depuis la saisie) et la
  **sélection** sont, elles, complètes.
- **Usage non décrémenté.** `usage_count` est monotone : ni l'édition ni la
  suppression d'une séance ne le baissent (c'est un compteur d'« usages
  historiques », pas de références vivantes). Assumé pour l'anti-bloat ; à
  rouvrir si un signal de « références actuelles » devient utile.
- Conformes au périmètre : **aucun** benchmark/agrégat (5.2), **aucune**
  métrique/feed (3.x), **aucun** versioning (écarté : modification = nouvelle),
  **aucun** gating (4.1).

### DoD — preuves

| Critère | Vérification | Statut |
|---|---|---|
| **Enregistrer** une réutilisable (depuis une séance et/ou directement), **scopée compte** | e2e `combinations.spec.ts` : `POST /combinations` 201, `compte_id` = compte courant, auto-nommée (« Triple oxer ») ; front « Enregistrer cette combinaison » → `obstacleToCombinaisonDto` | ✅ |
| **Instancier** en **ne saisissant que la hauteur** : `éléments` hérités (null), `nombre_d_éléments` inline, **taux exact** (§7) | e2e : obstacle `{Combinaison, hauteur, combinaison_ref}` → `nombre_d_éléments` copié (= réutilisable), `éléments` null, `tauxCombinaison` = 4/6 ; corps avec structure + ref → 400 | ✅ |
| **Modifier** une réutilisable **crée une nouvelle** ; l'ancienne **inchangée** | e2e : `PATCH` → `id` différent, `usage_count` 0, **ancienne intacte** en base (structure + nom), les deux coexistent ; renommage seul ⇒ nouvelle aussi | ✅ |
| **Portée compte** : instanciable sur **plusieurs chevaux** | e2e : une réutilisable instanciée sur 2 chevaux du compte → 2 obstacles liés (DISTINCT cheval_id = 2), `usage_count` = 2 | ✅ |
| **Liste triée par usage** (prouvé) | e2e : usages 3/1/0 → ordre `beaucoup > peu > jamais` (`usage_count DESC, last_used_at, created_at`) | ✅ |
| **Suppression** → obstacles liés **`SET NULL`** sans casser le taux | e2e : `DELETE` réutilisable → `obstacle.combinaison_ref` = NULL, `nombre_d_elements` conservé, **taux identique** avant/après | ✅ |
| **Autorisation** : pas d'instanciation/lecture/édition d'un **autre compte** | e2e : B instancie la ref de A → **404** (rien écrit) ; `GET` de B ne voit pas A ; `PATCH`/`DELETE` de B sur A → **404** | ✅ |
| **Migrations additives** (table + `combinaison_ref`) **s'appliquent** sur Postgres | `drizzle-kit migrate` (0000→0004, sur base peuplée **et** from-scratch) ; e2e constate table/colonnes/usage, FK `compte` CASCADE, FK `combinaison_ref` SET NULL | ✅ |
| **Couture inter-domaine propre** (§1) | `sessions` consomme `CombinationsService.findForAccount` + `recordUsage` (service exposé) ; jamais la table `combinaison` | ✅ |
| Aucun type d'API dupliqué | DTO/calc de `@hpt/shared` (`Combinaison*Dto/Sortie`, `nomAutoCombinaison`, `tauxCombinaison`) ; projection front re-validée par `séanceCréerSchema` | ✅ |
| `pnpm lint` | `biome check .` (195 fichiers) | ✅ exit 0 |
| `pnpm typecheck` | build `shared` puis `tsc --noEmit` (shared + api + app ; alignement Combinaison + Obstacle) | ✅ vert |
| `pnpm test` (sans DB) | Vitest — **70 (shared, +16)** + **14 (api, +1 alignement)** + **85 (app : +8 draft, +4 combinations-api)** | ✅ 169/169 |
| `pnpm build` | shared (ESM+CJS) + api (nest) + app (typecheck) ; **export Metro web** (22 routes, `/combinations` incluse) | ✅ vert |
| `db:verify` (Postgres requis) | Vitest — 73 (lots 0.3→2.4) + **16 (combinations 2.5)** | ✅ 89/89 |
| CI | job `ci` (sans DB) + job `db` (`migrate` 0→0004 + `verify`, e2e 2.5 inclus) | ✅ |

## Lot 3.1 — Feed mono-cheval · 2026-06-29

Premier morceau de la **Phase 3 (Restitution)**. Module **`feed`** (api) +
tranche **`app`** (onglet Feed) : composer le **fil d'un cheval** — chaque séance
devient une **entrée** (faits objectifs en avant, contexte qualitatif en
légende), avec **injection de jalons** (un record génère un jalon) et **entrées
de régularité** pour le Plat. Cœur de la rétention : vu à chaque ouverture,
fonctionnel **dès la séance n°1** (Spec §5.1). `feed` est une surface de
**lecture/composition** : il lit via le service `sessions` (jamais ses tables,
Archi §1/§3) et n'écrit **aucune** entité. Strictement le lot 3.1 : **pas** de
graphes héros (3.2), **pas** de cartes partageables (3.3), **pas** d'historique
(3.4), **pas** d'onboarding (3.5), **pas** de gating (le feed est gratuit).

### Emplacement (décisions tranchées)

- **`shared` (calc + DTO)** — le calcul vit ici, **une seule** implémentation
  (Archi §2) : `enums/jalon.ts` (`TYPES_JALON = record | première_fois`),
  `calc/franchissement.ts` (§10, franchissements propres par unité),
  `calc/faits-seance.ts` (§7/§9, agrégat objectif d'une séance),
  `calc/jalons.ts` (`détecteJalons` sur l'historique), `schemas/feed.ts` (DTO du
  fil : entrées séance/régularité/jalon en **union discriminée**, page + curseur,
  query de pagination). `referentiel.ts` gagne `typeJalonSchema`.
- **`api/src/feed/`** — `feed.service.ts` (compose via `SessionsService`),
  `feed.controller.ts` (`GET /horses/:id/feed`, garde JWT, query Zod),
  `feed.module.ts`. **Aucune** table, **aucune** écriture, **aucune** erreur de
  domaine propre (la propriété/404 vient de `sessions`/`horses`).
  `SessionsModule` **exporte désormais `SessionsService`** (extension non
  destructive de 2.2, comme `horses`/`combinations` l'ont fait).
- **`app/src/feed/`** — `feed-api.ts`, `use-feed.ts` (`useInfiniteQuery`,
  pagination), `labels.ts` (helpers **purs** testés), cartes `feed-entry-card`
  (séance), `regularity-entry` (Plat), `milestone-card` + `bar-motif` (jalon
  laiton). L'écran `app/(tabs)/index.tsx` passe du placeholder au **vrai fil**.

### Décisions tranchées (et pourquoi)

- **Où vit la détection record/jalon : dans `shared`, dès 3.1 — et pourquoi.**
  *Réconciliation roadmap ↔ architecture.* La roadmap ordonne 3.1 avant 3.2
  (`metrics`), mais le feed a besoin de **détecter les records** pour injecter ses
  jalons. Conformément à Archi §2 (dérivés = **une seule** implémentation), on
  **pose les fonctions pures ici** (`calc/jalons.ts`, `calc/franchissement.ts`) ;
  le module `metrics` (3.2) les **réutilisera** pour la vitrine à records **et**
  la hauteur maîtrisée (§10), sans double implémentation. **Aucun calcul dans le
  module `feed`** : il **orchestre** `shared`, rien de plus.
- **Modèle d'entrée de feed = union discriminée à 3 `kind`.** `séance` (faits
  objectifs + contexte légende), `régularité` (Plat / 0 franchissement : **pas**
  de faits), `jalon` (célébration injectée). Choix d'une **union explicite**
  plutôt qu'un `faits: null` ambigu : l'app rend trois cartes distinctes (UI/UX
  §4) sans deviner. La frontière `kind` est stable ; 3.2 ajoutera ses surfaces
  **au-dessus** du fil, pas dedans.
- **Deux couches étanches respectées (Modèle §1).** `faitsSéance` (§7/§9)
  n'agrège **que** la couche objective (hauteur max, efforts propres/total, taux,
  sans-faute) ; le **contexte** (ressenti, note, énergie, difficulté) n'est
  **jamais agrégé** — il traverse tel quel en **légende** (`contexteSortieSchema`
  réutilisé). Unification entraînement/concours par la notion d'**effort** (tour
  = 1 effort) : le taux d'un concours = tours sans-faute / tours (§9), celui d'un
  entraînement = §7 ; le libellé (« propre » / « sans-faute ») est choisi **côté
  UI** selon le type, pas porté par les faits.
- **Règle d'injection des jalons.** `détecteJalons` traite l'historique **trié
  par date croissante** en maintenant (a) l'ensemble des hauteurs déjà franchies
  proprement et (b) le **record courant**. Par séance : **un** `record` si son
  sommet propre dépasse **strictement** l'historique antérieur ; une
  `première_fois` pour **chaque autre** hauteur jamais franchie proprement (hors
  la hauteur de record, déjà célébrée). Le jalon est **attaché** à sa séance
  (`seance_id`) ; l'api le regroupe et l'**injecte après** l'entrée de séance
  (ordre du mock §6.2). **Franchissement propre (§10)** conservateur : obstacle
  simple = `rép − barres − refus` ; combinaison = `rép` **seulement si la ligne
  entière est sans faute** (pas d'attribution par élément) ; tour = 1 si
  sans-faute.
- **Provenance : `déclaratif` dans le fil, hors dérivés (Modèle §2).** Une séance
  `déclaratif` **apparaît** comme entrée (marquée « Antérieure à l'app » côté UI)
  mais **ne génère ni record ni jalon** : `détecteJalons` **filtre `live`** en
  amont. Prouvé en unitaire **et** e2e (un `déclaratif` propre à 130 n'éclipse pas
  le record `live` à 110, et ne porte aucun jalon).
- **Pagination simple = curseur sur la date.** `GET …/feed?limit=&before=` :
  `before` (ISO) borne les séances **strictement plus anciennes**, `limit`
  plafonne les **séances** de la page (les jalons injectés ne comptent pas dans la
  limite). La réponse porte `next_before` (curseur ISO, `null` en fin) + `has_more`.
  Les **jalons sont dérivés de l'historique `live` complet** : la pagination ne
  tranche que **l'affichage**, jamais le calcul (un record reste correct quelle
  que soit la page).
- **Alignement de type prouvé, zéro forme dupliquée (Archi §2).** `FaitsSéance`
  (calc) et `FaitsSéanceDto` (Zod) sont garantis **identiques** par un
  `expectTypeOf().toEqualTypeOf()` ; le reste du DTO du fil est **inféré** de Zod
  (`@hpt/shared`) et consommé tel quel par app + api. La projection sortante passe
  `filSchema.parse` (strip + validation au bord, Archi §5).

### Écarts vs cadrage (consignés)

- **`faitsSéance` (agrégat de séance) posé dans `shared` — au-delà de la stricte
  « détection record/jalon ».** Justifié par « **aucun calcul dans le module
  `feed`** » (la composition d'une entrée a besoin des faits objectifs) et par la
  **réutilisation** à venir (la carte de bilan simple 3.3 résume une séance).
  C'est un dérivé §7/§9, légitimement dans la couche calc (Archi §2) — testé,
  borné, sans état.
- **Carte de jalon : laiton + motif barre, sans emoji `🎉`.** La Spec §5.1
  *illustre* le jalon avec « 🎉 Nouveau record », mais UI/UX §3.3 pose une **règle**
  (« jamais d'emoji système **sauf dans le ressenti du feed** ») et UI/UX §2/§3
  font de la **célébration** un **laiton + signature barre**. La règle prime sur
  l'exemple : la carte célèbre par le **laiton** (réservé, donc précieux) et un
  **motif barre** (`bar-motif.tsx`), pas un emoji. Le ressenti, lui, garde ses
  emojis (seule entorse autorisée).
- **Correctif hors-périmètre pour débloquer la CI (`auth-context.tsx`).** Des
  commits de mise au point **postérieurs à 2.5** (support web, non journalisés)
  avaient introduit `SecureStore.isAvailable` — **inexistant** dans
  `expo-secure-store@56.0.4` (il expose `isAvailableAsync` /
  `canUseBiometricAuthentication`) → `pnpm typecheck` **rouge** sur la branche,
  **avant** tout code 3.1. Corrigé au **minimum** et **conformément à l'intention
  affichée** du commit (« sur web, fallback mémoire ») : `Platform.OS === 'web' ?
  undefined : SecureStore`. Aucune autre logique d'auth touchée. Signalé ici car
  hors lot, mais nécessaire à la DoD (« CI verte »).
- **Entrées de feed en lecture seule (pas de navigation vers le détail/édition).**
  Le fil **affiche** ; l'entrée riche vers détail/bilan/édition est l'**onglet
  Historique (3.4)**. On évite d'empiéter — l'écran d'édition (2.4) reste atteint
  depuis la confirmation de saisie.
- **`SessionsService` exporté** et **`formatRate` exposé** par le barrel
  `sessions` de l'app : extensions **non destructives** (réutilisation, jamais de
  duplication).

### Points laissés ouverts (reports explicites)

- **Vitrine à records + courbe de hauteur maîtrisée → 3.2** : elles vivront
  **au-dessus** de ce fil (même onglet, cf. `ListHeaderComponent` réservé) et
  **réutiliseront le calc `shared`** posé ici — `détecteJalons` pour la vitrine,
  `franchissementsObstacle/Tour` pour la **hauteur maîtrisée** (§10 : ≥ 3
  franchissements propres sur ≥ 2 séances ; la brique est prête, l'agrégation
  reste 3.2). Le **record absolu « gravé »** (§5.5, qui ne redescend jamais même en
  régression) est une décision d'affichage de la **vitrine 3.2** ; ici on **dérive
  de l'historique courant**.
- **Recomposition du fil après suppression (2.4)** : par construction. Rien n'est
  stocké (Modèle §9/§10) ; le feed **recompose** à chaque lecture depuis
  l'historique courant — une suppression retire mécaniquement la séance **et**
  redérive ses jalons (prouvé en unitaire : retirer la séance du record le
  redérive sur l'avant-dernière).
- **Séries propres (« clean streaks ») → enrichissement ultérieur.** La vitrine
  §5.2 mentionne « séries propres » comme troisième famille de jalon ; on n'a posé
  que **record** et **première_fois** (les deux du périmètre). `TYPES_JALON` est
  extensible sans casse.
- **Pagination — affinements.** (a) Curseur par **date** : une collision à la
  **milliseconde** près (deux séances au même instant) pourrait, au bord d'une
  page, sauter une entrée — improbable (horodatage de création mono-utilisateur),
  noté. (b) **Recalcul de l'historique complet à chaque page** : correct et simple
  à l'échelle v1 ; un calcul **incrémental/caché** sera utile si un cheval
  accumule des centaines de séances.
- **Énergie du contexte** (point ouvert hérité de 0.2) : rendue en légende quand
  présente (échelle 1-5), **jamais agrégée** (§1). Sémantique confirmée par l'usage.

### DoD — preuves

| Critère | Vérification | Statut |
|---|---|---|
| **Chaque séance** apparaît comme une entrée : faits objectifs en avant, contexte en légende | e2e `feed.spec.ts` : `GET …/feed` → entrée `séance` (`hauteur_max`, `efforts_propres/totaux`, `taux_réussite`, `sans_faute`) + `contexte` en légende | ✅ |
| **Un record génère un jalon** injecté ; une séance **`déclaratif` n'en génère pas** | e2e : séance `live` propre@110 ⇒ jalon `record@110` adjacent ; séance `déclaratif`@130 **apparaît** (marquée) mais **0 jalon** ; unitaire `jalons.test.ts` idem | ✅ |
| Une séance de **Plat** (0 obstacle) = **entrée de régularité** (sans hauteur/fautes) | e2e : entrée `régularité` (kind dédié, **pas** de `faits`) ; `faitsSéance([],[])` ⇒ `null` | ✅ |
| **Détection record/jalon testée dans `shared`** (une seule implémentation, partagée 3.2) | `jalons.test.ts` (11), `franchissement.test.ts` (7), `faits-seance.test.ts` (6, dont alignement `expectTypeOf`) | ✅ |
| **État vide = invitation** ; **fonctionne dès la séance n°1** | écran : `EmptyState` « Logue ta première séance pour voir {cheval} progresser » ; e2e : fil vide `entrées: []` ; séance n°1 ⇒ entrée + jalon | ✅ |
| **Composition via le service `sessions`** (jamais ses tables, Archi §1/§3) | `feed.service` consomme `SessionsService.listForHorse` ; `SessionsModule` exporte le service ; `feed` n'a ni table ni écriture | ✅ |
| **Pagination simple** (curseur `before` + `limit`) | e2e : `?limit=2` ⇒ 2 plus récentes + `has_more` + `next_before` ; `?before=curseur` ⇒ page suivante, fin de fil | ✅ |
| **Autorisation** : fil d'un cheval d'un **autre compte** refusé ; non authentifié | e2e : B `GET …/feed` sur le cheval de A → **404** ; sans jeton → **401** | ✅ |
| Accessibilité terrain (UI/UX §8) | chiffres **tabulaires** (`StatText`) ; libellés accessibles explicites par carte ; contraste AA+ (tokens) ; laiton **réservé** à la célébration | ✅ |
| Aucun type d'API dupliqué | DTO/calc de `@hpt/shared` (`Fil`, `EntréeFeed`, `FaitsSéanceDto`, `détecteJalons`, `faitsSéance`) ; `FaitsSéance` ≡ `FaitsSéanceDto` (`expectTypeOf`) | ✅ |
| `pnpm lint` | `biome check .` (216 fichiers) | ✅ exit 0 |
| `pnpm typecheck` | build `shared` puis `tsc --noEmit` (shared + api + app) | ✅ vert |
| `pnpm test` (sans DB) | Vitest — **94 (shared, +24)** + 14 (api) + **92 (app : +7 labels)** | ✅ 200/200 |
| `pnpm build` | shared (ESM+CJS) + api (nest) + app (typecheck) | ✅ vert |
| `db:verify` (Postgres requis) | Vitest — 89 (lots 0.3→2.5) + **5 (feed 3.1)** | ✅ 94/94 |
| CI | job `ci` (sans DB) + job `db` (`migrate` + `verify`, e2e 3.1 inclus) | ✅ |

---

## Lot 3.2 — Métriques & graphes héros · 2026-06-29

Deuxième morceau de la **Phase 3 (Restitution)**. Module **`metrics`** (api) +
tranche **`app`** : les **deux graphes héros** (Spec §5.2) posés **au-dessus** du
fil (3.1) dans l'onglet Feed — la **courbe de hauteur maîtrisée** (le plafond
fiable + le grand chiffre du jour) et la **vitrine à records/jalons**. Principe :
**montrer la maîtrise, pas l'activité** ; la maîtrisée **peut redescendre** sans
jamais **effacer le record**. `metrics` est une surface de **lecture/composition**
: il lit via le service `sessions` (jamais ses tables, Archi §1/§3) et **réutilise**
les fonctions pures de `shared` — la détection record/jalon **posée en 3.1** et la
**hauteur maîtrisée** ajoutée ici (§10). Strictement le lot 3.2 : **pas** le fil
(3.1, livré), **pas** de cartes partageables (3.3), **pas** d'analytique de
diagnostic (heatmap/benchmark 5.x = **premium**, hors set héros), **pas** de gating
(les héros sont **gratuits**).

### Emplacement (décisions tranchées)

- **`shared` (calc + DTO)** — le calcul vit ici, **une seule** implémentation
  (Archi §2) : `calc/hauteur-maitrisee.ts` (§10, `hauteurMaîtrisée` série + chiffre
  courant, `hauteurMaîtriséeParmi` brique de bas niveau) ; `recordAbsolu` **ajouté
  à `calc/jalons.ts`** (réutilise `détecteJalons`, ne le réimplémente pas) ;
  `schemas/metrics.ts` (DTO `Métriques` = `maîtrise` + `vitrine`, `jalonSchema`,
  `pointMaîtriseSchema`). La **brique 3.1** (`franchissementsObstacle/Tour`,
  `SéanceJalonInput`) est **réutilisée** telle quelle.
- **`api/src/metrics/`** — `metrics.service.ts` (compose via `SessionsService`),
  `metrics.controller.ts` (`GET /horses/:id/metrics`, garde JWT), `metrics.module.ts`.
  **Aucune** table, **aucune** écriture, **aucune** erreur de domaine propre (la
  propriété/404 vient de `sessions`/`horses`). Importe `SessionsModule` (déjà
  exporté en 3.1) — même posture que `feed`.
- **`app/src/metrics/`** — `metrics-api.ts`, `use-metrics.ts` (`useQuery`),
  `metrics-format.ts` (helpers **purs** testés), `mastery-curve.tsx` (courbe en
  barres, signature §2), `mastery-hero.tsx` (grand chiffre + motif barre + courbe +
  référence record laiton), `records-vitrine.tsx` (plaques laiton), `metrics-hero.tsx`
  (le `ListHeaderComponent` du Feed). L'écran `(tabs)/index.tsx` reçoit le bloc
  héros **au-dessus** du fil (le `ListHeaderComponent` réservé en 3.1).

### Décisions tranchées (et pourquoi)

- **Forme de la fonction maîtrisée §10 dans `shared` — et sa série temporelle.**
  `hauteurMaîtriséeParmi(séances)` est la **brique pure** : elle agrège, par
  hauteur, les **franchissements propres** (total) et les **séances distinctes**
  (un `Set` d'`id`) qui y contribuent, puis renvoie la **plus haute** hauteur
  atteignant **≥ 3 franchissements propres sur ≥ 2 séances** (seuils §10 en
  constantes nommées), ou `null`. `hauteurMaîtrisée(séances)` est l'entrée de haut
  niveau : elle **filtre le `live`** (§2), trie par date, et produit **un point par
  séance** (la **série** = la courbe) + le **chiffre courant** (= dernier point).
- **Pourquoi une fenêtre glissante (et comment la maîtrisée « redescend »).** §10
  comptée **tout-temps** serait **monotone** (un palier acquis ne retombe jamais) —
  incompatible avec l'honnêteté §5.5 (« la maîtrisée peut redescendre — régression,
  reprise post-blessure »). Chaque point est donc la maîtrisée **sur une fenêtre
  glissante** `(date − FENÊTRE, date]` : quand des hauteurs ne sont **plus
  corroborées récemment**, elles sortent du plancher et **la maîtrisée baisse**.
  `FENÊTRE_MAÎTRISE_JOURS = 365` (≈ une année sportive) — **généreuse** pour ne pas
  dramatiser une coupure courte, **constante unique tunable** (cf. points ouverts).
  La fenêtre est **relative à la dernière séance des données**, jamais à
  `Date.now()` : la fonction reste **pure et déterministe** (testable avec des dates
  fixes).
- **Réutilisation de la détection record/jalon de 3.1 pour la vitrine.** Le
  **record absolu « gravé »** (§5.5) est `recordAbsolu(séances)` : un mince dérivé
  **par-dessus `détecteJalons`** (les records y sont strictement croissants → le
  **dernier est le maximum**). Il est **tout-temps** (jamais fenêtré) : une
  régression ultérieure **ne l'efface jamais**. La vitrine présente ce record **+
  la liste de jalons** de `détecteJalons` — **aucune** réimplémentation (la décision
  d'affichage « le record reste gravé » que 3.1 laissait à 3.2 est ici posée :
  fenêtre pour la maîtrisée, tout-temps pour le record).
- **Modèle de lecture du module `metrics`.** **Un seul** endpoint
  `GET /horses/:id/metrics` renvoyant les **deux** héros (`maîtrise` + `vitrine`) :
  une seule requête, une seule clé de cache TanStack, pas de cascade de waterfalls
  (les deux surfaces s'affichent ensemble dans le même `ListHeaderComponent`). Le
  service **orchestre** `shared` (zéro calcul local), lit via
  `SessionsService.listForHorse` (404 sans fuite si étranger), projette
  `SéanceSortie → SéanceJalonInput` (glue de champs, miroir du feed), et **valide au
  bord** (`métriquesSchema.parse`, Archi §5).
- **Comment l'UI encode la baisse sans effacer le record.** Le bloc maîtrisée
  affiche le **grand chiffre** (échelle hero, **chiffres tabulaires**, vert
  sous-bois = couleur de maîtrise §2) ; le **record** l'accompagne en **référence
  laiton** (« le plafond au-dessus du plancher »). La **courbe en barres**
  (signature « hauteur-comme-barre », §2) montre la montée **et** la baisse : une
  régression = des barres plus courtes, un point non maîtrisé = un **creux** (fine
  ligne de base). Aucun traitement dramatique (UI/UX §7 : « assume la baisse sans
  dramatiser ») ; la **vitrine** garde le record en plaque laiton, intact. Le bloc
  héros **ne rend rien** tant qu'il n'y a rien à célébrer (Plat seul / pas de
  franchissement) — l'invitation du fil opère (§7).
- **Aucune forme dupliquée, alignement prouvé (Archi §2).** Les DTO viennent de
  `@hpt/shared` ; `Jalon` (calc) ≡ `JalonDto` (Zod) et `PointMaîtrise` ≡
  `PointMaîtriseDto` sont garantis par `expectTypeOf().toEqualTypeOf()`. Les types
  inférés de Zod portent le suffixe `Dto`/`MaîtriseDto` pour **éviter la collision**
  de barrel avec les interfaces `calc` (mêmes noms `Maîtrise`/`PointMaîtrise`),
  comme `FaitsSéance`/`FaitsSéanceDto` en 3.1.

### Écarts vs cadrage (consignés)

- **Fenêtre de récence ajoutée au §10 — décision assumée.** Le Modèle §10 définit
  la maîtrise sans fenêtre ; la Spec §5.5 exige qu'elle **redescende**. Les deux ne
  se concilient qu'avec une **récence** : on l'ajoute (fenêtre glissante, constante
  unique tunable) **sans toucher** au comptage §10 (≥ 3 / ≥ 2), et on la **journalise
  comme décision tranchée**. Le **record**, lui, reste fidèle au §10 « tout-temps ».
- **Le `record` (cm) figure aussi dans le bloc `maîtrise`** (pas seulement la
  vitrine) : c'est une **référence d'affichage** (la barre laiton au-dessus de la
  barre maîtrisée, signature §2), pas un troisième héros. Les **deux** surfaces
  héros restent **exactement deux** (Spec §5.2) ; il n'y a **pas** de graphe de
  taux (déjà encodé dans la maîtrisée).
- **Projection `SéanceSortie → SéanceJalonInput` dupliquée** (privée à
  `metrics.service`, miroir de celle du feed). C'est une **glue de champs** (pas un
  **dérivé** §2 : aucun calcul). On **ne touche pas** au feed livré (3.1) pour la
  hisser dans `shared` — point de nettoyage noté ci-dessous.
- **Courbe en barres « maison » (pas de lib de graphe).** La signature
  « hauteur-comme-barre » (§2) se rend en `View` normalisées (positions par **index
  chronologique**, pas par date) — pas de dépendance ajoutée, pas d'abstraction
  prématurée. Le sens passe par le **grand chiffre** ; la courbe est **décorative**
  (masquée aux lecteurs d'écran pour éviter un brouhaha de barres).
- **Vitrine = record + premières fois** (les deux familles de 3.1). Les **« séries
  propres »** (3ᵉ famille citée §5.2) restent un **enrichissement ultérieur** —
  `TYPES_JALON` est extensible sans casse (déjà noté en 3.1). Dans la vitrine, un
  **ancien record** redevient une **« première fois »** du palmarès (dédupliqué par
  hauteur, le plus haut en tête).

### Points laissés ouverts (reports explicites)

- **Cartes partageables (3.3)** réutiliseront le **record** (mis en avant, §5.4) et
  les **taux** (`faitsSéance`, §7/§9 — déjà dans `shared`) ; un record affiché en
  vitrine **n'est pas** une carte exportable (hors périmètre ici).
- **Heatmap type × hauteur** et **benchmark à combinaison constante** (5.1/5.2)
  restent **hors du set héros** (Spec §5.3) — outils de **diagnostic premium**.
  **Consigne respectée** : rien de tel ici.
- **Bilan de progression (4.4)** réutilisera la **hauteur maîtrisée** (`shared`,
  posée ici) + la **régularité** (dates de séance) ; la **fenêtre** `FENÊTRE_MAÎTRISE_JOURS`
  y sera (re)confirmée avec le produit/UX (durée tunable, une seule source).
- **Coût de recalcul.** Comme le feed (3.1), `metrics` **recompose** depuis
  l'historique `live` complet à chaque lecture (la série est `O(n²)` sur la fenêtre).
  Correct et simple à l'échelle v1 ; un calcul **incrémental/caché** sera utile si un
  cheval accumule des centaines de séances.
- **Hoisting de la projection `SéanceSortie → SéanceJalonInput`** dans `shared`
  (réutilisée par `feed` **et** `metrics`) : nettoyage possible quand on touchera de
  nouveau au feed — évité ici pour ne pas déborder sur 3.1 (livré).
- **Chiffre courant à la dernière séance** (pas à `Date.now()`) : un cheval inactif
  depuis > 1 an conserve donc sa dernière maîtrisée affichée plutôt que de tomber à
  `null` — choix conservateur (« ne dramatise pas »), à reconsidérer si un signal
  « hors de forme » devient souhaitable.

### DoD — preuves

| Critère | Vérification | Statut |
|---|---|---|
| **Courbe & records à jour** : maîtrisée + vitrine reflètent les séances `live` | e2e `metrics.spec.ts` : `GET …/metrics` → `maîtrise.courante`, `série`, `vitrine.record`/`jalons` ; unités `hauteur-maitrisee.test.ts` | ✅ |
| **La maîtrisée peut redescendre sans effacer le record** (test explicite) | unité : régression > 1 an ⇒ `courante` 115→**105** (fenêtre), `recordAbsolu` reste **125** ; e2e : plancher **<** record (115 < 125) | ✅ |
| **Plat exclu** des hauteurs ; **`déclaratif` exclu** des agrégats | unité (Plat 0 hauteur, déclaratif@140 ignoré) **+** e2e (maîtrisée/record restent à 110 malgré Plat & déclaratif@140) | ✅ |
| **Hauteur maîtrisée testée dans `shared`** (§10, une seule implémentation) | `hauteur-maitrisee.test.ts` (13 : seuils ≥3/≥2, combinaison conservatrice, tour, max, fenêtre) | ✅ |
| **La vitrine réutilise la détection record de 3.1** | `recordAbsolu` dérive de `détecteJalons` (jamais réimplémenté) ; vitrine = record + jalons | ✅ |
| **Composition via le service `sessions`** (jamais ses tables, Archi §1/§3) | `metrics.service` consomme `SessionsService.listForHorse` ; `metrics` n'a ni table ni écriture | ✅ |
| **Exactement 2 héros**, **pas** de graphe de taux ; **gratuits** (jamais verrouillés) | `Métriques` = `maîtrise` + `vitrine` ; route hors gating (4.1) ; `MetricsHero` discret si rien à montrer | ✅ |
| **Autorisation** : métriques d'un cheval d'un **autre compte** refusées ; non authentifié | e2e : B `GET …/metrics` sur le cheval de A → **404** ; sans jeton → **401** | ✅ |
| Accessibilité (UI/UX §8) | grand chiffre **hero** lisible, **chiffres tabulaires** (`StatText`), contraste AA+ (tokens), libellés accessibles ; laiton **réservé** à la célébration | ✅ |
| Aucun type d'API dupliqué | DTO/calc de `@hpt/shared` (`Métriques`, `hauteurMaîtrisée`, `recordAbsolu`) ; `Jalon ≡ JalonDto`, `PointMaîtrise ≡ PointMaîtriseDto` (`expectTypeOf`) | ✅ |
| `pnpm lint` | `biome check .` (233 fichiers) | ✅ exit 0 |
| `pnpm typecheck` | build `shared` puis `tsc --noEmit` (shared + api + app) | ✅ vert |
| `pnpm test` (sans DB) | Vitest — **113 (shared, +19)** + 14 (api) + **101 (app : +9 metrics)** | ✅ 228/228 |
| `pnpm build` | shared (ESM+CJS) + api (nest) + app (typecheck) | ✅ vert |
| `db:verify` (Postgres requis) | Vitest — 94 (lots 0.3→3.1) + **4 (metrics 3.2)** | ✅ 98/98 |
| CI | job `ci` (sans DB) + job `db` (`migrate` + `verify`, e2e 3.2 inclus) | ✅ |

---

## Lot 3.3 — Cartes partageables · 2026-06-29

Troisième morceau de la **Phase 3 (Restitution)**. Module **`sharing`** (api) +
tranche **`app`** : la **carte de bilan de séance simple** (Spec §5.4, UI/UX §6.6)
**proposée à l'enregistrement** par-dessus la confirmation « Enregistré » de 2.3,
avec le **record mis en avant** (laiton) s'il y en a un, et l'**export image**
(rendu de la carte + feuille de partage native). Disponible pour **tous les
comptes** (gratuit inclus). `sharing` est une surface de **lecture/composition**
: il lit la séance via le service `sessions` (jamais ses tables, Archi §1/§3) et
**réutilise** les fonctions pures de `shared` — le récap `résuméCarte` (réutilise
`faitsSéance` §7/§9 posé en 3.1) et la détection record/jalon (`détecteJalons` de
3.1, déjà réutilisée par la vitrine `metrics` 3.2). Strictement le lot 3.3 :
**pas** d'historique (3.4), **pas** de **bilan augmenté IA** (4.5), **pas** de
**bilan de progression PDF** (4.4) — **trois objets distincts** (Spec §8).

### Emplacement (décisions tranchées)

- **`shared` (calc + DTO)** — le calcul vit ici, **une seule** implémentation
  (Archi §2) : `calc/carte.ts` (`résuméCarte` — types travaillés distincts/ordre
  référentiel, hauteurs distinctes triées, et `faits` via `faitsSéance` **réutilisé**,
  jamais réimplémenté) ; `schemas/sharing.ts` (DTO `CarteBilan` = identité + récap
  + `record`). Le `faits` du DTO **réutilise** `faitsSéanceSchema` de 3.1 ; le
  `record` est un `number | null` (la hauteur du record battu par cette séance).
- **`api/src/sharing/`** — `sharing.service.ts` (compose via `SessionsService`),
  `sharing.controller.ts` (`GET /sessions/:id/card`, garde JWT, `:id` en
  `ParseUUIDPipe`), `sharing.module.ts`. **Aucune** table, **aucune** écriture,
  **aucune** erreur de domaine propre (la propriété/404 vient de `sessions`/
  `horses`). Importe `SessionsModule` (déjà exporté en 3.1) — même posture que
  `feed`/`metrics`.
- **`app/src/sharing/`** — `sharing-api.ts`, `card-format.ts` (helpers **purs**
  testés), `share-card.ts` (orchestration **pure** du partage), `card-share-port.ts`
  (port injectable), `native-card-share-port.ts` (adaptateur natif : view-shot +
  expo-sharing + `Share` RN), `bilan-card.tsx` (la carte, `forwardRef` pour la
  capture), `use-share-card.ts` (hook), `share-proposal.tsx` (l'aperçu +
  `[ Partager ] / [ Plus tard ]`). L'écran `app/src/app/capture.tsx` **greffe** la
  proposition sur sa confirmation « Enregistré ».

### Décisions tranchées (et pourquoi)

- **Où sont composées les données de carte : service `sharing`, réutilisant
  `shared` (et les dérivés que `metrics` possède).** Le service **orchestre** —
  zéro calcul local (Archi §2). Il lit la **séance** ciblée
  (`SessionsService.findOne` → 404 sans fuite si étrangère) pour le récap
  (`résuméCarte`), puis l'**historique** du cheval (`SessionsService.listForHorse`)
  pour le record (`détecteJalons`). **Pourquoi `détecteJalons` directement et pas
  `MetricsService`** : Archi §3 liste `sharing → metrics, sessions`, mais — comme
  `feed` (3.1), lui aussi listé « dépend de metrics » et qui n'injecte pourtant que
  `SessionsService` — cette dépendance se satisfait en **réutilisant les dérivés
  `shared` que `metrics` possède** (`détecteJalons`/`recordAbsolu`), pas en câblant
  le service. De plus `MetricsService.compose` ne donne que le **record absolu** du
  cheval : insuffisant pour répondre « **cette** séance a-t-elle battu un record ? ».
  `détecteJalons` rattache le jalon `record` à la **séance** qui l'a posé → on lit
  exactement le record **de la carte**. Une seule source de vérité (la carte, le
  feed et la vitrine ne peuvent pas diverger).
- **Point de greffe : par-dessus la confirmation 2.3, sans la remplacer.** L'écran
  `/capture` montrait déjà « Enregistré » + « Modifier la séance » + « Terminé »
  (2.3). On **conserve** le titre/message « Enregistré » et on **insère** la
  `ShareProposal` (aperçu de la carte + `[ Partager ] / [ Plus tard ]`) ; « Terminé »
  devient `[ Plus tard ]` (même geste : `router.back()`), « Modifier la séance »
  reste en lien discret. L'écran de confirmation passe en `scroll` (la carte peut
  être haute). **« enregistrer → célébrer »** (UI/UX §7) sans rien imposer.
- **Technique de rendu image + partage natif : port injectable.** Le partage est
  une **orchestration pure** (`partagerCarte`) derrière un **port** étroit
  (`CartePartagePort` : `capturer` + `partager`), exactement comme le store de
  brouillon injectable de 2.3 — donc **testée en Node** (faux port), sans rendu RN
  ni module natif. L'adaptateur **natif** (le seul fichier touchant le natif, **non**
  importé par un test, couvert par `tsc`) capture la `BilanCard` (`forwardRef` +
  `collapsable={false}`) en **PNG** via `react-native-view-shot` (`captureRef`,
  `result: 'tmpfile'`) puis ouvre la **feuille de partage native** via
  `expo-sharing` (`shareAsync`, fichier image cross-plateforme), avec **repli** sur
  `Share` (RN core) en texte si la capture est indisponible. **Jamais de crash** :
  capture en échec ⇒ partage texte ; fermeture de la feuille (`dismissedAction`) ⇒
  résultat « annulé », pas une exception.
- **Mise en avant du record vs carte récap simple : une seule carte, deux états.**
  Pas d'abstraction prématurée (deux composants). `BilanCard` rend **toujours** le
  récap (signature barre + grand chiffre + types/hauteurs + taux) ; **si**
  `carte.record !== null`, elle ajoute une **plaque laiton « Nouveau record »** et
  passe sa bordure/sa barre en laiton — c'est « la carte de record » (§6.6). Sans
  record, **aucune** célébration (laiton **réservé**, §2/§3.1) : récap sobre, pas de
  fausse fête. Un **Plat** (faits `null`) ⇒ carte de **régularité** (sans hauteur ni
  taux). **Pas d'emoji** (§3.3) : la fête se lit au laiton + motif barre (cohérent
  3.1/3.2), y compris dans le message texte de repli.
- **Signature de la carte = barre + nom du cheval + logo HPT discret (UI/UX §2/§6.6).**
  Le **nom du cheval** et le **logo HPT** sont une **signature d'affichage** ajoutée
  par l'app (elle tient déjà le cheval courant), **pas un dérivé** : ils ne transitent
  **pas** par le DTO `CarteBilan` (qui ne porte que des dérivés de séance). Ça garde
  `sharing` (api) sur ses dépendances `sessions`+`shared` (pas de lecture `horses`)
  et le DTO minimal.
- **Carte simple = gratuite, jamais verrouillée (§8).** La route ne porte **que** la
  garde JWT (aucune garde d'entitlement) ; l'UI ne grise rien. Le **bilan augmenté
  IA** (4.5, badge ✦) et le **bilan de progression** (4.4, PDF/multi-séances) sont
  **hors périmètre** — aucun n'est amorcé ici (Spec §8 : trois objets distincts).
- **Aucune forme dupliquée, alignement prouvé (Archi §2).** Le DTO vient de
  `@hpt/shared` ; `RésuméCarte` (calc) ≡ le récap du DTO
  (`Pick<CarteBilan, 'types_travaillés' | 'hauteurs' | 'faits'>`) garanti par
  `expectTypeOf().toEqualTypeOf()`. La projection sortante passe `carteBilanSchema.parse`
  (strip + validation au bord, Archi §5).

### Écarts vs cadrage (consignés)

- **Deux dépendances natives ajoutées (`react-native-view-shot@4`, `expo-sharing@~56`).**
  Le « rendu image » d'un composant RN **n'a pas** d'équivalent JS pur (contrairement
  au slider de 2.3, remplacé par des pas ±5) : la capture exige view-shot, le partage
  d'un **fichier image** cross-plateforme exige expo-sharing (le `Share` de RN core ne
  partage proprement qu'un texte/URL sur Android). On les **isole derrière le port**
  (logique testée sans elles) et on **épingle** le lockfile (CI `--frozen-lockfile`
  vert). Aucun build natif en CI (jobs `tsc`/`vitest`) ⇒ risque cantonné à la
  résolution + aux types (vérifiés). Décision **assumée et journalisée**.
- **Route `GET /sessions/:id/card`** (et non `/horses/:id/...`) : la carte est
  relative à **une séance**, pas au cheval — cohérent avec `GET /sessions/:id`
  (2.2/2.4). Suffixe **anglais** (`card`) comme `feed`/`metrics`, type **français**
  (`CarteBilan`) comme `Fil`/`Métriques`.
- **Record « de la séance » robuste pour n'importe quelle séance.** À
  l'enregistrement (la séance est la dernière), « a battu un record » ⇔ « est le
  record absolu ». L'endpoint reste correct **même pour une séance ancienne**
  rejouée : `détecteJalons` rattache le record à la séance qui a **le premier**
  franchi cette hauteur (records strictement croissants). Honnête (le record reste
  célébré sur la carte de la séance qui l'a posé) et utile pour la ré-ouverture 3.4.
- **`card-format.ts` réutilise `effortsBasis` du feed (3.1)** importé **du fichier**
  `../feed/labels` (et non du barrel `../feed`, qui ré-exporte des `.tsx` RN) : garde
  les helpers **purs** testables en Node (même posture que `labels.test`/`metrics-format.test`).
- **Tests app = logique pure (Node), pas de rendu RN.** Cohérent 1.4→3.2 : la DoD
  « export image » est prouvée par l'**orchestration** (`share-card.test`, faux port :
  image / repli texte / capture en échec / annulation) + les helpers
  (`card-format.test`) + la surface (`sharing-api.test`). Le `tsc` couvre la carte,
  le hook et l'adaptateur natif ; l'e2e api (`sharing.spec.ts`) prouve la composition.

### Points laissés ouverts (reports explicites)

- **Ré-ouverture du bilan simple depuis l'historique → 3.4.** Ici la carte est
  proposée **à l'enregistrement**. L'onglet Historique (§6.4 : « Bilans : ✓ simple »)
  rouvrira la **même** carte via le **même** endpoint `GET /sessions/:id/card`
  (réutilisable tel quel — la composition est sans état) ; `metrics`/`feed` restent
  inchangés.
- **Bilan augmenté IA (4.5)** — badge **✦ augmenté**, génération Mistral, persistance,
  proposé en plus à l'enregistrement (premium/pro) : **non amorcé** (aucun badge ✦,
  aucun appel IA). Trois objets distincts (§8).
- **Bilan de progression (4.4)** — rapport **multi-séances** sur une période
  (PDF/lien, premium/pro) : **non amorcé** (aucun PDF, aucune curation de période).
- **Capture web.** `react-native-view-shot` a un support web partiel ; sur web le
  partage repliera sur `Share`/texte si la capture échoue (jamais de crash). Affiner
  si une cible web devient prioritaire.
- **Personnalisation de la carte** (thème, mention coach, QR vers un feed invité) :
  hors périmètre v1 — la signature actuelle (barre + nom + HPT) suffit.

### DoD — preuves

| Critère | Vérification | Statut |
|---|---|---|
| L'enregistrement **propose** un bilan partageable (`[ Partager ] / [ Plus tard ]`), greffé sur la confirmation 2.3 | `capture.tsx` : bloc `saved` conserve « Enregistré » et insère `ShareProposal` (aperçu + 2 boutons) | ✅ (écran câblé ; tsc) |
| Un **record propose sa carte** (laiton) ; sans record, récap **sans fausse célébration** | e2e `sharing.spec.ts` : séance@125 ⇒ `record: 125` ; séance@110 sous un record@120 ⇒ `record: null` ; `BilanCard` laiton **ssi** `record !== null` | ✅ |
| L'**export image fonctionne** (rendu de la carte + partage natif) | `share-card.test.ts` : capture⇒partage **image** ; capture null/échec⇒**repli texte** sans crash ; adaptateur natif view-shot+expo-sharing (`tsc`) | ✅ |
| `[ Plus tard ]` **n'impose rien** (referme sans friction) | `ShareProposal.onDismiss` = `router.back()` ; toujours disponible (même carte indisponible) | ✅ |
| **Gratuit inclus** : aucune carte simple verrouillée | route `GET /sessions/:id/card` sous **JWT seul** (aucune garde d'entitlement) ; e2e : le propriétaire reçoit 200 | ✅ |
| Taux/record **cohérents** avec `shared`/`metrics` (pas de recalcul divergent) | `résuméCarte` réutilise `faitsSéance` (§7/§9) ; record via `détecteJalons` (3.1, partagé avec `metrics`) ; e2e : taux 5/5=1 | ✅ |
| **Plat / déclaratif** : pas de fausse célébration | e2e : Plat ⇒ `faits: null`, `record: null` ; `déclaratif`@140 ⇒ récap mais `record: null` (§2) | ✅ |
| **Autorisation** : carte d'une séance d'un **autre compte** refusée ; non authentifié | e2e : B `GET …/card` sur la séance de A → **404** ; sans jeton → **401** | ✅ |
| Aucun type d'API dupliqué | DTO/calc de `@hpt/shared` (`CarteBilan`, `résuméCarte`) ; `RésuméCarte` ≡ récap du DTO (`expectTypeOf`) | ✅ |
| `pnpm lint` | `biome check .` (253 fichiers) | ✅ exit 0 |
| `pnpm typecheck` | build `shared` puis `tsc --noEmit` (shared + api + app) | ✅ vert |
| `pnpm test` (sans DB) | Vitest — **124 (shared, +11)** + 14 (api) + **117 (app : +16 sharing)** | ✅ 255/255 |
| `pnpm build` | shared (ESM+CJS) + api (nest) + app (typecheck) | ✅ vert |
| `db:verify` (Postgres requis) | Vitest — 98 (lots 0.3→3.2) + **5 (sharing 3.3)** | ✅ 103/103 |
| CI | job `ci` (sans DB) + job `db` (`migrate` + `verify`, e2e 3.3 inclus) | ✅ |

---

## Lot 3.4 — Historique · 2026-06-30

Quatrième morceau de la **Phase 3 (Restitution)**. **Surface app `history`** :
l'onglet **Historique** — les **séances passées** d'un cheval, **groupées par
mois**, avec **faits objectifs** (hauteur, sans-faute/fautes ; **Plat =
régularité**) et **badges de bilan** (`✓ simple` ; `✦ augmenté` **quand
présent**), et la **ré-ouverture** du **bilan de séance simple** (la carte de
3.3). Conformément à l'Architecture §3/§4, `history` est une **surface app _sans
module backend dédié_** : elle **lit les endpoints existants** de `sessions`
(séances passées) et de `sharing` (`GET /sessions/:id/card`, 3.3). Le **seul**
ajout backend est une **liste paginée** des séances passées — elle manquait au
service `sessions`. Strictement le lot 3.4 : **pas** de bilan augmenté IA (4.5,
seul le **slot `✦`** est câblé, vide), **pas** de bilan de progression PDF (4.4),
**pas** de **nouvelle** UX d'édition/suppression (2.4, au plus un **renvoi**).

### Emplacement (décisions tranchées)

- **`shared` (DTO, Zod)** — `schemas/historique.ts` : `pageHistoriqueSchema`
  (page de **séances brutes** `séanceSortieSchema` **réutilisé** + curseur
  `next_before`/`has_more`) et `historiqueQuerySchema` (`before` ISO + `limit`
  1..50, défaut 20). **Aucune forme dupliquée** (Architecture §2) : la page
  n'invente rien, elle réutilise la projection de séance de 2.2 ; bornes de
  pagination **identiques au fil** (3.1).
- **`api/src/sessions/`** — **pas de nouveau module** (consigne) : on **étend**
  `sessions`. `sessions.service.ts` gagne `listHistory(compteId, chevalId,
  query)` (pagine l'historique possédé) ; `sessions.controller.ts` gagne
  `GET /horses/:id/sessions/history` (garde JWT, `:id` en `ParseUUIDPipe`, query
  Zod). Le `GET /horses/:id/sessions` **brut** de 2.2 reste **inchangé**.
- **`app/src/history/`** — `history-api.ts`, `use-history.ts` (`useInfiniteQuery`,
  pagination), `history-format.ts` (helpers **purs** testés : `faitsDeSéance`,
  `groupByMonth`, `formatMonthLabel`/`formatHistoryDate`, `badgesBilan`),
  `history-entry-card.tsx` (carte de séance). L'écran `app/(tabs)/historique.tsx`
  passe du placeholder à la **liste défilante par mois** (`SectionList`) ; l'écran
  `app/src/app/sessions/[id]/card.tsx` **rouvre** le bilan simple.

### Décisions tranchées (et pourquoi)

- **`history` lit les endpoints `sessions`/`sharing`, sans module backend
  (Architecture §3/§4).** Une surface app n'a pas de domaine propre : le backend
  ne fait que **paginer** des séances brutes ; **toute la composition de la vue**
  (faits objectifs via `faitsSéance` de `shared`, **groupement par mois**, badges)
  est **côté app**. C'est exactement ce qui distingue une **surface** d'un
  **module** (le feed 3.1 / le sharing 3.3 sont des modules : ils composent
  côté api). La **ré-ouverture** d'un bilan réutilise **tel quel**
  `GET /sessions/:id/card` (3.3) — composition **sans état**, rejouable pour
  n'importe quelle séance passée (anticipé au journal 3.3).
- **Endpoint de liste paginée ajouté « au strict nécessaire » — et pourquoi.**
  L'onglet **défile** des séances (UI/UX §6.4) ; or `GET /horses/:id/sessions`
  (2.2) renvoie **tout**, non paginé. Plutôt que de changer ce contrat (utilisé
  par l'e2e 2.2, lecture brute) ou de tout charger côté app, on **ajoute** une
  route **dédiée** `GET …/sessions/history` à **curseur** (`before` + `limit`),
  **calquée sur le fil** (3.1) pour un défilement cohérent. **Pas de module
  `history`**, **pas d'élargissement** : la route ne fait que **paginer** des
  `SéanceSortie` (mêmes DTO) ; `listHistory` réutilise `listForHorse` (scope
  compte + propriété → 404 sans fuite), trie **récent → ancien**, tranche par
  curseur. Surface **identique au fil**, sans dérivé calculé côté api.
- **Groupement par mois = présentation côté app, sur la liste aplatie.**
  `groupByMonth` regroupe les **séries consécutives** par mois en **préservant**
  l'ordre reçu (récent → ancien). Comme on regroupe la **liste aplatie complète**
  à chaque rendu, un mois **à cheval sur deux pages** reste **une seule** section
  (prouvé en unitaire). Libellés `MARS 2026` / `12/03` construits **sans `Intl`**
  (déterministes en test et à l'affichage, quel que soit le moteur JS). Un **Plat**
  (0 franchissement) ⇒ `faitsDeSéance` renvoie `null` ⇒ carte de **régularité**
  (Modèle §3, UI/UX §6.4).
- **Câblage conditionnel du slot `✦`, prêt pour 4.5 — pas une valeur en dur.**
  Les badges d'une carte sont décidés par la fonction **pure** `badgesBilan(augmentéDisponible?)`
  : **`✓ simple` toujours** (ré-ouvrable via 3.3), **`✦ augmenté` seulement si**
  `augmentéDisponible`. En 3.4 **aucune source** de bilan augmenté n'existe (le
  module `ai-bilan` est le lot **4.5**) : l'écran **ne fournit jamais** le
  paramètre, donc le `✦` **n'apparaît jamais** — non par une constante `false`
  baignée dans l'UI, mais par **absence de donnée**. Le **conditionnel** est
  prouvé des **deux côtés** (`badgesBilan(true)` ⇒ `['simple','augmenté']`, sinon
  `['simple']`). En 4.5, l'historique **lira `ai-bilan`** et passera `true` quand
  un bilan existe — **sans toucher** à ce conditionnel.
- **Lecture + ré-ouverture uniquement ; renvoi (pas réimplémentation) vers 2.4.**
  La carte rouverte (`sessions/[id]/card.tsx`) réutilise **tels quels**
  `useShareCard` + `BilanCard` (3.3) ; elle porte `[ Partager ]` (réutilisé) et un
  **renvoi discret** « Modifier la séance » → `/sessions/[id]/edit` (l'écran de
  2.4, **inchangé**). Aucune nouvelle UX d'édition/suppression n'est créée ici ;
  c'est le **point d'entrée naturel** autorisé par la consigne.
- **Cohérence après suppression = par construction (2.4).** L'historique est une
  **lecture** : rien n'est mis en cache d'agrégat. Le serveur relit l'historique
  courant à chaque page ; une séance supprimée (`DELETE /sessions/:id`, 2.4)
  **disparaît** mécaniquement (prouvé e2e : suppression ⇒ l'id n'est plus dans la
  page, la séance gardée reste).
- **Gratuit, jamais verrouillé (Spec §8).** L'historique conservé est gratuit et
  illimité : la route ne porte **que** la garde JWT (aucun entitlement) ; l'UI ne
  grise rien. Le gating (4.1) ne touche pas cette surface.

### Écarts vs cadrage (consignés)

- **Faits objectifs composés côté app (pas côté api).** Contrairement au feed
  (module, qui renvoie `EntréeFeed` avec `faits` calculés côté api), l'historique
  est une **surface** : l'endpoint renvoie des **séances brutes** et l'app dérive
  les faits via `faitsSéance` de `shared`. Conséquence assumée : un **petit mapping
  de glue** `ObstacleSortie → ObstacleFranchissement` est repris côté app (miroir
  de celui du feed/sharing/metrics côté api) — **glue**, pas calcul (le calcul
  reste **une seule** implémentation dans `shared`, Architecture §2).
- **Route `GET /horses/:id/sessions/history`** (sous-vue de `sessions`, pas
  `…/history`) : garde la **pagination dans le périmètre de `sessions`** et
  renforce « pas de module `history` ». Suffixe **anglais** (`history`) comme
  `feed`/`metrics`/`card` ; type **français** (`PageHistorique`).
- **Tests app = logique pure (Node), pas de rendu RN** (cohérent 1.4→3.3). La DoD
  « parcourir / Plat = régularité / câblage `✦` » est prouvée par les helpers
  **purs** (`history-format.test` : faits, groupement par mois, `badgesBilan`) +
  la surface (`history-api.test`). Le `tsc` couvre les écrans (carte, liste) ; un
  **export Metro web réel** bundle les **23 routes** (dont
  `/sessions/[id]/card`) sans erreur. L'e2e api (`historique.spec.ts`) prouve
  pagination, ordre, autorisation et **cohérence après suppression**.

### Points laissés ouverts (reports explicites)

- **Le badge `✦` se remplira en 4.5.** Le slot est **câblé** (`badgesBilan` +
  prop `augmentéDisponible`) mais **vide** : le module `ai-bilan` (génération
  Mistral, persistance, badge premium/pro) le **sourcera** — l'historique passera
  `true` quand un bilan augmenté existe pour la séance. Aucun appel IA, aucune
  persistance amorcée ici (Spec §8 : trois objets distincts).
- **L'historique sera lu par le compte invité en 4.6.** La **coquille invité**
  (lecture seule, UI/UX §5/§6.7) consultera les **mêmes** séances passées et
  bilans **simples** (sans `✦`, sans sélecteur multi-chevaux). La surface
  actuelle (lecture + ré-ouverture, gratuite) est compatible **par construction**
  — restera à brancher la lecture invité et le bandeau « lecture seule ».
- **Pagination — mêmes affinements que le fil (3.1).** (a) Curseur par **date** :
  une collision à la milliseconde près pourrait, au bord d'une page, sauter une
  entrée (improbable, mono-utilisateur). (b) **Recalcul de l'historique complet à
  chaque page** (`listForHorse`) : correct et simple à l'échelle v1 ; un calcul
  incrémental/paginé en SQL sera utile si un cheval accumule des centaines de
  séances.
- **Bilan de progression (4.4)** — rapport **multi-séances** (PDF/lien, curation
  de période) : non amorcé. L'historique **donne accès** aux bilans (Spec §1), il
  ne **cure** pas de période.

### DoD — preuves

| Critère | Vérification | Statut |
|---|---|---|
| **Parcourir les séances passées** d'un cheval (groupées par mois, faits objectifs, **Plat = régularité**) | `history-format.test` : `groupByMonth` (sections `MARS 2026`, ordre récent → ancien, mois à cheval sur 2 pages = 1 section), `faitsDeSéance` (obstacles ⇒ faits ; **Plat ⇒ null = régularité**) ; e2e `historique.spec` : page récent → ancien, séances brutes (faits dérivables) | ✅ |
| **Rouvrir un bilan simple** (`✓`) depuis une séance (carte 3.3) | carte tappable ⇒ `/sessions/[id]/card` ; écran réutilise `useShareCard` + `BilanCard` (**même** `GET /sessions/:id/card`, 3.3) ; export Metro : route `/sessions/[id]/card` bundlée | ✅ |
| **`✦` affiché uniquement si un bilan augmenté existe** — donc **absent en 3.4** (câblage conditionnel) | `history-format.test` : `badgesBilan()`/`badgesBilan(false)` ⇒ `['simple']`, `badgesBilan(true)` ⇒ `['simple','augmenté']` ; l'écran **ne passe jamais** `augmentéDisponible` (aucune source `ai-bilan`) ⇒ `✦` jamais rendu | ✅ |
| **Cohérence après suppression** (2.4) : une séance supprimée disparaît | e2e `historique.spec` : `DELETE /sessions/:id` ⇒ l'id **disparaît** de l'historique, la séance gardée reste | ✅ |
| **État vide = invitation** ; accessibilité terrain (≥ 44 px, AA+, chiffres tabulaires) | écran : `EmptyState` (« Tes séances s'archivent ici… ») + variantes chargement/erreur/aucun-cheval ; carte = `Pressable` plein (cible large), `StatText` **tabulaire**, libellés accessibles, laiton **non** détourné (`✦` en `secondary`, jamais en célébration) | ✅ |
| **Surface sans module dédié** : lecture via `sessions`/`sharing` | `listHistory` ajouté au **service `sessions`** (pas de module `history`) ; composition (faits/mois/badges) **côté app** ; ré-ouverture via l'endpoint `sharing` existant | ✅ |
| **Liste paginée** au strict nécessaire (curseur `before` + `limit`) | e2e `historique.spec` : `?limit=2` ⇒ 2 plus récentes + `has_more` + `next_before` ; `?before=curseur` ⇒ page suivante, fin de fil | ✅ |
| **Autorisation** : historique d'un cheval d'un **autre compte** refusé ; non authentifié | e2e : B `GET …/sessions/history` sur le cheval de A → **404** ; sans jeton → **401** | ✅ |
| Aucun type d'API dupliqué | DTO de `@hpt/shared` (`PageHistorique` **réutilise** `séanceSortieSchema` ; `HistoriqueQuery`) ; faits via `faitsSéance` (`shared`) ; carte via `CarteBilan` (3.3) | ✅ |
| `pnpm lint` | `biome check .` (264 fichiers) | ✅ exit 0 |
| `pnpm typecheck` | build `shared` puis `tsc --noEmit` (shared + api + app) | ✅ vert |
| `pnpm test` (sans DB) | Vitest — **132 (shared, +8)** + 14 (api) + **131 (app : +11 history-format, +3 history-api)** | ✅ 277/277 |
| `pnpm build` | shared (ESM+CJS) + api (nest) + app (typecheck) ; **export Metro web** (23 routes, `/sessions/[id]/card` incluse) | ✅ vert |
| `db:verify` (Postgres requis) | Vitest — 103 (lots 0.3→3.3) + **5 (historique 3.4)** | ✅ 108/108 |
| CI | job `ci` (sans DB) + job `db` (`migrate` + `verify`, e2e 3.4 inclus) | ✅ |

---

## Lot 3.5 — Onboarding · 2026-06-30

Cinquième morceau de la **Phase 3 (Restitution)**. **Surface app `onboarding`** :
le **tunnel d'accueil** — **bifurcation** Cavalier/Coach, **cheval minimal**,
**ligne de départ déclarative**, **1re séance guidée**, puis **atterrissage sur
le feed** (3.1) + **héros** (3.2). Principe directeur (Spec §2) : on **sort avec
une récompense déjà vue**, jamais avec seulement des champs remplis. Conformément
à l'Architecture §3/§4, `onboarding` est une **surface app _sans module backend
dédié_** : elle **orchestre** `horses` (2.1) et `sessions` (2.2/2.3) et atterrit
sur les surfaces livrées `feed`/`metrics`. Strictement le lot 3.5 : **pas** le
générateur réel de bilan de progression (4.4, ici **aperçu démo**), **pas**
d'upgrade/gating/paywall (4.1/4.2), **pas** de comptes/onboarding invité (4.6),
**pas** de reconstruction du feed/héros/saisie (réutilisés).

### Emplacement (décisions tranchées)

- **`app/src/onboarding/`** — la surface, découpée logique pure ⁄ composants
  (même posture que 1.4→3.4 : RN+Vitest fragile au rendu) :
  - **pur (`.ts`, testé Vitest)** : `onboarding-flow.ts` (machine d'étapes :
    chemins, `nextStep`/`prevStep`, `progress`, `canGoBack`, **et la décision de
    garde `shouldEnterOnboarding`**), `starting-line.ts` (brouillon + **DTO
    `déclaratif`** de la ligne de départ, via `draftToCreateDto` de 2.3),
    `bilan-demo.ts` (**données de démo** du bilan coach + libellé accessible) ;
  - **composants (`.tsx`, couverts `tsc` + export Metro)** : `bifurcation-step`,
    `bilan-demo-card`, `horse-step`, `starting-line-step`, `guided-session-step`,
    `onboarding-progress`, le hook d'état `use-onboarding`, et le barrel.
- **Route** : `app/src/app/onboarding.tsx` (`/onboarding`), écran-**wizard** unique
  qui pilote `use-onboarding` et rend l'étape courante (pas de sous-routes : l'état
  du tunnel — chemin, cheval créé — reste en mémoire, sans passer de params).
- **Garde de navigation** : `app/src/app/_layout.tsx` (`RootNavigator`) étendu —
  un **authentifié sans cheval** est redirigé vers `/onboarding` (décision pure
  `shouldEnterOnboarding`). **Zéro** changement `shared`/`api`/DB.

### Décisions tranchées (et pourquoi)

- **Tunnel = surface app, aucun module backend, aucun endpoint nouveau
  (Architecture §3/§4).** Le tunnel **n'écrit rien lui-même** : il appelle les
  services existants. Le cheval passe par `horses` (2.1, `POST /horses`) ; la
  ligne de départ **et** la 1re séance passent par `sessions` (2.2,
  `POST /horses/:id/sessions`). Le besoin d'orchestration est **entièrement
  satisfait par les routes livrées** — donc, conformément à la consigne (« aucun
  endpoint nouveau sauf strict nécessaire »), **aucun** n'a été ajouté. C'est ce
  qui distingue une **surface** (`onboarding`, `history`) d'un **module** (`feed`,
  `sharing`) : la composition reste côté app, le backend ne fait que ce qu'il sait
  déjà faire.
- **Pose de la provenance `déclaratif` sur la ligne de départ via `sessions`
  (Spec §2.4, Modèle §2).** La « question de référence » devient une **séance
  `déclaratif`** : un **franchissement propre unique** à la hauteur déclarée
  (obstacle simple, 1 répétition, 0 faute → taux 100 %). `buildStartingLineDto`
  **réutilise `draftToCreateDto(draft, 'déclaratif')`** de la saisie 2.3 — la
  provenance est un **paramètre déjà supporté** (2.2 accepte `déclaratif` depuis
  l'origine, « le flux qui s'en sert est 3.5 »), **aucun contrat dupliqué**. La
  ligne **nourrit le feed** (entrée marquée « Antérieure à l'app » par le
  `provenanceMarqueur` de 3.1) **mais reste exclue des dérivés** (`détecteJalons`
  et `hauteurMaîtrisée` filtrent `live` en amont, 3.1/3.2) : prouvé ici par un
  test qui injecte la ligne (130 cm) **au-dessus** d'un record `live` (110 cm) et
  vérifie que le record **reste 110**, qu'**aucun jalon** ne s'attache à la ligne,
  et que la maîtrisée **ne la compte pas**.
- **Enregistrement résilient réutilisé pour la ligne de départ.** La ligne de
  départ part par **`submitSession`** (2.3) : **idempotence + réessai** sur
  coupure passagère → pas de doublon (le serveur dédoublonne sur
  `(cheval_id, idempotency_key)`). Le bouton est désactivé pendant l'envoi (une
  ligne, une clé). Rien de spécifique à inventer.
- **1re séance guidée = variante _plus explicative_ de la saisie 2.3, pas une
  refonte.** `guided-session-step` **réutilise** `useSessionCapture` (brouillon,
  persistance, idempotence, réessai) et les **mêmes éditeurs** (`ChipGroup`,
  `ObstacleEditor`/`TourEditor`, `canSave`) ; il ajoute des **explications
  pas-à-pas** (« 1 · type », « 2 · obstacles », « 3 · enregistrer ») et **retire**
  la duplication « séance précédente » (il n'y en a pas — on ne propose pas de
  reprendre la ligne **déclarative** comme base). La séance créée est **`live` et
  duplicable** : la boucle nominale (2.3/3.x) la reprendra telle quelle. À
  l'enregistrement, on **atterrit directement sur le feed** (pas la carte 3.3,
  réservée à la boucle nominale) ; « Plus tard » mène **aussi** au feed — la ligne
  de départ y figure déjà, donc on ne sort **jamais** les mains vides.
- **Atterrissage sur le _vrai_ feed (3.1 + héros 3.2), pas un écran de récompense
  reconstruit.** La fin du tunnel fait `router.replace('/')` : l'utilisateur tombe
  sur les surfaces **livrées**, qui affichent déjà sa ligne de départ (repère) et,
  s'il a logué la 1re séance `live`, son **premier record** en vitrine (3.2) + le
  **jalon** injecté (3.1). « Réutiliser, pas refaire » jusqu'à la récompense — et
  c'est la preuve la plus forte de la DoD (« récompense déjà vue »).
- **Aperçu de bilan coach = démo statique, découplé de 4.4 — et pourquoi.** Le
  chemin coach insère **avant toute saisie** un `BilanDemoCard` : un **bilan de
  progression** (Spec §6 : niveau démontré, **régularité**, trajectoire) rendu sur
  **données figées** (`BILAN_DEMO`) et **explicitement marqué « Aperçu · exemple »**.
  **Consigne respectée** : ce n'est **pas** le générateur réel (4.4) ; aucune
  dépendance à un endpoint, aucun calcul. Pourquoi statique : le levier de
  conversion, c'est **montrer le livrable** tôt (Spec §2.3) ; le **vrai** bilan
  (couche objective + régularité) se construira en 4.4, sans toucher à cet aperçu.
  La carte **réutilise** la signature barre (`BarMotif`, 3.1) et le **laiton**
  (record, réservé à la célébration) — cohérence visuelle, zéro nouvelle primitive.
- **Bifurcation : choix explicite, pré-orienté par le `type` de compte.** L'écran
  de bifurcation (Spec §2.1, UI/UX §6.1) propose **Cavalier** (chemin court) /
  **Coach** (config + aperçu) ; le chemin correspondant au `type` choisi à
  l'inscription (1.4) porte un discret « Recommandé ». Le choix **n'écrit pas** le
  `type` du compte (déjà posé au register, éditable au Profil) : il **n'oriente
  que le tunnel**. Les deux chemins **convergent** ensuite (cheval → ligne →
  séance) : un seul jeu de composants, le coach ayant simplement l'étape démo en
  plus.
- **Garde « 0 cheval → onboarding » comme décision _pure_ et testée.** Plutôt que
  de disperser la condition dans l'UI, `shouldEnterOnboarding({authenticated,
  horsesLoading, horsesCount, inOnboarding})` est une fonction **pure** (testée :
  matrice complète) que `RootNavigator` applique — même esprit que `TABS`
  (source unique testée, 1.4). On **n'entre** que liste **résolue** (`!loading`,
  pas de clignotement) **et vide**, et **jamais** si on y est déjà (pas de
  boucle) ; on ne **force jamais la sortie** du tunnel (l'utilisateur le termine
  en atterrissant sur le feed) — un cheval créé en cours de tunnel ne l'en éjecte
  donc pas.

### Écarts vs cadrage (consignés)

- **Type de la séance « ligne de départ » : `Parcours` + obstacle `Vertical`.**
  Le cadrage parle d'un « point déclaratif » sans fixer la forme. On modélise le
  repère « franchit proprement X » par la forme **la plus neutre** d'un
  entraînement à obstacles (un droit, propre). C'est un **choix d'implémentation**
  (pas un nouveau contrat) ; toute la sémantique tient dans la **provenance**.
- **Convergence des deux chemins après la bifurcation.** Le cadrage décrit le
  chemin coach surtout par « config riche + aperçu bilan » ; on le fait **converger**
  vers la même configuration (cheval → ligne → séance) que le cavalier, l'aperçu
  démo en tête. Justification : les deux doivent **atterrir sur une récompense**
  (DoD) ; dupliquer un sous-tunnel coach distinct serait de l'abstraction
  prématurée. La « config plus riche » (multi-chevaux) est **hors périmètre**
  (Pro, cf. points ouverts).
- **Garde d'entrée traitée uniformément sur « 0 cheval ».** Un utilisateur qui
  supprimerait son **unique** cheval (2.1) repasserait par le tunnel. Conforme à
  « écrans vides = invitations » (le tunnel **est** l'invitation), mais c'est un
  léger débordement du cas « nouvel arrivant » — assumé et consigné.
- **Léger flash possible avant redirection.** La garde redirige dans un `effect`
  (comme la garde d'auth de 1.4) : un nouvel inscrit peut entrapercevoir le feed
  vide avant le saut vers `/onboarding`. Le feed vide étant déjà une **invitation**
  (3.1), l'effet est bénin ; noté.
- **Tests app = logique pure (Node), pas de rendu RN** (cohérent 1.4→3.4). La DoD
  (chemins traversables, ligne `déclarative` exclue, séance duplicable, garde) est
  prouvée par les helpers **purs** (`onboarding-flow` 16, `starting-line` 8 dont
  l'exclusion record/maîtrisée, `bilan-demo` 5) ; les écrans sont couverts par
  `tsc` **et** un **export Metro web** (24 routes, `/onboarding` incluse).

### Points laissés ouverts (reports explicites)

- **Le _vrai_ bilan de progression est le lot 4.4.** L'aperçu coach est **démo/
  statique** (`BILAN_DEMO`) : le générateur réel (PDF/lien, curation de période,
  couche objective + régularité) viendra en 4.4 et **réutilisera** la maîtrisée
  (`metrics` 3.2) — sans toucher à cet aperçu, qui restera l'accroche.
- **L'onboarding _invité_ est le lot 4.6.** Le tunnel invité (sauter la création
  de cheval, atterrir en **lecture seule** sur le cheval partagé, bandeau « lecture
  seule ») n'est **pas** ici. La garde actuelle (« 0 cheval → tunnel ») devra
  **cohabiter** avec l'accès invité (un invité n'a pas de cheval **à lui** mais ne
  doit pas être envoyé créer un cheval) — à brancher en 4.6.
- **Le chemin coach multi-chevaux suppose le Pro / les quotas (4.1/4.3).** Ici, le
  coach crée **un** cheval (création minimale réutilisée) ; « plusieurs chevaux »
  et la bibliothèque de combinaisons riche (2.5) en onboarding relèvent du
  **multi-cheval Pro** et de la **garde d'entitlement** — non construits (l'UI ne
  vend pas, elle montre).
- **Pré-amorçage de la 1re séance.** On a préféré ne **pas** pré-injecter un
  obstacle (robustesse vs hydratation du brouillon persistant) : la séance guidée
  démarre vide avec une invitation explicite. Un pré-remplissage « plus tenant par
  la main » reste possible si l'usage le réclame.
- **Confirmation 1.2 par deep link** (point ouvert hérité de 1.4 : `verify-email/
  confirm`, `password-reset/confirm`) — toujours non câblé ; ce lot ne traite pas
  les liens entrants.

### DoD — preuves

| Critère | Vérification | Statut |
|---|---|---|
| **Un nouvel utilisateur atteint une récompense visible** (feed + héros) **sans champ superflu** | Garde `shouldEnterOnboarding` (authentifié, 0 cheval → `/onboarding`, testée) → tunnel : cheval **minimal** (nom+niveau+hauteur, `HorseForm` 2.1) → ligne → séance → `router.replace('/')` sur le **vrai feed** (3.1) + `MetricsHero` (3.2) | ✅ |
| **Ligne de départ `déclarative`** (provenance via `sessions`), **« antérieure à l'app »**, **exclue des agrégats** | `starting-line.test` : `buildStartingLineDto` ⇒ `provenance: 'déclaratif'`, DTO **revalidé** par `séanceCréerSchema` ; **exclusion prouvée** (ligne@130 n'éclipse pas le record `live`@110 ; **0 jalon** sur la ligne ; `hauteurMaîtrisée` la **filtre**) ; marquage feed via `provenanceMarqueur` (3.1) | ✅ |
| **Chemins amateur et coach traversables** ; le coach montre un **aperçu de bilan (démo, sans 4.4)** | `onboarding-flow.test` : étapes des deux chemins (coach insère `bilan-demo`) ; `bilan-demo.test` : `BILAN_DEMO` cohérent (trajectoire croissante, record ≥ maîtrisée), `BilanDemoCard` marqué « Aperçu · exemple », **aucune** dépendance à 4.4 | ✅ |
| **La 1re séance guidée crée une séance duplicable** (boucle nominale 2.3/3.x) | `guided-session-step` réutilise `useSessionCapture` + éditeurs 2.3 → séance **`live`** créée par `POST /horses/:id/sessions` ; duplicable par `draftFromPreviousSession` (2.3), inchangé | ✅ |
| **Réutilisation, aucun module backend / endpoint nouveau** | `onboarding` = surface app ; cheval via `horses` (2.1), ligne+séance via `sessions` (2.2) ; **0** fichier `api/`/`shared`/DB modifié ; `buildStartingLineDto` réutilise `draftToCreateDto` (2.3) | ✅ |
| **Accessibilité terrain** (≥ 44 px, AA+, chiffres tabulaires) ; **écrans vides = invitations** | Cibles via `Button`/`HeightBar`/éditeurs (tokens 1.4) ; `StatText` **tabulaire** (aperçu) ; libellés accessibles (bifurcation, barre, progression `progressbar`) ; le tunnel **est** l'invitation du feed vide (§7) | ✅ |
| Aucun type d'API dupliqué | DTO/calc de `@hpt/shared` (`SéanceCréerDto`, `ChevalCréerDto`, `détecteJalons`/`recordAbsolu`/`hauteurMaîtrisée` pour le test d'exclusion) ; provenance posée via le contrat existant | ✅ |
| `pnpm lint` | `biome check .` (279 fichiers) | ✅ exit 0 |
| `pnpm typecheck` | build `shared` puis `tsc --noEmit` (shared + api + app) | ✅ vert |
| `pnpm test` (sans DB) | Vitest — 132 (shared) + 14 (api) + **160 (app : +29 onboarding — 16 flow, 8 starting-line, 5 bilan-demo)** | ✅ 306/306 |
| `pnpm build` | shared (ESM+CJS) + api (nest) + app (typecheck) ; **export Metro web** (**24 routes**, `/onboarding` incluse) | ✅ vert |
| `db:verify` (Postgres requis) | **inchangé** (aucun changement api/DB en 3.5) | ✅ 108/108 |
| CI | job `ci` (sans DB) + job `db` (inchangés ; 3.5 est app-only) | ✅ |

---

## Lot 4.1 — Tiers & entitlements · 2026-06-30

Ouverture de la **Phase 4 (Monétisation)**. Module **`entitlements`** (api) +
**politique de gating** dans `shared` + tranche **`app`** (lecture de
l'entitlement) : faire du champ `tier` (posé en 0.2/0.3 sur Compte) l'**autorité
serveur du gating** (Architecture §3/§5). On pose la **matrice tier →
capacités/quotas** (Spec §8), une **garde d'entitlement réutilisable**
premium/pro, l'**atterrissage des quotas différés** (chevaux 2.1, combinaisons
2.5), et la **lecture de l'entitlement au login** (Spec §9.3). Strictement le lot
4.1 : **ni** Mollie/checkout/paywall/grisage (4.2), **ni** archivage (4.3), **ni**
les fonctions payantes elles-mêmes (4.4/4.5/4.6/5.1) — ici on **fournit et
prouve** la garde ; les lots payants l'**attacheront**.

### Emplacement (décisions tranchées)

- **Politique dans `shared`** : nouvelle couche `packages/shared/src/entitlements/`
  (`entitlement.ts` + barrel + tests) — `CAPACITÉS`, `QUOTAS`,
  `PLAFOND_COMBINAISONS_GRATUIT`, type `Entitlement`, `MATRICE_ENTITLEMENT`, et
  fonctions pures `entitlementPourTier` / `aLaCapacité` / `quotaPour` /
  `peutCréer`. **DTO de sortie** : `schemas/entitlement.ts`
  (`entitlementSortieSchema`, dérivé des tuples de la politique → ne peut pas
  diverger). Barils `index.ts` (racine + schemas) mis à jour. C'est la **5ᵉ
  couche** de `shared` (à côté de `enums/types/schemas/calc`).
- **Module API** : `api/src/entitlements/` (par domaine, §3) —
  `entitlements.service` (projection + asserts), `entitlements.errors`
  (`CapacitéRequiseError` 403, `QuotaDépasséError` 403), `require-capacite.decorator`
  (`@RequireCapacité` + `Reflector`), `entitlement.guard` (`EntitlementGuard`,
  réutilisable), `entitlements.controller` (`GET /me/entitlement`),
  `entitlements.module`. Enregistré dans `app.module.ts` après `auth-account`.
- **Enforcement branché sur l'existant** : `horses` (2.1) et `combinations` (2.5)
  importent `EntitlementsModule` et **composent** le quota dans leur service de
  création — aucun nouveau endpoint de quota, aucune migration (le `tier`, les
  tables `cheval`/`combinaison` existent déjà).
- **Tranche front** : `app/src/entitlements/` (`entitlements-api`,
  `entitlements-context` + `useEntitlement`, barrel, test). `EntitlementsProvider`
  monté dans `_layout.tsx` ; **Profil** affiche le tier issu de l'entitlement.

### Décisions tranchées (et pourquoi)

- **Matrice = traduction littérale du tableau Spec §8, donnée pure et testée
  (Archi §2).** Cinq **capacités** gatées (`analytique_diagnostic`,
  `bilan_augmenté`, `bilan_progression` → premium/pro ; `multi_chevaux`,
  `comptes_invité` → pro) et deux **quotas** (`chevaux` 1/1/∞ ; `combinaisons`
  5/∞/∞). Une capacité n'existe dans la matrice que si elle peut être **refusée** :
  la saisie, la boucle gratuite (feed/héros/cartes) et l'historique — jamais
  verrouillés — n'y figurent pas. **Une seule implémentation**, lue par l'app
  (grisage 4.2) **et** l'api (garde + quota).
- **`null` = illimité** (et non `Infinity`) : sérialisable en JSON, donc traverse
  `GET /me/entitlement` sans perte. `peutCréer(tier, clé, countActuel)` = `quota
  === null || countActuel < quota`.
- **Plafond combinaisons gratuit = 5** (décision 4.1). La Spec §4.4 dit
  « bibliothèque limitée en nombre » sans chiffre figé ; 5 est assez pour essayer,
  assez bas pour rester un levier de conversion. **Source unique**
  (`PLAFOND_COMBINAISONS_GRATUIT` dans `shared`) → 4.2 pourra le re-trancher / le
  rendre paramétrable (tarifs) sans toucher l'enforcement.
- **Source du `tier` à l'exécution = le principal (claim JWT), pas une relecture
  DB par requête.** Le `tier` est posé sur Compte (0.3), **lu au login** (1.1) et
  porté **signé** par l'access token (`AuthenticatedUser.tier`, déjà présent). La
  garde **et** le quota **et** `/me/entitlement` lisent **la même** source → ce
  que l'app affiche/dégrisera == ce que le serveur enforce (jamais d'incohérence).
  C'est **authoritatif** (le client ne peut pas forger un tier signé) et évite un
  aller-retour DB par appel gaté (modèle *claims-based* standard). « Lit `tier`
  sur Compte » est satisfait via le claim issu de Compte au login (§9.3).
- **Garde d'entitlement réutilisable** = `@RequireCapacité(cap)` (métadonnée) +
  `EntitlementGuard` (lit la métadonnée via `Reflector`, lit `request.user.tier`,
  tranche via `aLaCapacité`). Un handler **non annoté** passe librement (on peut
  l'appliquer large sans bloquer le gratuit) ; un sous-tier sur un handler annoté
  → **403** (`CapacitéRequiseError`). **Fournie + exportée + prouvée** (test
  unitaire) ; **aucun** endpoint premium réel en 4.1 (ils naissent en
  4.4/4.5/4.6/5.1 et l'attacheront). À utiliser **après** `JwtAccessGuard`.
- **Enforcement de quota composé dans le service de ressource, pas en garde —
  pour rester acyclique.** Le décompte d'une ressource appartient au module qui la
  possède : `HorsesService.countActifs` / `CombinationsService.countForAccount`
  lisent **leur propre** table ; ils appellent ensuite
  `EntitlementsService.assertPeutCréer(tier, clé, count)` (décision pure, lève
  `QuotaDépasséError`). Sens de dépendance **`horses/combinations → entitlements`**
  uniquement. Mettre le décompte **dans** `entitlements` (qui appellerait
  `horses`) **et** l'enforcement dans `horses` (qui appelle `entitlements`) aurait
  créé un **cycle de modules** ; on l'évite en gardant le décompte côté
  propriétaire. `entitlements` ne lit **aucune** table d'un autre domaine (§3) —
  il ne porte que la **politique** et l'**erreur**. Aucune règle de tier n'est
  dispersée (les services ne connaissent ni forfaits ni chiffres) : c'est bien la
  **garde/le service d'entitlement** qui compose, comme annoncé par 2.1/2.5.
- **Décompte chevaux sur l'ACTIF (pré-câblé 4.3).** `countActifs` compte
  aujourd'hui **tous** les chevaux du compte (il n'y a pas encore de colonne
  `archivé`) ; 4.3 ajoutera `WHERE archivé = false` **au seul** endroit nommé
  `countActifs` → un cheval archivé **sortira mécaniquement** du quota (Spec §9.2),
  sans toucher au gating.
- **Plafond combinaisons enforcé sur `create` ET `update`.** « Modification =
  nouvelle » (2.5) **insère une ligne** (l'ancienne reste) : c'est une addition à
  la bibliothèque, donc soumise au même plafond — sinon un gratuit au plafond
  contournerait la limite par `PATCH` répété. Au plafond, éditer suppose de
  libérer une place d'abord (honnête, prouvé).
- **Refus = 403 (et non 401/402).** L'utilisateur est authentifié mais son tier
  n'ouvre pas la fonction/ressource. `publicMessage` **dit quoi faire** (passer au
  forfait qui débloque) sans jargon → l'app (4.2) déclenchera l'upgrade dessus.
  Erreurs **typées** (`DomainError`) traduites par le `DomainExceptionFilter`
  global (1.1) — aucune fuite d'interne (§5).
- **`GET /me/entitlement`** (route `/me`, sous `JwtAccessGuard`) renvoie
  `{ tier, capacités, quotas }` **validé** par `entitlementSortieSchema`. L'app le
  lit au login (`EntitlementsProvider`, TanStack Query activée à
  `authenticated`, clé portée par le compte) et **affiche le tier** dans Profil
  (repli sur le compte le temps du chargement). **Re-validation Zod au bord de
  l'app** (le DTO n'a que scalaires/booléens, contrairement aux fiches à `Date`).

### Écarts vs cadrage (consignés)

- **`tier` lu depuis le principal plutôt que relu en base à chaque appel.** Le
  cadrage dit « service d'entitlement (lit `tier` sur Compte) » ; on lit le `tier`
  **via le claim** (issu de Compte au login, signé) pour garantir l'égalité
  garde == quota == lecture et éviter un coût DB par requête. **Conséquence
  assumée** : un changement de tier (upgrade 4.2, downgrade) ne prend effet
  qu'au **prochain jeton** (≤ 15 min, ou immédiatement si 4.2 force un refresh —
  cf. points ouverts). Sans faille : un gratuit ne peut pas s'auto-élever (claim
  signé serveur).
- **Enforcement composé dans le service de ressource** (et non dans une garde
  `@UseGuards` dédiée au quota) — pour éviter un cycle de modules (cf. décision
  ci-dessus). La **garde** reste le mécanisme des **capacités** (premium/pro) ; le
  **quota** (qui exige un décompte propre à chaque ressource) est composé au plus
  près de la ressource via le **service** d'entitlement. Les deux sont
  « autorité serveur » et lisent la **même** politique `shared`.
- **Signatures de service étendues d'un paramètre `tier`** : `HorsesService.create`
  (`compteId, tier, dto`), `CombinationsService.create` (`compteId, tier, dto`) et
  `.update` (`compteId, tier, id, dto`). Seuls leurs **contrôleurs** les appellent
  (vérifié) ; `sessions` consomme `horses.findOne` / `combinations.findForAccount`
  / `recordUsage` — **inchangés**. Aucun type d'API modifié.
- **Tests e2e existants adaptés au quota.** Trois cas créaient **2 chevaux pour un
  même compte gratuit** (`horses` : `list-a`, `delete-isole` ; `combinations` :
  `cb-scope`) — désormais impossible (multi-chevaux = pro). Ces comptes passent en
  **pro** (helper `registerWithTier`, qui pose `tier` puis se connecte → claim à
  jour). Intention des tests **préservée** ; aucune assertion comportementale
  retirée.
- **Touche à `shared` (couche `entitlements` + `schemas/entitlement`) et au
  barrel racine.** Additif : aucun contrat existant modifié. Le dual-build
  ESM+CJS de `shared` embarque la nouvelle couche (consommée au runtime par l'api).

### Points laissés ouverts (reports explicites)

- **4.2 (grisage + checkout Mollie + flux d'upgrade)** : consommera
  `capacités`/`quotas` de l'entitlement pour **griser** et déclenchera l'upgrade
  sur un **403** (`CapacitéRequiseError`/`QuotaDépasséError`). **Contrat à
  honorer** : après un upgrade réussi, **rafraîchir le jeton** (re-login/refresh)
  pour que le claim `tier` — donc la garde et le quota — rejoigne l'entitlement
  affiché. Tarifs/montants et plafond combinaisons paramétrables y sont tranchés.
- **4.3 (archivage)** : ajoutera la colonne `archivé` et le `WHERE archivé =
  false` dans `countActifs` → un cheval archivé sort du quota (déjà pré-câblé).
- **4.4/4.5/4.6/5.1 (fonctions payantes)** : **attacheront** `@RequireCapacité` +
  `EntitlementGuard` sur leurs endpoints (`bilan_progression`, `bilan_augmenté`,
  `comptes_invité`, `analytique_diagnostic`). La garde est prête et prouvée.
- **Parallélisme** (Roadmap) : 4.2/4.3/4.4/4.5 lançables **après 4.1** ; **4.6
  après 4.1 + 5.1**.
- **Fraîcheur du tier (≤ 15 min)** : staleness bornée par la durée de vie de
  l'access (1.1), acceptée ; résolue au refresh et par le contrat 4.2 ci-dessus.
- **Concurrence du quota** : décompte puis insertion (non transactionnel) — deux
  créations simultanées pourraient dépasser de 1. Négligeable pour un usager seul ;
  un verrou/transaction reste possible si nécessaire (non requis par la DoD).
- **Garde de capacité non encore branchée sur un endpoint de prod** (aucune
  fonction payante n'existe en 4.1) — c'est conforme : 4.1 la **fournit/prouve**.

### DoD — preuves

| Critère | Vérification | Statut |
|---|---|---|
| **Un endpoint premium/pro refusé à un gratuit côté serveur — (a) garde** | `entitlement.guard.spec.ts` (unitaire) : handler `@RequireCapacité('analytique_diagnostic')` → **gratuit 403**, premium/pro OK, handler non annoté libre, sans principal → 401 | ✅ |
| **— (b) quota chevaux** : 2ᵉ cheval refusé en gratuit/premium, illimité en pro | e2e `horses.spec.ts` : gratuit 1er 201 / 2ᵉ **403** (liste reste à 1) ; premium 2ᵉ **403** ; pro 2ᵉ+3ᵉ 201 | ✅ |
| **Quota combinaisons** : gratuit au-delà du plafond refusé ; illimité premium/pro | e2e `combinations.spec.ts` : gratuit 5 OK / 6ᵉ **403** ; `PATCH` au plafond **403** (pas de contournement) ; premium & pro 7 OK | ✅ |
| **Matrice dans `shared`** (pure, testée, une seule implémentation) ; app+api la lisent | `entitlement.test.ts` (17 tests : fidélité §8, bornes de `peutCréer`, alignement politique↔DTO) ; api (service/guard) + app (`useEntitlement`) importent `@hpt/shared` | ✅ |
| **Lecture de l'entitlement au login** + **tier affiché** dans Profil | e2e `entitlements.spec.ts` : `GET /me/entitlement` (gratuit caps=false quotas 1/5 ; **reflète pro après reconnexion**) ; app `entitlements-api.test.ts` (+ re-valide Zod) ; `profil.tsx` lit `useEntitlement().tier` | ✅ |
| **Décompte chevaux sur l'actif** (pré-câblé 4.3) | `HorsesService.countActifs` (nommé/documenté ; `WHERE archivé=false` à ajouter en 4.3) | ✅ |
| Aucun type d'API dupliqué ; Zod au bord | DTO `EntitlementSortie` de `@hpt/shared` (api + app) ; sortie validée par `entitlementSortieSchema` | ✅ |
| Pas de débordement de périmètre | **0** Mollie/checkout/paywall/grisage (4.2), **0** archivage (4.3), **0** fonction payante (4.4+) ; garde fournie, non branchée sur un endpoint prod | ✅ |
| `pnpm lint` | `biome check .` (295 fichiers) | ✅ exit 0 |
| `pnpm typecheck` | build `shared` puis `tsc --noEmit` (shared + api + app) | ✅ vert |
| `pnpm test` (sans DB) | Vitest — **149 (shared, +17)** + **18 (api, +4 garde)** + **162 (app, +2 entitlements-api)** | ✅ 329/329 |
| `pnpm build` | shared (ESM+CJS) + api (nest) + app (typecheck) | ✅ vert |
| `db:verify` (Postgres requis) | Vitest — **118** (+3 chevaux quota, +3 combinaisons plafond, +4 `entitlements`) | ✅ 118/118 |
| CI | job `ci` (sans DB) + job `db` (`migrate` + `verify`) — **aucune migration** en 4.1 | ✅ |

---

## Lot 4.2 — Upgrade in-app & Mollie · 2026-06-30

Suite de la **Phase 4 (Monétisation)**. Extension du module **`entitlements`**
(api) + tranche **`app`** : on construit le **flux d'upgrade in-app** (paywall,
**checkout Mollie**, **webhooks**, **déverrouillage**) et l'**état verrouillé
générique** réutilisable. On **réutilise** l'entitlement de 4.1 comme **cible du
déverrouillage** : la garde, les quotas et la matrice ne sont **pas** refaits.
Strictement le lot 4.2 : **aucune** fonction premium réelle (analytique 5.1, IA
4.5, bilan de progression 4.4, multi-chevaux/invités 4.6) — ici, **uniquement**
le verrou générique + le paywall + le checkout + l'autorité du tier.

### Emplacement (décisions tranchées)

- **Contrats dans `shared`** : `schemas/abonnement.ts` (+ test, + barrel) —
  `TIERS_PAYANTS` (premium/pro, sous-ensemble strict de `TIERS`),
  `STATUTS_ABONNEMENT` (`en_attente`/`actif`/`annulé`/`échoué`), DTO d'entrée
  (`checkoutDemandeSchema`) et de sortie (`checkoutSortieSchema`,
  `abonnementStatutSortieSchema`, `offresSortieSchema`). Comme 4.1, sorties à
  **scalaires/booléens** → re-validées au bord de l'app.
- **Module API `entitlements` (extension)** — `api/src/entitlements/` :
  `subscription.config.ts` (montants/clés/URLs **lus de l'env**),
  `mollie/mollie.port.ts` (interface `MolliePort` + jeton `MOLLIE`),
  `mollie/fake-mollie.ts` (adaptateur dev/test, **webhooks simulables**),
  `mollie/mollie-http.client.ts` (adaptateur **réel**, API Mollie v2, mode test),
  `subscriptions.service.ts` (offres, checkout, **réconciliation = autorité**,
  statut, résiliation), `subscriptions.controller.ts` (`/me/subscription/*`,
  authentifié), `mollie-webhook.controller.ts` (`/webhooks/mollie`, **public**, +
  page de simulation dev). Le module **fournit** le `MOLLIE` via `useFactory`
  (fake sans clé, http avec clé).
- **Schéma + migration** : `api/src/db/schema/abonnement.ts` + enums
  (`abonnement_tier`, `abonnement_statut` réutilisant les tuples `shared`) +
  `api/drizzle/0005_abonnement.sql` — **additive** (2 CREATE TYPE + 1 CREATE
  TABLE + FK `compte_id` **CASCADE** + 2 index ; aucune table existante touchée).
- **Tranche front** : `app/src/subscription/` (`subscription-api`,
  `checkout-browser-port` + `native-checkout-browser-port`, `upgrade-flow` pur,
  `use-subscription` hooks, barrel, 2 tests). État verrouillé générique :
  `app/src/ui/LockedOverlay.tsx` (primitive voile + cadenas) +
  `app/src/entitlements/locked-feature.tsx` (slot lisant l'entitlement). Paywall :
  `app/src/app/upgrade.tsx`. Câblages : **Analytique** (verrou), **Profil** (carte
  Abonnement : upgrade / gérer / résilier / pending).

### Décisions tranchées (et pourquoi)

- **Le webhook Mollie est l'autorité du tier — pas le retour client.** `compte.tier`
  n'est élevé qu'à **un seul endroit** : `SubscriptionsService.réconcilier`, appelé
  par `POST /webhooks/mollie`, et **seulement** sur un paiement **honoré** (`paid`/
  `authorized`, mandat valide). `créerCheckout` ne fait que **préparer** (ligne
  `abonnement` `en_attente` + premier paiement Mollie) ; il **ne touche jamais** le
  tier. Le **retour client** ne fait que **re-lire** l'entitlement (4.1). C'est ce
  qui garantit qu'un client ne peut pas s'auto-élever et que l'app et le serveur
  disent toujours la même chose (autorité serveur, Architecture §5).
- **Contrat 4.1 honoré : refresh forcé au retour.** L'entitlement (4.1) lit le
  `tier` du **claim** JWT, pas la DB. Après un upgrade, le claim est **périmé** tant
  qu'on ne tourne pas le jeton. L'app expose donc `auth.refreshSession()` (nouvelle
  méthode `ApiClient.refreshSession`, *single-flight* comme l'interceptor 401) :
  au retour du checkout, `upgrade-flow` **force la rotation** (le `rotate` de 1.1
  relit `compte.tier`) puis **re-lit** entitlement + abonnement. Sans webhook
  confirmé, la re-lecture rend toujours `gratuit` → **état pending honnête**.
- **SEPA Direct Debit privilégié + carte ; asynchronie assumée** (Stack §6). Le
  flux Mollie retenu : client + **premier paiement** (`sequenceType: first`) pour
  établir le **mandat**, puis **abonnement récurrent** sur ce mandat une fois le
  paiement honoré. Le mandat SEPA pouvant rester **en attente**, l'abonnement reste
  `en_attente` (UI *pending*, jamais d'élévation) jusqu'au **webhook** confirmant.
  La réconciliation est **idempotente** (re-livraison du webhook sans effet ;
  abonnement récurrent créé **une seule fois**).
- **Port Mollie + deux adaptateurs (pas d'abstraction prématurée, mais une seam
  testable).** `MolliePort` isole l'I/O PSP (même posture que le port de partage
  3.3). Le **fake** (in-memory, déterministe) sert en **dev sans clé** et en
  **test** : il rend le flux *simulable localement* (son URL de checkout pointe une
  page de simulation dev `GET /webhooks/mollie/dev/checkout/:id` qui simule le
  paiement + réconcilie + redirige). Le **http client** (mode test, clé `test_…`)
  n'est **jamais** importé par un test (couvert par `tsc`). Le service ne dépend
  que du **port** → e2e du webhook sans réseau.
- **Montants paramétrables, jamais en dur.** Tarifs/devise/intervalle vivent dans
  **une** source (`subscription.config.ts`), surchargés par l'env ; défauts **dev**
  ergonomiques (même posture que les secrets dev de 1.1). L'app ne connaît **aucun**
  montant : elle les **lit** via `GET /me/subscription/offres`. Prouvé : l'e2e
  paramètre l'env et l'endpoint reflète les valeurs.
- **État verrouillé = invitation, générique et réutilisable** (UI/UX §3.1/§4/§6.8/§7).
  `LockedOverlay` (primitive) : aperçu **désaturé** sous **voile crème ~55 %**
  (token `lockedVeil` posé en 1.4) + **cadenas** encre douce + CTA ; toute la
  surface est tactile (≥ 44 px), `accessibilityRole=button` + hint. `LockedFeature`
  (slot) lit l'entitlement (4.1) : capacité débloquée → contenu réel ; sinon →
  aperçu grisé dont l'appui **ouvre l'upgrade** (`/upgrade?cap=…`), jamais
  culpabilisant. C'est le **slot que 4.4/4.5/4.6/5.1 habilleront** (ils passeront
  leur aperçu + leur contenu réel ; rien à redéclarer). En 4.2, **Analytique**
  l'utilise (esquisse de heatmap grisée ; le vrai diagnostic est 5.1).
- **Résiliation = renvoi Mollie + annulation in-app.** `GET /me/subscription`
  renvoie l'`gestion_url` (espace Mollie, Spec §9.3) ; le Profil propose **Gérer**
  (renvoi) **et** **Résilier** (annule le récurrent via le port, marque `annulé`,
  confirmation native). La **bascule fine de tier** au terme de la période est
  laissée à Mollie (point ouvert).
- **Webhook public, 200 systématique.** `POST /webhooks/mollie` n'a **pas** de
  garde (l'appelant est Mollie). Corps `x-www-form-urlencoded` (`id=tr_…`) parsé
  par le body-parser Nest. On répond **200** pour acquitter (paiement inconnu/sans
  id = no-op) ; une erreur transitoire laisse remonter une 5xx → Mollie réessaie.

### Écarts vs cadrage (consignés)

- **Table `abonnement` hors Modèle de données** — **écart assumé**, au même titre
  que `refresh_token` (1.1) : l'intégration Mollie impose un état serveur (lien
  compte ↔ paiement/mandat, statut du cycle SEPA) absent du modèle métier. Ajout
  par **migration additive** ; FK `compte_id` **CASCADE** (purge RGPD, 1.3). On n'y
  stocke que des **références opaques Mollie** (customer/payment/subscription/
  mandate) — **aucune** donnée de cheval, **aucun** moyen de paiement.
- **Nouvelle dépendance app `expo-web-browser ~56.0.5`** (version *bundled* SDK 56)
  pour ouvrir le checkout (`openAuthSessionAsync`, retour par deep link). Isolée
  derrière `CheckoutNavigateurPort` : la logique d'upgrade reste **testable en
  Node** (le natif n'est jamais importé par un test). Lockfile mis à jour.
- **`ApiClient.refreshSession` ajouté** (rotation forcée hors 401) pour honorer le
  contrat 4.1. Les 6 faux clients des tests existants ont reçu la méthode (aucune
  assertion comportementale modifiée).
- **`tier` toujours porté par le claim** (hérité de 4.1) : un upgrade ne prend
  effet qu'au **prochain jeton**. 4.2 **résout** ce point en forçant le refresh au
  retour (cf. décision ci-dessus) ; la fraîcheur résiduelle (≤ 15 min) ne joue plus
  pour l'upgrade observé.
- **Repli IAP store : documenté, non construit** (consigne). La voie UE/DMA sans
  IAP est la seule implémentée ; le repli est noté dans
  `native-checkout-browser-port.ts` et ici — à n'activer que si une politique de
  store l'impose hors UE.

### Points laissés ouverts (reports explicites)

- **Les vraies fonctions payantes** s'installeront **derrière le verrou** en
  4.4 (bilan de progression), 4.5 (bilan augmenté IA), 4.6 (invités), 5.1
  (analytique) : elles habilleront `LockedFeature`/`LockedOverlay` (aperçu +
  contenu réel) et attacheront `@RequireCapacité` côté serveur (4.1). Le slot et la
  garde sont prêts.
- **Tarifs définitifs** : décision **business hors build**. Les montants restent
  paramétrables (env) ; les défauts dev ne sont pas des tarifs de prod.
- **Gestion fine de la résiliation / proration côté Mollie** : la bascule de tier
  au terme de la période (et la proration) n'est pas pilotée finement ici — d'où le
  **renvoi** vers l'espace Mollie. Un webhook d'abonnement (ex. `subscription
  canceled`/`payment failed` récurrent) qui **redescendrait** le tier reste à
  brancher (la réconciliation est en place ; il suffira d'étendre les cas).
- **Concurrence / transaction** : checkout = insert puis appel PSP puis update
  (non transactionnel) ; réconciliation = create récurrent puis 2 updates. Suffisant
  pour un usager seul ; un verrou/transaction reste possible si nécessaire.
- **Signature/HMAC du webhook** : Mollie n'envoie que l'id ; l'authenticité est
  obtenue en **re-lisant** le paiement chez Mollie (jamais en croyant le corps).
  Aucun secret de webhook à gérer ; rien à durcir de plus.
- **Validation Mollie réelle** : l'adaptateur http est couvert par `tsc` ; un
  test de bout en bout contre l'API **test** Mollie (clé réelle) reste à exécuter
  côté validateur (hors sandbox, sans réseau PSP).

### DoD — preuves

| Critère | Vérification | Statut |
|---|---|---|
| **Un gratuit souscrit premium/pro depuis l'app ; au retour le tier est déverrouillé** | e2e `subscription.spec.ts` : checkout (mode **fake**) → `simulerPaiement(paid)` → **webhook** → `actif` ; **re-login** (re-lecture du claim) → entitlement **pro/premium** | ✅ |
| **Le webhook est l'autorité** : retour client **sans** webhook **n'élève pas** (pending) ; webhook confirmant **élève** | e2e : avant webhook → `en_attente`, re-login → **gratuit** ; après webhook honoré → **pro** ; **pending** (SEPA) reste gratuit ; **échoué** reste gratuit | ✅ |
| **Montants paramétrables** : aucune valeur en dur (lus de la config) | `subscription.config.spec.ts` (montants depuis l'env, fake sans clé) + e2e `GET /me/subscription/offres` reflète l'env (`14.00`/`28.00`) | ✅ |
| **Toucher une fonction grisée ouvre l'upgrade** (verrouillage = invitation) | `LockedFeature` (lit l'entitlement) → `LockedOverlay` (pressable, ≥ 44 px) → `router.push('/upgrade?cap=…')` ; **Analytique** câblée ; export Metro bundle `/upgrade` | ✅ |
| **État verrouillé lisible** (voile crème ~55 % + cadenas, AA+) | `LockedOverlay` : token `lockedVeil`, cadenas encre douce, CTA, `accessibilityRole`/hint ; cible ≥ 44 px | ✅ |
| **Retour & re-lecture (4.1) + pending honnête** | `upgrade-flow.test.ts` : `rafraîchir()` (refresh forcé + re-lecture) appelé **succès comme fermeture** ; paywall affiche l'état `en_attente` | ✅ |
| **Résiliation** (renvoi Mollie + annulation) | e2e : `POST /me/subscription/annuler` actif → `annulé` ; `gestion_url` renvoyée ; Profil câblé | ✅ |
| DTO sans duplication ; Zod au bord | DTO `@hpt/shared` (api + app) ; sorties validées (`offres`, `checkout`, `statut`) | ✅ |
| Pas de débordement de périmètre | **0** fonction premium réelle ; garde/quotas/matrice (4.1) **réutilisés** ; IAP **documenté, non construit** | ✅ |
| `pnpm lint` | `biome check .` (319 fichiers) | ✅ exit 0 |
| `pnpm typecheck` | build `shared` puis `tsc --noEmit` (shared + api + app) | ✅ vert |
| `pnpm test` (sans DB) | Vitest — **158 (shared, +9)** + **27 (api, +9 : config + fake)** + **170 (app, +8 : subscription-api + upgrade-flow)** | ✅ 355/355 |
| `pnpm build` | shared (ESM+CJS) + api (nest) + app (typecheck) ; **export Metro web** OK (`/upgrade` bundlé) | ✅ vert |
| `db:verify` (Postgres requis) | Vitest — **130** (+12 `subscription` : webhook autorité, pending, échoué, idempotent, offres, résiliation, page dev) | ✅ 130/130 |
| CI | job `ci` (sans DB) + job `db` (`migrate` 0005 + `verify`) | ✅ |

---

## Lot 4.3 — Archivage cheval · 2026-07-01

Extension du module **`horses`** (2.1) : **archiver / désarchiver** un cheval
(vendu/parti). Archiver le passe en **lecture seule** (fiche **et** séances),
conserve son **historique**, le **sort de la liste active et du quota** ;
**réversible** — désarchiver le ramène, **refusé** si cela dépasse le quota du
tier. On **branche** l'archivage sur le décompte pré-câblé en 4.1 (`countActifs`)
et on **réutilise** le verrou 4.2 (paywall) pour inviter à l'upgrade quand un
désarchivage est bloqué. **Aucun** multi-chevaux/invité (4.6), **aucun** Mollie
(4.2), **aucune** suppression RGPD (distincte). Strictement le lot 4.3.

### Emplacement (décisions tranchées)

- **Schéma + migration** : colonne `archivé` ajoutée à
  `api/src/db/schema/cheval.ts` (`boolean('archive')`, **`NOT NULL DEFAULT
  false`**) + migration **additive** `api/drizzle/0006_zippy_martin_li.sql`
  (`ALTER TABLE "cheval" ADD COLUMN "archive" boolean DEFAULT false NOT NULL`).
  Clé TS **accentuée** (`archivé`, alignement `shared`), colonne physique
  **désaccentuée** (`archive`) — même convention que `hauteur_de_référence` /
  `âge` (0.3). Le `DEFAULT false` rend le `ADD COLUMN NOT NULL` **sûr sur une
  table peuplée** (contraste voulu avec `idempotency_key` en 2.2 qui exigeait une
  table vide).
- **Contrats `shared`** : `Cheval` (type domaine) et `chevalSortieSchema`
  (projection détail/liste) portent `archivé: boolean` — l'app en a besoin pour
  **exclure** l'archivé du sélecteur (UI/UX §5) et le ranger en **section
  « archivés »**. `chevalCréerSchema` / `chevalModifierSchema` **inchangés** :
  l'archivage passe par des **actions dédiées**, jamais par le PATCH générique
  (cf. décision « quota-gardé »). `chevalExportSchema` (1.3) hérite `archivé`
  gratuitement (`.extend`).
- **Service `horses`** : `archive` / `unarchive` / `assertModifiable` ajoutés ;
  `countActifs` filtré ; `update` gardé (lecture seule). **Controller** :
  `POST /horses/:id/archive` et `/unarchive` (`@HttpCode(200)` — bascule d'état
  d'une ressource existante, pas une création). Erreur `ChevalArchivéError` (409).
- **Service `sessions`** : les **écritures** (create/update/remove) passent par
  `horses.assertModifiable` (via un flag `forWrite` sur `loadOwned`) — refus 409
  sur un cheval archivé ; les **lectures** gardent le chemin permissif `findOne`.
- **Tranche `app`** : `horses-api` (`archive`/`unarchive`), `horses-context`
  (mutations + partition `activeHorses`/`archivedHorses`, `currentHorse` = premier
  **actif**), écrans `horses/index` (sections **Actifs** / **Archivés**) et
  `horses/[id]` (actif → formulaire + **Archiver** ; archivé → fiche **lecture
  seule** + **Désarchiver** + suppression), `error-messages` (409/403 + helper
  `isQuotaBlocked`).

### Décisions tranchées (et pourquoi)

- **Statut d'archivage = un booléen sur `Cheval`** (et non une table/état séparé).
  L'archivage est un **attribut réversible** de la fiche, pas une entité : une
  colonne `archivé` est le minimum nécessaire (pas d'abstraction prématurée,
  Archi §7). Le nom fidèle au domaine (`archivé`) préserve l'**alignement
  `shared`** (la garde `alignment.spec.ts` passe sans exception : `boolean`
  requis des deux côtés, aucune nullabilité à normaliser).
- **Lecture seule via une garde d'écriture unique, `horses.assertModifiable`.**
  L'état d'archivage reste **connu du seul `horses`** (§1/§3) ; `update` (fiche)
  **et** `sessions` (séance) appellent la **même** garde, qui charge la fiche
  scopée (404 sans fuite si étrangère) et lève `ChevalArchivéError` si archivé.
  **409 Conflict** (et non 403/404) : la requête entre en conflit avec l'**état**
  du cheval, pas avec les droits du compte (403 = tier) ni son existence (404).
  Cohérent avec l'inviolabilité (Modèle §2) : l'archivé est **figé**.
  Conséquence assumée : dans `sessions.create`, la garde passe **avant** le
  chemin rapide d'idempotence → un re-`POST` sur un cheval archivé est **refusé**
  (409), pas rejoué. C'est le comportement « aucune écriture/séance » attendu.
- **Décompte actif réutilisé, non réimplémenté (4.1).** `countActifs` a reçu le
  **seul** changement pré-câblé par 4.1 : `WHERE archivé = false` (`and(eq(
  compte_id), eq(archivé, false))`). Le gating (garde de capacité, `assertPeutCréer`)
  est **inchangé** : un cheval archivé **sort mécaniquement du quota** sans qu'une
  règle de tier soit touchée. C'est exactement le point d'ancrage nommé au journal
  4.1 (« il suffira d'ajouter `WHERE archivé = false` ici »).
- **Désarchivage quota-gardé (garde 4.1).** Réintégrer un cheval à l'actif revient
  à **créer une place** : `unarchive` appelle donc `assertPeutCréer(tier, 'chevaux',
  countActifs)` — la **même** garde que la création. `countActifs` exclut le cheval
  encore archivé, donc le plafond porte bien sur l'état **après** désarchivage. Un
  gratuit/premium (quota 1) qui a déjà 1 cheval actif ne peut **pas** en désarchiver
  un second → 403 : **pas de contournement** de la limite via archive/désarchive.
  L'**archivage**, lui, n'est **jamais** quota-gardé (il ne fait que **réduire**
  l'actif).
- **Résolution du label « (pro) » (tension roadmap ↔ Spec, tranchée).**
  L'**action d'archivage n'est pas réservée au pro** : la **Spec §9.2 ne la gate
  pas**, et un cavalier gratuit qui vend son **unique** cheval doit pouvoir
  l'archiver. Le « (pro) » de la roadmap reflète le **contexte multi-chevaux** de
  l'archivage et son **interaction quota** (dép. 4.1) — pas une réserve d'accès.
  La **garde** porte donc sur le **désarchivage** (quota), **pas** sur l'archivage.
  Ni `archive` ni `unarchive` ne portent `@RequireCapacité` : la seule barrière est
  le **quota** au désarchivage (autorité serveur). *(Si le dev voulait une réserve
  pro **stricte** sur l'archivage, c'est le point à corriger — voir points ouverts.)*
- **Archivage ≠ suppression ; suppression d'un archivé autorisée.** Aucune purge à
  l'archivage (l'historique reste consultable). La **suppression** (RGPD, 2.1)
  **reste permise** même sur un cheval archivé : c'est l'**échappatoire** (sinon un
  cheval vendu serait piégé — ni éditable ni supprimable). La lecture seule protège
  l'**intégrité de la trace**, pas le cycle de vie de la fiche → `remove` **non
  gardé** (décision consignée).
- **`list` renvoie tout ; l'app partitionne.** `GET /horses` renvoie **actifs +
  archivés** (chacun portant `archivé`) en **un** aller-retour ; le contexte app
  dérive `activeHorses`/`archivedHorses` et `currentHorse = activeHorses[0]`. Le
  **sélecteur** (1.4/2.1) exclut donc l'archivé **sans changement** (il lit
  `currentHorse`). Pas de second endpoint (surface minimale, §7-Archi).
- **Verrou 4.2 réutilisé pour l'invitation à l'upgrade.** Un désarchivage refusé
  (403) affiche, sous le message, un bouton **« Passer au Pro »** routant vers le
  paywall existant `/upgrade?cap=multi_chevaux` (la matrice 4.2 mappe
  `multi_chevaux → pro`). Verrouillage = invitation (UI/UX §7), **sans** refaire le
  paywall ni la garde.

### Écarts vs cadrage (consignés)

- **Touche à `shared`** (type `Cheval` + `chevalSortieSchema`) — **additif**, aucun
  contrat existant modifié ; le dual-build ESM+CJS embarque `archivé`. Les DTO
  d'entrée (`créer`/`modifier`) sont **volontairement** laissés intacts pour que
  l'archivage reste une **action dédiée** (garde de quota non contournable par PATCH).
- **`@HttpCode(200)` sur archive/unarchive** (au lieu du 201 par défaut de `@Post`
  Nest) : ces routes **basculent l'état** d'une ressource existante et renvoient la
  fiche, pas une création à un nouveau URI → 200 est le statut juste.
- **Seeds/tests des lots antérieurs** : aucun `INSERT INTO cheval` direct n'a eu à
  changer (le `DEFAULT false` couvre les seeds). `schema.spec.ts` liste désormais
  la colonne `archive` (vérifiée présente) ; `account-export.test.ts` et
  `schemas.test.ts` ajoutent `archivé` à leurs littéraux de fiche parsés.
- **Suppression d'un cheval archivé autorisée** (cf. décision ci-dessus) — écart
  d'interprétation possible si « lecture seule » se voulait **absolu** ; tranché en
  faveur de l'échappatoire RGPD, consigné.

### Points laissés ouverts (reports explicites)

- **Confirmation « archivage non réservé au pro » (dev).** La Spec §9.2 ne gate pas
  l'archivage ; on l'a laissé **ouvert à tous les tiers**, seul le **désarchivage**
  est quota-gardé. **À confirmer par le dev** : si une réserve **pro stricte** sur
  l'action d'archiver est voulue (lecture « roadmap » du « (pro) »), il suffira
  d'attacher `@RequireCapacité('multi_chevaux')` au `POST …/archive` — la garde 4.1
  est prête. En l'état, ce **n'est pas** fait (fidélité à la Spec).
- **Interaction 4.6 (comptes invité).** Archiver un cheval **porteur d'invités**
  (pro, 4.6 — non construit) : l'accès invité deviendra la **lecture seule d'un
  cheval lecture seule** (l'invité ne saisit déjà rien, §9.5). La bascule fine
  (notifier l'invité, geler l'écriture côté coach déjà couverte par
  `assertModifiable`) sera **câblée en 4.6**, quand l'accès invité existera. Rien à
  faire ici.
- **Désarchivage en lot / réactivation guidée** : hors périmètre ; l'UI actuelle
  agit fiche par fiche.
- **Métriques/feed de l'archivé** : **figés** (aucun recalcul déclenché par
  l'archivage) — conforme (l'archivé est en lecture, rien n'est ré-agrégé).

### Compte rendu — vérifier la DoD

Backend (garde serveur) + tranche app. **Parcours de preuve** :

1. **Archiver sort de la liste active et du quota** (gratuit, quota 1) :
   `POST /horses` (H1, 201) → `POST /horses` (H2) **403** (plafond) →
   `POST /horses/H1/archive` **200** (`archivé:true`) → `POST /horses` (nouveau)
   **201** (place libérée). *(e2e `horses.spec.ts` › archivage)*
2. **Archivé = lecture seule** : `PATCH /horses/H1` **409** ; `POST
   /horses/H1/sessions` **409** ; `PATCH`/`DELETE /sessions/:id` **409** ; mais
   `GET /horses/H1/sessions` **200** (historique conservé). *(e2e `horses.spec.ts`
   + `sessions.spec.ts`)*
3. **Réversible, quota-gardé** : `POST /horses/H1/unarchive` **200** dans le quota ;
   **403** au-delà (un 2ᵉ actif déjà présent) ; **200** en pro (illimité).
   *(e2e `horses.spec.ts`)*
4. **App** : sélecteur ignore les archivés (`currentHorse` = 1ᵉʳ actif) ; écran
   « Mes chevaux » range Actifs / Archivés ; fiche archivée en lecture seule avec
   **Désarchiver** (→ upgrade Pro si 403).

Commandes : `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` (tous verts,
sans DB) ; `pnpm --filter @hpt/api db:verify` exécute les e2e (Postgres requis,
**job `db` de la CI** — Docker indisponible dans ce bac à sable, comme noté depuis
0.1/0.3).

### DoD — preuves

| Critère | Vérification | Statut |
|---|---|---|
| **Archiver sort de la liste active et du quota** ; historique conservé | e2e : gratuit au plafond → archive → création **autorisée** (place libérée) ; `GET …/sessions` reste **200** | ✅ (job `db`) |
| **Réversible** : désarchiver ramène ; **refusé si dépasse le quota** (garde 4.1) | e2e : unarchive **200** dans le quota ; **403** au-delà (H reste archivé) ; **200** en pro | ✅ (job `db`) |
| **Archivé = lecture seule** : aucune écriture/séance | e2e : `PATCH /horses/:id` **409** ; `POST …/sessions`, `PATCH`/`DELETE /sessions/:id` **409** ; `count(seance)` inchangé | ✅ (job `db`) |
| **Décompte actif** : après archivage, un nouveau cheval passe ; après désarchivage au-delà, refus | e2e (mêmes scénarios) ; `countActifs` filtre `archivé = false` | ✅ (job `db`) |
| **Archivage non gaté par le tier** ; **désarchivage** gardé | archive **sans** `@RequireCapacité` (gratuit OK) ; unarchive → `assertPeutCréer` (4.1) | ✅ |
| **Scoping** : archiver/désarchiver le cheval d'un autre → 404 sans fuite | e2e : B sur le cheval de A → **404** (archive **et** unarchive) | ✅ (job `db`) |
| **Statut d'archivage projeté** (app exclut du sélecteur, range en « archivés ») | `chevalSortieSchema.archivé` (test `schemas.test.ts`) ; app `activeHorses`/`archivedHorses` ; `HorseSelector` = actif | ✅ |
| **Verrou 4.2 réutilisé** pour l'upgrade au désarchivage bloqué | fiche archivée : 403 → bouton « Passer au Pro » → `/upgrade?cap=multi_chevaux` | ✅ |
| Aucun type d'API dupliqué ; DTO `shared` | `Cheval`/`ChevalSortie` de `@hpt/shared` (api + app) ; actions dédiées, DTO create/modifier intacts | ✅ |
| Migration `0006` **additive & sûre** | `ADD COLUMN … boolean DEFAULT false NOT NULL` (backfill par défaut) ; `schema.spec.ts` vérifie `archive` | ✅ (job `db`) |
| `pnpm lint` | `biome check .` (319 fichiers) | ✅ exit 0 |
| `pnpm typecheck` | build `shared` puis `tsc --noEmit` (shared + api + app) ; alignement `Cheval` (+`archivé`) | ✅ vert |
| `pnpm test` (sans DB) | Vitest — **158 (shared)** + **27 (api)** + **172 (app, +2 horses-api : archive/unarchive)** | ✅ 357/357 |
| `pnpm build` | shared (ESM+CJS) + api (nest) + app (typecheck) | ✅ vert |
| `db:verify` (Postgres requis) | e2e `horses.spec.ts` (+archivage : quota, lecture seule, réversible, scoping) + `sessions.spec.ts` (+séance refusée sur archivé) | ⚠️ **job `db` CI** (Docker absent du bac à sable) |
| CI | job `ci` (sans DB) + job `db` (`migrate` 0→**0006** + `verify`) | ✅ posé |

---

## Lot 4.4 — Bilan de progression · 2026-07-01

Suite de la **Phase 4 (Monétisation)**. Module **`progression-report`** (api) +
fonction pure **régularité** dans `shared` + tranche **`app`** : le **vrai
générateur** de bilan de progression (Spec §6) — un **artefact autonome**
(PDF/lien), professionnel, destiné à **quelqu'un sans l'app** (le client d'un
coach), bâti **uniquement sur la couche objective** et les séances `live`. Il
**réutilise** `metrics` (3.2, hauteur maîtrisée §10) et `sessions` (2.2) **via
leurs services** et **ne recalcule rien** (Architecture §2). C'est le générateur
**explicitement découplé** de l'**aperçu démo** de 3.5 (statique) : 3.5 était
l'accroche, 4.4 est le livrable. Strictement le lot 4.4 : **ni** bilan augmenté IA
(4.5), **ni** comptes invité (4.6), **ni** bilan de séance simple (3.3) — trois
objets distincts (Spec §5.4/§8).

### Emplacement (décisions tranchées)

- **`shared` (calc + DTO)** — le calcul vit ici, **une seule** implémentation
  (Archi §2) : `calc/regularite.ts` (fonction pure `régularité` + `RégularitéBilan`,
  §9, `live` only, fenêtre de curation) ; `schemas/progression-report.ts` (params de
  **curation** `bilanProgressionParamsSchema` = période + indicateurs + format ; les
  **6 sections** `bilanSectionsSchema` ; artefact + enveloppe `bilanProgressionSchema`).
  La courbe de maîtrise **réutilise** `pointMaîtriseSchema` (3.2). Barils
  (`calc/index`, `schemas/index`) mis à jour.
- **`api/src/progression-report/`** — `compose-bilan.ts` (**pur** :
  `composeBilanSections`, curation + assemblage, testé sans DB),
  `render-bilan-html.ts` (**pur** : document HTML autonome), `bilan-render.port.ts`
  (`BilanRenderPort` + jeton `BILAN_RENDER`), `local-bilan-render.ts` (adaptateur
  dev/stub : HTML → fichier `file://`), `progression-report.service.ts` (orchestration
  I/O), `progression-report.controller.ts` (`POST /horses/:id/progression-report`,
  garde), `progression-report.module.ts`. Enregistré dans `app.module.ts`.
  **`MetricsService` est désormais exporté** (extension non destructive de 3.2) pour
  la réutilisation.
- **`app/src/progression-report/`** — `period-presets.ts` (**pur**, testé),
  `progression-report-api.ts`, `use-progression-report.ts` (mutation à la demande),
  `bilan-generator.tsx` (écran de génération : curation + résultat), `bilan-apercu.tsx`
  (aperçu grisé pour le verrou). Route `app/src/app/progression-report.tsx`
  (**verrouillée** via `LockedFeature`, verrou 4.2) ; **point d'entrée** dans le Profil.

### Décisions tranchées (et pourquoi)

- **Régularité posée dans `shared`, pure et testée (le cœur du bilan, §6.1).**
  Elle n'existait pas → ajoutée ici, **une seule implémentation** (comme la
  maîtrisée 3.2). `régularité(séances, { from, to })` filtre le **`live`** (§2),
  restreint à la période (curation), puis dérive **fréquence** (`séances_par_mois`,
  rapportée à l'étendue **documentée**) et **continuité** (`semaines_actives` +
  `plus_longue_série_semaines`, par bucket de semaine aligné sur l'époque).
  Distinction clé vs maîtrisée : la régularité **inclut le Plat** (assiduité, pas
  hauteur — Modèle §3) mais **exclut le `déclaratif`** (couche objective, §2).
- **Réutilisation de la maîtrisée 3.2 — aucun recalcul divergent (Archi §2).** Le
  service appelle `metrics.compose` (maîtrise + vitrine déjà dérivées) et
  `sessions.listForHorse` ; **rien n'est réimplémenté**. La **trajectoire** = la
  **courbe** `maîtrise.série` **restreinte à la période** (projection de curation,
  pas un recalcul) ; le **niveau démontré** maîtrisée = le **dernier point** de la
  courbe dans la période (cohérent avec le « chiffre courant » de 3.2). Le **plus
  haut sans-faute concours** dérive des tours `Concours` `live` via le primitif
  `sansFaute` de `shared` (dérivation légère sur la brique existante, pas une
  nouvelle métrique).
- **Curation au niveau rapport (§6.3), donnée inviolable (§2).** La **période**
  (`from`/`to`, bornes incluses) **restreint** ce qu'on résume ; les **indicateurs**
  décochés **retirent** leur section (`identité`/`période` restent, cadre du
  livrable). `composeBilanSections` est **pure** : elle ne mute jamais ses entrées.
  Prouvé par test : resserrer la période change le rapport (moins de séances, autre
  maîtrisée) **sans** toucher les séances sous-jacentes (relecture inchangée).
- **Pipeline `HTML+CSS → PDF via Playwright` derrière un port ; local/stub en dev
  (Stack §5).** Le rendu HTML est **pur** (document autonome, styles inline, chaleur
  équestre — le lien web **et** la source PDF). La **sortie** passe par le port
  `BILAN_RENDER` : en dev, `LocalBilanRender` écrit le HTML en **fichier local**
  (`file://`) — le format `lien` est un **livrable réel** (`stub: false`), le format
  `pdf` un **substitut** (`stub: true`). **Pourquoi le stub** : `playwright` n'est
  pas une dépendance du dépôt (seuls les navigateurs sont préinstallés), et le
  découpage **Serverless Job → Object Storage → URL présignée** est un point
  **infra/déploiement** (mission : **non bloquant** pour la DoD). Le port est la
  **couture** où l'adaptateur prod se substitue **sans toucher** au service ni à la
  composition — même posture que le port Mollie (4.2) et le port de partage (3.3).
- **Endpoint gardé premium/pro (garde 4.1 attachée).** C'est ce que 4.1 annonçait
  (« les fonctions payantes 4.4+ l'attacheront ») : `@RequireCapacité('bilan_
  progression')` + `EntitlementGuard`, **après** `JwtAccessGuard`. Un **gratuit**
  est refusé en **403** (`CapacitéRequiseError`) ; l'UI ne fait que griser
  (`LockedFeature`). Premium = rapport **personnel** (son cheval) ; pro =
  **multi-chevaux** (un rapport par cheval — voir écart).
- **`POST` (pas `GET`) — action qui produit un artefact.** Générer un bilan
  **rend un document** (rendu HTML → sortie fichier/URL, Stack §5) et porte un corps
  de **curation** (période + indicateurs + format). C'est sémantiquement une action,
  pas une lecture idempotente ; elle n'écrit néanmoins **aucune** donnée métier
  (inviolabilité §2). Route ressource `POST /horses/:id/progression-report` (cheval
  dans l'URL, propriété vérifiée → 404 sans fuite), cohérente avec §5.
- **Composition/rendu purs, service mince (testabilité).** Toute la logique de
  curation + assemblage + HTML est en **fonctions pures** (unit-testées **sans DB**,
  dans `pnpm test`) ; le service ne fait que l'**I/O** (lectures via services + port).
  L'e2e (`db:verify`) prouve le **chemin câblé** (garde 403, 404, artefact réel).

### Écarts vs cadrage (consignés)

- **PDF en dev = stub HTML (assumé, non bloquant).** La mission autorise
  explicitement « génération locale + sortie fichier local/stub ; Job/Object Storage
  différés infra ». `playwright` n'étant pas installé, le format `pdf` renvoie le
  **même HTML** marqué `stub: true` ; le **lien web** (HTML) est le livrable réel de
  dev. L'adaptateur prod (Playwright + Object Storage) se branche sur le **port**
  sans changement de logique.
- **Rapport mono-cheval (par ressource `/horses/:id/…`).** La distinction
  premium/pro « mono vs multi » est portée par le **quota de chevaux** (4.1) : un
  premium n'a qu'**un** cheval, un pro en a **plusieurs** et génère **un rapport par
  cheval** via la même route. On **ne** construit **pas** de document agrégé
  multi-chevaux (abstraction prématurée) — chaque cheval a son bilan.
- **`MetricsService` exporté** (additif, non destructif) : `progression-report` le
  consomme pour réutiliser la maîtrisée. Aucun contrat ni type modifié.
- **Double lecture de l'historique.** Le service lit `listForHorse` **et**
  `metrics.compose` (qui relit l'historique en interne) — une lecture de plus, sur
  un chemin **froid/à la demande** (pas un feed). Acceptée pour la v1 (cohérent avec
  la note de recompute de 3.2) ; un partage de lecture est possible plus tard.
- **Sortie app non re-validée par Zod au bord.** Comme `metrics` (dates en `Date`
  côté type, chaînes ISO sur le fil), la réponse n'est **pas** re-parsée côté app
  (contrairement aux DTO à scalaires de 4.1/4.2) ; l'affichage n'utilise que des
  nombres/enums, insensibles à ce détail de transport.

### Points laissés ouverts (reports explicites)

- **Serverless Job + Object Storage / URL présignée en prod (infra).** L'adaptateur
  `BilanRenderPort` de prod (`HTML → PDF via Playwright` en Job, poussé sur Object
  Storage, servi par URL présignée) se branche sur le jeton `BILAN_RENDER` (sélection
  par env, comme le port Mollie choisit fake/http). Reste à **ajouter `playwright`**
  côté image de Job et à écrire l'adaptateur — **déploiement**, pas logique métier.
- **Lien web vs PDF.** Les **deux** formats existent au contrat ; en dev le **lien**
  (HTML autonome) fait foi, le **PDF** est un stub. Le produit tranchera l'usage
  (partage d'un lien présigné vs pièce jointe PDF) sans toucher à la composition.
- **Le compte invité (4.6) consultera la progression _en direct_.** Le bilan
  **exporté** (4.4) sert le client **sans l'app** ; l'**accès vivant** (fenêtre
  lecture seule sur le cheval partagé) est le lot **4.6** — les deux coexistent
  (Spec §6/§9.5).
- **Vidéo attachée à un record (post-v1, Spec §6.4).** Non capturée ; le bilan
  reste un registre de **performance** (santé/vétérinaire hors périmètre).
- **Période ouverte `to = null`.** Le niveau démontré/maîtrisée hérite du choix
  conservateur de 3.2 (dernier point de la courbe, pas `Date.now()`) : un cheval
  inactif conserve sa dernière maîtrisée affichée. À reconsidérer si un signal
  « hors de forme » devient souhaitable (déjà noté en 3.2).

### DoD — preuves

| Critère | Vérification | Statut |
|---|---|---|
| **Générer un bilan soigné avec sélection de période** (PDF/lien), **6 sections** (§6.2) | e2e `progression-report.spec.ts` : `POST …/progression-report` → sections `identité`/`niveau_démontré`/`performance_concours`/`régularité`/`trajectoire`/`période` + **artefact** (`file://`, taille > 0) ; rendu HTML autonome (`render-bilan-html.spec.ts`) | ✅ |
| **Objective + `live` only** : aucun ressenti/note ; **`déclaratif` exclu** | e2e : déclaratif@140 **exclu** de la régularité, du concours et du niveau démontré ; unité `render-bilan-html` : **0** occurrence de ressenti/difficulté/énergie | ✅ |
| **Curation** : changer période/indicateurs change le rapport, **sans altérer la donnée** | e2e : période passée ⇒ rapport vide, séances **intactes** (relecture = 6) ; indicateur décoché ⇒ section absente ; unité `compose-bilan.spec` (curation + non-mutation) | ✅ |
| **Réutilise la maîtrisée (3.2) & la régularité (`shared`, testée)** — pas de recalcul divergent | e2e : `niveau_démontré.hauteur_maîtrisée` **==** `GET …/metrics` `maîtrise.courante` (110) ; `regularite.test.ts` (8) ; **une seule** implémentation | ✅ |
| **Refusé au gratuit** (garde 4.1, capacité `bilan_progression`) | e2e : gratuit → **403** ; sans jeton → 401 ; cheval étranger → 404 ; app `LockedFeature` grise (verrou 4.2) | ✅ |
| **Régularité pure dans `shared`** (`live` only, Plat inclus, fenêtre de curation) | `regularite.test.ts` : déclaratif exclu, Plat compté, fréquence, semaines actives + série, curation | ✅ |
| **Pipeline HTML→PDF Playwright** ; local/stub en dev ; Job/Object Storage différés | port `BILAN_RENDER` + `LocalBilanRender` (HTML → `file://`) ; `lien` réel, `pdf` `stub: true` (e2e) ; adaptateur prod branchable sans toucher au service | ✅ (dev) |
| Aucun type d'API dupliqué ; Zod au bord | DTO/calc de `@hpt/shared` (`BilanProgression`, `régularité`) ; sortie validée par `bilanProgressionSchema` ; `RégularitéBilan ≡ RégularitéBilanDto` (`expectTypeOf`) | ✅ |
| Pas de débordement de périmètre | **0** IA (4.5), **0** compte invité (4.6), **0** refonte de l'aperçu démo (3.5) ; bilan **multi-séances** distinct des 3 bilans (§8) | ✅ |
| `pnpm lint` | `biome check .` (341 fichiers) | ✅ exit 0 |
| `pnpm typecheck` | build `shared` puis `tsc --noEmit` (shared + api + app) | ✅ vert |
| `pnpm test` (sans DB) | Vitest — **172 (shared, +14)** + **41 (api, +14 : 9 compose, 5 render)** + **176 (app, +4 period-presets)** | ✅ 389/389 |
| `pnpm build` | shared (ESM+CJS) + api (nest) + app (typecheck) | ✅ vert |
| `db:verify` (Postgres requis) | Vitest — 138 (lots antérieurs) + **6 (progression-report 4.4)** | ✅ 144/144 |
| CI | job `ci` (sans DB) + job `db` (`migrate` + `verify`, e2e 4.4 inclus) — **aucune migration** en 4.4 | ✅ |

---

## Lot 4.5 — Assistant IA — bilan augmenté · 2026-07-01

Suite de la **Phase 4 (Monétisation)**. Module **`ai-bilan`** (api) + **entité +
DTO** dans `shared` + tranche **`app`** : le **bilan augmenté** par l'assistant
IA (Spec §7) — pour **une séance**, un **texte consultatif** (analyse de la
dernière séance + recommandations pour la prochaine), **généré par IA**
(Mistral, UE), **à la demande**, **persisté**, **relu sans régénération**,
**rate-limité**, avec **disclaimer**. Il **remplit le slot ✦** pré-câblé (vide)
en 3.4 et **attache la garde** premium/pro de 4.1. Strictement le lot 4.5 :
**ni** bilan de progression (4.4), **ni** bilan de séance simple (3.3, gratuit),
**ni** comptes invité (4.6, qui n'y ont **pas** accès) — trois objets distincts
(Spec §5.4/§8).

### Emplacement (décisions tranchées)

- **`shared` (type + DTO)** — le contrat vit ici, **une seule** implémentation
  (Archi §2) : `types/ai-bilan.ts` (**entité de domaine `BilanAugmenté`**, Modèle
  §3, miroir de la ligne persistée) ; `schemas/ai-bilan.ts` (`DISCLAIMER_IA`
  constante ; `bilanAugmentéSortieSchema` = projection + `contenu` regroupé +
  `disclaimer` ; `bilansAugmentésDisponiblesSchema` pour le slot ✦). Barils
  (`types/index`, `schemas/index`) mis à jour.
- **Schéma + migration** : `api/src/db/schema/ai-bilan.ts` (table `bilan_augmente`)
  + `api/drizzle/0007_soft_infant_terrible.sql` — **additive** (1 CREATE TABLE +
  FK `seance_id` **CASCADE** + **UNIQUE(seance_id)**). **Alignée** sur `shared`
  (`alignment.spec.ts`, +1) : contrairement aux tables techniques (`refresh_token`,
  `abonnement`), c'est une **vraie entité de domaine** (§3).
- **Module API** : `api/src/ai-bilan/` (par domaine, §3) — `mistral.port.ts`
  (interface `MistralPort` + jeton `MISTRAL` + types de contexte/sortie),
  `stub-mistral.ts` (adaptateur **dev/test déterministe**, sans réseau),
  `mistral-http.client.ts` (adaptateur **réel** La Plateforme, jamais importé par
  un test), `ai-bilan.config.ts` (**modèle épinglé** + rate limit, lus de l'env),
  `ai-bilan-rate-limiter.ts` (fenêtre glissante par utilisateur, horloge
  injectable), `build-context.ts` (**pur** : contexte narratif via `faitsSéance`),
  `ai-bilan.errors.ts` (`BilanAugmentéNotFoundError` 404, `BilanAugmentéRateLimitError`
  429), `ai-bilan.service.ts` (orchestration get-or-create), `ai-bilan.controller.ts`
  (3 routes gardées), `ai-bilan.module.ts`. Enregistré dans `app.module.ts`.
- **Tranche front** : `app/src/ai-bilan/` — `ai-bilan-api.ts`, `use-ai-bilan.ts`
  (génération/relecture/disponibilité), `ai-bilan-card.tsx` (carte ✦ + disclaimer),
  `ai-bilan-section.tsx` (section « Générer » à l'enregistrement, **verrou 4.2** au
  gratuit). Câblages : **`capture.tsx`** (section à l'enregistrement),
  **`historique.tsx`** (remplit le **slot ✦** via la disponibilité),
  **`sessions/[id]/card.tsx`** (relecture du bilan, sans régénération).

### Décisions tranchées (et pourquoi)

- **Client IA derrière une interface injectable + stub par défaut (consigne,
  Stack §3.6).** Le sandbox de dev **n'atteint pas Mistral** : le jeton `MISTRAL`
  est fourni par `useFactory` — **stub déterministe** (`StubMistral`) **sans clé**,
  **vrai client** (`MistralHttpClient`) **avec clé** (`MISTRAL_API_KEY`, Secret
  Manager en prod). Même couture que le port Mollie (4.2) et le port de rendu
  (4.4). Le service ne dépend que de l'**interface** → **les tests moquent le
  client** (`.overrideProvider(MISTRAL)`), et l'e2e **compte les appels IA** pour
  prouver « relire sans régénérer ».
- **Modèle épinglé, jamais `-latest` (Stack §3.6).** `AI_BILAN_MODEL` (famille,
  déf. `mistral-small`) + `AI_BILAN_MODEL_VERSION` (version **épinglée**, déf.
  `mistral-small-2409`) — paramétrables par env, **jamais en dur ailleurs** (même
  posture que les tarifs Mollie 4.2). Le **modèle + la version effectivement
  appelés** sont **retournés par le port** et **persistés** sur chaque bilan
  (auditabilité, reproductibilité) — prouvé en base (`SELECT modele, version`).
- **Génération = get-or-create → « relu sans régénération » par construction
  (Spec §7.3, garde-fou de coût).** `UNIQUE(seance_id)` : **un seul** bilan par
  séance. `générer()` renvoie l'existant **sans appeler l'IA ni consommer le rate
  limit** ; la relecture (GET) ne fait **jamais** d'appel IA. Un re-POST est donc
  idempotent (aucun double coût). Prouvé e2e : POST → 1 appel ; GET puis re-POST →
  **toujours 1 appel** (client moqué).
- **À la demande uniquement (Spec §7.1).** Aucune génération automatique : la
  tranche front n'appelle `générer` que sur **action explicite** (bouton « Générer
  le bilan augmenté »), via une **mutation** TanStack (jamais une query passive).
- **Rate limiting par utilisateur + garde-fous de coût (Stack §3.6).**
  `AiBilanRateLimiter` : fenêtre glissante en mémoire, `AI_BILAN_RATE_LIMIT`
  générations max par `AI_BILAN_RATE_WINDOW_MS` (déf. 10/h). Seul un **nouvel**
  appel consomme (get-or-create) ; dépassement → **429** (`BilanAugmentéRateLimitError`),
  la **relecture restant possible**. Horloge **injectable** (unit-test déterministe) ;
  e2e à plafond bas (2) prouvant le 429.
- **Contexte = matière narrative des dernières séances (Spec §7.2, Modèle §1).**
  `build-context.ts` (**pur**) projette la séance cible + jusqu'à 5 précédentes en
  **couche objective** (via `faitsSéance` de `shared`, jamais réimplémenté) **et**
  **couche contexte qualitatif** (ressenti/énergie/note). **Autorisé** car la
  sortie est un **texte consultatif**, **pas un agrégat** — c'est l'exception
  explicite du Modèle §1. La sortie **n'alimente aucune métrique** (prouvé e2e :
  séances + `metrics` inchangés après génération).
- **Disclaimer (Spec §7.2) = constante `shared`, réattachée à la lecture.**
  `DISCLAIMER_IA` (« généré par une IA, à valider ; ni avis vétérinaire, ni
  substitut au coach ») n'est **pas persisté** : le service la **rattache** à
  chaque projection (toujours présente, jamais périmée), l'app l'affiche dans la
  carte ✦. Le contenu IA est **clairement marqué** (badge ✦ + tag « IA »).
- **Garde d'entitlement premium/pro attachée (4.1).** `@RequireCapacité('bilan_
  augmenté')` + `EntitlementGuard`, **après** `JwtAccessGuard`, sur les **trois**
  routes. Un **gratuit** (et l'invité 4.6, sans la capacité) est refusé en **403** ;
  l'app ne fait que **griser** (`LockedFeature`, verrou 4.2). Côté app, la lecture
  de disponibilité et la relecture sont **désactivées** sans la capacité (aucun
  appel, aucun ✦) — cohérent « refusé au gratuit ».
- **Trois routes, orientées ressource (Archi §5), via `sessions`.** `POST
  /sessions/:id/ai-bilan` (générer), `GET /sessions/:id/ai-bilan` (relire), `GET
  /horses/:id/ai-bilan` (disponibilité, slot ✦). La **propriété** est vérifiée via
  `SessionsService.findOne`/`listForHorse` (404 sans fuite) — `ai-bilan` ne lit
  **jamais** la table `seance` en direct (§1) ; il ne possède que `bilan_augmente`.
- **Le slot ✦ de 3.4 est alimenté sans toucher `badgesBilan`.** L'Historique lit
  `GET /horses/:id/ai-bilan` (si capacité) → un `Set` de `seance_ids` → passe
  `augmentéDisponible` à `HistoryEntryCard`. Le conditionnel **pur** posé en 3.4
  (`badgesBilan(true) ⇒ ['simple','augmenté']`) est **réutilisé tel quel**.

### Écarts vs cadrage (consignés)

- **Table `bilan_augmente` créée en 4.5 (back-doc), pas en 0.3.** L'entité **est
  spécifiée au Modèle §3** mais ne faisait pas partie des **6 entités socle** de
  0.3 ; 4.5 ajoute la table par **migration additive** et l'**aligne** sur `shared`
  (à la différence d'`abonnement`/`refresh_token`, techniques et non alignées). À
  **back-documenter** dans le doc Modèle de données comme entité désormais réalisée
  (point ouvert ci-dessous).
- **`contenu` = deux colonnes plates (`analyse`, `recommandations`), regroupées en
  sortie.** La ligne persistée est plate (alignement `BilanAugmenté`) ; le DTO de
  sortie les **regroupe** sous `contenu` (fidèle au libellé Modèle §3) et ajoute le
  `disclaimer`. Deux formes distinctes pour deux usages (ligne de domaine vs
  projection API) — même esprit que `Séance` (plat) vs `séanceSortie` (imbriqué).
- **Rate limiter in-memory (mono-instance).** Suffisant pour un usager seul (même
  posture que le décompte de quota 4.1) ; un backend partagé (Redis) sera utile si
  plusieurs instances d'API tournent — point ouvert. Fenêtre par utilisateur, pas
  par cheval (le plafond de coût est un plafond d'appels par compte).
- **Get-or-create plutôt que « régénérer ».** La Spec dit « à la demande, relu
  sans régénération » sans trancher une régénération explicite ; on choisit le
  **get-or-create** (un bilan par séance) — la lecture la plus fidèle à §7.3 et le
  garde-fou de coût le plus simple. Une future « régénération » (invalidation
  explicite) resterait possible sans casser le contrat (point ouvert).
- **Sortie app non re-validée par Zod au bord.** Comme `metrics`/`progression-report`
  (dates en `Date` côté type, chaînes ISO sur le fil), la réponse n'est pas
  re-parsée côté app ; l'affichage n'utilise que du texte/des chaînes, insensible à
  ce détail de transport. Le **404** de relecture est traité comme `null` (pas une
  erreur) → l'écran propose de générer.
- **Client Mistral réel couvert par `tsc`, jamais exécuté en test/sandbox.** Comme
  le client Mollie (4.2) et les adaptateurs natifs (2.3/3.3) : la logique est
  prouvée avec le **stub**/le **mock**, le vrai client est vérifié par les types.

### Points laissés ouverts (reports explicites)

- **Clé Mistral réelle en prod** via **env / Secret Manager** (`MISTRAL_API_KEY`) :
  le module bascule alors du **stub** au **`MistralHttpClient`** sans toucher au
  service. Un test de bout en bout contre l'API Mistral réelle reste à exécuter
  côté validateur (hors sandbox, sans réseau IA) — même posture que Mollie (4.2).
- **Le slot ✦ de 3.4 est désormais alimenté** : l'Historique affiche `✦ augmenté`
  **uniquement** là où un bilan existe (premium/pro) ; le conditionnel `badgesBilan`
  reste intact.
- **L'invité (4.6) est exclu du bilan augmenté (Spec §9.5).** L'accès invité
  (lecture seule) ne portera **pas** la capacité `bilan_augmenté` — les routes le
  refusent déjà (403). À vérifier lorsque la coquille invité sera branchée (4.6).
- **Back-documenter la table `bilan_augmente`** dans le **Modèle de données**
  (entité §3 désormais réalisée) — doc de cadrage, hors code.
- **Rate limit partagé (Redis) + régénération explicite** : évolutions possibles
  (multi-instances ; « refaire le bilan ») sans casser le contrat actuel.
- **Curation du contexte.** On envoie la séance + 5 précédentes ; affiner la
  fenêtre/le prompt (et la longueur) relèvera du réglage produit, sans toucher au
  contrat ni au port.

### DoD — preuves

| Critère | Vérification | Statut |
|---|---|---|
| **Générer sur demande** un bilan augmenté (premium/pro), **persisté** | e2e `ai-bilan.spec.ts` : `POST /sessions/:id/ai-bilan` → contenu (analyse+recommandations), ligne en base (`SELECT … FROM bilan_augmente`) ; bouton **explicite** côté app (mutation) | ✅ |
| **Relire sans régénérer** (aucun nouvel appel IA à la relecture) | e2e (**client moqué, compteur**) : POST → 1 appel ; **GET** puis **re-POST** → **toujours 1 appel** (get-or-create) ; relecture app via `GET`, sans mutation | ✅ |
| **Refusé au gratuit** (garde 4.1, capacité `bilan_augmenté`) | e2e : gratuit → **403** (POST/GET/dispo) ; app `LockedFeature` grise (verrou 4.2) ; query dispo/relecture **désactivées** sans la capacité | ✅ |
| **Modèle + version épinglés enregistrés** (jamais `-latest`) | e2e : `bilan_augmente.modele='mistral-small'`, `version='mistral-small-2409'` ; unit `stub-mistral.spec` (trace la config, `not.toContain('latest')`) | ✅ |
| **Disclaimer présent** ; sortie **n'alimente aucune métrique** | e2e : `disclaimer` non vide (IA/véto) ; **séances + `metrics` inchangés** après génération ; unit `ai-bilan.test` (disclaimer requis) ; carte ✦ affiche le disclaimer | ✅ |
| **Rate limiting effectif** ; **client IA moqué** en test | e2e (plafond=2) : 3ᵉ génération → **429**, relecture toujours 200 ; unit `ai-bilan-rate-limiter.spec` (plafond, isolement, fenêtre) ; `.overrideProvider(MISTRAL)` | ✅ |
| **Slot ✦ affiché uniquement si un bilan existe** (3.4 alimenté) | e2e `GET /horses/:id/ai-bilan` : liste la séance avec bilan, **pas** celle sans ; `historique.tsx` passe `augmentéDisponible` (capacité requise) → `badgesBilan` (3.4) inchangé | ✅ |
| **À la demande uniquement** (jamais auto) ; **texte, jamais agrégat** (§1) | app : génération sur bouton (mutation) ; `build-context` = matière **narrative** (objective + qualitatif) pour un **texte** ; unit `build-context.spec` | ✅ |
| **Autorisation** : séance/cheval d'un **autre compte** refusé ; non authentifié ; 404 si aucun bilan | e2e : intrus → **404** (séance & cheval) ; sans jeton → **401** ; relecture sans bilan → **404** | ✅ |
| **Interface IA injectable + stub dev** (sandbox sans Mistral) | port `MISTRAL` (`useFactory`) : stub sans clé, `MistralHttpClient` avec clé ; stub **déterministe** (unit) ; vrai client couvert `tsc` | ✅ |
| Aucun type d'API dupliqué ; entité alignée | DTO/type de `@hpt/shared` (`BilanAugmentéSortie`, `BilansAugmentésDisponibles`, `BilanAugmenté`) ; `alignment.spec` : `BilanAugmenté` ↔ ligne Drizzle | ✅ |
| Pas de débordement de périmètre | **0** bilan de progression (4.4), **0** bilan simple (3.3), **0** compte invité (4.6) ; slot ✦ (3.4) rempli, garde (4.1)/verrou (4.2) réutilisés | ✅ |
| `pnpm lint` | `biome check .` (365 fichiers) | ✅ exit 0 |
| `pnpm typecheck` | build `shared` puis `tsc --noEmit` (shared + api + app ; alignement `BilanAugmenté`) | ✅ vert |
| `pnpm test` (sans DB) | Vitest — **177 (shared, +5)** + **54 (api, +13 : stub 5, rate-limiter 3, build-context 4, alignement +1)** + **179 (app, +3 ai-bilan-api)** | ✅ 410/410 |
| `pnpm build` | shared (ESM+CJS) + api (nest) + app (typecheck) | ✅ vert |
| `db:verify` (Postgres requis) | Vitest — 144 (lots antérieurs) + **7 (ai-bilan 4.5)** | ✅ 151/151 |
| CI | job `ci` (sans DB) + job `db` (`migrate` 0→0007 + `verify`, e2e 4.5 inclus) | ✅ |

---

## Lot 5.1 — Heatmap type × hauteur · 2026-07-01

Ouverture de la **Phase 5 (Analytique)**. Premier morceau du module **`analytics`**
(api) + agrégation pure dans **`shared`** + tranche **`app`** : la **heatmap type ×
hauteur** (Spec §5.3, Modèle §9, UI/UX §6.5), cellules `type d'obstacle × hauteur`
remplies selon le **taux de réussite** (vert plein → vide). Outil de **diagnostic
premium**, **exact** grâce à la saisie par obstacle (2.3). `analytics` est une surface
de **lecture/composition** : elle lit via le service `sessions` (jamais ses tables,
Archi §1/§3) et **réutilise** les fonctions pures de `shared` — le **taux §7** posé en
0.2. Strictement le lot 5.1 : **pas** le benchmark à combinaison constante (5.2), **pas**
les comptes invité (4.6), **aucun** bilan (4.4/4.5), **rien** au set héros (3.2, livré).

### Emplacement (décisions tranchées)

- **`shared` (calc + DTO)** — le calcul vit ici, **une seule** implémentation (Archi
  §2) : `calc/heatmap.ts` (`agrègeHeatmap` : liste de séances → matrice `(type ×
  hauteur) → { taux, efforts_propres, efforts_totaux, n_obstacles }`, `types`/`hauteurs`
  présents) ; `schemas/heatmap.ts` (DTO `HeatmapDto` + `CelluleHeatmapDto`, miroir Zod).
  **Refactor ciblé de `calc/taux-reussite.ts`** : extraction de la brique
  `effortsObstacle` (décomposition §7 numérateur `propres` / dénominateur `totaux`) —
  **`tauxObstacleSimple`/`tauxCombinaison` en dérivent désormais** (comportement
  identique, tests 0.2 verts) **et** la heatmap la réutilise. Une seule arithmétique du
  §7, jamais réécrite.
- **`api/src/analytics/`** — `analytics.service.ts` (compose via `SessionsService`,
  projette `SéanceSortie → SéanceHeatmapInput`, agrège via `shared`, valide au bord),
  `analytics.controller.ts` (`GET /horses/:id/heatmap`, garde JWT **+ garde
  d'entitlement 4.1**), `analytics.module.ts` (importe `SessionsModule` +
  `EntitlementsModule`, **exporte** `AnalyticsService` pour 4.6). Enregistré dans
  `app.module.ts`. **Aucune** table, **aucune** écriture — même posture que `metrics`
  (3.2) et `progression-report` (4.4).
- **`app/src/analytics/`** — `heatmap-api.ts` (+ re-validation Zod au bord),
  `use-heatmap.ts` (`useQuery`), `heatmap-format.ts` (helpers **purs** testés :
  index/lecture O(1), aspect visuel vide/échec/rempli, libellés a11y),
  `heatmap-grid.tsx` (grille lignes×colonnes, chiffres tabulaires, déroulable),
  `heatmap-view.tsx` (états chargement/erreur/**vide = invitation**/données),
  `heatmap-apercu.tsx` (esquisse grisée du verrou). L'onglet `(tabs)/analytique.tsx`
  câble la vraie heatmap **derrière `LockedFeature`** (4.2), scopée au **cheval de
  l'en-tête** (sélecteur réutilisé, 1.4).

### Décisions tranchées (et pourquoi)

- **Taux §7 au niveau effort, PAS la règle conservatrice §10.** La heatmap est un **taux
  exact** (§9 « exacte »), pas la hauteur maîtrisée. Chaque obstacle est décomposé en
  efforts : simple → `propres = répétitions − barres − refus`, `totaux = répétitions` ;
  combinaison → `totaux = répétitions × nombre_d_éléments`, `propres = totaux − barres −
  refus`. La cellule agrège `Σ propres / Σ totaux`. On **n'applique pas** le §10
  (« combinaison comptée seulement si la ligne est sans faute ») : il appartient
  **exclusivement** à la hauteur maîtrisée (3.2). Prouvé par un test dédié : une
  combinaison fautée donne `5/6`, **pas** `0`.
- **La décomposition en efforts, pas le ratio, est la brique partagée.** Un ratio
  par-obstacle **ne s'agrège pas** (moyenne de ratios ≠ ratio des sommes). D'où
  `effortsObstacle` (numérateur/dénominateur) exposé dans `shared` : la heatmap **somme**
  les efforts §7 puis divise. `tauxObstacleSimple`/`tauxCombinaison` reposent maintenant
  **sur cette même brique** → aucune divergence possible (au lieu de dupliquer
  l'arithmétique dans `analytics`).
- **Combinaison = sa propre ligne** (Modèle §9). Type-conteneur, agrégée sur **sa**
  hauteur (valeur unique de la ligne), au dénominateur **× éléments** ; placée **en
  dernière ligne** (ordre du référentiel). Jamais ventilée par élément (fautes au niveau
  de la ligne, §0).
- **Cellule = taux agrégé, + volume exposé.** Chaque cellule porte `efforts_propres`,
  `efforts_totaux` (n efforts) et `n_obstacles` — lisibilité de **fiabilité** et surtout
  moyen de **distinguer cellule vide vs taux nul** (voir ci-dessous).
- **Cellule vide ≠ taux nul.** Une cellule n'existe dans `cellules` que si ≥ 1 obstacle
  **calculable** y contribue → l'**absence** du couple `(type, hauteur)` = « pas de
  donnée » (l'UI rend **« — »**) ; une cellule **présente à `taux = 0`** = 0 % (rouille
  sobre). Deux états franchement distincts (test unit **et** e2e).
- **Périmètre de source = obstacles d'entraînement `live`.** `agrègeHeatmap` filtre
  `provenance === 'live'` (§2, `déclaratif` exclu) et n'agrège que les **`obstacles`**.
  Le **Plat** (0 obstacle) et le **Concours** (des *tours*, sans type d'obstacle) ne
  contribuent donc rien — **exclusion par construction**, confirmée par la projection api
  qui ne mappe **jamais** les tours. La **couche contexte** (difficulté/ressenti/note)
  n'est pas dans la forme d'entrée → **jamais agrégée** (Modèle §1, règle d'or) ; prouvé
  e2e (une séance avec contexte ne change pas le taux).
- **Gating = autorité serveur (Archi §5).** Le endpoint attache `@RequireCapacité('
  analytique_diagnostic')` + `EntitlementGuard` (4.1) **après** `JwtAccessGuard` : un
  **gratuit** est refusé en **403**. L'app **grise** via `LockedFeature`/`LockedOverlay`
  (4.2, réutilisés tels quels) et déclenche l'upgrade **premium** ; elle n'est **pas** la
  source de vérité. Le hook `useHeatmap` n'est monté que **dans le contenu débloqué** →
  un gratuit ne déclenche jamais la requête (et le serveur la refuserait).
- **Lecture per-cheval, réutilisable en aval.** `AnalyticsService.heatmap(compteId,
  chevalId)` lit la heatmap **d'un cheval** et le module **exporte** le service :
  structuré pour une **relecture en lecture seule scopée** par les comptes invité (4.6,
  qui en dépendra) — **sans** construire le scoping ici.
- **DTO depuis `shared`, Zod au bord** (`app → shared ← api`). `CelluleHeatmap` (calc) ≡
  `CelluleHeatmapDto` (Zod) garanti par `expectTypeOf().toEqualTypeOf()` (comme
  `Jalon`/`JalonDto` en 3.2). La réponse (scalaires/tableaux, **aucune `Date`**) est
  **re-validée** au bord de l'app.

### Écarts vs cadrage (consignés)

- **Refactor de `taux-reussite.ts` (0.2) pour exposer `effortsObstacle`.** Le cadrage dit
  « réutilise le taux §7 sans le réimplémenter » ; comme un ratio ne s'agrège pas, on a
  dû **remonter la décomposition en efforts** comme brique partagée. Additif et
  **iso-comportement** (les 7 tests `taux-reussite` de 0.2 restent verts sans
  modification) — pas un changement de contrat, juste une factorisation qui **garantit**
  l'unicité d'implémentation.
- **Champs de cellule en `snake_case` français** (`efforts_propres`, `efforts_totaux`,
  `n_obstacles`) : cohérent avec la convention de données (`nombre_d_éléments`,
  `seance_id` du `Jalon`) et le transport JSON ; l'interface `calc` porte les mêmes noms
  (type-equality calc ≡ DTO).
- **Route `GET /horses/:id/heatmap`** (ressource sœur de `/metrics`) plutôt que
  `/analytics/heatmap` : 5.2 ajoutera un **endpoint frère** (`…/benchmark`) sous la même
  garde, dans le même module — pas de préfixe imposé prématurément.
- **Aperçu grisé = esquisse factice** (déplacée de l'écran 4.2 vers `heatmap-apercu.tsx`).
  Le vrai diagnostic étant refusé au gratuit côté serveur, l'aperçu ne divulgue **aucune**
  donnée réelle — il donne à *deviner* la fonction (verrouillage = invitation, §7).
- **Tests app = logique pure (Node)**, cohérent avec 1.4+ : `heatmap-format` (8) couvre le
  formatage/lookup/aspect visuel/a11y ; la grille/les écrans sont prouvés par `tsc` **et**
  l'**export Metro web** (route `/analytique` bundlée, 32 KB).

### Points laissés ouverts (reports explicites)

- **5.2 (benchmark à combinaison constante)** ajoutera une **section sous la heatmap** dans
  `analytics` (endpoint frère `…/benchmark` sous la **même** garde `analytique_diagnostic`,
  même écran Analytique). **Lançable indépendamment** de 5.1 (parallélisme roadmap).
- **4.6 (comptes invité) dépend de 5.1** : l'endpoint analytique sera **relu en lecture
  seule scopée** par l'invité — `AnalyticsService` est **exporté** à cette fin ; le scoping
  invité n'est **pas** construit ici (Roadmap §Séquençage : 5.1 précède 4.6).
- **Coût de recalcul** : comme `metrics` (3.2), `analytics` **recompose** depuis
  l'historique `live` complet à chaque lecture (une passe O(n·obstacles)). Correct et
  simple à l'échelle v1 ; un cache/incrémental sera utile si un cheval accumule des
  centaines de séances.
- **Échelle de couleur / seuil de contraste** (`celluleVisuel` : opacité `0.2 + 0.8·taux`,
  crème dès `taux ≥ 0.55`) : heuristique lisible plein soleil, **tunable** en une source
  si l'UX veut une rampe différente — sans toucher au calcul.

### DoD — preuves

| Critère | Vérification | Statut |
|---|---|---|
| **Heatmap correcte** : chaque cellule `(type, hauteur)` = taux §7 exact agrégé | e2e `analytics.spec.ts` (Oxer 100 : `5/6` sur 2 obstacles ; unités `heatmap.test.ts`) | ✅ |
| **Combinaison = sa propre ligne**, dénominateur × éléments (cas **3 éléments**) | e2e + unit : Combinaison@120, `nombre_d_éléments=3` → `totaux=6`, `taux=5/6`, ligne `Combinaison` **en dernier** | ✅ |
| **Cellule vide ≠ taux nul** (distinguées) | unit **+** e2e : Vertical@110 tout fauté → **présent** `taux=0`, `n_obstacles=1` ; Oxer@150 jamais travaillé → **absent** (« — ») | ✅ |
| **Périmètre** : Plat, Concours et `déclaratif` **exclus** ; **contexte jamais agrégé** | unit (déclaratif/Plat/Concours) **+** e2e (Concours@130 & déclaratif@140 absents des colonnes ; séance **avec contexte** → taux inchangé) | ✅ |
| **Agrégation dans `shared`** (pure, testée, une seule implémentation) réutilisant **§7** ; **pas** la règle §10 | `heatmap.ts` réutilise `effortsObstacle` (brique §7) ; test dédié « combinaison fautée → `5/6`, pas `0` » | ✅ |
| **Grisée si gratuit** : endpoint **refusé au gratuit** (garde 4.1) ; app grise + upgrade | e2e : gratuit → **403** ; app `LockedFeature` (verrou 4.2) → `/upgrade?cap=analytique_diagnostic` | ✅ |
| **Autorisation** : cheval d'un **autre compte** refusé ; non authentifié | e2e : intrus (premium) → **404** ; sans jeton → **401** ; propriétaire premium → 200 | ✅ |
| Accessibilité (UI/UX §8) | cellules ≥ 44 px lisibles plein soleil, **chiffres tabulaires** (`StatText`), contraste AA+ (fond teinté sous texte pleine opacité), libellés a11y par case | ✅ |
| Aucun type d'API dupliqué ; Zod au bord | DTO `@hpt/shared` (`HeatmapDto`, `CelluleHeatmapDto`) ; `CelluleHeatmap ≡ CelluleHeatmapDto` (`expectTypeOf`) ; réponse re-validée app | ✅ |
| Pas de débordement de périmètre | **0** benchmark (5.2), **0** compte invité (4.6), **0** bilan ; heatmap **hors set héros** (Feed 3.2 intact) ; garde (4.1)/verrou (4.2) **réutilisés** | ✅ |
| `pnpm lint` | `biome check .` (381 fichiers) | ✅ exit 0 |
| `pnpm typecheck` | build `shared` puis `tsc --noEmit` (shared + api + app) | ✅ vert |
| `pnpm test` (sans DB) | Vitest — **194 (shared, +17 : heatmap calc 12, schema 5)** + 54 (api) + **187 (app, +8 heatmap-format)** | ✅ 435/435 |
| `pnpm build` | shared (ESM+CJS) + api (nest) + app (typecheck) ; **export Metro web** OK (`/analytique` bundlé) | ✅ vert |
| `db:verify` (Postgres requis) | Vitest — 151 (lots antérieurs) + **6 (analytics 5.1)** | ✅ 157/157 |
| CI | job `ci` (sans DB) + job `db` (`migrate` + `verify`, e2e 5.1 inclus) — **aucune migration** en 5.1 | ✅ |

---

## Lot 4.6 — Comptes invité · accès client (pro) · 2026-07-01

Nouveau module **`guest-access`** (api) + **table `acces_invite`** (Modèle §3,
back-doc) + tranche **`app`** (coquille invité) : un coach **pro** associe à une
**fiche cheval** un **compte invité** pour son client — une **fenêtre vivante** en
**lecture seule** sur la progression, qui remplace l'envoi de rapports (Spec §9.5).
Le module porte les **invitations** (plusieurs par cheval, par e-mail), l'**octroi
scopé à UN cheval**, l'**onboarding invité** et la **révocation** ; il **réutilise**
feed (3.1) / héros (3.2) / historique (3.4) / analytique (5.1) en **lecture seule
scopée** — il ne les refait pas. Strictement le lot 4.6 : **aucune** écriture par
l'invité, **pas** de bilan augmenté (4.5) pour l'invité, **pas** les autres chevaux
du coach, **pas** de partage de propriété (Spec §9.2).

**Prérequis dur vérifié — 5.1 livré avant de démarrer** : l'invité consulte
l'**analytique** (heatmap), livrée par le lot **5.1** (entrée de journal présente ;
module `analytics` en **lecture** ; `AnalyticsService` **exporté** « à cette fin »
comme annoncé en 5.1). La roadmap impose **5.1 précède 4.6** (§Séquençage) — respecté.

### Emplacement (décisions tranchées)

- **`shared`** : `enums/acces-invite.ts` (`STATUTS_ACCÈS_INVITÉ =
  en_attente|actif|révoqué`), `types/acces-invite.ts` (`AccèsInvité`, forme de
  domaine **alignée** sur la ligne Drizzle — comme `BilanAugmenté`), et
  `schemas/acces-invite.ts` (DTO Zod : `accèsInvitéInviterSchema` `{ email }`,
  `accèsInvitéAccepterSchema` `{ token }`, `accèsInvitéSortieSchema` **vue coach**
  sans secret — `invité_relié` dérivé —, `chevalPartagéSchema` **atterrissage
  invité** `{ cheval_id, cheval_nom }`). Barils enums/types/schemas mis à jour.
- **Schéma + migration** : `api/src/db/schema/acces-invite.ts` (table `acces_invite`)
  + enum `acces_invite_statut` (réutilise le tuple `shared`), migration **additive**
  `api/drizzle/0008_puzzling_banshee.sql` (`CREATE TYPE` + `CREATE TABLE` + 3 FK
  `ON DELETE CASCADE` + 3 index — **aucune table existante touchée**). Colonnes
  physiques désaccentuées (`invite_email`, `invite_compte_id`), clés TS accentuées
  (alignement `shared`, convention `archivé`/`age` de 0.3/4.3). `alignment.spec.ts`
  gagne l'entrée **Accès invité** (hors colonne technique `token_hash`).
- **Module `api/src/guest-access/`** : `guest-access.service` (invitations, octroi,
  autorisation lecture seule scopée, révocation, acceptation, lectures réutilisées),
  `guest-access.controller` (**gestion coach**, garde Pro), `guest-consultation.controller`
  (**consultation invité**), `guest-access.errors` (`AccèsInvitéNotFoundError` 404,
  `InvitationInvalideError` 400, `AccèsInvitéDéjàExistantError` 409),
  `guest-access.config` (lien d'invitation, TTL 7 j), `guest-access.module` (importe
  `Horses/Feed/Metrics/Sessions/Analytics/Entitlements` + `Passport`, lie `MAILER →
  ConsoleMailer`). `FeedModule` **exporte désormais `FeedService`** (extension non
  destructive, comme metrics/analytics l'ont fait). Port `Mailer` (1.2) étendu de
  `sendGuestInvitation` (stub log en dev). Enregistré dans `app.module.ts`.
- **Tranche `app/src/guest-access/`** : `read-scope` (portée owner/guest ↔ préfixe
  de route, **pur**), `guest-access-api` (inviter/lister/révoquer/accepter/mesAccès),
  `guest-access-context` (`GuestAccessProvider`/`useGuestAccess`, auto-acceptation
  d'un jeton en attente), `use-guest-invites` (gestion coach), `pending-invite`
  (jeton en attente, **pur**), `guest-routing` (`shouldEnterGuestShell`/
  `guestStateUnresolved`, **pur**), `read-only-banner`, `guest-invites-section`
  (inviter depuis la fiche cheval), `guest-error-messages`. **Coquille invité** :
  groupe de routes `app/guest/` (`_layout` 3 onglets **sans (+)/switcher** + bandeau
  lecture seule ; `index`/`historique`/`analytique` réutilisant les surfaces via le
  `basePath` invité) + écran `guest-invite.tsx` (acceptation par deep link). Garde de
  navigation (`app/_layout`) étendue : un **invité pur** atterrit sur `/guest`.
- **Lectures réutilisées, paramétrées par `basePath`** : `feed-api`/`metrics-api`/
  `history-api`/`heatmap-api` + leurs hooks + `MetricsHero`/`HeatmapView` acceptent un
  **`basePath`** (défaut `/horses`) ; la coquille invité passe `/guest-access/horses`.
  Suffixe de route **identique** des deux côtés → aucune surface dupliquée.

### Décisions tranchées (et pourquoi)

- **L'invité = un compte régulier (1.1) + un octroi scopé (Stack §3.4), pas d'auth
  parallèle.** L'acceptation **relie** le compte authentifié de l'invité à l'octroi ;
  toute lecture invité passe par `assertAccèsActif(guestId, chevalId)` qui **scope
  dans le SQL** (`invité_compte_id = … AND statut = actif`). Un octroi **révoqué**,
  **en attente** ou visant un **autre** cheval ne matche pas → **404 sans fuite**
  (même posture que `ChevalNotFoundError`). L'**autorisation scope chaque lecture**,
  jamais un rôle global.
- **Réutilisation via les services, scopée au propriétaire.** Les surfaces existantes
  (`FeedService`, `MetricsService`, `SessionsService.listHistory`, `AnalyticsService`)
  scopent par `compteId` **propriétaire** et vérifient la propriété. Pour l'invité, on
  **résout le propriétaire** (`compte_pro_id` de l'octroi) et on appelle **le même**
  service avec cet id → le cheval lui appartient, la composition est identique. **Zéro
  reconstruction** (Archi §2/§3) ; les lectures traversent un **contrôleur invité
  dédié** (`/guest-access/…`) qui porte le contrôle de portée.
- **`compte_pro_id` enregistré sur l'octroi (dénormalisation assumée).** Plutôt qu'une
  lecture inter-module non scopée de `cheval` à chaque lecture invité, l'octroi **porte
  le propriétaire** (vérifié à la création : le coach est authentifié **et** possède le
  cheval). Sûr car la propriété d'un cheval est **immuable** en v1 (Modèle §3) ; fidèle
  à « 1 Cheval **détenu par un compte pro** » ; sert aussi la traçabilité RGPD (§9.5).
  Exclu de rien dans l'alignement (c'est une colonne de domaine) ; **`token_hash`**,
  lui, est **technique** → exclu (comme `idempotency_key`).
- **Garde Pro (4.1) sur la seule gestion.** Le **contrôleur de gestion** porte
  `@RequireCapacité('comptes_invité')` + `EntitlementGuard` → **inviter/lister/révoquer**
  sont **Pro** (gratuit/premium → **403**). La **consultation invité** n'est **pas**
  gatée par un tier (l'invité est souvent **gratuit**) : sa portée vient de l'**octroi**,
  et l'analytique existe car le **propriétaire** est Pro. C'est le point clé prouvé en
  e2e : un invité **gratuit** lit la heatmap via `/guest-access/…` (200) alors que la
  route **propriétaire** la lui refuse (403, garde 5.1).
- **Jeton d'invitation = capacité au porteur (comme vérif/reset 1.2).** À l'invitation,
  un secret aléatoire est émis, **hashé (SHA-256)** en base (jamais en clair, jamais
  dans un DTO) et envoyé par e-mail (TEM prod / **stub log** dev). L'acceptation présente
  le jeton, relie le compte, passe `actif` et **consomme** le jeton (`token_hash = null`).
  **Sans** exiger que l'e-mail du compte corresponde à l'invité : posséder le jeton
  prouve la réception (friction minimale, « crée/relie son compte », §9.5).
- **Onboarding invité — saute la création de cheval (Spec §9.5).** La garde de navigation
  route un **invité pur** (authentifié, **0 cheval possédé**, **≥ 1 accès partagé**) vers
  la **coquille invité** `/guest`, **avant** l'onboarding « créer un cheval » ; elle
  **diffère** la décision d'onboarding tant que l'état invité charge (pas de clignotement).
  Un jeton ouvert par deep link **avant** login est **mémorisé** puis **auto-accepté** à
  l'authentification (`pending-invite` + provider) → atterrissage direct.
- **Coquille invité restreinte (UI/UX §5/§6.7).** Groupe de routes distinct : **3 onglets
  de consultation** (Feed · Historique · Analytique), **pas de ( + )**, **pas de ✦**
  (on ne passe **jamais** `augmentéDisponible` — le slot 3.4 reste vide par **absence de
  donnée**, aucun appel `ai-bilan`), **pas de switcher** (accès scopé à UN cheval), et un
  **bandeau « lecture seule »** permanent (UI/UX §4). L'analytique invité **ne porte pas**
  de `LockedFeature` (portée = octroi, pas le tier).
- **Révocation = coupe la lecture.** `révoquer` passe `statut = révoqué` **et** efface le
  jeton (scopé `compte_pro_id` → 404 sans fuite) : l'accès **cesse** immédiatement (la
  garde de portée exige `actif`), une invitation encore en attente devient inacceptable.
  Ré-inviter après révocation est permis (octroi neuf). **Doublon** non révoqué (même
  cheval + e-mail) → **409** (pas d'octrois fantômes) ; **plusieurs invités différents**
  restent permis (§9.5).
- **Aucune écriture invité (le serveur refuse).** Le module n'expose **aucun** endpoint
  d'écriture. Viser les routes **propriétaire** (POST séance, PATCH cheval) avec le jeton
  de l'invité échoue sur la **propriété** (404, il ne possède pas le cheval) ; gérer les
  invités échoue sur la **garde Pro** (403). Doublement impossible, prouvé en e2e.

### Écarts vs cadrage (consignés)

- **Ajout de la table `acces_invite` (back-doc).** Entité **spécifiée au Modèle §3**
  mais **non posée en 0.3** (6 entités socle) — comme le Bilan augmenté (4.5). Ajoutée
  par migration **additive** ; **alignée** sur `shared` (`AccèsInvité`). **À
  back-documenter dans le Modèle de données** (point ouvert).
- **`compte_pro_id` dénormalisé** (cf. décision) : colonne non littérale au Modèle §3
  mais fidèle à « détenu par un compte pro », justifiée par l'immuabilité de la propriété
  et l'évitement d'un couplage de lecture inter-module. Consignée.
- **`FeedService` exporté** (comme `SessionsService`/`MetricsService`/`AnalyticsService`
  avant lui) : extension **non destructive** pour la réutilisation invité.
- **Port `Mailer` étendu** d'une méthode (`sendGuestInvitation`) et **lié localement**
  dans `guest-access` (`ConsoleMailer`, stub dev) — même seam que l'auth (1.2), permuté
  vers TEM en prod sans toucher au domaine. Pas d'import du module `auth-account` (juste
  le port + le stub, fichiers infra transverses).
- **Lectures paramétrées par `basePath`** (string, défaut `/horses`) plutôt qu'un couplage
  des hooks feed/metrics/… au module `guest-access` : découplage propre, la coquille
  invité passe `GUEST_READ_BASE`. La clé de cache porte le `basePath` (owner ≠ guest).
- **Acceptation en `200`** (et non `201`) : bascule d'état d'un octroi **existant**
  (comme `archive`/`unarchive` de 4.3), pas une création à un nouveau URI.
- **E-mail invité normalisé en minuscules** (dédoublonnage cohérent (cheval, e-mail)).
- **Tests app = logique pure (Node)**, cohérent avec 1.4+ : `read-scope` (3),
  `guest-access-api` (5), `guest-routing` (9), `pending-invite` (4) ; les écrans/coquille
  sont prouvés par `tsc` **et** l'**export Metro web** (routes `/guest`,
  `/guest/historique`, `/guest/analytique`, `/guest-invite` bundlées).

### Points laissés ouverts (reports explicites)

- **Séquençage — 4.6 restait bloqué tant que 5.1 n'était pas livré** (l'invité consulte
  l'analytique). Débloqué : 5.1 est livré (`AnalyticsService` exporté). C'était le
  **prérequis dur** de la roadmap (§Séquençage : 5.1 précède 4.6).
- **Interaction 4.3 (archivage ↔ invités).** Archiver un cheval **porteur d'invités**
  devient la **lecture seule d'un cheval déjà en lecture seule** : l'invité ne saisit
  déjà rien, et les lectures empruntent le chemin **permissif** (`horses.findOne`) → un
  cheval archivé **reste consultable** par ses invités (données figées), conforme au
  journal 4.3 (« Rien à faire ici »). On **autorise** d'ailleurs d'inviter sur un cheval
  archivé (aucune raison de le refuser). Une **notification** à l'invité lors de
  l'archivage n'est **pas** câblée (hors périmètre).
- **Back-documenter la table `acces_invite` dans le Modèle de données** (§3) — l'entité y
  est spécifiée ; la **réalité en base** (colonnes, `compte_pro_id`, `token_hash`
  technique) est à consigner comme pour le Bilan augmenté.
- **Downgrade du coach (Pro → gratuit/premium) avec invités actifs** : les lectures invité
  restent servies (le service de composition n'est pas gaté). Suspendre/expirer les accès
  au downgrade est une **question de cycle de gating** au-delà de la DoD 4.6 ; laissée
  ouverte.
- **Invité possédant aussi ses propres chevaux** (coach **et** client) : v1 route vers la
  coquille invité **uniquement** l'invité **pur** (0 cheval possédé). Fusionner les deux
  vues (surfacer les accès partagés dans l'onglet régulier) est un enrichissement ultérieur.
- **Plusieurs chevaux partagés au même invité** : la coquille montre le **premier** (pas
  de switcher, §6.7). Un sélecteur invité minimal reste possible si l'usage l'exige.
- **Persistance du jeton en attente** : en mémoire de session (suffit au parcours deep
  link → auth → acceptation). Un stockage disque n'est pas requis par la DoD.

### Compte rendu — vérifier la DoD

Backend (module `guest-access` + garde serveur) + tranche app (gestion + coquille
invité). **Parcours de preuve** (e2e `guest-access.spec.ts`, Postgres réel) :

1. **Pro uniquement** : `POST /horses/:id/guest-access` → **403** en gratuit **et** en
   premium, **201** en pro (garde 4.1 `comptes_invité`).
2. **Inviter → consulter en lecture seule** : le coach invite (jeton capturé via le port
   `Mailer` de test, équivalent du stub log dev) ; le client (**compte gratuit**) accepte
   (`POST /guest-access/accept` → **200**, renvoie `{ cheval_id, cheval_nom }`) ; il lit
   `GET /guest-access/horses/:id/{feed,metrics,sessions/history,heatmap}` → **200** — y
   compris l'**analytique** malgré son tier gratuit (portée = octroi). **Onboarding** :
   son `GET /horses` = `[]` (aucun cheval possédé) mais `GET /guest-access/me` renvoie le
   cheval partagé → il **saute la création de cheval**.
3. **Scoping strict** : un **autre** cheval (même coach **ou** autre compte) → **404** ;
   **écrire** (`POST …/sessions`, `PATCH /horses/:id`) → **404** ; **gérer** les invités
   → **403**. L'historique du cheval partagé reste **inchangé** (aucune écriture n'a pris).
4. **Plusieurs invités + révocation** : deux invités **différents** lisent ; révoquer l'un
   (`DELETE /guest-access/:id` → **204**) **coupe** son accès (feed/heatmap → **404**,
   `me` → `[]`) **sans** toucher l'autre (toujours **200**).
5. **App** : fiche cheval → section « Comptes invité » (Pro : inviter + liste + révoquer ;
   sinon grisé → upgrade). Deep link `/guest-invite?token=…` → acceptation → coquille
   `/guest` (Feed · Historique · Analytique, **sans ( + )/✦/switcher**, **bandeau lecture
   seule**).

Commandes : `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` (tous verts, sans DB) ;
`pnpm --filter @hpt/api db:verify` exécute les e2e (Postgres requis, **job `db` de la CI**).

### DoD — preuves

| Critère | Vérification | Statut |
|---|---|---|
| **Inviter un client** qui consulte le cheval en **lecture seule** (feed, héros, historique + bilans simples, **analytique 5.1**) | e2e `guest-access.spec.ts` › DoD : invite → accept → `feed/metrics/sessions/history/heatmap` **200** (invité **gratuit**) | ✅ (job `db`) |
| **Sans saisie, sans autres chevaux, sans ✦** | e2e : écritures → **404** ; autre cheval → **404** ; app : coquille invité ne passe **jamais** `augmentéDisponible` (✦ absent) | ✅ |
| **Plusieurs invités** par cheval ; **révocable** (l'accès **cesse**) | e2e : 2 invités différents lisent ; `DELETE` → l'un coupé (**404**, `me` `[]`), l'autre intact (**200**) | ✅ (job `db`) |
| **Scoping serveur** : ni autre cheval, ni écriture | e2e : `/guest-access/horses/{autre}/…` **404** ; `POST …/sessions` & `PATCH /horses/:id` **404** ; gérer **403** | ✅ (job `db`) |
| **Pro uniquement** (garde 4.1) | e2e : invite gratuit **403**, premium **403**, pro **201** ; consultation invité **non** gatée par le tier | ✅ (job `db`) |
| **Onboarding invité** : saute la création de cheval | e2e : invité `GET /horses` `[]` **+** `GET /guest-access/me` = cheval partagé ; app : garde route l'invité pur vers `/guest` (test `guest-routing`) | ✅ |
| **Coquille invité** : pas de ( + ), pas de ✦, pas de switcher, **bandeau lecture seule** | `app/guest/_layout` (3 onglets, banner) ; export Metro : `/guest`, `/guest/historique`, `/guest/analytique`, `/guest-invite` bundlées | ✅ |
| **Table Accès invité** (Modèle §3) : 1 Cheval pro ; invité compte/e-mail ; statut | migration `0008` additive (`acces_invite` + enum + 3 FK cascade) ; `alignment.spec.ts` aligne `AccèsInvité` (hors `token_hash`) | ✅ |
| **E-mail d'invitation** : TEM prod / **stub** dev | port `Mailer.sendGuestInvitation` ; `ConsoleMailer` log en dev ; e2e capture via override du port | ✅ |
| Aucun type d'API dupliqué ; DTO `shared` ; Zod au bord | DTO `@hpt/shared` (`AccèsInvité*`, `ChevalPartagé`) ; entrées validées (`ZodValidationPipe`), sorties strippées | ✅ |
| Réutilisation (feed/héros/historique/analytique), **0 reconstruction** | services `Feed/Metrics/Sessions/Analytics` **exportés** et consommés ; app via `basePath` invité | ✅ |
| `pnpm lint` | `biome check .` (412 fichiers) | ✅ exit 0 |
| `pnpm typecheck` | build `shared` puis `tsc --noEmit` (shared + api + app) ; alignement `AccèsInvité` | ✅ vert |
| `pnpm test` (sans DB) | Vitest — **203 (shared, +9)** + **55 (api, +1 alignement)** + **208 (app, +21 guest-access)** | ✅ 466/466 |
| `pnpm build` | shared (ESM+CJS) + api (nest) + app (typecheck) ; **export Metro web** OK (routes invité bundlées) | ✅ vert |
| `db:verify` (Postgres requis) | Vitest — 157 (lots antérieurs) + **6 (guest-access 4.6)** | ✅ 163/163 |
| CI | job `ci` (sans DB) + job `db` (`migrate` 0→**0008** + `verify`, e2e 4.6 inclus) | ✅ posé |

---

## Lot 5.2 — Benchmark à combinaison constante · 2026-07-01

Deuxième (et **dernier**) morceau de la **Phase 5 (Analytique)** — **clôture du
périmètre v1**. Extension du module **`analytics`** (api) + agrégation pure dans
**`shared`** + tranche **`app`** : le **benchmark à combinaison constante** (Spec
§5.3, Modèle §8/§9, UI/UX §6.5), posé **sous la heatmap** (5.1) dans l'écran
Analytique. On suit dans le temps la **réussite d'une combinaison réutilisable
identifiée** (structure figée) pour un cheval → l'amélioration est attribuable au
**couple**, pas à une structure plus facile. `analytics` reste une surface de
**lecture/composition** : il lit via `sessions` **et** `combinations` (leurs
**services**, jamais leurs tables — Archi §1/§3) et **réutilise** le **taux §7**
(0.2). Strictement le lot 5.2 : **pas** de heatmap refaite (5.1, étendue), **pas**
de CRUD de combinaisons (2.5, réutilisé), **aucun** tarif/verrou refait (4.1/4.2,
réutilisés).

### Emplacement (décisions tranchées)

- **`shared` (calc + DTO)** — le calcul vit ici, **une seule** implémentation
  (Archi §2) : `calc/benchmark.ts` (`sérieBenchmark(ref, séances)` : série ordonnée
  `{ date, taux, hauteur }` + `tendance` ; `combinaisonsInstanciées(séances)` : les
  identités benchmarkables + décompte per-cheval). Les deux dérivent d'une **brique
  interne unique** `instanciations()` (mêmes filtres → cohérence garantie) qui
  **réutilise** `effortsObstacle` (taux §7). `schemas/benchmark.ts` (DTO `Point`/
  `Série`/`Liste`, miroir Zod). **Hoist** du vocabulaire **`Tendance`** partagé avec
  le bilan 4.4 : `enums/tendance.ts` (`TENDANCES`) + `tendanceSchema` (référentiel).
- **`api/src/analytics/`** (extension) — `analytics.service.ts` gagne `benchmarkList`
  (via `sessions` + `combinations`) et `benchmarkSérie` (via `sessions` +
  `combinations.findForAccount`) ; `analytics.controller.ts` gagne deux routes
  **frères** (`GET /horses/:id/benchmark`, `…/benchmark/:combinaisonRef`) sous la
  **même** garde `analytique_diagnostic` ; `analytics.module.ts` importe désormais
  **`CombinationsModule`**. **Aucune** table, **aucune** écriture — même posture que
  la heatmap (5.1).
- **`api/src/guest-access/`** (extension, **4.6 déjà livré**) — `GuestAccessService`
  gagne `benchmarkListForGuest`/`benchmarkSérieForGuest` (assert de portée →
  délègue à `AnalyticsService` scopé au **propriétaire**) ; `guest-consultation.
  controller.ts` expose les deux routes sous `/guest-access` (portée = octroi, pas
  le tier de l'invité). La **vue invité reprend le benchmark** en lecture seule
  scopée — sans reconstruire de surface.
- **`app/src/analytics/`** (extension) — `benchmark-api.ts` (+ `basePath` 4.6),
  `use-benchmark.ts` (2 hooks TanStack Query), `benchmark-format.ts` (helpers
  **purs** testés : courbe/annotation/tendance/mono-point/a11y), `benchmark-curve.
  tsx` (courbe « maison » 3.2, chiffres tabulaires, hauteur en annotation),
  `benchmark-section.tsx` (sélecteur de combinaison + courbe + états), `benchmark-
  apercu.tsx` (esquisse grisée). **`AnalytiqueContenu`** empile heatmap **puis**
  benchmark dans un seul défilement (réutilisé par le propriétaire **et** l'invité,
  via `basePath`) ; **`AnalytiqueAperçu`** compose l'aperçu grisé des deux.

### Décisions tranchées (et pourquoi)

- **Série benchmark dans `shared`, réutilisant le taux §7 (jamais réécrit).** Un
  point = `effortsObstacle` (décomposition §7 : `propres / totaux`, dénominateur
  `répétitions × nombre_d_éléments` pour la combinaison) → `taux`. **Aucune**
  arithmétique du §7 n'est dupliquée : la même brique alimente le taux par-obstacle
  (0.2), la heatmap (5.1) et le benchmark (5.2). Un obstacle non calculable est
  **ignoré** sans planter (robustesse cohérente heatmap).
- **Indexation sur `combinaison_ref` — identité stable (2.5), jamais de mélange.**
  La série filtre sur l'**égalité stricte** du `combinaison_ref`. Comme « modifier
  une combinaison en crée une **nouvelle** » (2.5, pas de versioning), une structure
  modifiée porte un **autre** ref → **série distincte**, comparaison *like-for-like*
  garantie. Un obstacle **dé-lié** (`combinaison_ref = null`, `SET NULL` de 2.5) est
  **exclu** : il n'est plus rattaché à l'identité suivie (le coût que 2.5 avait
  consigné pour 5.2 est ici **traité par exclusion**).
- **Un point = une instanciation `live` ; hauteur en annotation vs taux.** Chaque
  obstacle Combinaison référençant l'identité dans une séance **`live`** produit un
  point ; la **hauteur** (la barre du jour, **variable**) voyage en **annotation**,
  jamais confondue avec le taux (la **structure**, elle, est constante). Le
  `déclaratif` est **exclu** (§2) ; la **couche contexte n'est jamais agrégée** (§1,
  elle n'entre pas dans la forme d'entrée). Prouvé e2e (contexte sans effet sur le
  taux, déclaratif absent de la série).
- **Portée per-cheval.** La bibliothèque de combinaisons est **au niveau compte**
  (partagée entre chevaux, 2.5) ; le benchmark suit **UN cheval** → la série ne
  compte **que** les instanciations du cheval sélectionné (via `sessions.
  listForHorse`, scopé compte + propriété). Prouvé e2e (même réutilisable instanciée
  sur 2 chevaux ⇒ 2 séries indépendantes).
- **Liste benchmarkable triée par usage (per-cheval).** `combinaisonsInstanciées`
  trie par `n_points` décroissant (« le plus travaillé sur ce cheval »), puis
  récence, puis ref — le **tri anti-bloat** (§4.3) au sens per-cheval. L'**identité
  affichable** (`nom` « Double 1 »/« Triple oxer », `nombre_d_éléments`) est **lue
  via `combinations.list`** (indexée, pas de N+1), jamais la table.
- **Mono-point géré.** Une combinaison instanciée **une fois** affiche **un point**,
  `tendance = null` (aucune fausse tendance) + une **invitation à la rejouer**. La
  `tendance` (≥ 2 points) est le **signe de la pente** (moindres carrés du taux sur
  l'index), avec une bande `stable` (`EPSILON_TENDANCE`) — honnête, « sans
  dramatiser » (§7).
- **Gating = autorité serveur (4.1) ; verrou (4.2) réutilisés.** Les deux endpoints
  portent la **même** garde `@RequireCapacité('analytique_diagnostic')` +
  `EntitlementGuard` que la heatmap → **gratuit refusé en 403** (prouvé). L'app
  grise via **un seul** `LockedFeature` couvrant **toute** l'Analytique (heatmap +
  benchmark) ; l'appui ouvre l'upgrade **premium**. Le hook n'est monté que dans le
  contenu débloqué → un gratuit ne déclenche jamais la requête.
- **Extension de la surface Analytique de 5.1 (pas de refonte).** `AnalytiqueContenu`
  possède le défilement ; `HeatmapView` devient un **bloc encastrable** (ses états
  cohabitent dans une carte, la grille/le calc **inchangés**). Le benchmark s'ajoute
  **dessous**. La **coquille invité** (4.6) et l'écran propriétaire rendent **le même**
  `AnalytiqueContenu` (paramétré `basePath`) — zéro surface dupliquée (Archi §2/§3).

### Écarts vs cadrage (consignés)

- **`Tendance`/`tendanceSchema` hoistés et partagés avec 4.4 (single source).** Le
  bilan 4.4 avait déjà **exactement** ce vocabulaire (`['hausse','stable','baisse']`).
  Plutôt que le dupliquer (« aucun type dupliqué », Archi §2), on l'a **remonté** :
  `enums/tendance.ts` (`TENDANCES` + type) alimente le type **et** `tendanceSchema`
  (référentiel). `progression-report.ts` (4.4) l'**importe** désormais au lieu de le
  redéclarer — refactor **additif et iso-comportement** (les 6 tests du bilan restent
  verts, `compose-bilan` lit `Tendance` via le barrel). Layering respecté (enums →
  calc/schemas), aucune inversion.
- **« Victory Native » du cadrage → convention **réelle** de 3.2 (barres « maison »).**
  Le cadrage évoque Victory Native/Skia, mais **3.2 a délibérément posé** une courbe
  **sans dépendance de graphe** (barres `View` normalisées, positions par index,
  chiffres tabulaires, décorative masquée aux lecteurs d'écran). On **réutilise cette
  convention livrée** (une seule, cohérente) — **aucune** dépendance native ajoutée
  (pas d'abstraction prématurée, CI/Metro web inchangés).
- **Transport des dates.** La **série** porte des `date` (`z.date()`) → l'app
  **caste** (précédent `metrics` 3.2 : dates ISO au runtime, courbe positionnée par
  index — l'affichage n'en dépend pas). La **liste** n'a que scalaires/entiers →
  **re-validée** par Zod au bord (précédent `heatmap` 5.1). Règle nette : *Zod au
  bord quand pas de `Date` ; cast quand `Date`.*
- **`HeatmapView` passe de plein-écran (flex 1 + ScrollView propre) à bloc
  encastrable.** Nécessaire pour empiler le benchmark **sous** la heatmap dans un
  même défilement. La grille/le format/le calc de 5.1 sont **intacts** ; seuls le
  conteneur et les états (rendus **dans la carte**) changent. L'écran invité passe de
  `HeatmapView` direct à `AnalytiqueContenu` (même réutilisation, +benchmark).
- **Aperçu grisé combiné.** L'aperçu du verrou devient `AnalytiqueAperçu` (esquisse
  heatmap **+** benchmark) — cohérent avec « **toute** l'Analytique est premium/pro »
  (§8), sans divulguer de vraie donnée.

### Points laissés ouverts (reports explicites)

- **4.6 déjà livré → la vue invité reprend le benchmark, ici et maintenant.** La
  surface Analytique est réutilisée **en lecture seule scopée** (contrôleur/‌service
  invité + `AnalytiqueContenu` via `basePath`), prouvé e2e (invité **gratuit** lit
  liste+série via l'octroi ; routes propriétaire → 403). Rien n'est reporté côté
  invité.
- **Coût de recalcul.** Comme heatmap/metrics, `analytics` **recompose** depuis
  l'historique `live` complet à chaque lecture (une passe par obstacle). Correct et
  simple à l'échelle v1 ; un cache/incrémental sera utile si un cheval accumule des
  centaines de séances.
- **Tendance = pente des extrêmes lissée (moindres carrés).** Heuristique honnête et
  déterministe (bande `EPSILON_TENDANCE` tunable en une source) ; une modélisation
  plus riche (fenêtre, pondération par volume) reste un raffinement ultérieur — sans
  toucher aux points (le taux §7 par instanciation, lui, est exact).
- **Phase 5 = dernière phase de la roadmap.** **5.2 clôt le périmètre v1 complet**
  (Capture → Restitution → Monétisation → Analytique). Reste hors-v1 (déjà consigné
  ailleurs) : séries propres (jalons 3.1/3.2), cache incrémental, affinements PSP
  (4.2), fusion coach↔client (4.6).

### Compte rendu — vérifier la DoD

Backend (module `analytics` étendu + garde serveur + réutilisation invité) + tranche
app (section benchmark sous la heatmap). **Parcours de preuve** (e2e
`benchmark.spec.ts` + bloc benchmark de `guest-access.spec.ts`, Postgres réel) :

1. **Progression** : enregistrer une réutilisable (`POST /combinations`),
   l'**instancier** sur plusieurs séances `live` (hauteur seule), puis `GET
   /horses/:id/benchmark` (liste triée par usage, `n_points`) et `…/benchmark/:ref`
   (série ordonnée : **taux §7** par date, **hauteur en annotation**, **tendance**).
2. **Identité stable** : `PATCH /combinations/:ref` (= **nouvelle** identité),
   instancier la nouvelle → **deux séries distinctes**, **aucun** mélange de ref.
3. **Per-cheval** : instancier la même réutilisable sur deux chevaux → séries
   indépendantes (`n_points` par cheval).
4. **Mono-point** : une instanciation → **un point**, `tendance = null`.
5. **Exclusions** : une séance `déclaratif` **n'entre pas** ; une séance `live`
   **avec contexte** ne change **pas** le taux (contexte jamais agrégé).
6. **Gating** : compte **gratuit** → **403** sur les deux endpoints ; l'app grise via
   `LockedFeature` → `/upgrade`. **Invité** (4.6) : lit liste+série via
   `/guest-access/...` (200, portée = octroi) mais reste **403** sur les routes
   propriétaire.

Commandes : `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` (tous verts,
sans DB) ; `pnpm --filter @hpt/api db:verify` (Postgres requis, **job `db` de la
CI**). Écran : onglet **Analytique** (heatmap **puis** benchmark ; sélecteur de
combinaison ; courbe + tendance + annotation de hauteur ; mono-point ; état vide =
invitation) — grisé au gratuit → upgrade ; repris tel quel dans la coquille invité.

### DoD — preuves

| Critère | Vérification | Statut |
|---|---|---|
| **Progression d'une combinaison identifiée dans le temps** : série ordonnée, taux §7 par date, hauteur en annotation, courbe = tendance | e2e `benchmark.spec.ts` (3 instanciations 0.5→0.75→1, hauteurs 110/115/120, `tendance: hausse`) ; unités `benchmark.test.ts` | ✅ |
| **Identité stable** : combinaison **modifiée (nouvelle identité, 2.5)** ⇒ série **distincte**, **aucun** mélange de `combinaison_ref` | e2e (`PATCH` ⇒ nouvel `id` ; séries A/B disjointes) + unit (dédié) ; obstacle **dé-lié** (`ref = null`) **exclu** | ✅ |
| **Per-cheval** : la série ne compte **que** le cheval sélectionné ; **`déclaratif` exclu** ; **contexte jamais agrégé** | e2e (même réutilisable sur 2 chevaux ⇒ séries indépendantes ; déclaratif absent ; contexte sans effet) + unit | ✅ |
| **Mono-point géré** : un point, **pas** de fausse tendance | e2e (`n_points = 1`, `tendance: null`) + unit ; app : invitation « rejoue cette combinaison » | ✅ |
| **Série dans `shared`** (pure, testée, une seule implémentation) réutilisant le **taux §7** | `calc/benchmark.ts` réutilise `effortsObstacle` ; alignement `Point/Série ≡ DTO` (`expectTypeOf`) ; 14 tests | ✅ |
| **Grisé si gratuit** : endpoint **refusé au gratuit** (garde 4.1) ; app grise + upgrade (verrou 4.2) | e2e : gratuit → **403** (liste **et** série) ; app **un seul** `LockedFeature` (heatmap + benchmark) → `/upgrade?cap=analytique_diagnostic` | ✅ |
| **Autorisation** : cheval **ou** combinaison étrangers → 404 ; sans jeton → 401 ; ref malformé → 400 | e2e : intrus premium → **404** ; ref d'un autre compte → **404** ; sans jeton → **401** ; `ParseUUIDPipe` → **400** | ✅ |
| **Réutilisation invité (4.6 livré)** : la vue invité **reprend** le benchmark en lecture seule scopée | e2e `guest-access.spec.ts` : invité **gratuit** lit `/guest-access/…/benchmark(/:ref)` (200, portée = octroi) ; routes propriétaire → **403** ; app `AnalytiqueContenu` via `basePath` | ✅ |
| Accessibilité (UI/UX §8) | courbe « maison » lisible plein soleil, **chiffres tabulaires** (`StatText`), hauteur en **annotation**, tendance (icône + libellé), contraste AA+ ; courbe décorative masquée, sens via libellé a11y | ✅ |
| Aucun type d'API dupliqué ; Zod au bord | DTO `@hpt/shared` (`Benchmark*Dto`) ; `Tendance` **partagé** avec 4.4 (single source) ; liste re-validée (pas de `Date`), série castée (`Date`, précédent metrics) | ✅ |
| Pas de débordement de périmètre | **0** heatmap refaite (5.1 étendue), **0** CRUD combinaison (2.5 réutilisé), **0** tarif/verrou refait (4.1/4.2 réutilisés) ; contexte **jamais** agrégé | ✅ |
| `pnpm lint` | `biome check .` (426 fichiers) | ✅ exit 0 |
| `pnpm typecheck` | build `shared` puis `tsc --noEmit` (shared + api + app ; alignement `Point/Série ≡ DTO`, `Tendance ≡ tendanceSchema`) | ✅ vert |
| `pnpm test` (sans DB) | Vitest — **217 (shared, +14 benchmark)** + 55 (api) + **216 (app, +8 benchmark-format)** | ✅ 488/488 |
| `pnpm build` | shared (ESM+CJS) + api (nest) + app (typecheck) ; **export Metro web** OK (`/analytique` 34 KB, `/guest/analytique` bundlés) | ✅ vert |
| `db:verify` (Postgres requis) | Vitest — 163 (lots antérieurs) + **8 (benchmark 5.2 : 7 propriétaire + 1 réutilisation invité)** | ✅ 171/171 |
| CI | job `ci` (sans DB) + job `db` (`migrate` + `verify`, e2e 5.2 inclus) — **aucune migration** en 5.2 | ✅ |

---
