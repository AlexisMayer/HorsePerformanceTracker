import type { ChevalPartagé } from '@hpt/shared';
import {
  type UseMutationResult,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { createContext, type ReactNode, useContext, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../auth';
import { createGuestAccessApi } from './guest-access-api';
import { takePendingInvite } from './pending-invite';

/**
 * État `guest-access` de l'app (lot 4.6) — **lit les accès partagés de l'invité**
 * (`GET /guest-access/me`) et le **stocke dans l'état app** (TanStack Query, Stack
 * §3.1), sur le client **authentifié** d'`auth-context`. La requête n'est activée
 * qu'une fois la session établie ; sa clé est portée par le compte → une nouvelle
 * session repart d'accès vierges.
 *
 * **Onboarding invité** : à l'authentification, si un **jeton d'invitation en
 * attente** existe (ouvert par deep link avant login), on l'**accepte
 * automatiquement** puis on rafraîchit les accès — l'invité **atterrit** sur le
 * cheval partagé sans passer par la création de cheval (Spec §9.5). L'accès reste
 * l'**autorité serveur** (l'octroi, pas ce contexte).
 */
export interface GuestAccessContextValue {
  /** Chevaux partagés que l'invité peut consulter (accès actifs), ou `[]`. */
  sharedHorses: ChevalPartagé[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  /** Accepte une invitation (jeton) — relie le compte et renvoie où atterrir. */
  accept: UseMutationResult<ChevalPartagé, Error, string>;
}

const GuestAccessContext = createContext<GuestAccessContextValue | null>(null);

const GUEST_ACCESS_QUERY_KEY = ['guest-access', 'me'] as const;

export function GuestAccessProvider({ children }: { children: ReactNode }) {
  const { client, status, account } = useAuth();
  const queryClient = useQueryClient();
  const api = useMemo(() => createGuestAccessApi(client), [client]);

  const queryKey = [...GUEST_ACCESS_QUERY_KEY, account?.id ?? null];

  const query = useQuery({
    queryKey,
    queryFn: () => api.mesAccès(),
    enabled: status === 'authenticated',
    staleTime: 30_000,
  });

  const accept = useMutation<ChevalPartagé, Error, string>({
    mutationFn: (token) => api.accepter(token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  // Onboarding invité : consomme un éventuel jeton en attente (deep link ouvert
  // avant login) **une fois authentifié**. `takePendingInvite` est à usage unique
  // → pas de double acceptation ; le ref évite de re-déclencher pendant la mutation.
  const acceptingRef = useRef(false);
  useEffect(() => {
    if (status !== 'authenticated' || acceptingRef.current) return;
    const token = takePendingInvite();
    if (!token) return;
    acceptingRef.current = true;
    accept.mutate(token, {
      onSettled: () => {
        acceptingRef.current = false;
      },
    });
  }, [status, accept.mutate]);

  const value: GuestAccessContextValue = {
    sharedHorses: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: () => query.refetch(),
    accept,
  };

  return <GuestAccessContext.Provider value={value}>{children}</GuestAccessContext.Provider>;
}

export function useGuestAccess(): GuestAccessContextValue {
  const value = useContext(GuestAccessContext);
  if (!value) throw new Error('useGuestAccess doit être utilisé dans un <GuestAccessProvider>.');
  return value;
}
