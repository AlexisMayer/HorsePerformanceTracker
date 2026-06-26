# Roadmap de build — Horse Performance Tracker

> **Document 4/7** du dossier de cadrage. Voir aussi : PRD, Spec, Modèle de données, Stack technique, UI/UX, Architecture.
> **Cible : un produit complet** (gratuit + premium + pro), construit par **petits lots à dépendances**, chacun développé puis validé avant le suivant. Chaque lot est volontairement **restreint et vérifiable**.

---

## Méthode de build

- **Développement** : Claude Code implémente **un lot à la fois**.
- **Validation** : le dev valide chaque lot (**gate**) via sa **Définition de terminé (DoD)** — critère observable. **Chaque DoD est prouvé par un test** livré avec le lot.
- Un lot n'est lancé que si ses **dépendances** sont prêtes.
- Chaque lot nomme **son module** (cf. Architecture §4).
- **Qualité de plancher** (sur chaque lot, pas en lot séparé) : états vides traités comme des invitations, erreurs explicites, brouillon + réessai à l'enregistrement, contraste plein soleil, cibles tactiles généreuses.

### Ce que reçoit l'agent pour un lot
La **fiche du lot** (périmètre + DoD + module) · les **pointeurs** vers les sections utiles des autres docs · le **Setup** (ci-dessous) · la **consigne de journal**. Tout ce qui n'est pas dans la fiche est **hors périmètre du lot**.

### Journal de build (obligatoire à la livraison)
À la livraison de chaque lot, l'agent **ajoute une entrée** à `docs/build-journal.md` (append-only) : *lot · date · décisions tranchées (et pourquoi) · écarts éventuels vs cadrage · points laissés ouverts*. Ce journal sert la relecture et les agents suivants. Il est **distinct des documents de cadrage**, qui restent des specs propres (le journal est un artefact du dépôt, pas du cadrage).

---

## Setup, outillage & infra de dev

- **Monorepo** : pnpm workspaces · **Node 20 LTS** · `app/` (Expo RN) · `api/` (NestJS) · `packages/shared/`.
- **Lint/format** : Biome. **Tests** : Vitest. **CI** : lint + test + build à chaque lot.
- **App** : Expo Router (navigation) · TanStack Query (données serveur).
- **DB dev** : **PostgreSQL local via docker-compose** (la prod = Scaleway) ; migrations Drizzle.
- **E-mails en dev** : **stubés/loggés en console** (vérification, reset, invitation) ; TEM Scaleway en prod.
- **Secrets** : `.env` local (jamais commité) ; Secret Manager en prod.
- **Tokens** (défauts ajustables) : access ~15 min · refresh ~30 j avec rotation.

---

## Périmètre (v1 complète)

- **Gratuit** (mono-cheval) : onboarding · saisie par obstacle · combinaisons réutilisables · feed · graphes héros · cartes partageables · bilan de séance simple · historique.
- **Premium** (mono-cheval) : analytique de diagnostic · bilan de progression · assistant IA (bilan augmenté).
- **Pro** : multi-chevaux · comptes invité (accès client en lecture seule).

La **saisie** et l'**historique** ne sont jamais gatés.

---

## Phase 0 — Fondations

- **0.1 Monorepo & outillage** — pnpm workspaces, Node 20, Biome, Vitest, CI ; packages `app/`/`api/`/`shared` vides ; docker-compose Postgres. *DoD : install, lint, test, build verts ; Postgres local démarre.* — `—`
- **0.2 Contrats `shared`** *(dép. 0.1)* — référentiel/enums (Modèle §0), types d'entités de base, Zod, fonctions de calcul pures + tests. *DoD : enums & types importables app+api ; le taux de réussite « obstacle simple » est calculé et testé.* — `shared`
- **0.3 Schéma DB & migrations** *(dép. 0.2)* — Drizzle : Compte, Cheval, Séance, Obstacle, Tour, Contexte (+ champs techniques). *DoD : la migration applique le schéma sur Postgres local.* — `db/shared`

## Phase 1 — Compte & accès

- **1.1 Auth** *(dép. 0.3)* — inscription, login, JWT access/refresh (argon2, rotation). *DoD : s'inscrire, se connecter, rafraîchir ; identifiants invalides rejetés.* — `auth-account`
- **1.2 Vérification e-mail & reset** *(dép. 1.1)* — liens stubés en dev. *DoD : vérifier son e-mail et réinitialiser son mot de passe via les liens (loggés en dev).* — `auth-account`
- **1.3 RGPD compte** *(dép. 1.1)* — suppression de compte + export des données. *DoD : la suppression purge les données ; l'export renvoie les données de l'utilisateur.* — `auth-account`
- **1.4 Coquille app & navigation** *(dép. 0.1, 1.1)* — tab bar (Feed · Historique · Analytique · Profil) + bouton de saisie central ; tokens UI (UI/UX §3) ; écrans d'auth câblés. *DoD : naviguer entre onglets ; se connecter/déconnecter depuis l'app.* — `app`

## Phase 2 — Capture (saisie)

- **2.1 Cheval** *(dép. 1.1, 1.4)* — fiche (création/édition), `niveau` **enum : amateur | pro**. *DoD : créer/éditer un cheval lié au compte.* — `horses`
- **2.2 Séance — modèle & création minimale** *(dép. 0.3, 2.1)* — écriture d'une séance (obstacles/tours), horodatage + provenance + **clé d'idempotence** ; chemin de création **minimal** (pas l'UX rapide). *DoD : enregistrer une séance d'entraînement persistée et horodatée via un chemin minimal ; un réessai ne crée pas de doublon.* — `sessions`
- **2.3 Saisie rapide** *(dép. 2.2)* — UX soignée : presets/sliders/compteurs/chips, duplication d'obstacle (« +5 cm ») et de séance, conventions de comptage. *DoD : une séance à plusieurs obstacles en quelques taps ; taux par obstacle exacts ; combinaison correctement dénombrée.* — `sessions` + `app`
- **2.4 Édition / suppression de séance** *(dép. 2.2)* — édition jamais silencieuse (`date_modification`), suppression retire les contributions. *DoD : éditer (date de modif visible) ; supprimer.* — `sessions`
- **2.5 Combinaisons réutilisables** *(dép. 2.3)* — bibliothèque compte, enregistrement depuis une séance, instanciation par la hauteur. *DoD : enregistrer une combinaison, l'instancier en ne saisissant que la hauteur ; la modifier en crée une nouvelle.* — `combinations`

## Phase 3 — Restitution gratuite

- **3.1 Feed mono-cheval** *(dép. 2.2)* — entrées (faits + contexte en légende), jalons, entrée de régularité (Plat). *DoD : chaque séance apparaît ; un record génère un jalon ; le Plat = régularité.* — `feed`
- **3.2 Métriques & graphes héros** *(dép. 2.2)* — hauteur maîtrisée (Modèle §10), records/jalons, courbe + vitrine. *DoD : courbe & records à jour ; la maîtrisée peut redescendre sans effacer le record.* — `metrics`
- **3.3 Cartes partageables** *(dép. 3.2)* — bilan de séance simple à l'enregistrement + carte de record, export image. *DoD : l'enregistrement propose un bilan partageable ; un record propose sa carte.* — `sharing`
- **3.4 Historique** *(dép. 3.1, 3.3)* — onglet : séances passées + accès aux bilans simples ; badge « augmenté » quand présent. *DoD : parcourir les séances et rouvrir un bilan simple.* — `history`
- **3.5 Onboarding** *(dép. 2.3, 3.1, 3.2)* — bifurcation amateur/coach, cheval minimal, ligne de départ (`déclaratif`), 1re séance guidée, récompense visible. *DoD : un nouvel utilisateur atteint une récompense visible sans champ superflu.* — `onboarding`

## Phase 4 — Monétisation

- **4.1 Tiers & entitlements** *(dép. 1.1)* — 3 niveaux, **garde de gating serveur** (autorité). *DoD : un endpoint premium/pro est refusé à un gratuit côté serveur.* — `entitlements`
- **4.2 Upgrade in-app & Mollie** *(dép. 4.1)* — fonctions grisées + flux d'upgrade (checkout Mollie, webhooks, déverrouillage). *DoD : un gratuit souscrit premium/pro depuis l'app ; au retour le tier est déverrouillé.* — `entitlements`
- **4.3 Archivage cheval (pro)** *(dép. 2.1, 4.1)* — archiver/désarchiver (lecture seule, hors quota). *DoD : archiver sort le cheval de la liste active et du quota ; réversible.* — `horses`
- **4.4 Bilan de progression** *(dép. 3.2, 4.1)* — générateur PDF/lien, sections, curation période/indicateurs. *DoD : générer un bilan soigné avec sélection de période.* — `progression-report`
- **4.5 Assistant IA — bilan augmenté** *(dép. 3.2, 4.1)* — Mistral (Small, version épinglée), à la demande, persisté, rate limiting, disclaimer. *DoD : générer sur demande, relire sans régénérer ; refusé au gratuit.* — `ai-bilan`
- **4.6 Comptes invité** *(dép. 4.1, 3.1, 3.2, 5.1)* — invitations (plusieurs par cheval), accès lecture seule scopé, onboarding invité, révocation. *DoD : inviter un client qui consulte le cheval en lecture seule (sans saisie ni autres chevaux) ; révocable.* — `guest-access`

## Phase 5 — Analytique de diagnostic

- **5.1 Heatmap type × hauteur** *(dép. 2.3)* — exacte (saisie par obstacle). *DoD : heatmap correcte ; grisée si gratuit.* — `analytics`
- **5.2 Benchmark à combinaison constante** *(dép. 2.5, 3.2)*. *DoD : progression d'une combinaison identifiée dans le temps.* — `analytics`

---

## Séquençage

Les phases s'enchaînent par dépendance : **Fondations → Compte → Capture → Restitution** (la boucle gratuite qui accumule la donnée et répond au pari central : la boucle émotionnelle retient-elle ?), puis **Monétisation** et **Analytique** qui exploitent l'historique. Deux traversées à respecter : **bilan/diagnostic n'ont de sens qu'avec des séances accumulées** (donc après la phase 3), et **les comptes invité (4.6) consultent l'analytique** → **5.1 précède 4.6**. Hors ces points, monétisation et analytique sont largement parallélisables une fois la phase 3 validée.
