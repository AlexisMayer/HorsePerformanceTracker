/**
 * Définition de la **coquille de navigation** (UI/UX §5) — source de vérité
 * unique, consommée par la tab bar **et** par les tests. Module **pur** (aucun
 * import React Native) pour rester importable en environnement Node (Vitest).
 *
 * Tab bar 4 onglets : **Feed · Historique · Analytique · Profil**, avec un
 * **bouton de saisie central (FAB)** proéminent intercalé au milieu. Le contenu
 * réel des onglets vient avec leurs lots (Feed 3.1, Historique 3.4,
 * Analytique 5.1) ; ici ce sont des placeholders en état vide-invitation.
 */

/** Nom d'icône Ionicons (gardé en `string` pour que le module reste pur). */
export type IconName = string;

export interface TabConfig {
  /** Nom de route Expo Router dans le groupe `(tabs)`. */
  name: string;
  /** Chemin de navigation associé. */
  href: string;
  /** Libellé visible dans la tab bar. */
  label: string;
  /** Icône (état inactif / actif). */
  icon: IconName;
  iconActive: IconName;
}

/** Les 4 onglets, dans l'ordre d'affichage gauche → droite (UI/UX §5). */
export const TABS: readonly TabConfig[] = [
  { name: 'index', href: '/', label: 'Feed', icon: 'home-outline', iconActive: 'home' },
  {
    name: 'historique',
    href: '/historique',
    label: 'Historique',
    icon: 'time-outline',
    iconActive: 'time',
  },
  {
    name: 'analytique',
    href: '/analytique',
    label: 'Analytique',
    icon: 'stats-chart-outline',
    iconActive: 'stats-chart',
  },
  {
    name: 'profil',
    href: '/profil',
    label: 'Profil',
    icon: 'person-outline',
    iconActive: 'person',
  },
];

/**
 * Bouton de saisie central (FAB) — l'action cœur (UI/UX §5/§7). **Actif depuis
 * le lot 2.3** : il ouvre l'écran de saisie rapide (`/capture`). Ce n'est pas un
 * onglet : c'est un bouton intercalé au centre de la tab bar.
 */
export const CAPTURE_FAB = {
  label: 'Saisie',
  icon: 'add' as IconName,
} as const;

/** Index où le FAB s'intercale (au centre : après Feed/Historique). */
export const CAPTURE_FAB_POSITION = 2;
