import type { BenchmarkSérieDto, PointBenchmarkDto, Tendance } from '@hpt/shared';

/**
 * Helpers **purs** d'affichage du **benchmark à combinaison constante** (lot 5.2)
 * — aucun import React Native, donc testables par Vitest. Ils ne font que
 * **présenter** un dérivé déjà calculé par `shared` (`sérieBenchmark`, qui réutilise
 * le taux §7) : **jamais** de calcul métier ici (il vit dans `shared`, Architecture
 * §2). Les valeurs restent lisibles plein soleil (chiffres tabulaires côté
 * composant, §8) ; la **hauteur** est portée en **annotation**, jamais confondue
 * avec le taux.
 */

/** Taux en pourcentage entier (chiffres tabulaires) : `0.833 → "83"`, `0 → "0"`, `1 → "100"`. */
export function formatPourcent(taux: number): string {
  return String(Math.round(taux * 100));
}

/** Une barre de la courbe : son taux (§7), la hauteur (annotation) et le remplissage [0, 1]. */
export interface BarreBenchmark {
  taux: number;
  hauteur: number;
  /** Remplissage de barre ∈ [0, 1] = le **taux** lui-même (100 % = barre pleine). */
  relatif: number;
}

/**
 * Projette la **série** (un point par instanciation `live`) en barres — signature
 * « la progression se lit comme des barres qui montent » (UI/UX §2). Le taux étant
 * déjà une **fraction** [0, 1], le remplissage **est** le taux (pas de
 * normalisation trompeuse : une barre pleine = 100 % propre, jamais « le meilleur
 * de la fenêtre »). On garde les `max` points les plus récents ; positions par
 * **index** chronologique (pas de calcul de date), déterministe.
 */
export function courbeBenchmark(
  points: PointBenchmarkDto[],
  options: { max?: number } = {},
): BarreBenchmark[] {
  return points.slice(-(options.max ?? 24)).map((p) => ({
    taux: p.taux,
    hauteur: p.hauteur,
    relatif: Math.min(1, Math.max(0, p.taux)),
  }));
}

/** Le **taux courant** (dernier point) = le grand chiffre du benchmark, ou `null` si vide. */
export function dernierTaux(points: PointBenchmarkDto[]): number | null {
  return points.length === 0 ? null : points[points.length - 1].taux;
}

/** Vrai si la série n'a qu'**un** point (à rejouer — pas de tendance affichée). */
export function estMonoPoint(points: PointBenchmarkDto[]): boolean {
  return points.length === 1;
}

/** Libellé de tendance (honnête, sans dramatiser §7), ou `null` si non tranchable. */
export function tendanceLabel(tendance: Tendance | null): string | null {
  switch (tendance) {
    case 'hausse':
      return 'En progression';
    case 'baisse':
      return 'En recul';
    case 'stable':
      return 'Stable';
    default:
      return null;
  }
}

/**
 * **Annotation de hauteur** de la série : la barre travaillée est **constante en
 * structure**, mais sa hauteur peut **varier** — on résume la plage (« 110 cm » si
 * unique, sinon « 110–120 cm »), pour dire d'un coup d'œil sur quelles barres la
 * progression a été mesurée. `null` si la série est vide.
 */
export function annotationHauteurs(points: PointBenchmarkDto[]): string | null {
  if (points.length === 0) return null;
  const hauteurs = points.map((p) => p.hauteur);
  const min = Math.min(...hauteurs);
  const max = Math.max(...hauteurs);
  return min === max ? `${min} cm` : `${min}–${max} cm`;
}

/**
 * Libellé accessible de la série (lecteurs d'écran, §8) : nomme la combinaison, le
 * nombre d'instanciations, le taux courant et la tendance (ou l'invitation à
 * rejouer sur un point isolé), sans jamais confondre hauteur et taux.
 */
export function benchmarkAccessibilityLabel(série: BenchmarkSérieDto): string {
  const n = série.points.length;
  if (n === 0) return `${série.nom} : aucune instanciation enregistrée pour ce cheval.`;
  const courant = formatPourcent(série.points[n - 1].taux);
  if (n === 1) {
    return `${série.nom} : une instanciation, réussite ${courant} %. Rejoue-la pour suivre sa progression.`;
  }
  const tendance = tendanceLabel(série.tendance);
  const suffixeTendance = tendance ? `, ${tendance.toLowerCase()}` : '';
  return `${série.nom} : ${n} instanciations, réussite courante ${courant} %${suffixeTendance}.`;
}
