import type { AccèsInvitéSortie } from '@hpt/shared';
import {
  type UseMutationResult,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuth } from '../auth';
import { createGuestAccessApi } from './guest-access-api';

/**
 * État de **gestion des invités** d'un cheval (lot 4.6, vue **coach**) — liste
 * les accès (`GET /horses/:id/guest-access`) + mutations **inviter** et **révoquer**,
 * sur le client **authentifié**. La clé porte le compte **et** le cheval. N'est
 * activé qu'avec une session **et** un cheval.
 *
 * Le serveur reste l'**autorité** : `comptes_invité` est **Pro** (403 sinon), la
 * propriété du cheval scope la lecture (404 si étranger), les doublons sont
 * refusés (409). L'écran (fiche cheval) n'affiche la gestion que si la capacité
 * est débloquée — mais c'est le **serveur** qui tranche.
 */
export interface GuestInvitesState {
  invites: AccèsInvitéSortie[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  invite: UseMutationResult<AccèsInvitéSortie, Error, string>;
  revoke: UseMutationResult<void, Error, string>;
}

export function useGuestInvites(chevalId: string | null): GuestInvitesState {
  const { client, status, account } = useAuth();
  const queryClient = useQueryClient();
  const api = useMemo(() => createGuestAccessApi(client), [client]);

  const queryKey = ['guest-invites', account?.id ?? null, chevalId];

  const query = useQuery({
    queryKey,
    queryFn: () => api.lister(chevalId as string),
    enabled: status === 'authenticated' && chevalId != null,
    staleTime: 15_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const invite = useMutation<AccèsInvitéSortie, Error, string>({
    mutationFn: (email) => api.inviter(chevalId as string, email),
    onSuccess: invalidate,
  });

  const revoke = useMutation<void, Error, string>({
    mutationFn: (accèsId) => api.révoquer(accèsId),
    onSuccess: invalidate,
  });

  return {
    invites: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: () => query.refetch(),
    invite,
    revoke,
  };
}
