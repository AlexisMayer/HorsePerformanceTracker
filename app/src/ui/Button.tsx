import { ActivityIndicator, Pressable, type PressableProps, StyleSheet, View } from 'react-native';
import { colors, minTouchTarget, radius, spacing } from '../theme';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  /** Libellé du bouton. UI/UX §7 : même verbe du bouton à la confirmation. */
  label: string;
  /** Libellé affiché pendant le chargement (ex. « Connexion… »). */
  loadingLabel?: string;
  variant?: Variant;
  loading?: boolean;
  /** Occupe toute la largeur disponible. Défaut : `true`. */
  fullWidth?: boolean;
}

/**
 * Bouton de base (UI/UX §3/§8). Cible tactile ≥ 44 px, contraste AA+, états
 * pressé/désactivé/chargement. `primary` = Vert sous-bois (CTA, §3.1).
 */
export function Button({
  label,
  loadingLabel,
  variant = 'primary',
  loading = false,
  fullWidth = true,
  disabled,
  ...props
}: ButtonProps) {
  const isDisabled = Boolean(disabled) || loading;
  const palette = VARIANTS[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: palette.background, borderColor: palette.border },
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && { backgroundColor: palette.backgroundPressed },
        isDisabled && styles.disabled,
      ]}
      {...props}
    >
      <View style={styles.content}>
        {loading ? <ActivityIndicator color={palette.text} size="small" /> : null}
        <Text variant="bodyStrong" style={{ color: palette.text }}>
          {loading ? (loadingLabel ?? label) : label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: minTouchTarget + 4,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  disabled: {
    opacity: 0.5,
  },
});

const VARIANTS: Record<
  Variant,
  { background: string; backgroundPressed: string; border: string; text: string }
> = {
  primary: {
    background: colors.primary,
    backgroundPressed: colors.primaryPressed,
    border: colors.primary,
    text: colors.onPrimary,
  },
  secondary: {
    background: colors.surface,
    backgroundPressed: colors.surfaceSunken,
    border: colors.border,
    text: colors.text,
  },
  ghost: {
    background: 'transparent',
    backgroundPressed: colors.surface,
    border: 'transparent',
    text: colors.primary,
  },
  danger: {
    background: 'transparent',
    backgroundPressed: colors.surface,
    border: colors.danger,
    text: colors.danger,
  },
};
