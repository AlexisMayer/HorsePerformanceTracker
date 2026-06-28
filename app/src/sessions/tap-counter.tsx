import { Pressable, StyleSheet, View } from 'react-native';
import { colors, minTouchTarget, radius, spacing } from '../theme';
import { StatText, Text } from '../ui';

export interface TapCounterProps {
  label: string;
  value: number;
  /** Plancher (répétitions = 1, fautes = 0, éléments = 2). Défaut 0. */
  min?: number;
  onChange: (next: number) => void;
  /** Teinte du chiffre — `danger` pour les fautes (Rouille, §3.1). */
  tone?: 'default' | 'danger';
}

/**
 * Compteur « **tap +/−** » (UI/UX §4/§8) — répétitions, barres, refus, éléments.
 * Cibles tactiles généreuses (≥ 44 px, « parfois avec des gants »), chiffre
 * **tabulaire** au centre. Le « − » se désactive au plancher.
 */
export function TapCounter({ label, value, min = 0, onChange, tone = 'default' }: TapCounterProps) {
  const atMin = value <= min;
  return (
    <View style={styles.wrapper}>
      <Text variant="label" color="textMuted" numberOfLines={1}>
        {label}
      </Text>
      <View
        style={styles.row}
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ now: value }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Diminuer ${label}`}
          disabled={atMin}
          onPress={() => onChange(value - 1)}
          style={({ pressed }) => [
            styles.btn,
            pressed && !atMin && styles.btnPressed,
            atMin && styles.btnDisabled,
          ]}
        >
          <Text variant="h2" style={styles.sign}>
            −
          </Text>
        </Pressable>
        <StatText style={styles.value} color={tone === 'danger' && value > 0 ? 'danger' : 'text'}>
          {value}
        </StatText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Augmenter ${label}`}
          onPress={() => onChange(value + 1)}
          style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
        >
          <Text variant="h2" style={styles.sign}>
            +
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    gap: spacing.xxs,
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  btn: {
    width: minTouchTarget,
    height: minTouchTarget,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPressed: {
    backgroundColor: colors.border,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  sign: {
    color: colors.primary,
    lineHeight: 26,
  },
  value: {
    minWidth: 36,
    textAlign: 'center',
  },
});
