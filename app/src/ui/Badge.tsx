import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { Text } from './Text';

type Tone = 'neutral' | 'primary' | 'celebration' | 'danger';

export interface BadgeProps {
  label: string;
  tone?: Tone;
}

/**
 * Pastille de statut (UI/UX §3.1) — ex. le `tier` du compte sur le Profil. Le
 * Laiton (`celebration`) reste réservé aux jalons : à n'utiliser que pour ce qui
 * se célèbre.
 */
export function Badge({ label, tone = 'neutral' }: BadgeProps) {
  const palette = TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: palette.background }]}>
      <Text variant="label" style={{ color: palette.text }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
  },
});

const TONES: Record<Tone, { background: string; text: string }> = {
  neutral: { background: colors.progressBackground, text: colors.primary },
  primary: { background: colors.primary, text: colors.onPrimary },
  celebration: { background: colors.celebration, text: colors.onPrimary },
  danger: { background: colors.surface, text: colors.danger },
};
