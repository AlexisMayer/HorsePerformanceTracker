import type { SéanceSortie } from '@hpt/shared';
import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { ActivityIndicator, RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { useBilansAugmentésDisponibles } from '../../ai-bilan';
import { useEntitlement } from '../../entitlements';
import { flattenHistory, groupByMonth, HistoryEntryCard, useHistory } from '../../history';
import { HorseSelector, useHorses } from '../../horses';
import { colors, spacing } from '../../theme';
import { Screen, Text } from '../../ui';
import { EmptyState } from '../../ui/EmptyState';
import { ScreenHeader } from '../../ui/ScreenHeader';

/**
 * Onglet **Historique** (UI/UX §5/§6.4, Spec §1/§8) — les **séances passées** du
 * **cheval courant** (sélecteur en-tête, 1.4), **groupées par mois**, avec faits
 * objectifs et **badges de bilan** (`✓ simple` ; `✦ augmenté` **seulement si
 * présent** — slot câblé mais vide jusqu'au lot 4.5). Toucher une carte **rouvre
 * son bilan simple** (carte 3.3, `GET /sessions/:id/card`).
 *
 * **Surface app sans module backend dédié** : lit des séances brutes paginées via
 * `sessions` et **compose** ici (faits, mois, badges). Lecture seule, **jamais
 * verrouillée** (historique conservé, gratuit — Spec §8). **État vide =
 * invitation** (UI/UX §7). Pagination simple (charge les plus anciennes en fin de
 * liste), comme le fil (3.1).
 */
export default function HistoriqueScreen() {
  const { currentHorse } = useHorses();
  const router = useRouter();
  const chevalId = currentHorse?.id ?? null;
  const history = useHistory(chevalId);
  const séances = flattenHistory(history.data?.pages);
  const sections = useMemo(() => groupByMonth(séances), [séances]);

  // Slot ✦ (lot 4.5) : on lit `ai-bilan` **uniquement** si la capacité est
  // débloquée (premium/pro) — le gratuit ne fait aucun appel et ne voit jamais de
  // ✦. L'ensemble des séances qui ont un bilan augmenté remplit le slot pré-câblé
  // en 3.4 (sans toucher à `badgesBilan`).
  const { entitlement } = useEntitlement();
  const augmentéCapacité = entitlement?.capacités?.bilan_augmenté ?? false;
  const dispo = useBilansAugmentésDisponibles(chevalId, augmentéCapacité);
  const augmentés = useMemo(() => new Set(dispo.data?.seance_ids ?? []), [dispo.data?.seance_ids]);

  const renderItem = useCallback(
    ({ item }: { item: SéanceSortie }) => (
      <HistoryEntryCard
        séance={item}
        augmentéDisponible={augmentés.has(item.id)}
        onOuvrir={() => router.push(`/sessions/${item.id}/card`)}
      />
    ),
    [router, augmentés],
  );

  const onEndReached = useCallback(() => {
    if (history.hasNextPage && !history.isFetchingNextPage) history.fetchNextPage();
  }, [history.hasNextPage, history.isFetchingNextPage, history.fetchNextPage]);

  return (
    <Screen edges={['left', 'right']} contentStyle={styles.screen}>
      <ScreenHeader title="Historique" right={<HorseSelector />} />
      <SectionList
        style={styles.list}
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={({ section }) => (
          <Text variant="label" color="secondary" style={styles.monthHeader}>
            {section.title}
          </Text>
        )}
        contentContainerStyle={sections.length === 0 ? styles.emptyContent : styles.listContent}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <HistoryEmpty
            chevalNom={currentHorse?.nom ?? null}
            isLoading={history.isLoading}
            isError={history.isError}
          />
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          history.isFetchingNextPage ? (
            <View style={styles.footer}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null
        }
        refreshControl={
          chevalId ? (
            <RefreshControl
              refreshing={history.isRefetching && !history.isFetchingNextPage}
              onRefresh={history.refetch}
              tintColor={colors.primary}
            />
          ) : undefined
        }
      />
    </Screen>
  );
}

/** Vide/chargement/erreur de l'historique — toujours une **invitation** (UI/UX §7). */
function HistoryEmpty({
  chevalNom,
  isLoading,
  isError,
}: {
  chevalNom: string | null;
  isLoading: boolean;
  isError: boolean;
}) {
  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (isError) {
    return (
      <EmptyState
        icon="cloud-offline-outline"
        title="Historique indisponible"
        message="Impossible de charger l'historique pour le moment. Vérifie ta connexion et réessaie."
      />
    );
  }
  if (!chevalNom) {
    return (
      <EmptyState
        icon="paw-outline"
        title="Choisis un cheval"
        message="Ajoute un cheval depuis le sélecteur en haut, puis logue une séance pour la retrouver ici."
      />
    );
  }
  return (
    <EmptyState
      icon="time-outline"
      title="Tes séances s'archivent ici"
      message={`Chaque séance de ${chevalNom} rejoindra cet historique, avec son bilan à rouvrir quand tu veux.`}
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: 0,
    gap: 0,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  emptyContent: {
    flexGrow: 1,
  },
  monthHeader: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxs,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  footer: {
    paddingVertical: spacing.md,
  },
});
