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
