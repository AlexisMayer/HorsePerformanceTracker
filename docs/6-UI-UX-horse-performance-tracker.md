# UI/UX — Direction & écrans symboliques — Horse Performance Tracker

> **Document 6/7** du dossier de cadrage. Voir aussi : PRD, Spec, Modèle de données, Roadmap, Stack technique, Architecture.
> **Ce document est une direction, pas une maquette.** Wireframes **symboliques** (structure, hiérarchie, intention), pas de vues haute-fidélité. Il fixe la personnalité, les tokens, les composants, la navigation et les écrans clés.

---

## 1. Principe directeur — « sportive-équestre »

Le produit a une double nature à réconcilier :
- **Émotionnel grand public** (feed, records, cartes partagées) → énergie, célébration, progression visible.
- **Outil pro crédible** (analytique, bilans, accès client invité) → lisibilité, sobriété, confiance.

La direction tient les deux : une base **énergique et célébrante** (pour la rétention) posée sur une **chaleur équestre** (cuir, sable, sous-bois) qui distingue l'app d'une app de fitness générique et donne du sérieux aux livrables pro. Identité **propre** au produit (distincte de la marque CraftData).

**Ce que ce n'est pas** : ni tableur aride, ni app de fitness fluo, ni le cliché « crème + serif + terracotta ». La chaleur vient des **matières équestres**, pas d'un filtre vintage.

---

## 2. Signature : la hauteur-comme-barre

L'élément mémorable, tiré du monde du CSO : **la hauteur est représentée comme une barre d'obstacle** posée sur deux chandeliers. La **hauteur maîtrisée** est la barre « validée » (pleine, vert sous-bois) ; le **record** est une barre plus haute, marquée d'une **plaque laiton**. La progression dans le feed se lit comme des barres qui montent. Ce motif unique porte l'identité partout : héros, cartes partageables, vitrine à records.

---

## 3. Tokens

### 3.1 Palette « Écurie chaleureuse » (mode clair uniquement)

| Rôle | Nom | Hex |
|---|---|---|
| Fond | Crème | `#FBF7F0` |
| Surface / carte | Sable | `#F1E9DA` |
| Bordure / séparateur | Sable foncé | `#E3D7C2` |
| **Accent primaire** (CTA, progression, maîtrisée) | Vert sous-bois | `#2E5D44` |
| Fond de progression | Vert pâle | `#DCE8DF` |
| **Célébration** (record, jalon) | Laiton | `#C8861E` |
| Secondaire (accents matière) | Cuir | `#7A5236` |
| Texte principal | Encre | `#20251F` |
| Texte secondaire | Encre douce | `#5C5A4E` |
| Sémantique faute / refus | Rouille (sobre) | `#B15533` |

- **Vert sous-bois** = couleur de marque et de réussite (pas de terracotta en accent de marque).
- **Laiton** strictement réservé à la **célébration** (records, jalons) → reste rare donc précieux.
- **Rouille** = sémantique faute/refus uniquement, jamais décorative.
- **État verrouillé** (fonctions payantes) : surface désaturée + voile crème (~55 %) + cadenas encre douce.

### 3.2 Typographie (identité propre)

- **Display & chiffres héros** : *Hanken Grotesk* (poids Bold/ExtraBold), une grotesk sportive et chaleureuse — porte la personnalité. Chiffres **tabulaires** pour les hauteurs et stats.
- **Corps & données** : *Inter* (15–16 px), très lisible en plein soleil et en tableaux ; chiffres tabulaires dans les tables.
- Échelle : Hero `48–64` · H1 `28` · H2 `20` · Corps `15–16` · Légende `13`.
- Le grand **chiffre de hauteur** (héros) est le moment typographique fort de l'app.

### 3.3 Forme & espacement

- **Rayons** : `12–16 px` sur cartes (doux, pas anguleux) ; pleins arrondis sur les compteurs « tap ».
- **Ombres** : très légères, chaudes (jamais de gris froid) — l'élévation se lit surtout par la couleur de surface.
- **Grille** : base `8 px`, marges latérales généreuses (pouce).
- **Icônes** : trait `1.75–2 px`, bouts arrondis ; un set cohérent, jamais d'emoji système sauf dans le ressenti du feed.

---

## 4. Composants clés (inventaire)

- **Chips de type** (Croix · Vertical · Oxer · Triple barre · Mur · Rivière · Combinaison) — sélection rapide.
- **Slider de hauteur** (60→160, pas de 5) avec gros chiffre tabulaire.
- **Compteurs « tap +/− »** (répétitions, barres, refus) — cibles tactiles généreuses.
- **Carte d'entrée de feed** : fait objectif en avant (hauteur, réussite), contexte qualitatif en légende (emoji ressenti, note).
- **Bloc héros « hauteur maîtrisée »** : grand chiffre + motif barre + courbe.
- **Vitrine à records** : plaques laiton (plus haut sans-faute, premières fois, séries).
- **Heatmap** type × hauteur : cellules remplies selon le taux de réussite (vert plein → vide).
- **Carte partageable** : format social, signature barre + nom du cheval + logo HPT discret.
- **Badges de bilan** : `✓ simple` (tous) · `✦ augmenté (IA)` (premium/pro).
- **État verrouillé** : aperçu grisé + cadenas → ouvre l'upgrade.
- **FAB de saisie** central (action cœur), **sélecteur de cheval** en en-tête, **tab bar** (§5).
- **Bandeau « lecture seule »** pour la vue invité.

---

## 5. Coquille de navigation

**Tab bar (4 onglets) + bouton de saisie central proéminent :**

```
  Feed        Historique     ( + )     Analytique     Profil
                            saisie
```

- **Feed** — accueil mono-cheval : héros + fil de la séance.
- **Historique** — toutes les séances passées et l'accès à leurs **bilans** (simple ✓ / augmenté ✦).
- **( + ) Saisie** — bouton central, l'action cœur, toujours à portée de pouce.
- **Analytique** — diagnostic (premium/pro ; grisé sinon).
- **Profil** — compte, tier, chevaux, abonnement, invités.
- **Sélecteur de cheval** : en **en-tête** (haut de Feed/Historique/Analytique), bascule rapide entre chevaux (pro).

**Coquille invité (lecture seule)** : mêmes onglets de consultation (Feed · Historique · Analytique) **sans** le bouton ( + ), **sans** bilan augmenté, **sans** sélecteur multi-chevaux — un bandeau « lecture seule » est visible.

---

## 6. Écrans symboliques

> Représentations schématiques (structure & intention), pas des maquettes.

### 6.1 Onboarding — bifurcation
```
┌───────────────────────┐
│        [ HPT ]         │
│                        │
│  Tu montes tes chevaux │
│  ou tu coaches des     │
│  clients ?             │
│                        │
│  ┌─────────┐ ┌───────┐ │
│  │ Cavalier│ │ Coach │ │
│  └─────────┘ └───────┘ │
│                        │
│  (puis : 1er cheval,   │
│   ligne de départ,     │
│   1re séance guidée)   │
└───────────────────────┘
```

### 6.2 Feed mono-cheval + héros
```
┌───────────────────────┐
│ ▼ Quibelle        ⚙︎  │  en-tête : sélecteur cheval
├───────────────────────┤
│ HAUTEUR MAÎTRISÉE      │
│   ▔▔▔▔ 115 ▔▔▔▔  ▲    │  signature : barre + chiffre
│  ╭──── courbe ──────╮  │
│  ╰──────────────────╯  │
│  🏆 120 SF · 1res · séries│  vitrine records (laiton)
├───────────────────────┤
│ FIL                    │
│ ┌ 12/03 · Parcours ───┐│
│ │ 110 cm · 4/5 propre  ││  fait objectif en avant
│ │ 🙂 « en forme »       ││  contexte en légende
│ └──────────────────────┘│
│ ┌ 🎉 Record · 120 SF ──┐│  jalon injecté
│ └──────────────────────┘│
├───────────────────────┤
│ Feed  Histo  (+)  Ana  Profil│
└───────────────────────┘
```

### 6.3 Saisie par obstacle
```
┌───────────────────────┐
│ ✕         Nouvelle séance│
│ Type [Plat][Gym][Parc][Conc]│
├───────────────────────┤
│ OBSTACLES              │
│ ┌ Oxer · 110 ─────────┐│
│ │ rép − 5 +  barr 1  ref 0││  compteurs tap
│ └──────────────────────┘│
│ ┌ Combinaison · 120 ──┐│
│ │ 3 éléments · « Double 1 »││  combinaison réutilisable
│ └──────────────────────┘│
│ [ + Ajouter un obstacle ]│
│ [ ↻ Même obstacle, +5 cm ]│
├───────────────────────┤
│      [  Enregistrer  ] │  → synchro + carte (§6.6)
└───────────────────────┘
```

### 6.4 Historique (accès aux bilans)
```
┌───────────────────────┐
│ ▼ Quibelle   Historique│
├───────────────────────┤
│ MARS 2026              │
│ ┌ 12/03 · Parcours ───┐│
│ │ 110 · 4/5            ││
│ │ Bilans : ✓ simple    ││  → ouvre la carte
│ │          ✦ augmenté  ││  IA (premium/pro)
│ └──────────────────────┘│
│ ┌ 08/03 · Concours ───┐│
│ │ 115 · 1 SF · ✓ simple││
│ └──────────────────────┘│
│ ┌ 03/03 · Plat ───────┐│
│ │ régularité · ✓        ││
│ └──────────────────────┘│
│           … (défile)    │
└───────────────────────┘
```

### 6.5 Analytique de diagnostic (premium/pro)
```
┌───────────────────────┐
│ Analytique   ▼ Quibelle│
├───────────────────────┤
│ HEATMAP  type × hauteur│
│        90  100 110 120 │
│ Oxer   ██   ██  ▓▓  ░░ │  plein = réussite
│ Vertical ██ ██  ██  ▓▓ │
│ Combi  ██   ▓▓  ░░   — │
│                        │
│ BENCHMARK « Double 1 » │
│  ╭──── progression ──╮ │
│  ╰────────────────────╯│
└───────────────────────┘
 (si gratuit : tout grisé + 🔒 → upgrade)
```

### 6.6 Carte de bilan de séance (partageable)
```
┌───────────────────────┐
│   ╔══════════════════╗ │
│   ║  QUIBELLE         ║ │
│   ║  Séance · 12/03   ║ │
│   ║  ▔▔ 110 cm ▔▔     ║ │  signature barre
│   ║  4/5 propre        ║ │
│   ║  🏆 nouveau record ║ │  laiton si record
│   ║            [ HPT ] ║ │
│   ╚══════════════════╝ │
│  [ Partager ]  [ Plus tard ]│  proposition non intrusive
└───────────────────────┘
```

### 6.7 Vue invité (lecture seule)
```
┌───────────────────────┐
│ Quibelle    👁 lecture seule│
├───────────────────────┤
│ HAUTEUR MAÎTRISÉE 115 ▲│
│  ╭──── courbe ──────╮  │
│ FIL (consultation)     │
│ ┌ 12/03 · 110 · 4/5 ──┐│
│ │ ✓ bilan simple        ││  (pas de ✦ augmenté)
│ └──────────────────────┘│
│ Analytique ✓ (du cheval)│
├───────────────────────┤
│ Feed   Historique   Analytique│  pas de (+), pas de switcher
└───────────────────────┘
```

### 6.8 Paywall / upgrade
```
┌───────────────────────┐
│   🔒 Analytique         │
│  ░░░░ aperçu grisé ░░░░ │
├───────────────────────┤
│ Débloque…              │
│ ┌ Premium ──┐ ┌ Pro ──┐│
│ │ 1 cheval   │ │ multi  ││
│ │ analytique │ │ +      ││
│ │ bilans + IA│ │ invités││
│ └────────────┘ └────────┘│
│      [ Continuer → ]   │  → checkout Mollie
└───────────────────────┘
```

---

## 7. Patterns d'interaction

- **Saisie éclair** : type → ajout d'obstacles en tap, **duplication** de la séance précédente, raccourci **« même obstacle, +5 cm »**. Objectif < 30 s sur une séance simple.
- **Enregistrer → célébrer** : l'enregistrement déclenche la synchro puis **propose** la carte de séance (`[ Partager ] / [ Plus tard ]`) — jamais imposée.
- **Verrouillage = invitation** : toucher une fonction grisée ouvre l'upgrade (premium/pro), sans culpabiliser.
- **Célébration mesurée** : un record fait scintiller la **plaque laiton** (micro-interaction brève) — pas de confettis génériques.
- **Honnêteté** : la hauteur maîtrisée peut **redescendre** (reprise, blessure) ; le **record reste gravé**. L'UI assume la baisse sans dramatiser.
- **Écrans vides = invitations** : « Logue ta première séance pour voir Quibelle progresser », jamais un vide muet.
- **Voix d'interface** : verbes actifs, même mot du bouton à la confirmation (« Enregistrer » → « Enregistré »), pas de jargon système.

---

## 8. Accessibilité & terrain

- **Plein soleil** (carrière) : contraste élevé (AA+), gros chiffres héros — c'est aussi pourquoi le **mode clair** est le seul mode.
- **Une main, vite, parfois avec des gants** : cibles tactiles **≥ 44 px**, bouton de saisie central, compteurs larges.
- **Chiffres tabulaires** partout (hauteurs, stats, tables) pour un alignement stable.
- **Focus clavier visible**, **reduced motion** respecté, libellés explicites (lecteurs d'écran).

---

## 9. Récapitulatif de la direction

- Identité **propre** · personnalité **sportive-équestre** · palette **« Écurie chaleureuse »** · **mode clair uniquement**.
- Navigation : tab bar **Feed · Historique · Analytique · Profil** + **bouton de saisie central** + **sélecteur de cheval** en en-tête ; **coquille invité** restreinte (lecture seule).
- Signature : **la hauteur-comme-barre** (maîtrisée en vert sous-bois, record en laiton).
- Typo : **Hanken Grotesk** (display) + **Inter** (corps), chiffres tabulaires.
