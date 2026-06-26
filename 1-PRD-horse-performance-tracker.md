# PRD — Horse Performance Tracker

> **Document 1/7** du dossier de cadrage. Voir aussi : Spec, Modèle de données, Roadmap, Stack technique, UI/UX, Architecture.
> Discipline : CSO (Concours de Saut d'Obstacles). Éditeur : CraftData.
> Statut : socle validé.

---

## 1. Vision & positionnement

**Le carnet qui rend la progression visible (rétention par l'émotion) et la rend démontrable dans un bilan professionnel (monétisation par l'abonnement + moat par l'historique).**

Transformer les séances quotidiennes de CSO en données exploitables pour piloter la progression du cheval, sans jamais devenir un simple journal numérique ni une plateforme d'analyse aride.

### Deux jobs-to-be-done, séquencés (pas simultanés)

1. **Voir progresser son cheval** — le coin d'entrée. Disponible dès le jour 1, il crée l'habitude, fait revenir l'utilisateur et accumule la donnée.
2. **Démontrer la progression** — débloqué par l'historique accumulé : l'entraîneur partage la progression avec ses clients via un **accès vivant (compte invité)** et des **bilans** (fidélisation, justification des honoraires).

**Conséquence structurante** : tout ce qui est loggé dès le jour 1 doit déjà pouvoir alimenter le bilan, même si le bilan n'est pas encore généré. On ne collecte pas rétroactivement une donnée historique.

---

## 2. Problème

Les cavaliers et propriétaires de CSO suivent leurs séances de façon informelle : notes dispersées, fonctionnement au ressenti, pas d'historique exploitable, pas d'indicateurs fiables. Il en résulte des entraînements peu structurés, des axes de progression difficiles à identifier, une perte d'information dans le temps, et une difficulté à communiquer la valeur et l'évolution du cheval.

Le produit doit répondre simplement à : quels exercices fonctionnent pour ce cheval ? quelle hauteur est maîtrisée aujourd'hui ? le cheval progresse-t-il réellement ? que travailler ensuite ?

---

## 3. Marché & défensibilité

### Paysage concurrentiel
Le créneau « tracker de progression CSO **sans capteur** » est vide ; les acteurs existants occupent d'autres cases :

- **Equisense** — capteur matériel (cadence, enchaînements, fréquence cardiaque, nombre de sauts) ; donnée captée automatiquement.
- **Equilab** — tracking de séance GPS/capteurs (distance, vitesse, allures).
- **Horsing Up** — gestion de centre équestre (côté club).
- **Appaloo / R.A.Y.A** — bibliothèques de contenu (exercices, programmes vidéo).

Personne ne possède le carnet de progression CSO orienté **performance à l'obstacle**, sans hardware.

### Le piège et le moat
Sans capteur, **chaque donnée vient d'une saisie manuelle** — c'est l'ouverture *et* la contrainte centrale. La feature « logger manuel » n'est pas défendable (un incumbent l'ajoute en un sprint). La vraie défensibilité est le **lock-in par l'historique accumulé** : deux ans de progression d'un cheval ne se recommencent pas ailleurs, et aucun concurrent ne peut les copier rétroactivement. Cet historique est aussi ce qui alimente l'**accès client (compte invité)** et le **bilan de progression** — le cœur de l'offre de l'angle entraîneur.

### Différenciation
Approche orientée progression · métriques spécialisées CSO · expérience mobile de saisie rapide · **assistant IA** (bilan + recommandations, hébergé en UE) · **accès client (compte invité)** · capacité à transformer les entraînements en un bilan partageable. Le moat n'est pas la feature, c'est l'historique.

---

## 4. La tension stratégique centrale

> Le produit a besoin de **beaucoup de données** pour que les visualisations aient de la valeur, mais chaque donnée **coûte de l'effort** de saisie, sans capteur pour l'automatiser.

Les deux risques produit — « trop de saisie » et « trop notebook » — sont les deux faces de cette contrainte. **Réponse de cadrage** : se positionner comme le logger CSO le plus rapide du marché, qui transforme la saisie en une histoire de progression visible et partageable. La récompense immédiate, c'est le feed et la carte partageable ; l'analytique riche vient ensuite.

---

## 5. Utilisateurs cibles

| Priorité | Cible | Rôle stratégique |
|---|---|---|
| **P1** | Cavaliers amateurs engagés en CSO (propriétaires, demi-pensionnaires, réguliers) | Moteur d'acquisition et de viralité |
| **P2** | Entraîneurs / coachs avec chevaux en pension | **Revenu principal** : abonnement **pro** pour donner à leurs clients un **accès vivant (compte invité)** et des **bilans**, fidéliser et justifier les honoraires |

**Boucle B2B2C** : le coach produit un bilan soigné → son client découvre l'app → s'inscrit sur le gratuit. Le coach est aussi le power-user naturel des combinaisons réutilisables et du multi-chevaux. Loin d'éloigner de P1, il y amène.

---

## 6. Principes produit

1. **Mobile first** — usage à l'écurie, en bord de carrière, entre deux séances.
2. **Saisie ultra-rapide** — objectif < 30 s sur une séance simple, via duplication intelligente et combinaisons réutilisables.
3. **Data visuelle** — la valeur perçue passe par la visualisation (progrès, faiblesses, régularité).
4. **Assister sans remplacer l'expert** — le produit fournit données, indicateurs, tendances, et un **assistant IA** qui propose un bilan de séance et des recommandations. Ces suggestions sont **assistives** : clairement générées par IA, à valider par le cavalier/coach, qui garde la décision finale.

---

## 7. Business model

**Freemium à trois niveaux.** Pas de dépendance à un partenaire institutionnel (FFE, assureur — écartés, trop contraignants).

| Tier | Contenu |
|---|---|
| **Gratuit** | 1 cheval · saisie complète (par obstacle) · combinaisons réutilisables (nombre limité) · feed · graphes héros · cartes partageables · **bilan de séance simple** · **historique illimité** |
| **Premium** | 1 cheval · **analytique de diagnostic** · **bilan de progression** · **assistant IA (bilan augmenté)** · combinaisons réutilisables illimitées |
| **Pro** | **Multi-chevaux** · analytique · **bilan de progression** · **assistant IA** · **comptes invité** (accès client en lecture seule) · combinaisons illimitées |

Le différenciateur premium → pro est le **multi-chevaux** (+ **comptes invité** : accès client). Montants fixés ultérieurement (gating à 3 niveaux, sans impact sur le build).

**Règles de frontière**
- Ne jamais gater la saisie de base ni la profondeur d'historique conservée — le gratuit accumule sans limite (moteur du moat). Les tiers payants déverrouillent l'**exploitation** de l'historique (analytique, bilans), pas sa conservation.
- Le partage social reste gratuit : c'est un levier d'acquisition.

**Monétisation** : deux segments, deux paliers.
- **Premium** — upsell B2C de l'**amateur engagé** (mono-cheval) qui veut analytique + rapport sur son cheval.
- **Pro** — **revenu principal** : l'**entraîneur** multi-chevaux qui donne à chaque client un **compte invité** (fenêtre vivante sur la progression de son cheval, plus collante qu'un rapport envoyé). Payeur clair, ROI évident, besoin récurrent qui entretient aussi la densité de données.
Le gratuit amateur reste l'acquisition et la base du funnel.

---

## 8. Métriques de succès (KPIs produit)

| Catégorie | Indicateur | Pourquoi |
|---|---|---|
| Activation | % de nouveaux comptes atteignant une 1ʳᵉ récompense visible en onboarding | Le pari friction/émotion se joue ici |
| Activation | % qui loguent une **2ᵉ** séance dans les 7 jours | Mesure si la duplication/combinaisons réutilisables réduit vraiment la friction |
| Engagement | Séances loguées / cheval actif / semaine | Densité de données = condition de toute la valeur |
| Rétention | Rétention M1 / M3 (cohortes) | L'inconnue qui fait vivre ou mourir l'économie unitaire |
| Monétisation | Conversion gratuit → premium (amateur) / pro (coach) ; ARPU | Valide les deux paliers de revenu |
| Viralité | Cartes partagées / utilisateur ; inscriptions issues d'un bilan coach | Mesure la boucle B2B2C |

---

## 9. Risques & limites assumées

- **Friction de saisie** (risque n°1) — mitigé par duplication, combinaisons réutilisables et saisie par obstacle rapide.
- **Données subjectives** — isolées en couche contexte, jamais agrégées en métrique.
- **TAM B2C amateur restreint** — atténué par l'angle entraîneur (payeur récurrent) et la boucle B2B2C.
- **Charge de saisie côté coach** — combinaisons réutilisables et duplication d'autant plus critiques.
- **Écran vide à l'inscription** — mitigé par ligne de départ, séance guidée, aperçu de bilan.

> Le pari tient à une seule question testable : **le crochet émotionnel bat-il la fatigue de saisie ?** Si oui, rétention et LTV remontent et tout le modèle respire.

---

## 10. Hypothèses & paris

Le pari se mesure **en marché** (via les KPIs §8), pas en entretien :

1. **Crochet émotionnel vs friction** — la progression visible suffit-elle à faire revenir loguer sans incitation ? (activation 2ᵉ séance, rétention M1/M3)
2. **Upsell premium (amateur)** — l'amateur mono-cheval paie-t-il pour l'analytique + le rapport sur son cheval ? (conversion gratuit → premium)
3. **Angle entraîneur (pro)** — le bilan récurrent convertit-il les coachs en abonnés pro ? (conversion, ARPU coach)
4. **Boucle B2B2C** — les clients de coachs s'inscrivent-ils après avoir reçu un bilan ?
