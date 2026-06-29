import type { PointMaîtriseDto, Vitrine } from '@hpt/shared';

/**
 * Helpers **purs** d'affichage des graphes héros (lot 3.2) — aucun import React
 * Native, donc testables par Vitest. Ils ne font que **présenter** des dérivés
 * déjà calculés par `shared` (hauteur maîtrisée §10, records 3.1) : **jamais** de
 * calcul métier ici (il vit dans `shared`, Architecture §2). Le grand chiffre
 * héros reste lisible plein soleil (chiffres tabulaires côté composant, §8).
 */

/** Le grand chiffre maîtrisé, ou un tiret cadratin quand rien n'est encore maîtrisé. */
export function formatHauteur(hauteur: number | null): string {
  return hauteur === null ? '—' : String(hauteur);
}

/**
 * Libellé accessible du bloc maîtrisée (lecteurs d'écran, §8) — assume une absence
 * de maîtrise sans dramatiser, et nomme le record gravé s'il existe (§5.5).
 */
export function maîtriseAccessibilityLabel(courante: number | null, record: number | null): string {
  const base =
    courante === null
      ? 'Pas encore de hauteur maîtrisée.'
      : `Hauteur maîtrisée : ${courante} centimètres.`;
  const ref = record === null ? '' : ` Record gravé : ${record} centimètres.`;
  return `${base}${ref}`;
}

/** Une barre de la courbe : sa hauteur (cm, `null` si non maîtrisé) + sa taille relative [0, 1]. */
export interface BarreMaîtrise {
  hauteur: number | null;
  /** Hauteur de barre normalisée dans [0, 1] ; `0` quand la maîtrise est absente (creux honnête). */
  relatif: number;
}

/**
 * Projette la **série temporelle** de maîtrise (un point par séance live) en
 * barres normalisées — la signature « hauteur-comme-barre » (UI/UX §2 : « la
 * progression se lit comme des barres qui montent »). On garde les `max` points
 * les plus récents ; chaque hauteur est mise à l'échelle entre la plus basse et la
 * plus haute de la fenêtre affichée (la plus haute = barre pleine). Un point sans
 * maîtrise (`null`) devient un **creux** (relatif 0), assumé sans drama (§5.5).
 *
 * Pur et tolérant : positions par **index** chronologique (pas de calcul de date),
 * jamais de division par zéro (fenêtre plate ⇒ barres à mi-hauteur).
 */
export function courbeMaîtrise(
  série: PointMaîtriseDto[],
  options: { max?: number } = {},
): BarreMaîtrise[] {
  const fenêtre = série.slice(-(options.max ?? 24));
  const hauteurs = fenêtre.map((p) => p.hauteur).filter((h): h is number => h !== null);
  if (hauteurs.length === 0) return fenêtre.map(() => ({ hauteur: null, relatif: 0 }));

  const min = Math.min(...hauteurs);
  const max = Math.max(...hauteurs);
  return fenêtre.map((p) => {
    if (p.hauteur === null) return { hauteur: null, relatif: 0 };
    // Fenêtre plate : barres à mi-hauteur ; sinon échelle [0.25, 1] (la plus basse
    // reste visible, la plus haute remplit la barre).
    const relatif = max === min ? 0.65 : 0.25 + 0.75 * ((p.hauteur - min) / (max - min));
    return { hauteur: p.hauteur, relatif };
  });
}

/** Plaques de la vitrine : le **record** gravé (cm) en tête + les autres **premières fois** (cm). */
export interface PlaquesVitrine {
  record: number | null;
  premièresFois: number[];
}

/**
 * Réduit la vitrine (records + premières fois, dérivés par `shared`) en **plaques
 * laiton** : le **plus haut sans-faute** (record absolu) en tête, puis chaque
 * autre hauteur jamais franchie proprement (premières fois), de la plus haute à la
 * plus basse. Une hauteur n'apparaît qu'une fois (un record ancien devient une
 * première fois dans le palmarès). Pur — la sélection/le décompte vivent ici, pas
 * dans le composant.
 */
export function plaquesVitrine(vitrine: Vitrine): PlaquesVitrine {
  const record = vitrine.record?.hauteur ?? null;
  const hauteurs = [...new Set(vitrine.jalons.map((j) => j.hauteur))].sort((a, b) => b - a);
  return { record, premièresFois: hauteurs.filter((h) => h !== record) };
}
