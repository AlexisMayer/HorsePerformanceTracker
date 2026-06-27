import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { type ColorRole, colors, type TextVariant, textVariants } from '../theme';

export interface TextProps extends RNTextProps {
  /** Variante typographique (UI/UX §3.2). Défaut : `body`. */
  variant?: TextVariant;
  /** Rôle de couleur (token). Défaut : `text` (Encre). */
  color?: ColorRole;
}

/**
 * Texte de base — applique les tokens de typo et de couleur (UI/UX §3.2). Tout
 * texte de l'app passe par ici pour rester cohérent (familles, échelle, chiffres
 * tabulaires sur les variantes numériques).
 */
export function Text({ variant = 'body', color = 'text', style, ...props }: TextProps) {
  return <RNText style={[textVariants[variant], { color: colors[color] }, style]} {...props} />;
}

/**
 * Valeur numérique (hauteur, stat) en chiffres tabulaires. Raccourci sémantique
 * sur la variante `stat` — garantit l'alignement stable demandé en §8.
 */
export function StatText({ variant = 'stat', ...props }: TextProps) {
  return <Text variant={variant} {...props} />;
}
