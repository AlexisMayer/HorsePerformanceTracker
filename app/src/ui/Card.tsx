import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { colors, radius, shadow, spacing } from '../theme';

export interface CardProps extends ViewProps {
  children: ReactNode;
}

/**
 * Carte de surface (UI/UX §3.3) — Sable, rayon doux 16 px, ombre chaude légère.
 * L'élévation se lit surtout par la couleur de surface ; l'ombre détache à peine.
 */
export function Card({ children, style, ...props }: CardProps) {
  return (
    <View style={[styles.card, style]} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadow.card,
  },
});
