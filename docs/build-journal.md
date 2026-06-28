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
