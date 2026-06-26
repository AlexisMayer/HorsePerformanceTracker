# Modèle de données — Horse Performance Tracker

> **Document 3/7** du dossier de cadrage. Voir aussi : PRD, Spec fonctionnelle, Roadmap de build, Stack technique, UI/UX, Architecture.
> Clé de voûte du produit : le schéma conditionne le feed, les visualisations, le bilan et la frontière gratuit/premium/pro. On ne collecte pas rétroactivement un champ non demandé.

---

## 0. Référentiel (valeurs par défaut)

Figé pour garantir la cohérence des métriques entre utilisateurs ; ajustable sans casser le schéma.

**Hauteurs** — slider de **60 à 160 cm, pas de 5 cm**. (60-70 : croix/échauffement, jeunes chevaux · 80-130 : club/amateur · 135-160 : amateur élite/pro.)

**Types d'obstacles** — chips :
Croix · Vertical (Droit) · Oxer · Triple barre (Spa) · Mur · Rivière (bidet) · **Combinaison**.

La **Combinaison** est un **type-conteneur** (une ligne). Elle porte les mêmes champs qu'un obstacle classique (hauteur, répétitions, barres, refus), **plus** un champ `nombre d'éléments` (multiplicateur du dénominateur, §7) et, **au choix**, le détail des types et de l'ordre des éléments (enregistrable comme combinaison réutilisable). Les fautes restent au niveau de la combinaison, jamais par élément.

**Types de séance** — Plat · Gymnastique · Parcours · Concours.

---

## 1. Deux couches étanches

**Couche objective (colonne vertébrale).** Faits binaires ou numériques, indiscutables. Alimente courbes, heatmaps et bilan.

**Couche contexte (qualitatif).** Ressenti, énergie, note libre, marqueur de difficulté par obstacle. Vit **uniquement** dans l'entrée du feed comme légende. **Jamais agrégée** en métrique.

> Règle d'or : aucune donnée de la couche contexte ne devient une métrique, une courbe ou une ligne de bilan. On ne calcule jamais de « difficulté moyenne par type d'obstacle ».

*Le **bilan augmenté** (assistant IA, §3) est un **texte consultatif**, pas une métrique : il peut s'appuyer sur les deux couches comme contexte sans enfreindre cette règle, puisqu'il ne produit aucun agrégat.*

---

## 2. Intégrité & inviolabilité

- Les séances sont **horodatées et non éditables silencieusement** : une entrée est une trace contemporaine.
- Une modification d'une séance ancienne **affiche sa date de modification**.
- Chaque séance porte une **provenance** : `live` (contemporaine) ou `déclaratif` (amorçage / onboarding).
- Seules les séances `live` alimentent les **métriques et le bilan** ; le `déclaratif` nourrit le feed mais reste exclu des agrégats.
- L'inviolabilité vit au **niveau de la donnée** ; la **curation** (période/indicateurs d'un bilan) vit au **niveau du rapport**.

---

## 3. Entités & relations

L'unité atomique de l'entraînement est l'**Obstacle** ; celle du concours est le **Tour**. La séance est une **collection** : l'ordre des obstacles n'est pas significatif ; seule la combinaison porte une structure interne ordonnée.

```
Compte (Utilisateur)
 ├── e-mail · nom · password_hash · email_verified
 ├── type : amateur | coach
 ├── tier : gratuit | premium | pro
 ├── 1..N Cheval
 └── 0..N Combinaison réutilisable ← niveau COMPTE

Cheval
 ├── 1 Compte ; nom ; niveau : amateur | pro ; hauteur_de_référence (déclarative) ; [âge, race]
 ├── 0..N Accès invité (pro)
 └── 1..N Séance

Accès invité  ← lecture seule, pro uniquement (PAS un partage de propriété)
 ├── 1 Cheval (détenu par un compte pro) ; invité (compte/e-mail) ; statut
 └── portée : lecture du feed, analytique, historique + bilans simples
       (jamais : saisie, bilan augmenté, gestion, autres chevaux)

Séance
 ├── 1 Cheval ; date (immuable ; date_modification si édit) ; provenance live|déclaratif
 ├── type : Plat | Gymnastique | Parcours | Concours
 ├── ENTRAÎNEMENT (Plat/Gym/Parcours) : 0..N Obstacle (collection)
 ├── CONCOURS : 1..N Tour (collection)
 └── Contexte (0..1)

Obstacle  ← unité atomique de l'ENTRAÎNEMENT
 ├── 1 Séance
 ├── type ; hauteur ; répétitions
 ├── barres ; refus
 ├── [difficulté] (couche contexte, optionnel, jamais agrégé)
 └── si type = Combinaison :
       ├── nombre_d_éléments  (multiplicateur du dénominateur, §7)
       ├── [combinaison_ref] → Combinaison réutilisable (optionnel)
       └── [éléments] liste ordonnée de types (optionnel ; hérités si combinaison_ref)

Tour  ← unité atomique du CONCOURS
 ├── 1 Séance
 ├── hauteur (fixée par l'épreuve) ; barres ; refus
 └── sans_faute (dérivé : barres = 0 ET refus = 0)

Combinaison réutilisable
 ├── 1 Compte (PAS un cheval) ; nom
 ├── nombre_d_éléments ; éléments (liste ordonnée de types)
 └── PAS de hauteur (fournie à l'instanciation dans une séance)

Contexte de séance (couche qualitative)
 ├── ressenti_global (1-5, optionnel) ; énergie (optionnel) ; note (optionnel)

Record / Jalon (DÉRIVÉ — jamais saisi)
 └── calculé depuis les séances (meilleurs franchissements, premières fois, séries)

Bilan augmenté (assistant IA — PERSISTÉ, premium/pro)
 ├── 1 Séance ; date_génération ; modèle + version (Mistral)
 ├── contenu : bilan de la séance + recommandations pour la prochaine
 └── généré à la demande ; relu ensuite sans régénération
```

**Plat** = séance d'entraînement à **0 obstacle** : nourrit seulement fréquence/régularité.

Un **cheval appartient à un seul compte** (pas de partage en v1) : un demi-pensionnaire suit sa propre fiche, à l'historique indépendant.

**Champs techniques communs** à toutes les entités (implicites, non répétés ci-dessus) : `id`, `created_at`, `updated_at`. Le `niveau` du cheval est volontairement **grossier** (`amateur | pro`) en v1, extensible plus tard sans casse.

---

## 4. Structure de la séance

- **Entraînement (Plat / Gymnastique / Parcours)** : une **collection d'obstacles**. Le cavalier ajoute les obstacles l'un après l'autre — un obstacle simple est une entrée plate et rapide ; seule la combinaison ouvre des champs supplémentaires. L'ordre n'est pas conservé.
- **Concours** : une **collection de tours**, chacun avec sa hauteur et ses fautes.

La saisie, y compris la granularité par obstacle, est **gratuite** : elle génère la donnée. Le **premium** déverrouille l'**exploitation** (analytique + bilans) sur un cheval ; le **pro** ajoute le multi-chevaux et les **comptes invité** (accès client en lecture seule).

---

## 5. Champs — niveau Séance

| Champ | Saisie | Note |
|---|---|---|
| Date | auto (horodatée, immuable) | provenance live/déclaratif |
| Cheval | défaut = dernier monté | |
| Type de séance | preset : Plat / Gymnastique / Parcours / Concours | pilote la structure (obstacles vs tours) |
| Obstacles **ou** Tours | collection | selon le type de séance |

---

## 6. Champs des unités atomiques

### 6.1 Obstacle (entraînement)

| Champ | Saisie | Obligatoire |
|---|---|:---:|
| Type | chip | ✓ |
| Hauteur | slider (60→160) | ✓ |
| Répétitions | compteur, défaut 1 | ✓ |
| Barres | compteur | ✓ (0 par défaut) |
| Refus | compteur | ✓ (0 par défaut) |
| Difficulté | marqueur optionnel (couche contexte) | — |
| **Si Combinaison** : nombre d'éléments | compteur | ✓ |
| **Si Combinaison** : éléments (types + ordre) | optionnel | — |

### 6.2 Tour (concours)

| Champ | Saisie |
|---|---|
| Hauteur | slider (fixée par l'épreuve) |
| Barres | compteur |
| Refus | compteur |
| (Sans-faute) | **dérivé** : barres = 0 ET refus = 0 |

---

## 7. Conventions de comptage

À appliquer uniformément (elles déterminent silencieusement tous les taux) :

1. **Un refus représenté puis sauté compte comme 1 saut** (il reste au dénominateur).
2. **L'échauffement fait partie intégrante de la séance** (loggé, pas exclu).
3. **Dénominateur d'une combinaison = efforts, pas passages.** Le `nombre d'éléments` multiplie les répétitions : sans lui, une combinaison de 3 éléments avec 6 barres donnerait un taux négatif.

### Formules de réussite (entraînement)
- **Obstacle simple** : `(répétitions − barres − refus) / répétitions`
- **Combinaison** : `(répétitions × éléments − barres − refus) / (répétitions × éléments)`

Le dénominateur est **exact** (= les répétitions saisies).

---

## 8. Combinaisons réutilisables

Seules les **combinaisons** ont une structure qu'on rejoue d'une séance à l'autre. La séance, elle, est une collection jetable (rien à réutiliser). La bibliothèque de compte stocke donc des **combinaisons réutilisables**.

| Champ | Contenu |
|---|---|
| Nom | auto (« Double 1 », « Triple oxer »), renommage optionnel |
| Nombre d'éléments | structure figée |
| Éléments (types + ordre) | structure figée |
| Hauteur | **non stockée** — fournie à l'instanciation dans une séance |

- **Portée compte** (partagée entre chevaux) : un coach rejoue la même combinaison sur plusieurs chevaux sans la ressaisir ; seule l'instanciation est liée à un cheval.
- **Instanciation** : en ajoutant un obstacle de type Combinaison, on sélectionne une combinaison réutilisable (`combinaison_ref`) et on ne renseigne que la **hauteur** (+ répétitions, fautes).
- **Création** : une combinaison détaillée dans une séance peut être enregistrée comme combinaison réutilisable.
- **Modification** : modifier une combinaison réutilisable en crée une **nouvelle** (pas de versioning). L'identité d'une combinaison est donc stable, ce qui garantit la fiabilité du benchmark.

---

## 9. Métriques dérivées (jamais saisies)

| Métrique | Formule | Source | Fiabilité |
|---|---|---|---|
| Taux de réussite par obstacle | voir §7 (simple / combinaison) | entraînement, par type × hauteur | Exacte |
| Taux de sans-faute | tours sans faute / tours | Concours | Fiable — bilan |
| Hauteur max franchie | sur obstacles/tours | sauf Plat | Exacte |
| **Hauteur maîtrisée** | voir §10 | sauf Plat | Conservatrice — feed + bilan |
| Fréquence / régularité | sur dates de séance | tout | Exacte |
| Heatmap type × hauteur × résultat | agrégation des obstacles | sauf Plat | Exacte (Combinaison = sa propre ligne) |
| Progression à combinaison constante | réussite d'une combinaison réutilisable suivie dans le temps | combinaisons réutilisables | Bonne — benchmark |
| Record / jalon | extremum/événement sur l'historique | tout | Exacte |

La faute étant attribuée à l'obstacle précis (oxer 110, pas un agrégat), heatmap et taux de réussite sont exacts.

---

## 10. Définition de « hauteur maîtrisée »

> Une hauteur **H** est maîtrisée quand le cheval y a réalisé **≥ 3 franchissements propres, sur ≥ 2 séances**.

- **Franchissement propre** = un effort sans faute. Obstacle simple à H : `répétitions − barres − refus` efforts propres.
- **Combinaison** : comptée seulement si l'entrée est **sans faute** (passage propre de la ligne entière), à **sa hauteur** (valeur unique saisie pour la ligne) — règle conservatrice, car on n'attribue pas la faute par élément.
- **Tour de concours** sans-faute : compte comme franchissement propre à la hauteur de l'épreuve.

La hauteur maîtrisée est un **plancher conservateur** ; le **record** (meilleur franchissement propre unique) encaisse l'exploit ponctuel. L'une rassure (bilan), l'autre célèbre (feed/partage).

---

## 11. Décisions data ouvertes

Aucune.
