import type { CombinaisonSortie } from '@hpt/shared';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { useCombinations } from '../../combinations';
import { colors, spacing } from '../../theme';
import { BackHeader, Button, Card, EmptyState, Screen, Text } from '../../ui';

/**
 * Écran **Bibliothèque de combinaisons** (lot 2.5, Spec §4) — liste **consultable**
 * des réutilisables du compte, **triée par usage** (autorité serveur : « plus
 * utilisées, récentes »). Chaque entrée affiche sa structure (types ordonnés) et
 * son nombre d'instanciations. La **suppression** dé-lie les obstacles (`SET
 * NULL`) sans casser leur taux (confirmée — qualité de plancher).
 *
 * La **création** se fait depuis la saisie (« Enregistrer cette combinaison » sur
 * un obstacle Combinaison détaillé). Aucun plafond ici : la limite gratuit/payant
 * (Spec §4.4) est l'affaire de la garde d'entitlement (lot 4.1).
 */
export default function CombinationsLibraryScreen() {
  const { combinaisons, isLoading, remove } = useCombinations();
  const router = useRouter();

  const confirmDelete = (combo: CombinaisonSortie) => {
    Alert.alert(
      'Supprimer cette combinaison ?',
      `« ${combo.nom} » sera retirée de ta bibliothèque. Les séances qui l'utilisaient gardent leurs obstacles (hauteur, fautes, taux) ; elles perdent seulement le lien nommé.`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => remove.mutate(combo.id) },
      ],
    );
  };

  return (
    <Screen scroll edges={['top', 'left', 'right']} contentStyle={styles.content}>
      <BackHeader title="Mes combinaisons" onBack={() => router.back()} />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : combinaisons.length === 0 ? (
        <EmptyState
          icon="layers-outline"
          title="Aucune combinaison enregistrée"
          message="Détaille une combinaison pendant une saisie, puis « Enregistrer cette combinaison » pour la rejouer ensuite sur n'importe quel cheval — en ne saisissant que la hauteur."
        />
      ) : (
        combinaisons.map((combo) => (
          <Card key={combo.id}>
            <View style={styles.rowBetween}>
              <Text variant="h2">{combo.nom}</Text>
              <Text variant="caption" color="textMuted">
                {combo.usage_count > 0 ? `utilisée ${combo.usage_count}×` : 'jamais utilisée'}
              </Text>
            </View>
            <Text variant="body" color="textMuted">
              {combo.éléments.join(' · ')}
            </Text>
            <Button variant="ghost" label="Supprimer" onPress={() => confirmDelete(combo)} />
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
  },
  center: {
    paddingVertical: spacing.xl,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
});
