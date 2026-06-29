import type { EntréeFeed } from '@hpt/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuth } from '../auth';
import { createFeedApi } from './feed-api';

/** Taille de page du fil (séances par tranche ; les jalons injectés s'y ajoutent). */
const PAGE_SIZE = 20;

/**
 * État du **fil mono-cheval** (lot 3.1) — TanStack Query, **scopé au cheval
 * courant** (en-tête, 1.4) et au compte (la clé porte les deux : un changement de
 * session/cheval repart d'un fil vierge). Pagination **simple** par curseur
 * (`useInfiniteQuery` → « charger les plus anciennes »). N'est activé qu'avec une
 * session **et** un cheval (sinon : invitation côté écran).
 *
 * Le feed est une surface de **lecture** : aucune mutation ici. Il se
 * rafraîchit à l'ouverture (le serveur recompose les jalons depuis l'historique
 * courant — une suppression de séance, 2.4, est donc reflétée par construction).
 */
export function useFeed(chevalId: string | null) {
  const { client, status, account } = useAuth();
  const api = useMemo(() => createFeedApi(client), [client]);

  return useInfiniteQuery({
    queryKey: ['feed', account?.id ?? null, chevalId],
    queryFn: ({ pageParam }) =>
      api.getFeed(chevalId as string, { before: pageParam, limit: PAGE_SIZE }),
    enabled: status === 'authenticated' && chevalId != null,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.has_more ? (last.next_before ?? undefined) : undefined),
    staleTime: 15_000,
  });
}

/** Aplati les pages chargées en une liste d'entrées (récent → ancien). */
export function flattenFeed(pages: { entrées: EntréeFeed[] }[] | undefined): EntréeFeed[] {
  return (pages ?? []).flatMap((p) => p.entrées);
}

/** Clé de liste stable d'une entrée (séance/régularité = id ; jalon = id+type+hauteur). */
export function entréeKey(entrée: EntréeFeed): string {
  return entrée.kind === 'jalon'
    ? `jalon:${entrée.seance_id}:${entrée.type_jalon}:${entrée.hauteur}`
    : `${entrée.kind}:${entrée.seance_id}`;
}
