import type { SéanceSortie } from '@hpt/shared';
import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { ActivityIndicator, RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { GUEST_READ_BASE, useGuestAccess } from '../../guest-access';
import { flattenHistory, groupByMonth, HistoryEntryCard, useHistory } from '../../history';
import { colors, spacing } from '../../theme';
import { Screen, Text } from '../../ui';
import { EmptyState } from '../../ui/EmptyState';

/**
 * **Historique invité** (lot 4.6, UI/UX §6.7) — les séances passées du **cheval
 * partagé**, groupées par mois, avec **bilans de séance simples** (`✓`, rouvrables).
 * **Pas de ✦ augmenté** : on **ne passe jamais** `augmentéDisponible` (le bilan IA
 * est exclu de la vue invité, Spec §9.5) — le slot câblé en 3.4 reste vide **par
 * absence de donnée**. Réutilise l'historique (3.4) via le `basePath` invité
 * (`read-scope`). Lecture seule ; la ré-ouverture du bilan simple emprunte l'écran
 * `sessions/[id]/card` (3.3) — lui-même en lecture.
 */
export default function GuestHistoriqueScreen() {
  const { sharedHorses } = useGuestAccess();
  const router = useRouter();
  const chevalId = sharedHorses[0]?.cheval_id ?? null;
  const chevalNom = sharedHorses[0]?.cheval_nom ?? null;
  const history = useHistory(chevalId, GUEST_READ_BASE);
  const séances = flattenHistory(history.data?.pages);
  const sections = useMemo(() => groupByMonth(séances), [séances]);

  const renderItem = useCallback(
    ({ item }: { item: SéanceSortie }) => (
      // Aucun `augmentéDisponible` : la vue invité n'affiche jamais le ✦ (§9.5).
      <HistoryEntryCard séance={item} onOuvrir={() => router.push(`/sessions/${item.id}/card`)} />
    ),
    [router],
  );

  const onEndReached = useCallback(() => {
    if (history.hasNextPage && !history.isFetchingNextPage) history.fetchNextPage();
  }, [history.hasNextPage, history.isFetchingNextPage, history.fetchNextPage]);

  return (
    <Screen edges={['left', 'right']} contentStyle={styles.screen}>
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
          <GuestHistoryEmpty
            chevalNom={chevalNom}
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

/** Vide/chargement/erreur de l'historique invité — invitation sobre (UI/UX §7). */
function GuestHistoryEmpty({
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
  return (
    <EmptyState
      icon="time-outline"
      title="Les séances s'afficheront ici"
      message={`Chaque séance de ${chevalNom ?? 'ton cheval'} rejoindra cet historique, avec son bilan à consulter.`}
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
