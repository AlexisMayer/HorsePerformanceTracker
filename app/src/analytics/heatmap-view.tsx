import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors, spacing } from '../theme';
import { Card, Text } from '../ui';
import { aDesDonnées } from './heatmap-format';
import { HeatmapGrid } from './heatmap-grid';
import { useHeatmap } from './use-heatmap';

export interface HeatmapViewProps {
  chevalId: string | null;
  /** Portée de lecture (lot 4.6) : `/horses` (défaut) ou `/guest-access/horses` (invité). */
  basePath?: string;
}

/**
 * **Bloc heatmap type × hauteur** (UI/UX §6.5) — la heatmap du cheval courant,
 * rendue comme une **carte autonome** (le parent `AnalytiqueContenu` fournit le
 * défilement, la heatmap 5.2 s'empile **au-dessus** du benchmark). Ses états
 * (chargement / erreur / **vide = invitation**, §7) sont **internes à la carte**
 * pour cohabiter avec la section benchmark.
 *
 * Rendu **uniquement en premium/pro** (dans le `children` du `LockedFeature`) ou en
 * **lecture seule scopée invité** (4.6, `basePath`) : le gratuit voit l'aperçu
 * grisé, jamais ceci — et le serveur refuserait la requête (403, autorité 4.1).
 * Lecture seule ; diagnostic **exact** grâce à la saisie par obstacle (2.3).
 */
export function HeatmapView({ chevalId, basePath }: HeatmapViewProps) {
  const { data, isLoading, isError } = useHeatmap(chevalId, basePath);

  // Le message « choisis un cheval » est porté par le parent (`AnalytiqueContenu`).
  if (!chevalId) return null;

  return (
    <Card>
      <Text variant="h2">Heatmap type × hauteur</Text>
      <Text variant="caption" color="textMuted">
        Taux de réussite exact à l’entraînement (couche objective, séances loguées).
      </Text>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : isError || !data ? (
        <Text variant="body" color="textMuted">
          Impossible de charger la heatmap pour le moment. Vérifie ta connexion et réessaie.
        </Text>
      ) : !aDesDonnées(data) ? (
        <Text variant="body" color="textMuted">
          Ta heatmap prendra forme ici : logue des séances par obstacle (type · hauteur · barres ·
          refus) pour révéler tes points forts, type × hauteur.
        </Text>
      ) : (
        <HeatmapGrid heatmap={data} />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  center: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
});
