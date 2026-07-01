import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { Text } from '../ui';

/**
 * Aperçu **grisé** de la heatmap (UI/UX §6.5/§3.1) — esquisse **non
 * fonctionnelle** (données factices), montrée sous le voile + cadenas du verrou
 * générique (4.2) pour un compte **gratuit**. Elle donne à *deviner* la fonction
 * sans divulguer le vrai diagnostic (celui-ci est refusé au gratuit côté serveur,
 * 4.1). Le rendu **réel** (exact, saisie par obstacle) est `HeatmapView`.
 */
const LIGNES = ['Oxer', 'Vertical', 'Combi'] as const;
const COLONNES = ['90', '100', '110', '120'] as const;
const INTENSITÉS = [
  [1, 0.85, 0.55, 0.25],
  [0.9, 0.7, 0.5, 0.3],
  [0.8, 0.45, 0.2, 0.1],
] as const;

export function HeatmapAperçu() {
  return (
    <View style={styles.preview}>
      <Text variant="label" color="textMuted">
        Heatmap type × hauteur
      </Text>
      <View style={styles.colHeader}>
        <View style={styles.rowLabelSpacer} />
        {COLONNES.map((c) => (
          <Text key={c} variant="caption" color="textMuted" style={styles.colLabel}>
            {c}
          </Text>
        ))}
      </View>
      {LIGNES.map((ligne, i) => (
        <View key={ligne} style={styles.row}>
          <Text variant="caption" style={styles.rowLabel}>
            {ligne}
          </Text>
          {COLONNES.map((c, j) => (
            <View
              key={c}
              style={[styles.cell, { backgroundColor: colors.primary, opacity: INTENSITÉS[i][j] }]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  preview: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  colHeader: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  rowLabelSpacer: { width: 64 },
  colLabel: { flex: 1, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  rowLabel: { width: 64 },
  cell: {
    flex: 1,
    height: 36,
    borderRadius: radius.sm,
  },
});
