/**
 * Référentiel des hauteurs d'obstacle (Modèle §0).
 *
 * Slider de 60 à 160 cm, pas de 5 cm. Figé pour garantir la cohérence des
 * métriques entre utilisateurs ; ajustable plus tard sans casser le schéma.
 */

export const HAUTEUR_MIN_CM = 60;
export const HAUTEUR_MAX_CM = 160;
export const HAUTEUR_PAS_CM = 5;

/** Toutes les hauteurs valides du référentiel, dans l'ordre croissant. */
export const HAUTEURS_CM: readonly number[] = Array.from(
  { length: (HAUTEUR_MAX_CM - HAUTEUR_MIN_CM) / HAUTEUR_PAS_CM + 1 },
  (_, i) => HAUTEUR_MIN_CM + i * HAUTEUR_PAS_CM,
);

/**
 * Une hauteur est valide si elle tombe sur un cran du slider :
 * entière, dans [60, 160], multiple de 5 à partir de 60.
 */
export function estHauteurValide(hauteur: number): boolean {
  return (
    Number.isInteger(hauteur) &&
    hauteur >= HAUTEUR_MIN_CM &&
    hauteur <= HAUTEUR_MAX_CM &&
    (hauteur - HAUTEUR_MIN_CM) % HAUTEUR_PAS_CM === 0
  );
}
