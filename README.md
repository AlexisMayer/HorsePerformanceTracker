# Horse Performance Tracker (HPT)

> **SaaS mobile de suivi de progression en saut d'obstacles (CSO).**
> Le carnet qui rend la progression d'un cheval visible (rétention par l'émotion)
> et démontrable dans un bilan professionnel (monétisation par l'abonnement).

Ce dépôt est un **monorepo TypeScript de bout en bout** (app mobile + API + contrats
partagés). Ce README couvre l'**installation locale** et la **vérification** du projet.
Le déploiement (prod Scaleway) fera l'objet d'un `DEPLOYMENT.md` séparé.

> ✅ **V1 complète.** L'intégralité du périmètre v1 est livrée — les **six phases** (0 à 5) :
> Fondations → Compte → Capture → Restitution gratuite → Monétisation → Analytique de
> diagnostic, en **gratuit**, **premium** et **pro**. Détail en
> [État d'avancement](#état-davancement).

---

## Sommaire

- [Présentation](#présentation)
- [Architecture du monorepo](#architecture-du-monorepo)
- [Stack technique](#stack-technique)
- [Prérequis](#prérequis)
- [Installation pas à pas](#installation-pas-à-pas)
- [Configuration (`.env`)](#configuration-env)
- [Base de données locale](#base-de-données-locale)
- [Lancer l'API](#lancer-lapi)
- [Lancer l'application mobile](#lancer-lapplication-mobile)
- [Vérifier & tester](#vérifier--tester)
- [Smoke test de l'API (curl)](#smoke-test-de-lapi-curl)
- [Référence des endpoints](#référence-des-endpoints)
- [Scripts disponibles](#scripts-disponibles)
- [Dépannage](#dépannage)
- [État d'avancement](#état-davancement)
- [Documentation](#documentation)

---

## Présentation

HPT transforme les séances quotidiennes de CSO en données exploitables : saisie par
obstacle en fin de séance, taux de réussite, hauteur maîtrisée, combinaisons
réutilisables, feed de progression et bilans partageables. Trois principes dictent la
conception :

- **Client en ligne** — la saisie requiert une connexion (avec brouillon local + réessai
  sur coupure passagère pour ne jamais perdre une saisie). Pas d'offline-first.
- **RGPD & souveraineté** — tout en UE (hébergement Scaleway, région `fr-par`).
- **TypeScript partout** — un seul langage app/serveur, **types et contrats partagés**,
  aucune duplication.

**Trois niveaux** composent la v1 : **Gratuit** (mono-cheval — onboarding, saisie par
obstacle, combinaisons réutilisables, feed, graphes héros, cartes partageables, historique) ;
**Premium** (analytique de diagnostic, bilan de progression, assistant IA) ; **Pro**
(multi-chevaux, comptes invité en lecture seule). La **saisie** et l'**historique** ne sont
**jamais** verrouillés.

---

## Architecture du monorepo

```
HorsePerformanceTracker/
├── app/                 # Application mobile — Expo / React Native (@hpt/app)
│   └── src/
│       ├── app/         # Routes Expo Router : (auth), (tabs), horses, sessions, guest…
│       ├── auth/        # Client HTTP, contexte de session, secure storage
│       ├── onboarding/  # Bifurcation amateur/coach, 1re séance guidée
│       ├── horses/      # Fiche cheval + archivage (UI + API)
│       ├── sessions/    # Saisie rapide d'une séance (UI + API)
│       ├── combinations/# Bibliothèque de combinaisons réutilisables
│       ├── feed/        # Fil de progression (onglet Feed)
│       ├── metrics/     # Graphes héros & records
│       ├── history/     # Historique des séances (onglet Historique)
│       ├── sharing/     # Cartes partageables (export image)
│       ├── analytics/   # Heatmap & benchmark (onglet Analytique)
│       ├── progression-report/ # Bilan de progression
│       ├── ai-bilan/    # Bilan augmenté par IA
│       ├── entitlements/# Verrous & capacités (grisage des fonctions payantes)
│       ├── subscription/# Paywall & upgrade (checkout Mollie)
│       ├── guest-access/# Invitations & coquille invité (lecture seule)
│       ├── ui/ theme/   # Composants & tokens de design
│       └── config.ts    # URL de l'API (EXPO_PUBLIC_API_URL)
│
├── api/                 # Backend — NestJS (@hpt/api)
│   ├── src/
│   │   ├── auth-account/# Auth (JWT access/refresh, argon2), vérif e-mail, RGPD
│   │   ├── entitlements/# Tiers & gating serveur, abonnement & webhook Mollie
│   │   ├── horses/      # CRUD cheval + archivage (pro), scopé au compte
│   │   ├── sessions/    # Création/édition/suppression de séance + historique
│   │   ├── combinations/# Combinaisons réutilisables
│   │   ├── feed/        # Fil de progression mono-cheval (faits + jalons)
│   │   ├── metrics/     # Hauteur maîtrisée, records, courbe héros
│   │   ├── sharing/     # Cartes de bilan de séance partageables
│   │   ├── progression-report/ # Bilan de progression (premium/pro)
│   │   ├── ai-bilan/    # Assistant IA — bilan augmenté (Mistral, premium/pro)
│   │   ├── analytics/   # Heatmap type × hauteur & benchmark (premium/pro)
│   │   ├── guest-access/# Comptes invité — accès client lecture seule (pro)
│   │   ├── health/      # GET /health
│   │   └── db/          # Connexion Drizzle + schéma (1 fichier par entité)
│   └── drizzle/         # Migrations SQL générées + snapshots (commitées)
│
├── packages/shared/     # Contrats partagés (@hpt/shared) — source de vérité unique
│   └── src/
│       ├── enums/       # Référentiel figé (hauteurs, types d'obstacle/séance…)
│       ├── types/       # Formes de domaine des entités
│       ├── schemas/     # DTO Zod (validation aux frontières)
│       └── calc/        # Fonctions de calcul pures (taux de réussite…)
│
├── docs/                # Dossier de cadrage (PRD, Spec, Modèle…) + build-journal
├── docker-compose.yml   # PostgreSQL 16 local
└── .env.example         # Variables d'environnement de dev (à copier en .env)
```

**Le flux des contrats** : `@hpt/shared` définit enums, types et schémas Zod **une seule
fois** ; l'`api` et l'`app` les **importent**. Aucun type d'API n'est dupliqué. C'est
pourquoi `@hpt/shared` doit être **bâti avant** ses consommateurs (voir l'installation).

---

## Stack technique

| Couche        | Technologies |
|---------------|--------------|
| **Monorepo**  | pnpm workspaces `10.33.0`, Node 20 LTS, TypeScript `6.0.3` |
| **App**       | Expo SDK 56, React Native 0.85, React 19, Expo Router, TanStack Query |
| **API**       | NestJS 11 (Express), Passport JWT, argon2, Drizzle ORM 0.45 |
| **Base**      | PostgreSQL 16 (Docker en dev ; Scaleway en prod) |
| **Paiement & IA** | Mollie (abonnement premium/pro, webhook = autorité du tier), Mistral Small (bilan augmenté, version épinglée) |
| **Outillage** | Biome (lint/format), Vitest (tests), drizzle-kit (migrations) |

---

## Prérequis

| Outil | Version | Notes |
|-------|---------|-------|
| **Node.js** | **≥ 20** (cible 20 LTS) | `.nvmrc` épingle `20`. Testé jusqu'à Node 22. |
| **pnpm** | **10.33.0** | Épinglé via `packageManager`. Voir ci-dessous. |
| **Docker + Docker Compose** | récent | Pour la base PostgreSQL locale. |
| **Git** | — | Pour cloner le dépôt. |

> **App mobile** : un simulateur iOS / émulateur Android, **ou** l'application **Expo Go**
> sur un appareil physique (le plus simple), suffit. Aucun build natif n'est requis pour
> le dev.

**Installer pnpm 10.33.0** — le plus simple est Corepack (fourni avec Node) :

```bash
corepack enable
corepack prepare pnpm@10.33.0 --activate
```

> ⚠️ **Ne pas modifier `.npmrc`** (`node-linker=hoisted`) : ce réglage est nécessaire à la
> compatibilité Metro / React Native dans le monorepo.

---

## Installation pas à pas

```bash
# 1. Cloner et entrer dans le dépôt
git clone <url-du-dépôt> HorsePerformanceTracker
cd HorsePerformanceTracker

# 2. Installer toutes les dépendances du workspace
pnpm install

# 3. Bâtir les contrats partagés (REQUIS avant de lancer l'API ou l'app)
pnpm --filter @hpt/shared build

# 4. Préparer l'environnement de dev
cp .env.example .env

# 5. Démarrer la base PostgreSQL locale
docker compose up -d

# 6. Appliquer les migrations de base de données
pnpm --filter @hpt/api db:migrate
```

À partir d'ici, l'API et l'app peuvent être lancées (sections suivantes).

> **Pourquoi l'étape 3 ?** `@hpt/api` et `@hpt/app` importent `@hpt/shared` depuis son
> `dist/`. Tant que le package n'est pas bâti, leur démarrage échoue. Les commandes
> `pnpm typecheck` et `pnpm build` rebâtissent `shared` automatiquement ; pour un
> simple `dev`, il faut l'avoir bâti au moins une fois.

---

## Configuration (`.env`)

Copiez `.env.example` vers `.env` (jamais commité — voir `.gitignore`). Les valeurs par
défaut conviennent au dev local.

| Variable | Défaut (dev) | Rôle |
|----------|--------------|------|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `hpt` / `hpt` / `hpt` | Identifiants du conteneur Postgres. |
| `POSTGRES_PORT` | `5432` | Port exposé par Docker. |
| `DATABASE_URL` | `postgresql://hpt:hpt@localhost:5432/hpt` | URL lue par l'API et drizzle-kit. |
| `PORT` | `3000` | Port d'écoute de l'API NestJS. |
| `JWT_ACCESS_SECRET` | `dev-access-secret-change-me` | Secret de signature des access tokens (~15 min). |
| `JWT_REFRESH_SECRET` | `dev-refresh-secret-change-me` | Secret de signature des refresh tokens (~30 j). |
| `APP_PUBLIC_URL` | `http://localhost:3000` | Base des liens d'e-mail (vérification, reset). |

> 🔐 Les secrets du `.env.example` sont des valeurs **de dev uniquement**. En production,
> ils proviennent du Secret Manager, jamais du dépôt.

**Fonctions payantes (optionnel en dev).** L'upgrade et l'assistant IA tournent **sans clé**
en local grâce à des adaptateurs de repli — laissez ces variables vides pour développer.

| Variable | Défaut (dev) | Rôle |
|----------|--------------|------|
| `MOLLIE_API_KEY` | *(vide)* | Clé Mollie. **Vide ⇒ adaptateur fake** (webhooks simulables localement). |
| `SUBSCRIPTION_PREMIUM_AMOUNT` / `SUBSCRIPTION_PRO_AMOUNT` | `9.99` / `19.99` | Tarifs mensuels (paramétrables, jamais en dur). |
| `MOLLIE_WEBHOOK_URL` | `http://localhost:3000/webhooks/mollie` | URL où Mollie poste l'id de paiement (**autorité du tier**). |
| `MOLLIE_REDIRECT_URL` | `hpt://upgrade-return` | Deep link de retour de l'app après checkout. |
| `MISTRAL_API_KEY` | *(vide)* | Clé Mistral. **Vide ⇒ stub déterministe** (le sandbox de dev n'atteint pas Mistral). |
| `AI_BILAN_MODEL_VERSION` | `mistral-small-2409` | Version **épinglée** du modèle (jamais `-latest`). |
| `AI_BILAN_RATE_LIMIT` | `10` | Générations IA max par utilisateur et par fenêtre glissante. |

> `.env.example` liste ces variables avec des commentaires détaillés (devise, intervalle,
> fenêtre de rate limiting, URL de gestion Mollie…).

**Côté application mobile**, une variable supplémentaire (optionnelle) pointe l'API :

| Variable | Défaut | Rôle |
|----------|--------|------|
| `EXPO_PUBLIC_API_URL` | `http://localhost:3000` | URL de l'API ciblée par l'app (inlinée au build par Expo). |

Sur un **appareil physique**, `localhost` désigne le téléphone : remplacez-le par l'IP LAN
de votre machine, p. ex. `EXPO_PUBLIC_API_URL=http://192.168.1.20:3000`.

---

## Base de données locale

```bash
# Démarrer Postgres 16 (en arrière-plan, avec healthcheck)
docker compose up -d

# Appliquer les migrations Drizzle
pnpm --filter @hpt/api db:migrate

# Arrêter la base (les données persistent dans le volume nommé)
docker compose down

# Repartir d'une base vierge (supprime le volume de données)
docker compose down -v
```

Scripts Drizzle disponibles dans `@hpt/api` :

| Commande | Effet |
|----------|-------|
| `pnpm --filter @hpt/api db:generate` | Génère une migration SQL à partir du schéma. |
| `pnpm --filter @hpt/api db:migrate` | Applique les migrations sur la base de `DATABASE_URL`. |
| `pnpm --filter @hpt/api db:verify` | Tests d'intégration sur base réelle (voir plus bas). |

---

## Lancer l'API

```bash
pnpm --filter @hpt/api dev      # NestJS en watch (nest start --watch), port 3000
```

Vérifiez qu'elle répond :

```bash
curl http://localhost:3000/health
# → {"status":"ok"}
```

> 📨 **E-mails en dev** : les e-mails (vérification, réinitialisation) ne sont pas envoyés
> mais **loggés dans la console de l'API** (`ConsoleMailer`). Le lien à usage unique
> apparaît dans les logs — c'est ainsi qu'on teste la vérification d'e-mail et le reset en
> local.

Pour un build de production locale :

```bash
pnpm --filter @hpt/api build    # → api/dist
pnpm --filter @hpt/api start    # node dist/main.js
```

---

## Lancer l'application mobile

```bash
pnpm --filter @hpt/app start    # serveur de dev Expo (Metro)
```

Puis, dans le menu Expo : scannez le QR code avec **Expo Go**, ou pressez `i` (iOS), `a`
(Android), `w` (web). Cibles directes :

```bash
pnpm --filter @hpt/app ios      # simulateur iOS
pnpm --filter @hpt/app android  # émulateur Android
pnpm --filter @hpt/app web      # navigateur
```

L'app démarre sur l'écran de **connexion** ; créez un compte via « Créer un compte »
(l'API doit tourner et la base être migrée). La session ouverte redirige vers les onglets
**Feed · Historique · Analytique · Profil** avec le bouton de saisie central.

---

## Vérifier & tester

Commandes **agrégées** (à la racine, sur tout le monorepo) :

| Commande | Ce qu'elle fait |
|----------|-----------------|
| `pnpm lint` | `biome check .` — lint + format (lecture seule). |
| `pnpm typecheck` | Bâtit `shared` puis `tsc --noEmit` sur les 3 packages. |
| `pnpm test` | Tests unitaires Vitest (**sans base de données**). |
| `pnpm build` | Bâtit `shared` (ESM+CJS) + `api` (nest) + `app` (typecheck). |
| `pnpm format` | `biome format --write .` — applique le formatage. |
| `pnpm lint:fix` | `biome check --write .` — corrige ce qui est auto-corrigeable. |

`pnpm test` couvre **les trois packages sans nécessiter Postgres** (à ce jour : **488
tests** — 217 `shared`, 55 `api`, 216 `app`). C'est la suite qui tourne en CI sur chaque
push / PR.

**Tests de base de données** (intégration, **Postgres requis**) — séparés pour garder
`pnpm test` vert sans base :

```bash
docker compose up -d                    # si la base n'est pas déjà lancée
pnpm --filter @hpt/api db:migrate       # base à jour
pnpm --filter @hpt/api db:verify        # 171 tests e2e : schéma, contraintes, cascades, flux auth/CRUD
```

> En **intégration continue**, deux jobs reflètent exactement ces commandes : un job
> `ci` (install → lint → typecheck → test → build, sans base) et un job `db` (service
> `postgres:16`, `db:migrate` puis `db:verify`). Voir `.github/workflows/ci.yml`.

---

## Smoke test de l'API (curl)

Avec l'API lancée et la base migrée, ce scénario valide la chaîne complète
inscription → connexion → route protégée :

```bash
# 1. Santé
curl -s http://localhost:3000/health
# → {"status":"ok"}

# 2. Inscription (le lien de vérification d'e-mail est loggé dans la console de l'API)
curl -s -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@exemple.fr","nom":"Test","password":"motdepasse123","type":"amateur"}'

# 3. Connexion → renvoie access_token + refresh_token
curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@exemple.fr","password":"motdepasse123"}'

# 4. Route protégée (remplacer <ACCESS_TOKEN> par le access_token reçu à l'étape 3)
curl -s http://localhost:3000/auth/me \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'
# → le compte courant, sans aucun secret
```

Champs attendus : `type` ∈ `amateur | coach`, `password` de 8 à 200 caractères,
`email` valide.

---

## Référence des endpoints

Toutes les routes hors auth publique exigent un en-tête `Authorization: Bearer <access_token>`
et sont **scopées au compte courant** (l'identité vient du jeton, jamais du corps ni de l'URL).
Les fonctions **premium/pro** sont **gatées côté serveur** (autorité) : un compte gratuit reçoit
un **403** ; l'app se contente de **griser** puis propose l'upgrade.

### `auth-account` — `/auth` & `/account`

| Méthode & route | Auth | Description |
|-----------------|:----:|-------------|
| `POST /auth/register` | — | Crée un compte (tier `gratuit`), logge un lien de vérification. |
| `POST /auth/login` | — | Renvoie un couple access + refresh. |
| `POST /auth/refresh` | — | Rotation : nouveau couple, ancien invalidé. |
| `POST /auth/logout` | — | Révoque le refresh présenté. |
| `GET /auth/me` | ✅ | Compte courant (sans secret). |
| `POST /auth/verify-email/request` | — | (Re)demande le lien de vérification (200 anti-énumération). |
| `POST /auth/verify-email/confirm` | — | Confirme l'e-mail via le jeton du lien. |
| `POST /auth/password-reset/request` | — | Demande un lien de reset (200 anti-énumération). |
| `POST /auth/password-reset/confirm` | — | Réinitialise le mot de passe + révoque les sessions. |
| `DELETE /account` | ✅ | Suppression de compte (RGPD), confirmée par mot de passe. |
| `GET /account/export` | ✅ | Export JSON complet des données (portabilité). |

### `horses` — `/horses`

| Méthode & route | Description |
|-----------------|-------------|
| `POST /horses` | Crée un cheval lié au compte. |
| `GET /horses` | Liste les chevaux du compte. |
| `GET /horses/:id` | Détail d'un cheval (404 si étranger au compte). |
| `PATCH /horses/:id` | Édite un cheval (PATCH partiel). |
| `DELETE /horses/:id` | Supprime un cheval (cascade). |
| `POST /horses/:id/archive` | Archive (lecture seule, hors quota) — **pro**. |
| `POST /horses/:id/unarchive` | Désarchive (réversible) — **pro**. |

### `sessions` — `/horses/:id/sessions` & `/sessions`

| Méthode & route | Description |
|-----------------|-------------|
| `POST /horses/:id/sessions` | Crée une séance (horodatée, **clé d'idempotence** requise). |
| `GET /horses/:id/sessions` | Liste les séances d'un cheval. |
| `GET /horses/:id/sessions/history` | Historique enrichi (badge « augmenté » quand présent). |
| `GET /sessions/:id` | Détail d'une séance. |
| `PATCH /sessions/:id` | Édite une séance (pose `date_modification`, jamais silencieux). |
| `DELETE /sessions/:id` | Supprime une séance (cascade des unités atomiques). |

### `combinations` — `/combinations`

| Méthode & route | Description |
|-----------------|-------------|
| `POST /combinations` | Crée une combinaison réutilisable du compte. |
| `GET /combinations` | Liste la bibliothèque, triée par usage. |
| `PATCH /combinations/:id` | « Édition » = crée une **nouvelle** (l'ancienne reste intacte). |
| `DELETE /combinations/:id` | Supprime ; les obstacles liés passent en `SET NULL`. |

### `feed` · `metrics` · `sharing` — restitution gratuite

| Méthode & route | Description |
|-----------------|-------------|
| `GET /horses/:id/feed` | Fil de progression (faits + contexte en légende, jalons). |
| `GET /horses/:id/metrics` | Hauteur maîtrisée, records/jalons, points de la courbe héros. |
| `GET /sessions/:id/card` | Carte de bilan de séance partageable (**gratuit, jamais verrouillé**). |

### `entitlements` — tiers, abonnement & Mollie

| Méthode & route | Auth | Description |
|-----------------|:----:|-------------|
| `GET /me/entitlement` | ✅ | Tier courant + capacités débloquées. |
| `GET /me/subscription/offres` | ✅ | Tarifs premium/pro (montants lus de la config). |
| `POST /me/subscription/checkout` | ✅ | Démarre un checkout Mollie (n'élève **pas** le tier). |
| `GET /me/subscription` | ✅ | État d'abonnement + URL de gestion Mollie. |
| `POST /me/subscription/annuler` | ✅ | Résilie l'abonnement courant. |
| `POST /webhooks/mollie` | — | Webhook Mollie — **seule autorité** qui élève/abaisse le tier. |

### Fonctions premium/pro (gatées serveur — 403 au gratuit)

| Méthode & route | Capacité requise | Description |
|-----------------|------------------|-------------|
| `POST /horses/:id/progression-report` | `bilan_progression` | Génère un bilan de progression (curation période/indicateurs, sortie lien/PDF). |
| `POST /sessions/:id/ai-bilan` | `bilan_augmenté` | Génère (à la demande) le bilan augmenté par IA ; rate-limité. |
| `GET /sessions/:id/ai-bilan` | `bilan_augmenté` | Relit le bilan IA persisté (aucun appel IA ; 404 si aucun). |
| `GET /horses/:id/ai-bilan` | `bilan_augmenté` | Séances possédant un bilan augmenté (slot ✦ de l'historique). |
| `GET /horses/:id/heatmap` | `analytique_diagnostic` | Heatmap type d'obstacle × hauteur (exacte, par obstacle). |
| `GET /horses/:id/benchmark` | `analytique_diagnostic` | Combinaisons instanciées, triées par usage (`n_points`). |
| `GET /horses/:id/benchmark/:ref` | `analytique_diagnostic` | Progression d'une combinaison constante dans le temps (série + tendance). |

### `guest-access` — comptes invité (pro)

**Côté propriétaire** (garde `comptes_invité`) :

| Méthode & route | Description |
|-----------------|-------------|
| `POST /horses/:id/guest-access` | Invite un client sur **un** cheval (plusieurs invitations possibles). |
| `GET /horses/:id/guest-access` | Liste les accès invité d'un cheval. |
| `DELETE /guest-access/:accessId` | Révoque un accès. |

**Côté invité** (session invité, **lecture seule** scopée à un cheval) :

| Méthode & route | Description |
|-----------------|-------------|
| `POST /guest-access/accept` | Accepte une invitation (onboarding invité). |
| `GET /guest-access/me` | Contexte invité courant (cheval consultable). |
| `GET /guest-access/horses/:id/feed` | Feed du cheval consulté. |
| `GET /guest-access/horses/:id/metrics` | Métriques du cheval consulté. |
| `GET /guest-access/horses/:id/sessions/history` | Historique du cheval consulté. |
| `GET /guest-access/horses/:id/heatmap` | Heatmap (selon l'octroi). |
| `GET /guest-access/horses/:id/benchmark[/:ref]` | Benchmark (selon l'octroi). |

---

## Scripts disponibles

**Racine** (`package.json`) — agrégés sur tout le workspace :

| Script | Commande |
|--------|----------|
| `pnpm lint` | `biome check .` |
| `pnpm lint:fix` | `biome check --write .` |
| `pnpm format` | `biome format --write .` |
| `pnpm typecheck` | build `shared` puis `tsc --noEmit` (récursif) |
| `pnpm test` | `vitest run` (récursif) |
| `pnpm build` | build récursif (`shared` → `api` → `app`) |

**`@hpt/api`** : `dev`, `start`, `build`, `typecheck`, `test`, `db:generate`,
`db:migrate`, `db:verify`.
**`@hpt/app`** : `start`, `ios`, `android`, `web`, `typecheck`, `test`, `build`.
**`@hpt/shared`** : `build`, `typecheck`, `test`.

Cibler un package : `pnpm --filter @hpt/<api|app|shared> <script>`.

---

## Dépannage

| Symptôme | Cause probable & solution |
|----------|---------------------------|
| `Cannot find module '@hpt/shared'` (au lancement de l'API/app) | `shared` n'est pas bâti → `pnpm --filter @hpt/shared build`. |
| L'API ne démarre pas / erreur de connexion DB | Postgres non lancé ou non migré → `docker compose up -d` puis `db:migrate`. Vérifier `DATABASE_URL`. |
| `docker compose up` échoue à tirer l'image | Vérifier l'accès réseau au registre Docker, puis réessayer. |
| Port `3000` ou `5432` déjà utilisé | Modifier `PORT` / `POSTGRES_PORT` dans `.env`. |
| L'app mobile ne joint pas l'API depuis un téléphone | `localhost` = le téléphone : utiliser l'IP LAN via `EXPO_PUBLIC_API_URL`. |
| `pnpm install` refuse un build de dépendance | Géré par `pnpm.onlyBuiltDependencies` ; relancer `pnpm install`. |
| Mauvaise version de pnpm | `corepack prepare pnpm@10.33.0 --activate`. |

---

## État d'avancement

Le projet est construit par **lots à dépendances**, chacun validé (DoD prouvée par test)
puis consigné dans `docs/build-journal.md`. **La v1 est complète : les six phases (0 à 5)
sont livrées.**

- **Phase 0 — Fondations** : monorepo & outillage, contrats `shared`, schéma DB & migrations.
- **Phase 1 — Compte & accès** : auth (JWT, argon2, rotation), vérification e-mail & reset,
  RGPD (suppression/export), coquille app & navigation.
- **Phase 2 — Capture** : fiche cheval, séance (création, saisie rapide, édition/suppression),
  combinaisons réutilisables.
- **Phase 3 — Restitution gratuite** : feed mono-cheval, métriques & graphes héros, cartes
  partageables, historique, onboarding amateur/coach.
- **Phase 4 — Monétisation** : tiers & gating serveur, upgrade in-app & Mollie, archivage
  cheval (pro), bilan de progression, assistant IA (bilan augmenté), comptes invité (pro).
- **Phase 5 — Analytique de diagnostic** : heatmap type × hauteur, benchmark à combinaison
  constante (premium/pro, grisés au gratuit).

Reste **hors v1** (raffinements consignés dans le journal) : séries de graphes plus riches,
cache analytique incrémental, affinements PSP, fusion coach ↔ client. Le **déploiement**
(EAS, conteneurisation de l'API, infra Scaleway, secrets de prod) fera l'objet d'un
`DEPLOYMENT.md`.

---

## Documentation

- `docs/build-journal.md` — **journal de build** (append-only) : décisions tranchées, écarts,
  points ouverts, lot par lot. Le meilleur point d'entrée pour comprendre l'existant.
- `docs/1-PRD-*` à `docs/7-ARCHITECTURE-*` — dossier de cadrage (produit, spec fonctionnelle,
  modèle de données, roadmap, stack & RGPD, UI/UX, architecture).

> Le **déploiement** (build natif EAS de l'app, conteneurisation de l'API, infra Scaleway,
> secrets de prod) sera documenté séparément dans `DEPLOYMENT.md`.
</content>
