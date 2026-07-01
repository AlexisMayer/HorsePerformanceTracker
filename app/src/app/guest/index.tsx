import type { EntréeFeed } from '@hpt/shared';
import { useCallback } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import {
  entréeKey,
  FeedEntryCard,
  flattenFeed,
  MilestoneCard,
  RegularityEntry,
  useFeed,
} from '../../feed';
import { GUEST_READ_BASE, useGuestAccess } from '../../guest-access';
import { MetricsHero } from '../../metrics';
import { colors, spacing } from '../../theme';
import { Screen } from '../../ui';
import { EmptyState } from '../../ui/EmptyState';

/**
 * **Feed invité** (lot 4.6, UI/UX §6.7) — le fil du **cheval partagé**, en
 * **lecture seule**. Réutilise **tel quel** le feed (3.1) et les héros (3.2) via le
 * `basePath` invité (`GUEST_READ_BASE`, `read-scope`) : mêmes cartes, mêmes jalons,
 * scopé par l'**octroi** côté serveur. Aucune saisie, aucun sélecteur — le cheval
 * vient de l'accès partagé. En-tête + bandeau « lecture seule » fournis par la
 * coquille (`guest/_layout`).
 */
export default function GuestFeedScreen() {
  const { sharedHorses } = useGuestAccess();
  const chevalId = sharedHorses[0]?.cheval_id ?? null;
  const chevalNom = sharedHorses[0]?.cheval_nom ?? null;
  const feed = useFeed(chevalId, GUEST_READ_BASE);
  const entrées = flattenFeed(feed.data?.pages);

  const renderItem = useCallback(({ item }: { item: EntréeFeed }) => {
    switch (item.kind) {
      case 'séance':
        return <FeedEntryCard entrée={item} />;
      case 'régularité':
        return <RegularityEntry entrée={item} />;
      case 'jalon':
        return <MilestoneCard entrée={item} />;
      default:
        return null;
    }
  }, []);

  const onEndReached = useCallback(() => {
    if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage();
  }, [feed.hasNextPage, feed.isFetchingNextPage, feed.fetchNextPage]);

  return (
    <Screen edges={['left', 'right']} contentStyle={styles.screen}>
      <FlatList
        style={styles.list}
        data={entrées}
        keyExtractor={entréeKey}
        renderItem={renderItem}
        contentContainerStyle={entrées.length === 0 ? styles.emptyContent : styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={<MetricsHero chevalId={chevalId} basePath={GUEST_READ_BASE} />}
        ListEmptyComponent={
          <GuestFeedEmpty chevalNom={chevalNom} isLoading={feed.isLoading} isError={feed.isError} />
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          feed.isFetchingNextPage ? (
            <View style={styles.footer}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null
        }
        refreshControl={
          chevalId ? (
            <RefreshControl
              refreshing={feed.isRefetching && !feed.isFetchingNextPage}
              onRefresh={feed.refetch}
              tintColor={colors.primary}
            />
          ) : undefined
        }
      />
    </Screen>
  );
}

/** Vide/chargement/erreur du fil invité — toujours une invitation sobre (UI/UX §7). */
function GuestFeedEmpty({
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
        title="Fil indisponible"
        message="Impossible de charger le fil pour le moment. Vérifie ta connexion et réessaie."
      />
    );
  }
  return (
    <EmptyState
      icon="trophy-outline"
      title="Le fil prendra vie ici"
      message={`Dès que ${chevalNom ?? 'ton cheval'} enchaînera des séances, sa progression s’affichera ici.`}
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
