import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { Text } from './Text';

export interface EmptyStateProps {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  /** Invitation à l'action — UI/UX §7 : « écrans vides = invitations ». */
  message: string;
}

/**
 * État vide traité comme une **invitation** (UI/UX §7), jamais un vide muet. Les
 * onglets de ce lot sont des placeholders dans cet état : leur vrai contenu
 * arrive avec leurs lots (Feed 3.1, Historique 3.4, Analytique 5.1).
 */
export function EmptyState({ icon, title, message }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={28} color={colors.primary} />
      </View>
      <Text variant="h2" style={styles.centered}>
        {title}
      </Text>
      <Text variant="body" color="textMuted" style={styles.centered}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.progressBackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  centered: {
    textAlign: 'center',
  },
});
