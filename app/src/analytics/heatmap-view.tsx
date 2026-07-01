import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { colors, spacing } from '../theme';
import { Card, EmptyState, Text } from '../ui';
import { aDesDonnées } from './heatmap-format';
import { HeatmapGrid } from './heatmap-grid';
import { useHeatmap } from './use-heatmap';

export interface HeatmapViewProps {
  chevalId: string | null;
  /** Portée de lecture (lot 4.6) : `/horses` (défaut) ou `/guest-access/horses` (invité). */
  basePath?: string;
}

/**
 * **Contenu débloqué** de l'onglet Analytique (UI/UX §6.5) : la **heatmap type ×
 * hauteur** du cheval courant, ou une **invitation** tant qu'il n'y a pas de
 * donnée (§7 « écrans vides = invitations »). Rendu **uniquement en premium/pro**
 * (dans le `children` du `LockedFeature`) : le gratuit voit l'aperçu grisé, jamais
 * ceci — et le serveur refuserait la requête (403, autorité 4.1).
 *
 * Lecture seule (TanStack Query) : diagnostic **exact** grâce à la saisie par
 * obstacle (2.3). La heatmap est le **seul** contenu ici ; le **benchmark** (5.2)
 * s'ajoutera **dessous** dans une prochaine tranche.
 */
export function HeatmapView({ chevalId, basePath }: HeatmapViewProps) {
  const { data, isLoading, isError } = useHeatmap(chevalId, basePath);

  if (!chevalId) {
    return (
      <View style={styles.center}>
        <EmptyState
          icon="paw-outline"
          title="Choisis un cheval"
          message="Sélectionne un cheval dans l’en-tête pour voir sa heatmap de réussite."
        />
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={styles.center}>
        <EmptyState
          icon="cloud-offline-outline"
          title="Diagnostic indisponible"
          message="Impossible de charger la heatmap pour le moment. Vérifie ta connexion et réessaie."
        />
      </View>
    );
  }

  if (!aDesDonnées(data)) {
    return (
      <View style={styles.center}>
        <EmptyState
          icon="grid-outline"
          title="Ta heatmap prendra forme ici"
          message="Logue des séances par obstacle (type · hauteur · barres · refus) pour révéler tes points forts, type × hauteur."
        />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Card>
        <Text variant="h2">Heatmap type × hauteur</Text>
        <Text variant="caption" color="textMuted">
          Taux de réussite exact à l’entraînement (couche objective, séances loguées).
        </Text>
        <HeatmapGrid heatmap={data} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
  },
});
