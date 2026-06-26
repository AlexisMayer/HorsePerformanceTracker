# Spec fonctionnelle — Horse Performance Tracker

> **Document 2/7** du dossier de cadrage. Voir aussi : PRD, Modèle de données, Roadmap, Stack technique, UI/UX, Architecture.
> Décrit le **comportement** des fonctionnalités. La structure des données est dans le Modèle de données.

---

## 1. Architecture de navigation

Le **cheval est l'axe primaire** de l'app (conséquence du feed mono-cheval).

- Entrée → **liste / sélecteur de chevaux** (1 cheval en gratuit/premium, N en pro).
- Accueil par cheval → **feed** + **graphes héros** + bouton de saisie.
- La bibliothèque de **combinaisons réutilisables** est au niveau du compte (transversale aux chevaux).
- Coquille : tab bar **Feed · Historique · Analytique · Profil** + **bouton de saisie central** ; sélecteur de cheval en en-tête (cf. UI/UX §5).
- **Historique** donne accès aux séances passées et à leurs **bilans** (simple ✓ / augmenté ✦).
- Profil / compte → tier (gratuit/premium/pro), type (amateur/coach).

---

## 2. Onboarding & première séance

Objectif : **sortir de l'onboarding avec une récompense déjà vue**, jamais avec seulement des champs remplis.

### 2.1 Bifurcation initiale
Première question : *« Tu montes ton/tes cheval(aux), ou tu travailles des chevaux pour des clients ? »*

- **Amateur** → chemin court.
- **Coach** → chemin configuration + aperçu de bilan.

### 2.2 Chemin amateur
1. Création du **premier cheval, minimale** : nom + niveau + hauteur de référence. (Âge, race… optionnels, différés.)
2. **Question de référence** : « Quelle hauteur ton cheval franchit-il proprement aujourd'hui ? » → crée une **ligne de départ** (point déclaratif).
3. **Première séance guidée** (tunnel pas-à-pas, plus explicatif que le mode courant) → crée le premier actif réutilisable (séance duplicable + combinaison réutilisable enregistrable).
4. Atterrissage sur le **feed** affichant déjà la ligne de départ.

### 2.3 Chemin coach
1. Configuration tolérée plus riche : plusieurs chevaux, premières combinaisons réutilisables.
2. **Aperçu d'un bilan** tôt (même sur données de démo) → montre le livrable client avant toute saisie réelle. Levier de conversion principal.

### 2.4 Règle data (cf. inviolabilité)
La ligne de départ et toute séance saisie « de mémoire » sont **déclaratives**, marquées « antérieures à l'app », et **exclues des agrégats et du bilan**.

---

## 3. Saisie d'une séance (le cœur de produit)

Cible : **< 30 s** sur une séance simple, en limitant texte libre, formulaires complexes et écrans multiples.

### 3.1 Deux structures selon le type
Le **type de séance** détermine la structure saisie :

- **Entraînement (Plat / Gymnastique / Parcours)** : on **ajoute les obstacles** l'un après l'autre (l'obstacle est l'unité). Plat = aucun obstacle (régularité seule).
- **Concours** : on **ajoute les tours** (le tour est l'unité).

### 3.2 Saisir un obstacle (entraînement)
À la fin de la séance, le cavalier ajoute chaque obstacle puis passe au suivant (ou au même à une autre hauteur) :

`type · hauteur · répétitions · barres · refus` (+ marqueur de difficulté optionnel).

- **Combinaison** : mêmes champs + **nombre d'éléments** dans la ligne, et **au choix** : sélectionner une **combinaison réutilisable** ou détailler les types/ordre (enregistrable). Les fautes restent au niveau de la combinaison.
- Le **dénominateur est exact** (= répétitions) : plus d'estimation du nombre de sauts.
- Raccourci clé : « **même obstacle, hauteur + 5** » pour dupliquer une entrée en montant la barre.

### 3.3 Saisir un tour (concours)
`hauteur (épreuve) · barres · refus` → le **sans-faute** est dérivé. Plusieurs tours/épreuves possibles dans une même séance.

### 3.4 Boucle nominale (séance ≈ la précédente)
1. Ouvrir la saisie sur un cheval.
2. Séance **pré-remplie par duplication** de la précédente (entraînement).
3. L'utilisateur ne touche que les **deltas** (typiquement les hauteurs).
4. **Enregistrer** → persistance serveur, puis **proposition de partager le bilan de séance** sur les réseaux (cf. §5.4).

### 3.5 Granularité = choix de l'utilisateur
Une séance écolée tient en 1-2 obstacles ; une séance riche en 8-15. Le modèle **scale avec ce que le cavalier a réellement fait**, et la saisie (granularité par obstacle comprise) est **entièrement gratuite**. Vigilance produit : l'ajout d'obstacle doit être **quasi instantané** (presets, compteurs « tap + », duplication d'entrée).

### 3.6 Saisies rapides (composants UI)
Presets, sliders, compteurs « tap + », chips, duplication d'obstacle et de séance, sélection d'une combinaison réutilisable. Le texte libre est **toujours optionnel et hors du chemin critique**.

### 3.7 Édition & suppression
- Une séance peut être **éditée** : jamais silencieusement — la modification trace sa `date_modification` (cf. inviolabilité, Modèle de données §2).
- Une séance peut être **supprimée** par son propriétaire ; ses contributions aux métriques et records sont retirées.
- Les séances `déclaratives` (amorçage) suivent les mêmes règles.

---

## 4. Combinaisons réutilisables

### 4.1 Principe
Seules les **combinaisons** se rejouent d'une séance à l'autre. Une **combinaison réutilisable** stocke la structure d'une combinaison (nombre d'éléments + types/ordre), **sans la hauteur**. En ajoutant un obstacle de type Combinaison, on en sélectionne une et on ne renseigne que la **hauteur** (+ répétitions, fautes). La collection d'une séance, elle, n'est pas réutilisable.

### 4.2 Portée
La bibliothèque appartient au **compte**, pas au cheval : un coach rejoue la même combinaison sur plusieurs chevaux sans la ressaisir.

### 4.3 Comportements à cadrer
- **Tri anti-bloat** : liste triée par usage (récentes, plus utilisées).
- **Modification** : modifier une combinaison réutilisable en crée une **nouvelle** (pas de versioning) → identité stable, benchmark fiable.
- **Création** : une combinaison détaillée dans une séance peut être enregistrée comme combinaison réutilisable.

### 4.4 Gratuit vs payant
- Gratuit : bibliothèque **limitée en nombre**.
- Premium / Pro : bibliothèque **illimitée**.

---

## 5. Feed & visualisations héros

Principe directeur : **montrer la maîtrise, pas l'activité** (une courbe de hauteur brute par jour zigzague et donne une fausse impression de stagnation). Contrainte mobile : **2-3 surfaces maximum**.

### 5.1 Feed (mono-cheval)
- Un **fil par cheval**, vu à chaque ouverture → cœur de la rétention.
- Chaque séance = une entrée : **faits objectifs en avant** (hauteur, sans-faute, fautes), **contexte qualitatif en légende** (emoji ressenti, note).
- **Injection de jalons** dans le fil (« 🎉 Nouveau record — 120 sans-faute »).
- Une séance de **Plat** (0 obstacle) apparaît comme une **entrée de régularité** (pas de hauteur/fautes à afficher).
- Fonctionne dès la séance n°1.

### 5.2 Graphes héros (2)
1. **Courbe de hauteur maîtrisée** — le plafond fiable (pas la hauteur brute), avec le grand chiffre du jour (« maîtrisée : 115 cm »).
2. **Records & jalons** — vitrine à trophées (plus haut sans-faute, premières fois, séries propres).

Le **taux de réussite n'a pas de graphe propre** (déjà encodé dans la hauteur maîtrisée).

### 5.3 Exclu du set héros (→ analytique premium & pro / v2)
Heatmap type × hauteur, benchmark à combinaison constante : outils de **diagnostic**, pas de progression émotionnelle.

### 5.4 Bilan de séance (carte partageable)
À l'**enregistrement** de chaque séance, l'app propose de partager un **bilan de séance simple** : une carte récap (ce qui a été travaillé, hauteurs, taux de réussite) avec le **record mis en avant** s'il y en a un. C'est une *proposition* non intrusive, facilement ignorée pour éviter la lassitude — pas un bouton « exporter » enfoui. Disponible pour **tous les comptes**.

Les comptes **premium/pro** peuvent en plus générer un **bilan augmenté** par l'assistant IA (§7).

> Trois objets distincts : le **bilan de séance simple** (carte, gratuit), le **bilan augmenté** (IA, §7, premium/pro) et le **bilan de progression** (§6, rapport multi-séances, premium/pro).

### 5.5 Honnêteté vs encouragement
La hauteur maîtrisée peut *redescendre* (régression, reprise post-blessure) ; mais le **record absolu reste gravé** — l'accomplissement ne s'efface jamais.

---

## 6. Bilan de progression

Artefact autonome (PDF ou lien web), professionnel, destiné à quelqu'un **sans l'app** (typiquement le client d'un coach). Bâti **uniquement sur la couche objective** (jamais ressenti ni notes privées). Disponible en **premium** (rapport personnel, mono-cheval) et **pro** (multi-chevaux). Pour le client d'un coach pro, l'accès passe surtout par le **compte invité** (§9.5, accès vivant) ; le rapport exporté reste utile pour un client **sans l'app**.

### 6.1 Usage
L'entraîneur génère le bilan « n'importe quand » pour son client — c'est un **livrable de service récurrent**, pas un document de vente. En **premium** (amateur mono-cheval), le même rapport sert de **bilan personnel** de progression. Contexte non adversarial : le client veut voir progresser son cheval, le coach veut démontrer la valeur de son travail. Il met en avant la **trajectoire** (l'émotion) et la **régularité** (la preuve du travail fourni, donc la justification des honoraires).

### 6.2 Structure (sections)
1. Identité — fiche cheval.
2. Niveau démontré — hauteur maîtrisée + plus haut franchissement propre en concours.
3. Performance concours — tours, sans-faute par hauteur, résultats dans le temps.
4. Régularité & suivi — fréquence/continuité (cœur du bilan).
5. Trajectoire — courbe de hauteur maîtrisée + tendance.
6. Période — fenêtre documentée, nombre de séances.

### 6.3 Curation
Le coach choisit **période** et **indicateurs** présentés (curation au niveau rapport) ; la donnée sous-jacente reste inviolable.

### 6.4 Trous assumés
- **Vidéo** non capturée (évolution post-v1 : attacher une vidéo à un record pour enrichir le bilan).
- **Santé/vétérinaire** hors périmètre : registre de **performance** uniquement.

---

## 7. Assistant IA — bilan augmenté (premium/pro)

Un assistant alimenté par IA (Mistral, hébergé en UE) qui produit, pour une séance, un **bilan augmenté** : une analyse de la dernière séance + des **recommandations pour la prochaine**.

### 7.1 Déclenchement (à la demande)
- Proposé à l'**enregistrement** d'une séance, aux comptes **premium/pro**.
- **Généré uniquement sur action explicite** de l'utilisateur (bouton « Générer le bilan augmenté ») — jamais automatiquement, pour éviter les appels inutiles.

### 7.2 Entrée / sortie
- **Contexte fourni à l'IA** : les données des **dernières séances** (couche objective + contexte qualitatif, comme matière narrative).
- **Sortie** : bilan de la dernière séance + recommandations pour la suivante.
- C'est un **texte consultatif** clairement **généré par IA**, à valider par le cavalier/coach (cf. principe « assister sans remplacer »). Mention que ce n'est pas un avis vétérinaire ni un substitut au coach.

### 7.3 Persistance (relecture sans régénération)
- Le bilan augmenté est **enregistré** (lié à la séance, §Modèle de données).
- Il est **relisable à la séance suivante** (« recommandations de la dernière fois ») **sans nouvel appel IA**.

### 7.4 Gratuit vs premium/pro
- **Gratuit** : bilan de séance **simple** (§5.4) uniquement.
- **Premium/Pro** : bilan **augmenté** sur demande.

---

## 8. Synthèse du gating gratuit / premium / pro

| Fonction | Gratuit | Premium | Pro |
|---|---|:---:|:---:|
| Chevaux | 1 | 1 | Illimité |
| Saisie (granularité par obstacle incluse) | ✓ | ✓ | ✓ |
| Feed, héros, cartes partageables | ✓ | ✓ | ✓ |
| Historique conservé | illimité | illimité | illimité |
| Combinaisons réutilisables | limitée | illimitée | illimitée |
| Bilan de séance **simple** (carte partageable, §5.4) | ✓ | ✓ | ✓ |
| Bilan de séance **augmenté** (assistant IA, §7) | — | ✓ | ✓ |
| **Bilan de progression** (rapport multi-séances, §6) | — | ✓ | ✓ |
| Analytique de diagnostic (heatmap, benchmark) | — | ✓ | ✓ |
| Comptes invité (accès client, lecture seule) | — | — | ✓ |
| Multi-chevaux | — | — | ✓ |

La **saisie** et la **boucle gratuite** (feed, héros, cartes) ne sont jamais verrouillées — elles génèrent la donnée. Le **premium** déverrouille l'**exploitation** (analytique + bilans) sur **un cheval** ; le **pro** ajoute le **multi-chevaux** et les **comptes invité** (accès client).

**Trois bilans à ne pas confondre :**
- **Bilan de séance simple** (§5.4) — carte récap partageable d'**une** séance, proposée à l'enregistrement. **Gratuit**, tous comptes.
- **Bilan de séance augmenté** (§7) — analyse IA d'**une** séance + recommandations, **à la demande**, persisté. **Premium/Pro**.
- **Bilan de progression** (§6) — rapport **multi-séances** sur une période, exporté (PDF/lien). **Premium/Pro**.

---

## 9. Comptes, chevaux & abonnement

### 9.1 Compte & authentification
- **Inscription** e-mail + mot de passe, **connexion**, **réinitialisation** de mot de passe, **vérification** d'e-mail.
- **Suppression de compte** (droit à l'effacement) : purge des données associées.
- **Export** complet des données de l'utilisateur (portabilité).

### 9.2 Gestion des chevaux
- **Fiche cheval** : création (minimale en onboarding), édition (nom, niveau, âge, race, hauteur de référence).
- **Archivage** d'un cheval (vendu/parti) : passe en **lecture seule**, son historique est conservé, il sort de la liste active et ne compte plus dans le quota de chevaux. Réversible.
- **Suppression** d'un cheval (et de son historique) possible (RGPD).
- **Pas de cheval partagé en v1** : chaque compte suit ses propres chevaux. Un demi-pensionnaire crée **sa propre fiche**, à l'historique indépendant de celui du propriétaire.

### 9.3 Abonnement (côté app)
- L'app **affiche le statut** (gratuit / premium / pro) et **lit l'entitlement** au login.
- **Upgrade depuis l'app** : un point d'entrée d'upgrade (depuis les fonctions grisées, §9.4) propose **premium** ou **pro** et ouvre le **checkout Mollie** (navigateur in-app/externe) ; au retour, le tier choisi est **déverrouillé** via l'entitlement. Conforme UE/DMA, sans commission de store (repli IAP documenté côté Stack §6 si une politique de store l'impose hors UE).
- Gestion et résiliation depuis l'app (renvoi vers l'espace de gestion Mollie).

### 9.4 Fonctions payantes verrouillées (levier de conversion)
Les fonctions payantes — **analytique de diagnostic, bilan augmenté (IA), bilan de progression** (premium) et **multi-chevaux, comptes invité** (pro) — sont **visibles mais grisées/verrouillées** pour les comptes gratuits, avec un aperçu et une incitation à passer au tier qui les débloque. Toucher une fonction verrouillée déclenche le flux d'upgrade (§9.3) vers **premium** (analytique, bilans) ou **pro** (multi-chevaux, comptes invité). La **saisie** et la **boucle gratuite** (dont le bilan de séance **simple**) ne sont jamais verrouillées.

### 9.5 Comptes invité — accès client (pro uniquement)
Un coach **pro** associe à une **fiche cheval** un **compte invité** pour son client : une fenêtre vivante sur la progression, qui remplace l'envoi de rapports.

- **Mise en place** : le coach invite le client (par e-mail) sur un cheval donné ; le client **installe l'app**, crée/relie son compte et obtient l'accès.
- **Ce que voit l'invité** (du **seul** cheval partagé) : le **feed**, l'**analytique**, l'**historique des séances** avec les **bilans de séance simples**.
- **Ce qu'il ne peut pas faire** : **aucune saisie**, **pas de bilan augmenté (IA)**, pas de gestion (édition/suppression, combinaisons), pas d'accès aux autres chevaux du coach.
- **Modèle** : c'est un **accès en lecture seule** accordé par le compte pro, **pas un partage de propriété** — le cheval reste détenu et saisi par le coach (cohérent avec « pas de cheval partagé », §9.2). Un cheval peut porter **plusieurs** comptes invité (ex. propriétaire + cavalier) ; chacun révocable à tout moment.
- **Onboarding invité** : à l'installation via l'invitation, le client **saute la création de cheval** et atterrit directement sur le cheval partagé, en lecture seule.
- **RGPD** : le client accède à des données le concernant (son cheval) ; l'accès est traçable et révocable.
