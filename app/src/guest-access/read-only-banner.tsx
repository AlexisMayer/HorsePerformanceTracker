import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { colors, spacing } from '../theme';
import { Text } from '../ui';

/**
 * **Bandeau « lecture seule »** de la vue invité (UI/UX §4/§6.7, lot 4.6) — signale
 * en permanence, en tête de la coquille invité, que l'accès est **en consultation**
 * (pas de saisie, pas de gestion). Sobre (pas de laiton, réservé à la célébration) :
 * un œil + un libellé, sur une teinte neutre. Accessible (rôle résumé + libellé).
 */
export function ReadOnlyBanner() {
  return (
    <View
      style={styles.banner}
      accessibilityRole="summary"
      accessibilityLabel="Accès en lecture seule — consultation du cheval partagé"
    >
      <Ionicons name="eye-outline" size={16} color={colors.textMuted} />
      <Text variant="caption" color="textMuted">
        Lecture seule · cheval partagé par ton coach
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
});
