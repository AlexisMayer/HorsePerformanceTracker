import { ScrollView, StyleSheet, View } from 'react-native';
import { spacing } from '../theme';
import { EmptyState } from '../ui';
import { BenchmarkSection } from './benchmark-section';
import { HeatmapView } from './heatmap-view';

export interface AnalytiqueContenuProps {
  chevalId: string | null;
  /** Portée de lecture (lot 4.6) : `/horses` (défaut) ou `/guest-access/horses` (invité). */
  basePath?: string;
}

/**
 * **Contenu de l'onglet Analytique** (UI/UX §6.5) — la surface de **diagnostic
 * premium** d'un cheval, empilée dans un seul défilement : la **heatmap type ×
 * hauteur** (5.1) **puis**, **dessous**, le **benchmark à combinaison constante**
 * (5.2). Composant **unique et réutilisable**, paramétré par `basePath` : rendu
 * derrière le verrou pour le **propriétaire** (premium/pro) **et** tel quel pour la
 * **coquille invité** en lecture seule scopée (4.6). Aucune surface n'est
 * dupliquée (Architecture §2/§3).
 */
export function AnalytiqueContenu({ chevalId, basePath }: AnalytiqueContenuProps) {
  if (!chevalId) {
    return (
      <View style={styles.center}>
        <EmptyState
          icon="paw-outline"
          title="Choisis un cheval"
          message="Sélectionne un cheval dans l’en-tête pour voir son diagnostic (heatmap et benchmark)."
        />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <HeatmapView chevalId={chevalId} basePath={basePath} />
      <BenchmarkSection chevalId={chevalId} basePath={basePath} />
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
