import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { Text } from './Text';

export interface ScreenHeaderProps {
  title: string;
  /**
   * Affiche un **sélecteur de cheval** purement visuel et **inerte**. Décision
   * 1.4 : aucun cheval n'existe avant 2.1 — la coquille le *prévoit* sans aucune
   * logique multi-cheval (consigne « hors périmètre »).
   */
  horseSelectorPlaceholder?: boolean;
}

/**
 * En-tête d'onglet (UI/UX §5). Le sélecteur de cheval est rendu comme un repère
 * désactivé tant que la fiche cheval (lot 2.1) n'existe pas — il pose
 * l'emplacement sans promettre d'action.
 */
export function ScreenHeader({ title, horseSelectorPlaceholder = false }: ScreenHeaderProps) {
  return (
    <View style={styles.header}>
      <Text variant="h1">{title}</Text>
      {horseSelectorPlaceholder ? (
        <View
          accessibilityRole="text"
          accessibilityState={{ disabled: true }}
          accessibilityLabel="Sélecteur de cheval — disponible après l'ajout d'un cheval"
          style={styles.selector}
        >
          <Ionicons name="ellipse-outline" size={16} color={colors.textMuted} />
          <Text variant="label" color="textMuted">
            Aucun cheval
          </Text>
          <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    opacity: 0.7,
  },
});
