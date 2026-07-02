import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { Text } from '../ui';

/**
 * Aperçu **grisé** du benchmark (UI/UX §6.5/§3.1) — esquisse **non fonctionnelle**
 * (données factices : un sélecteur + une courbe qui monte), montrée sous le voile +
 * cadenas du verrou générique (4.2) pour un compte **gratuit**. Elle donne à
 * *deviner* la fonction sans divulguer le vrai diagnostic (refusé au gratuit côté
 * serveur, 4.1). Le rendu **réel** est `BenchmarkSection` / `BenchmarkCurve`.
 */
const CHIPS = ['Double 1', 'Triple oxer', 'Double vertical'] as const;
const BARRES = [0.45, 0.55, 0.7, 0.8, 0.95] as const;

export function BenchmarkAperçu() {
  return (
    <View style={styles.preview}>
      <Text variant="label" color="textMuted">
        Benchmark à combinaison constante
      </Text>
      <View style={styles.chips}>
        {CHIPS.map((c, i) => (
          <View key={c} style={[styles.chip, i === 0 && styles.chipActif]}>
            <Text variant="caption" color={i === 0 ? 'onPrimary' : 'textMuted'}>
              {c}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.frame}>
        {BARRES.map((b) => (
          <View
            key={`bar-${b}`}
            style={[styles.bar, { height: 8 + b * 48, backgroundColor: colors.primary }]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  preview: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActif: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  frame: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 64,
    gap: 4,
  },
  bar: {
    flex: 1,
    borderRadius: radius.sm,
  },
});
