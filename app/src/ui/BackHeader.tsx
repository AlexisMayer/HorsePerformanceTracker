import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, minTouchTarget, radius, spacing } from '../theme';
import { Text } from './Text';

export interface BackHeaderProps {
  title: string;
  onBack: () => void;
}

/**
 * En-tête des écrans poussés (UI/UX §5/§8) — bouton **retour** (cible ≥ 44 px,
 * libellé pour lecteurs d'écran) + titre. Utilisé par les écrans hors tab bar
 * (ex. gestion des chevaux, lot 2.1), où la navigation se fait au Stack racine.
 */
export function BackHeader({ title, onBack }: BackHeaderProps) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Retour"
        onPress={onBack}
        hitSlop={spacing.xs}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
      >
        <Ionicons name="chevron-back" size={24} color={colors.text} />
      </Pressable>
      <Text variant="h2" numberOfLines={1} style={styles.title}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  back: {
    width: minTouchTarget,
    height: minTouchTarget,
    marginLeft: -spacing.sm,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    backgroundColor: colors.surface,
  },
  title: {
    flex: 1,
  },
});
