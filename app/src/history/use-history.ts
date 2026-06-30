import type { PageHistorique, SéanceSortie } from '@hpt/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuth } from '../auth';
import { createHistoryApi } from './history-api';

/** Taille de page de l'historique (séances par tranche). */
const PAGE_SIZE = 20;

/**
 * État de l'**historique mono-cheval** (lot 3.4) — TanStack Query, **scopé au
 * cheval courant** (en-tête, 1.4) et au compte (la clé porte les deux : un
 * changement de session/cheval repart d'un historique vierge). Pagination
 * **simple** par curseur (`useInfiniteQuery` → « charger les plus anciennes »),
 * **comme le fil** (3.1). N'est activé qu'avec une session **et** un cheval
 * (sinon : invitation côté écran).
 *
 * Surface de **lecture** : aucune mutation. Il se rafraîchit à l'ouverture — une
 * séance supprimée (2.4) **disparaît** par construction (le serveur relit
 * l'historique courant ; rien n'est mis en cache d'agrégat).
 */
export function useHistory(chevalId: string | null) {
  const { client, status, account } = useAuth();
  const api = useMemo(() => createHistoryApi(client), [client]);

  return useInfiniteQuery({
    queryKey: ['history', account?.id ?? null, chevalId],
    queryFn: ({ pageParam }) =>
      api.getHistory(chevalId as string, { before: pageParam, limit: PAGE_SIZE }),
    enabled: status === 'authenticated' && chevalId != null,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.has_more ? (last.next_before ?? undefined) : undefined),
    staleTime: 15_000,
  });
}

/** Aplati les pages chargées en une liste de séances (récent → ancien). */
export function flattenHistory(pages: PageHistorique[] | undefined): SéanceSortie[] {
  return (pages ?? []).flatMap((p) => p.séances);
}
