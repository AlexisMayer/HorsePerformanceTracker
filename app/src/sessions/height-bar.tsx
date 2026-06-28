import { HAUTEUR_MAX_CM, HAUTEUR_MIN_CM } from '@hpt/shared';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, minTouchTarget, radius, spacing } from '../theme';
import { StatText, Text } from '../ui';
import { stepHauteur } from './draft';

export interface HeightBarProps {
  value: number;
  onChange: (next: number) => void;
}

/**
 * Sélecteur de **hauteur** (UI/UX §4) — référentiel 60→160 cm, **pas de 5**,
 * **gros chiffre tabulaire**. Réglé par deux grandes cibles −5 / +5 (terrain,
 * une main, gants — §8) plutôt qu'un curseur glissé, fragile au doigt.
 *
 * Porte la **signature « hauteur-comme-barre »** (UI/UX §2) : une barre
 * d'obstacle qui se remplit en Vert sous-bois à mesure que la hauteur monte —
 * l'identité du produit jusque dans la saisie.
 */
export function HeightBar({ value, onChange }: HeightBarProps) {
  const ratio = (value - HAUTEUR_MIN_CM) / (HAUTEUR_MAX_CM - HAUTEUR_MIN_CM);
  const atMin = value <= HAUTEUR_MIN_CM;
  const atMax = value >= HAUTEUR_MAX_CM;

  return (
    <View style={styles.wrapper}>
      <Text variant="label" color="textMuted">
        Hauteur
      </Text>
      <View
        style={styles.row}
        accessibilityRole="adjustable"
        accessibilityLabel="Hauteur en centimètres"
        accessibilityValue={{ now: value, min: HAUTEUR_MIN_CM, max: HAUTEUR_MAX_CM }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Baisser la hauteur de 5 centimètres"
          disabled={atMin}
          onPress={() => onChange(stepHauteur(value, -1))}
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

        <View style={styles.readout}>
          <View style={styles.numberRow}>
            <StatText variant="hero" style={styles.number}>
              {value}
            </StatText>
            <Text variant="label" color="textMuted" style={styles.unit}>
              cm
            </Text>
          </View>
          {/* Signature : la barre d'obstacle se remplit avec la hauteur. */}
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round(ratio * 100)}%` }]} />
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Monter la hauteur de 5 centimètres"
          disabled={atMax}
          onPress={() => onChange(stepHauteur(value, 1))}
          style={({ pressed }) => [
            styles.btn,
            pressed && !atMax && styles.btnPressed,
            atMax && styles.btnDisabled,
          ]}
        >
          <Text variant="h2" style={styles.sign}>
            +
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const STEP_BTN = minTouchTarget + 4;

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xxs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  btn: {
    width: STEP_BTN,
    height: STEP_BTN,
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
  },
  readout: {
    flex: 1,
    gap: spacing.xs,
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: spacing.xxs,
  },
  number: {
    textAlign: 'center',
  },
  unit: {
    marginBottom: spacing.xs,
  },
  track: {
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
  },
});
