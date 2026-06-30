import { StyleSheet, View } from 'react-native';
import { LockedFeature } from '../../entitlements';
import { HorseSelector } from '../../horses';
import { colors, radius, spacing } from '../../theme';
import { EmptyState, Screen, Text } from '../../ui';
import { ScreenHeader } from '../../ui/ScreenHeader';

/**
 * Onglet **Analytique** (UI/UX §5/§6.5). Le diagnostic réel (heatmap type ×
 * hauteur, benchmark) arrive au lot **5.1** ; ici on pose le **gating** (4.2) :
 * en **gratuit**, la fonction est **grisée + cadenas** (`LockedFeature`) et son
 * appui ouvre l'upgrade (verrouillage = invitation, §7) ; en **premium/pro**, on
 * montre l'invitation neutre en attendant 5.1.
 *
 * Le **gating reste l'autorité serveur** (4.1) : `LockedFeature` lit
 * l'entitlement, il ne décide rien.
 */
export default function AnalytiqueScreen() {
  return (
    <Screen edges={['left', 'right']} contentStyle={{ flex: 1, padding: 0, gap: 0 }}>
      <ScreenHeader title="Analytique" right={<HorseSelector />} />
      <LockedFeature
        capacité="analytique_diagnostic"
        titre="Analytique de diagnostic"
        aperçu={<HeatmapAperçu />}
      >
        <EmptyState
          icon="stats-chart-outline"
          title="Tes diagnostics apparaîtront ici"
          message="Avec assez de séances, ta heatmap type × hauteur et tes benchmarks révéleront tes points forts."
        />
      </LockedFeature>
    </Screen>
  );
}

/**
 * Aperçu **grisé** de la heatmap (UI/UX §6.5) — esquisse non fonctionnelle,
 * montrée sous le voile + cadenas. Le rendu réel (exact, saisie par obstacle)
 * est le lot 5.1.
 */
const LIGNES = ['Oxer', 'Vertical', 'Combi'] as const;
const COLONNES = ['90', '100', '110', '120'] as const;
const INTENSITÉS = [
  [1, 0.85, 0.55, 0.25],
  [0.9, 0.7, 0.5, 0.3],
  [0.8, 0.45, 0.2, 0.1],
] as const;

function HeatmapAperçu() {
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
