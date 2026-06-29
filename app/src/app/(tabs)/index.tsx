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
import { HorseSelector, useHorses } from '../../horses';
import { colors, spacing } from '../../theme';
import { Screen } from '../../ui';
import { EmptyState } from '../../ui/EmptyState';
import { ScreenHeader } from '../../ui/ScreenHeader';

/**
 * Onglet **Feed** (UI/UX §5/§6.2, Spec §5.1) — le **fil mono-cheval**, cœur de la
 * rétention, vu à chaque ouverture et **fonctionnel dès la séance n°1**. Scopé au
 * **cheval courant** (sélecteur en-tête, 1.4). Chaque séance devient une entrée
 * (faits objectifs en avant, contexte en légende), avec **jalons injectés**
 * (laiton) et **entrées de régularité** (Plat).
 *
 * **État vide = invitation** (UI/UX §7), jamais un vide muet. Le **bloc héros**
 * (courbe de hauteur maîtrisée + vitrine à records) est le lot **3.2** : il
 * s'insérera **au-dessus** de ce fil (cf. `ListHeaderComponent`) — on ne le
 * construit pas ici. Pagination simple (charge les plus anciennes en fin de
 * liste). Jamais verrouillé (gratuit).
 */
export default function FeedScreen() {
  const { currentHorse } = useHorses();
  const chevalId = currentHorse?.id ?? null;
  const feed = useFeed(chevalId);
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
      <ScreenHeader title="Feed" right={<HorseSelector />} />
      <FlatList
        style={styles.list}
        data={entrées}
        keyExtractor={entréeKey}
        renderItem={renderItem}
        contentContainerStyle={entrées.length === 0 ? styles.emptyContent : styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <FeedEmpty
            chevalNom={currentHorse?.nom ?? null}
            isLoading={feed.isLoading}
            isError={feed.isError}
          />
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

/** Vide/chargement/erreur du fil — toujours une **invitation** (UI/UX §7). */
function FeedEmpty({
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
  if (!chevalNom) {
    return (
      <EmptyState
        icon="paw-outline"
        title="Choisis un cheval"
        message="Ajoute un cheval depuis le sélecteur en haut, puis logue ta première séance pour suivre sa progression."
      />
    );
  }
  return (
    <EmptyState
      icon="trophy-outline"
      title="Ton fil prendra vie ici"
      message={`Logue ta première séance pour voir ${chevalNom} progresser.`}
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
