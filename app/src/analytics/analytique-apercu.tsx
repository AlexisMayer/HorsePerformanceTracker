import { StyleSheet, View } from 'react-native';
import { spacing } from '../theme';
import { BenchmarkAperçu } from './benchmark-apercu';
import { HeatmapAperçu } from './heatmap-apercu';

/**
 * Aperçu **grisé** de **toute** l'Analytique (UI/UX §6.5/§3.1) — la heatmap (5.1)
 * **et** le benchmark (5.2), esquissés sous le voile + cadenas du verrou générique
 * (4.2) pour un compte **gratuit**. Cohérent avec « toute l'Analytique est
 * premium/pro » (Spec §8) : le teaser laisse deviner les **deux** diagnostics sans
 * divulguer de vraie donnée (refusée au gratuit côté serveur, 4.1).
 */
export function AnalytiqueAperçu() {
  return (
    <View style={styles.wrap}>
      <View style={styles.heatmap}>
        <HeatmapAperçu />
      </View>
      <BenchmarkAperçu />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    gap: spacing.sm,
  },
  heatmap: {
    flex: 1,
  },
});
