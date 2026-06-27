import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { colors, minTouchTarget, radius, spacing } from '../theme';
import { Text } from '../ui';
import { useHorses } from './horses-context';

/**
 * Sélecteur de cheval en en-tête (UI/UX §5) — branché sur le **cheval courant**
 * (lot 2.1). En v1 **mono-cheval** : il affiche le nom du cheval courant (ou
 * « Aucun cheval » si le compte n'en a pas encore) et mène à la **gestion des
 * chevaux** (`/horses`). Il n'opère **aucune bascule multi-cheval** : le
 * dropdown de sélection entre plusieurs chevaux relève du Pro (lot 4.x). La
 * coquille pose donc l'emplacement et l'identité affichée, sans promettre plus.
 */
export function HorseSelector() {
  const { currentHorse } = useHorses();
  const router = useRouter();

  const label = currentHorse?.nom ?? 'Aucun cheval';
  const accessibilityLabel = currentHorse
    ? `Cheval courant : ${currentHorse.nom}. Gérer mes chevaux.`
    : 'Aucun cheval. Ajouter un cheval.';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => router.push('/horses')}
      style={({ pressed }) => [styles.selector, pressed && styles.pressed]}
    >
      <Ionicons
        name={currentHorse ? 'paw' : 'add-circle-outline'}
        size={16}
        color={currentHorse ? colors.primary : colors.textMuted}
      />
      <Text variant="label" color={currentHorse ? 'text' : 'textMuted'} numberOfLines={1}>
        {label}
      </Text>
      <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    minHeight: minTouchTarget,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    maxWidth: 180,
  },
  pressed: {
    backgroundColor: colors.surfaceSunken,
  },
});
