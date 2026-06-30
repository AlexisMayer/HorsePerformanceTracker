import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useHorses } from '../../../horses';
import { BilanCard, useShareCard } from '../../../sharing';
import { colors, spacing } from '../../../theme';
import { BackHeader, Button, EmptyState, Screen } from '../../../ui';

/**
 * **Ré-ouverture du bilan de séance simple** depuis l'historique (lot 3.4, UI/UX
 * §6.4). Réutilise **tel quel** l'endpoint et les composants de 3.3 : la **même**
 * carte (`BilanCard`) composée par le **même** `GET /sessions/:id/card`
 * (`useShareCard`) — la composition est sans état, donc rejouable pour n'importe
 * quelle séance passée. Aucun nouvel endpoint, aucune logique de carte
 * réimplémentée.
 *
 * Carte **simple** uniquement (gratuite, tous comptes — Spec §8) : pas de bilan
 * augmenté IA (4.5), pas de bilan de progression PDF (4.4). On y **renvoie** vers
 * l'**édition existante** (2.4) — point d'entrée naturel, jamais réimplémenté.
 */
export default function SessionCardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { currentHorse } = useHorses();
  const nomCheval = currentHorse?.nom ?? '';
  const { carte, loading, cardRef, partager, sharing } = useShareCard(id ?? null, nomCheval);

  return (
    <Screen scroll contentStyle={styles.content}>
      <BackHeader title="Bilan de séance" onBack={() => router.back()} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : carte ? (
        <>
          <BilanCard ref={cardRef} carte={carte} nomCheval={nomCheval} />
          <Button
            label="Partager"
            loadingLabel="Partage…"
            loading={sharing}
            onPress={() => {
              void partager();
            }}
          />
          {/* Renvoi vers l'édition/suppression existante (2.4) — pas réimplémentée. */}
          <Button
            label="Modifier la séance"
            variant="ghost"
            onPress={() => router.push(`/sessions/${id}/edit`)}
          />
        </>
      ) : (
        <>
          <EmptyState
            icon="cloud-offline-outline"
            title="Bilan indisponible"
            message="Impossible de charger ce bilan pour le moment. Vérifie ta connexion et réessaie."
          />
          <Button label="Retour" variant="secondary" onPress={() => router.back()} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
});
