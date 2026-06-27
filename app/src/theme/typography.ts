import {
  HankenGrotesk_700Bold,
  HankenGrotesk_800ExtraBold,
} from '@expo-google-fonts/hanken-grotesk';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import type { TextStyle } from 'react-native';

/**
 * Typographie (UI/UX §3.2) — identité propre : *Hanken Grotesk* (display &
 * chiffres héros, sportive et chaleureuse) + *Inter* (corps & données, lisible
 * en plein soleil). Chiffres **tabulaires** sur les variantes numériques pour un
 * alignement stable (§3.2/§8).
 */

/**
 * Carte des polices chargées (clé = famille à référencer dans les styles).
 * Passée telle quelle à `useFonts` au démarrage. Les noms correspondent aux
 * exports des paquets `@expo-google-fonts/*`.
 */
export const FONT_ASSETS = {
  HankenGrotesk_700Bold,
  HankenGrotesk_800ExtraBold,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} as const;

/** Familles de police par rôle (les valeurs sont les clés de `FONT_ASSETS`). */
export const fontFamily = {
  /** Display fort (chiffre de hauteur héros). */
  displayExtra: 'HankenGrotesk_800ExtraBold',
  /** Display (titres, chiffres de stats). */
  display: 'HankenGrotesk_700Bold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemibold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
} as const;

const tabular: TextStyle = { fontVariant: ['tabular-nums'] };

/**
 * Échelle typographique (UI/UX §3.2) : Hero `48–64` · H1 `28` · H2 `20` ·
 * Corps `15–16` · Légende `13`. Le grand chiffre de hauteur (`hero`/`stat`)
 * porte des chiffres tabulaires — c'est le moment typographique fort de l'app.
 */
export const textVariants = {
  hero: {
    fontFamily: fontFamily.displayExtra,
    fontSize: 56,
    lineHeight: 60,
    ...tabular,
  },
  h1: {
    fontFamily: fontFamily.display,
    fontSize: 28,
    lineHeight: 34,
  },
  h2: {
    fontFamily: fontFamily.display,
    fontSize: 20,
    lineHeight: 26,
  },
  body: {
    fontFamily: fontFamily.body,
    fontSize: 16,
    lineHeight: 24,
  },
  bodyStrong: {
    fontFamily: fontFamily.bodySemibold,
    fontSize: 16,
    lineHeight: 24,
  },
  label: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
  },
  caption: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    lineHeight: 18,
  },
  /** Chiffre de statistique (tabulaire) hors échelle héros. */
  stat: {
    fontFamily: fontFamily.display,
    fontSize: 20,
    lineHeight: 26,
    ...tabular,
  },
} satisfies Record<string, TextStyle>;

export type TextVariant = keyof typeof textVariants;
