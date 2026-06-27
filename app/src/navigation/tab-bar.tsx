import { Ionicons } from '@expo/vector-icons';
import type { TabTriggerSlotProps } from 'expo-router/ui';
import { type ComponentProps, forwardRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, minTouchTarget, radius, shadow, spacing } from '../theme';
import { Text } from '../ui';
import type { IconName } from './tabs';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export interface TabBarButtonProps extends TabTriggerSlotProps {
  label: string;
  icon: IconName;
  iconActive: IconName;
}

/**
 * Bouton d'onglet (UI/UX §5/§8) — rendu par `TabTrigger asChild` : il reçoit
 * `isFocused` + `onPress` de la navigation. Cible tactile ≥ 44 px, état actif en
 * Vert sous-bois, libellé explicite (lecteurs d'écran). `href` (web) est retiré
 * car on rend une `Pressable`, pas une ancre.
 */
export const TabBarButton = forwardRef<View, TabBarButtonProps>(
  ({ label, icon, iconActive, isFocused, href: _href, ...props }, ref) => {
    const color = isFocused ? colors.primary : colors.textMuted;
    return (
      <Pressable
        ref={ref}
        {...props}
        accessibilityRole="tab"
        accessibilityState={{ selected: Boolean(isFocused) }}
        style={styles.tab}
      >
        <Ionicons name={(isFocused ? iconActive : icon) as IoniconName} size={24} color={color} />
        <Text variant="caption" style={{ color }}>
          {label}
        </Text>
      </Pressable>
    );
  },
);
TabBarButton.displayName = 'TabBarButton';

/**
 * Bouton de saisie central (FAB) proéminent (UI/UX §5). Surélevé au-dessus de la
 * tab bar, Vert sous-bois, toujours à portée de pouce. **Placeholder** dans ce
 * lot : `onPress` ouvre un message — la saisie réelle est 2.2/2.3.
 */
export function CaptureFab({ onPress }: { onPress: () => void }) {
  return (
    <View style={styles.fabSlot}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Nouvelle saisie"
        onPress={onPress}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      >
        <Ionicons name="add" size={32} color={colors.onPrimary} />
      </Pressable>
    </View>
  );
}

const FAB_SIZE = 60;

const styles = StyleSheet.create({
  tab: {
    flex: 1,
    minHeight: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: spacing.xs,
  },
  fabSlot: {
    width: FAB_SIZE + spacing.md,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -spacing.lg,
    borderWidth: 3,
    borderColor: colors.background,
    ...shadow.raised,
  },
  fabPressed: {
    backgroundColor: colors.primaryPressed,
  },
});
