# Stack technique & RGPD/Sécurité — Horse Performance Tracker

> **Document 5/7** du dossier de cadrage. Voir aussi : PRD, Spec fonctionnelle, Modèle de données, Roadmap de build, UI/UX, Architecture.
> Hébergement : **Scaleway** (région fr-par). Construit par Claude Code, validé lot par lot par le dev.

---

## 1. Principes directeurs

Trois principes dictent la stack :

1. **Client en ligne** — la saisie se fait en fin de séance ; l'enregistrement requiert une connexion (avec brouillon local + réessai sur coupure passagère pour ne jamais perdre une saisie). Pas d'offline-first.
2. **RGPD & souveraineté** — tout en UE, sous-traitants US minimisés et documentés.
3. **TypeScript de bout en bout** — un seul langage app/serveur, types partagés, code homogène et facile à relire (adapté au build Claude Code + validation dev).

---

## 2. Vue d'ensemble

```
┌──────────────────────────────┐
│  App mobile (React Native)   │
│  - État local de saisie      │
│  - Brouillon + réessai envoi │
│  - Victory Native (graphes)  │
└───────────────┬──────────────┘
                │ HTTPS (auth, enregistrement, lecture, bilan)
┌───────────────▼──────────────────────────────┐
│  API NestJS (Serverless Containers, fr-par)   │
│  - Auth (Passport JWT, argon2)                │
│  - Enregistrement séance + lecture données    │
│  - Entitlements abonnement                    │
│  - Webhooks Mollie                            │
│  - Appel Mistral (bilan augmenté, à la demande)│
└───┬───────────────┬───────────────┬───────────┘
    │               │               │
┌───▼────┐   ┌──────▼──────┐   ┌────▼─────────────┐
│Postgres│   │Object Storage│   │Serverless Jobs   │
│(Scaleway)  │(PDF de bilan)│   │(génération bilan)│
└────────┘   └─────────────┘   └──────────────────┘
   Secret Manager · Container Registry · Cockpit · VPC/IAM
   ─→ Mistral API (La Plateforme, UE) : bilan augmenté
```

---

## 3. Stack par couche

### 3.1 Application mobile
- **React Native + Expo** (EAS pour builds & OTA), TypeScript ; **Expo Router** (navigation) ; **TanStack Query** (état serveur / cache de lecture).
- **Client en ligne** : état de saisie en mémoire, **brouillon local + réessai** de l'envoi sur coupure passagère ; cache de lecture standard pour la fluidité (feed, graphes).
- **Graphes** : Victory Native (Skia) pour les courbes héros.
- **Cartes partageables** : capture d'une vue stylée via `react-native-view-shot` (client-side en v1).

### 3.2 Backend
- **Node.js + TypeScript**, framework **NestJS** (structuré, opinionated).
- **ORM Drizzle** (SQL-first, types transparents, migrations lisibles).
- Rôle : auth, enregistrement & lecture des données, entitlements, webhooks, signature des accès Object Storage, déclenchement de la génération de bilan.

### 3.3 Base de données
- **PostgreSQL** (relationnel, conforme au modèle d'entités).
- **Démarrage : Serverless SQL Database** (Scaleway) — managée, auto-scalable, facturée à l'usage. Ops et coût minimaux en début de vie.
- **Évolution : Managed PostgreSQL** (réplicas Multi-AZ) quand la charge se stabilise. Migration Postgres→Postgres à faible friction.

### 3.4 Authentification
- **Auth NestJS native** : Passport + **JWT access/refresh** (rotation des refresh tokens), mots de passe en **argon2**. Refresh token stocké dans le **secure storage** de l'appareil. Pattern éprouvé pour un client mobile.
- Toute la PII d'identité reste dans Postgres/Scaleway. **Aucun fournisseur d'auth US** (Auth0, Clerk, Firebase écartés pour raisons RGPD).
- **Autorisation / comptes invité (pro)** : rôle **lecture seule** scopé à **un cheval** (invitation par e-mail, révocable) ; aucun droit d'écriture. Les endpoints vérifient la portée (cheval autorisé) à chaque lecture.

### 3.5 Hébergement Scaleway (région fr-par)
| Service | Usage |
|---|---|
| **Serverless Containers** (GA v1) | API NestJS — sécurisé par défaut (sandbox kernel, patching OS), HTTPS-only, IAM, routage VPC |
| **Serverless Jobs** | Génération des PDF de bilan (tâche plus lourde) |
| **Serverless SQL Database** → Managed PostgreSQL | Données applicatives |
| **Object Storage** | PDF de bilan, futures vidéos (cartes partageables générées client-side en v1) |
| **Secret Manager** | Secrets (jamais dans le code) |
| **Transactional Email (TEM)** | E-mails transactionnels UE : vérification, réinitialisation, **invitation compte invité** |
| **Container Registry** | Images de déploiement |
| **Cockpit** | Logs, métriques, alertes |
| **VPC / Private Network + IAM** | Base hors internet public, accès en moindre privilège |

### 3.6 Assistant IA (Mistral)
- **API Mistral (La Plateforme)**, hébergée en **UE** — cohérent avec la souveraineté (Scaleway, Mollie).
- Modèle par défaut **Mistral Small** (bon ratio coût/qualité pour un bilan structuré) ; **version épinglée** (pas d'alias `-latest` pour éviter la dérive de modèle).
- Appel backend **à la demande uniquement** ; résultat **persisté** en Postgres (entité Bilan augmenté) → **pas de régénération** à la relecture.
- **Rate limiting** par utilisateur et garde-fous de coût.
- Contexte envoyé : données des dernières séances ; sortie = texte consultatif (bilan + recommandations), jamais une métrique.

---

## 4. Enregistrement d'une séance

La saisie se fait en fin de séance ; l'**enregistrement** est l'unique moment d'écriture serveur. Il déclenche, dans l'ordre :

1. **Persistance** : envoi de la séance à l'API → écriture en Postgres. **Clé d'idempotence** (UUID généré côté client) pour qu'un réessai après coupure ne crée pas de doublon.
2. **Proposition de partage** : à la confirmation, l'app propose de partager le **bilan de séance** (carte partageable, cf. Spec §5) sur les réseaux — record mis en avant s'il y en a un.

**Résilience (sans offline-first)** : la saisie en cours est tenue en **brouillon local** ; si l'enregistrement échoue (coupure passagère), l'app réessaie automatiquement et ne perd pas la saisie. Une connexion reste requise pour valider.

**Inviolabilité** : l'horodatage et la provenance (`live` / `déclaratif`) sont posés à l'enregistrement (cf. Modèle de données §2). Les séances restent immuables ; une édition trace sa `date_modification`.

---

## 5. Génération du bilan (PDF)

- **Pipeline HTML + CSS → PDF via Playwright** (rendu fidèle), exécuté en **Serverless Job** (charge ponctuelle, isolée de l'API).
- Sortie stockée sur **Object Storage** ; accès par **URL présignée** à durée limitée.
- Bilan construit **uniquement sur la couche objective** et sur les séances `live` (cf. Modèle de données).

---

## 6. Paiement & abonnement (Mollie)

- **Mollie** (entité UE, Pays-Bas) comme PSP : cohérent avec la souveraineté UE et **évite la commission IAP** des stores. Défendable pour un outil B2B coach, en particulier en UE (DMA).
- **Abonnement** via l'**API Subscriptions de Mollie**, avec **SEPA Direct Debit** comme rail récurrent privilégié (prélèvement automatique, mandat collant, frais plafonnés sur les montants récurrents) ; carte en complément. **Deux formules** : premium (mono-cheval) et pro (multi-chevaux + comptes invité).
- **Entitlements à 3 niveaux** (gratuit/premium/pro) stockés côté backend (Postgres) ; l'app lit l'entitlement au login.
- **Webhooks** Mollie (statut de paiement / de mandat) → mise à jour de l'entitlement.
- **Montants** paramétrables, fixés ultérieurement (gating à 3 niveaux, sans impact build).
- **RGPD** : Mollie est un sous-traitant **UE** → pas de transfert transatlantique sur la donnée de paiement. DPA signé, données transmises minimales (e-mail, jamais de données de cheval). Inscrit au registre des traitements.
- **TVA** : Mollie n'est pas merchant-of-record → facturation et TVA gérées par CraftData (simple en vente FR ; autoliquidation B2B intra-UE).
- La limite de Mollie (billing avancé : usage, proration fine, multi-devises) ne concerne pas un abonnement plat mono-tarif.
- **Upgrade depuis l'app** : le flux d'abonnement est **initié dans l'app** (depuis les fonctions premium grisées) et ouvre le **checkout Mollie** (navigateur in-app/externe) ; au retour, l'app déverrouille le premium via l'**entitlement**. Conforme UE/DMA, **sans achat in-app store** donc sans commission. **Repli** : IAP store si une politique de store l'impose hors UE (à n'activer que si nécessaire).

---

## 7. RGPD & sécurité (couche transverse)

### 7.1 Résidence & sous-traitants
- Tout en **UE / fr-par**. 
- Sous-traitants : **Scaleway (FR)** principal ; **Mollie (UE / Pays-Bas)** pour le paiement ; **Mistral (FR, La Plateforme)** pour l'assistant IA — tous encadrés par DPA, sans transfert hors UE ; **analytics UE** (Matomo auto-hébergé ou Plausible) — **jamais Google Analytics**.

### 7.2 Minimisation
- Collecte limitée : e-mail + nom. Les données du cheval ne sont pas des données personnelles.
- **Cas spécifique coach** : saisir le **nom d'un client** = traitement de PII de tiers → CraftData devient **sous-traitant**, le coach est responsable de traitement. Nécessite un **DPA avec les coachs** et, par minimisation, la possibilité d'utiliser des **libellés/initiales** plutôt que les noms réels.

### 7.3 Droits des personnes
- **Effacement** : suppression de compte et purge associée.
- **Portabilité** : export complet des données de l'utilisateur.
- **Consentement** explicite pour tout analytics.

### 7.4 Mesures techniques
- TLS partout (containers HTTPS-only) ; chiffrement **au repos** (DB + Object Storage).
- Secrets dans **Secret Manager**, jamais en dur.
- **IAM en moindre privilège**, base sur **Private Network** (hors internet public).
- Rate limiting, validation stricte des entrées, **argon2** pour les mots de passe.
- L'**horodatage inviolable** du modèle sert aussi de **piste d'audit**.

### 7.5 Sauvegardes & continuité
- Backups automatiques (DB managée), restaurations testées ; **Glacier** pour la rétention longue.

### 7.6 Documents légaux
- Politique de confidentialité, CGU, **registre des traitements**, **DPA-type pour les coachs**. DPO probablement non obligatoire à cette échelle, mais **privacy-by-design** appliqué.

---

## 8. Environnements & déploiement

- **Mono-repo TypeScript** : `app/` (RN) + `api/` (NestJS) + `packages/shared/` (types & schémas partagés). Frontières de modules & contrats : cf. Architecture.
- **Outillage** : **pnpm** workspaces · **Node 20 LTS** · **Biome** (lint/format) · **Vitest** (tests).
- **Dev local** : **PostgreSQL via docker-compose** ; e-mails (vérif/reset/invitation) **stubés/loggés** en dev, **TEM** en prod ; secrets en `.env` (jamais commités).
- **Infra-as-Code** : Terraform (provider Scaleway) pour reproductibilité.
- **CI/CD** : build → Container Registry → déploiement Serverless Containers.
- **Environnements** : dev / staging / prod en **projets Scaleway séparés**, secrets isolés.
- **Observabilité** : Cockpit (logs, métriques, alertes).

---

## 9. Stack retenue & hors périmètre

**Retenu** : React Native/Expo · NestJS · Drizzle · PostgreSQL (Serverless SQL → Managed) · Auth NestJS (Passport JWT access/refresh) + argon2 · Serverless Containers + Jobs · Object Storage · **client en ligne (persistance à l'enregistrement)** · **Mollie (API Subscriptions + SEPA Direct Debit), facturation web** · **Mistral (La Plateforme, Mistral Small, UE) pour le bilan augmenté à la demande** · tout en fr-par.

**Hors périmètre v1 (post-v1)** : offline-first (SQLite + sync) si le terrain le réclame · Kubernetes Kapsule (si besoins d'orchestration) · vidéo · internationalisation.
