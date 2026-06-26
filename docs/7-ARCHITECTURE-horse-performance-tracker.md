# Architecture & conventions — Horse Performance Tracker

> **Document 7/7** du dossier de cadrage. Voir aussi : PRD, Spec, Modèle de données, Roadmap, Stack technique, UI/UX.
> **Ce document fixe des frontières et des conventions, pas un arbre de fichiers.** Le tracé réel du dépôt est **scaffoldé par les fondations (lots 0.1–0.3)** et évolue en codant. On fige ici ce qui doit rester stable : la couche de contrats partagés, le découpage en modules de domaine, la carte module↔lots, et les règles transverses.

---

## 1. Principes

- **Monorepo TypeScript** : `app/` (React Native) · `api/` (NestJS) · `packages/shared/` (contrats). Détail infra : Stack §8.
- **Monolithe modulaire** — pas de microservices (overkill à cette échelle). Un seul service API, découpé en **modules de domaine** internes.
- **Organisation par domaine** (feature-based), **pas par couche** : on regroupe par `sessions`, `horses`, `metrics`…, pas en `controllers/ services/ repositories` à la racine. Chaque domaine est un **module NestJS** côté api et un **dossier de feature** côté app.
- **Le contrat partagé est la colonne vertébrale** (§2) : app et api ne dupliquent jamais un type ; tout transite par `shared`.
- **Dépendances orientées** : `app → shared ← api`. Entre domaines, les dépendances pointent **vers le bas** (vers `sessions`/`shared`), jamais en cycle. Un domaine consomme un autre **via son service exposé**, jamais en lisant ses tables internes.

---

## 2. Couche de contrats partagés (`packages/shared`) — la pièce maîtresse

C'est ce qui transforme le **Modèle de données (doc 3)** en code unique partagé. Source de vérité en cascade :

```
Schéma Drizzle (DB, api)
   └─► Types TS dérivés         ──► importés par app ET api
   └─► Schémas Zod (validation) ──► validation runtime à chaque frontière d'API
```

`shared` contient :
- **Types d'entités** (Compte, Cheval, Séance, Obstacle, Tour, Combinaison réutilisable, Accès invité, Bilan augmenté…).
- **DTO d'entrée/sortie** d'API + leurs **schémas Zod** (validation au bord).
- **Enums du référentiel** (types d'obstacle, types de séance, hauteurs, tiers) — Modèle §0.
- **Fonctions de calcul pures et testées** : taux de réussite (Modèle §7), hauteur maîtrisée (§10), dérivés sans-faute. **Une seule** implémentation → l'aperçu côté app et le calcul côté api ne peuvent pas diverger.

Règle : tout changement du modèle commence ici ; app et api suivent par les types.

---

## 3. Modules de domaine

| Module | Responsabilité (1 ligne) | Entités | Dépend de |
|---|---|---|---|
| `auth-account` | Comptes, auth (JWT), RGPD (suppression/export) | Compte | — |
| `horses` | Fiche cheval (CRUD), archivage | Cheval | auth-account |
| `sessions` | Saisie, édition/suppression, **intégrité & horodatage**, conventions de comptage | Séance, Obstacle, Tour | horses |
| `combinations` | Bibliothèque de combinaisons réutilisables | Combinaison réutilisable | auth-account |
| `metrics` | Hauteur maîtrisée, records/jalons, taux (dérivés) | (dérivé) | sessions, shared (calc) |
| `feed` | Composition du fil mono-cheval | (lecture) | sessions, metrics |
| `sharing` | Cartes partageables (bilan de séance simple, record) | (dérivé) | metrics, sessions |
| `analytics` | Heatmap, benchmark (diagnostic) | (dérivé) | sessions, combinations |
| `progression-report` | Bilan de progression (PDF/lien) | (dérivé) | metrics, sessions |
| `ai-bilan` | Bilan augmenté (Mistral), persisté | Bilan augmenté | sessions |
| `entitlements` | Tiers, Mollie, **garde de gating** | (tier sur Compte) | auth-account |
| `guest-access` | Invitations, **autorisation lecture seule** scopée à un cheval | Accès invité | horses, feed, metrics, analytics, entitlements |

**Surfaces app sans module backend dédié** : `history` (lecture des séances passées + leurs bilans, sur les endpoints de `sessions`/`sharing`/`ai-bilan`) et `onboarding` (flux app réutilisant `horses`/`sessions`).

**Transverses** : la **garde d'entitlement** (`entitlements`) protège les endpoints premium/pro (autorité serveur ; l'UI ne fait que griser) ; l'**inviolabilité/horodatage** est portée par `sessions` (toute écriture passe par son service, qui pose horodatage + provenance ; une édition trace `date_modification`).

---

## 4. Carte module ↔ lots

| Module | Lots (Roadmap) |
|---|---|
| `shared` | 0.2, 0.3 |
| `auth-account` | 1.1, 1.2, 1.3 |
| `app` (coquille, nav, écrans) | 1.4, + tranche front de chaque lot |
| `horses` | 2.1, 4.3 (archivage) |
| `sessions` | 2.2, 2.3, 2.4 |
| `combinations` | 2.5 |
| `feed` | 3.1 |
| `metrics` | 3.2 |
| `sharing` | 3.3 |
| `history` (surface) | 3.4 |
| `onboarding` (surface) | 3.5 |
| `entitlements` | 4.1, 4.2 |
| `progression-report` | 4.4 |
| `ai-bilan` | 4.5 |
| `guest-access` | 4.6 |
| `analytics` | 5.1, 5.2 |

Le scaffolding (monorepo, outillage, squelette des modules vides) est posé par les lots **0.1–0.3**. Chaque lot revient à « construire/étendre le module X + sa tranche de contrat dans `shared` ».

---

## 5. Conventions

- **Routes** : orientées ressource (`/horses`, `/horses/:id/sessions`, `/combinations`, `/horses/:id/guest-access`).
- **Validation** : Zod à **chaque** frontière d'API ; les DTO viennent de `shared`. Rien n'entre non validé.
- **Erreurs** : erreurs de domaine **typées** ; jamais de fuite d'interne. Les messages destinés à l'utilisateur sont écrits **de son côté de l'écran** (cf. UI/UX) — ils disent quoi faire, sans jargon ni excuse.
- **Idempotence** : clé d'idempotence (UUID client) sur la création de séance (Stack §4).
- **Règles métier** : dans les **services de domaine** ; les calculs purs (taux, maîtrise) **uniquement** dans `shared`.
- **Nommage** : modules en kebab-case ; types en PascalCase ; variables en camelCase.
- **Gating** : autorité **serveur** (garde d'entitlement) ; l'UI grise et déclenche l'upgrade, sans être la source de vérité.
- **Qualité de plancher** (par lot, cf. Roadmap) : états vides en invitations, erreurs explicites, brouillon + réessai à l'enregistrement.
- **Test par DoD** : chaque lot livre le test qui prouve sa DoD.
- **Journal de build** : à la livraison, l'agent ajoute une entrée à `docs/build-journal.md` (append-only) — lot, décisions tranchées et pourquoi, écarts, points ouverts. C'est le fil de continuité entre agents ; il vit dans le dépôt, **distinct des documents de cadrage** (qui restent des specs propres).

---

## 6. Scaffoldé par les fondations (et pas figé ici)

Les lots **0.1–0.3** posent le **squelette** : monorepo + outillage (pnpm, Node 20, Biome, Vitest, CI — cf. Roadmap « Setup ») ; `shared` (référentiel, types, Zod, calc) ; coquille `api` (NestJS + modules de domaine vides) + migrations Drizzle ; coquille `app` (Expo Router + TanStack Query + tab bar). Postgres tourne en local via docker-compose ; les e-mails sont stubés en dev.

L'**arbre de fichiers réel vit dans le dépôt**, pas dans ce document — ce qui évite l'architecture prématurée et la dérive d'un arbre figé en prose.

---

## 7. Ce qu'on évite délibérément

- **Microservices** ; **abstraction prématurée** ; **frameworks maison** génériques.
- **Découpage par couche** à la racine (controllers/services/repos) — on découpe par domaine.
- **Types dupliqués** entre app et api — `shared` est l'unique source.
- **Arbre de fichiers exhaustif figé d'avance** — il émerge en codant.
