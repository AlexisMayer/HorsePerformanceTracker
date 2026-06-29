/**
 * Référentiel des **jalons** dérivés (Modèle §2/§9/§10, Spec §5.1/§5.2).
 *
 * Un jalon est un **événement dérivé** (jamais saisi) attaché à la séance `live`
 * qui l'a généré, calculé depuis l'historique (cf. `calc/jalons`). Deux espèces
 * en v1 :
 *  - `record` — un **plus haut franchissement propre** que tout l'historique
 *    antérieur (« le record encaisse l'exploit ponctuel », §10) ;
 *  - `première_fois` — un **1er franchissement propre à une hauteur** jamais
 *    franchie proprement jusque-là (hors hauteur de record, déjà célébrée).
 *
 * Seul le `live` engendre des jalons : le `déclaratif` nourrit le feed mais reste
 * exclu des dérivés (§2). Liste figée, réutilisée par `calc` ET les schémas Zod.
 */

export const TYPES_JALON = ['record', 'première_fois'] as const;

export type TypeJalon = (typeof TYPES_JALON)[number];
