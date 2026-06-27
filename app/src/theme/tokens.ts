/**
 * Tokens UI — lot 1.4 (UI/UX §3). Source unique des valeurs de design : palette
 * « Écurie chaleureuse » (mode clair uniquement, §3.1/§8), grille 8 px (§3.3),
 * rayons 12–16 px, ombres chaudes légères. Aucune valeur en dur dispersée dans
 * les écrans — tout passe par ces primitives.
 */

/**
 * Palette « Écurie chaleureuse » (mode clair uniquement). Les rôles, pas les
 * teintes, sont la frontière stable : un écran demande `colors.primary`, jamais
 * un hex. Valeurs reprises 1:1 de UI/UX §3.1.
 */
export const colors = {
  /** Fond (Crème). */
  background: '#FBF7F0',
  /** Surface / carte (Sable). */
  surface: '#F1E9DA',
  /** Surface alternative, plus enfoncée. */
  surfaceSunken: '#EDE3D0',
  /** Bordure / séparateur (Sable foncé). */
  border: '#E3D7C2',
  /** Accent primaire : CTA, progression, hauteur maîtrisée (Vert sous-bois). */
  primary: '#2E5D44',
  /** Variante pressée de l'accent primaire. */
  primaryPressed: '#244B37',
  /** Texte/icône posé sur l'accent primaire. */
  onPrimary: '#FBF7F0',
  /** Fond de progression (Vert pâle). */
  progressBackground: '#DCE8DF',
  /** Célébration : records, jalons (Laiton) — rare, donc précieux. */
  celebration: '#C8861E',
  /** Secondaire, accents matière (Cuir). */
  secondary: '#7A5236',
  /** Texte principal (Encre). */
  text: '#20251F',
  /** Texte secondaire (Encre douce). */
  textMuted: '#5C5A4E',
  /** Sémantique faute / refus, jamais décoratif (Rouille sobre). */
  danger: '#B15533',
  /** Voile d'état verrouillé (~55 % crème) — gating UI, lot 4.x. */
  lockedVeil: 'rgba(251, 247, 240, 0.55)',
} as const;

export type ColorRole = keyof typeof colors;

/**
 * Espacement sur grille 8 px (UI/UX §3.3), avec demi-pas 4 px pour les
 * ajustements fins. Marges latérales généreuses (atteinte au pouce).
 */
export const spacing = {
  none: 0,
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export type SpacingToken = keyof typeof spacing;

/** Rayons : cartes douces 12–16 px ; `pill` pour les éléments pleinement arrondis. */
export const radius = {
  sm: 12,
  md: 16,
  lg: 20,
  pill: 999,
} as const;

/**
 * Cible tactile minimale (UI/UX §8 : « une main, vite, parfois avec des gants »).
 * Toute zone interactive doit faire au moins cette taille.
 */
export const minTouchTarget = 44;

/**
 * Ombres très légères et **chaudes** (jamais de gris froid — UI/UX §3.3) :
 * l'élévation se lit surtout par la couleur de surface, l'ombre ne fait que
 * détacher. Couleur d'ombre = Cuir. Inclut `elevation` pour Android.
 */
export const shadow = {
  none: {
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  card: {
    shadowColor: colors.secondary,
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  raised: {
    shadowColor: colors.secondary,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
} as const;

export type ShadowToken = keyof typeof shadow;
