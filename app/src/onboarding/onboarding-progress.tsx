import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../theme';

export interface OnboardingProgressProps {
  current: number;
  total: number;
}

/**
 * Indicateur **pas-à-pas** du tunnel (UI/UX §7 — voix d'interface qui situe
 * l'utilisateur). Des pastilles, remplies en Vert sous-bois jusqu'à l'étape
 * courante. À la bifurcation (`current = 0`), rien à montrer. Décoratif : un
 * libellé accessible résume « étape n sur N » (§8).
 */
export function OnboardingProgress({ current, total }: OnboardingProgressProps) {
  if (current < 1 || total < 1) return null;

  // Clé indirecte (propriété), pas l'index brut au site JSX (lint, cf. courbe 3.2).
  const dots = Array.from({ length: total }, (_, i) => ({ key: `dot-${i}`, on: i < current }));

  return (
    <View
      style={styles.row}
      accessibilityRole="progressbar"
      accessibilityLabel={`Étape ${current} sur ${total}`}
    >
      {dots.map((dot) => (
        <View key={dot.key} style={[styles.dot, dot.on ? styles.dotOn : styles.dotOff]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  dot: {
    height: 6,
    flex: 1,
    borderRadius: radius.pill,
  },
  dotOn: {
    backgroundColor: colors.primary,
  },
  dotOff: {
    backgroundColor: colors.border,
  },
});
