import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AiBilanCard, useBilanAugmenté } from '../../../ai-bilan';
import { useEntitlement } from '../../../entitlements';
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
 * Carte **simple** (gratuite, tous comptes — Spec §8), **plus** le **bilan
 * augmenté IA relu** (lot 4.5, premium/pro) quand il existe : la relecture passe
 * par `GET /sessions/:id/ai-bilan` — **aucune régénération** (§7.3). On y
 * **renvoie** vers l'**édition existante** (2.4) — point d'entrée naturel, jamais
 * réimplémenté. Pas de bilan de progression PDF ici (4.4, objet distinct).
 */
export default function SessionCardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { currentHorse } = useHorses();
  const nomCheval = currentHorse?.nom ?? '';
  const { carte, loading, cardRef, partager, sharing } = useShareCard(id ?? null, nomCheval);

  // Relecture du bilan augmenté (premium/pro) — sans régénération (§7.3). Lu
  // seulement si la capacité est débloquée ; `null` (404) ⇒ rien à afficher.
  const { entitlement } = useEntitlement();
  const augmentéCapacité = entitlement?.capacités?.bilan_augmenté ?? false;
  const augmenté = useBilanAugmenté(id ?? null, augmentéCapacité);

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
          {/* Bilan augmenté IA relu (lot 4.5) — s'affiche seulement s'il existe ;
              GET, jamais de régénération (§7.3). */}
          {augmenté.data ? <AiBilanCard bilan={augmenté.data} /> : null}
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
