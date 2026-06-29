import type { CombinaisonCréerDto, CombinaisonModifierDto, CombinaisonSortie } from '@hpt/shared';
import {
  type UseMutationResult,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { useAuth } from '../auth';
import { createCombinationsApi } from './combinations-api';

/**
 * État `combinations` de l'app (lot 2.5). **Bibliothèque de compte** des
 * combinaisons réutilisables (TanStack Query, Stack §3.1) + mutations, sur le
 * client **authentifié** exposé par `auth-context`. La liste arrive **déjà triée
 * par usage** (anti-bloat, autorité serveur) — l'app n'a rien à re-trier.
 *
 * `update` reflète **modification = nouvelle** : il crée une nouvelle réutilisable
 * (l'ancienne reste intacte) ; on invalide simplement la liste, qui ré-affiche
 * les deux. Aucun plafond géré ici (gating = lot 4.1).
 */
export interface CombinationsContextValue {
  combinaisons: CombinaisonSortie[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  create: UseMutationResult<CombinaisonSortie, Error, CombinaisonCréerDto>;
  update: UseMutationResult<CombinaisonSortie, Error, { id: string; dto: CombinaisonModifierDto }>;
  remove: UseMutationResult<void, Error, string>;
}

const CombinationsContext = createContext<CombinationsContextValue | null>(null);

const COMBINATIONS_QUERY_KEY = ['combinations'] as const;

export function CombinationsProvider({ children }: { children: ReactNode }) {
  const { client, status, account } = useAuth();
  const queryClient = useQueryClient();
  const api = useMemo(() => createCombinationsApi(client), [client]);

  // Clé portée par le compte : un changement de session repart d'une liste vierge.
  const queryKey = [...COMBINATIONS_QUERY_KEY, account?.id ?? null];

  const query = useQuery({
    queryKey,
    queryFn: () => api.list(),
    enabled: status === 'authenticated',
    staleTime: 30_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const create = useMutation<CombinaisonSortie, Error, CombinaisonCréerDto>({
    mutationFn: (dto) => api.create(dto),
    onSuccess: invalidate,
  });

  const update = useMutation<CombinaisonSortie, Error, { id: string; dto: CombinaisonModifierDto }>(
    {
      mutationFn: ({ id, dto }) => api.update(id, dto),
      onSuccess: invalidate,
    },
  );

  const remove = useMutation<void, Error, string>({
    mutationFn: (id) => api.remove(id),
    onSuccess: invalidate,
  });

  const value: CombinationsContextValue = {
    combinaisons: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: () => query.refetch(),
    create,
    update,
    remove,
  };

  return <CombinationsContext.Provider value={value}>{children}</CombinationsContext.Provider>;
}

export function useCombinations(): CombinationsContextValue {
  const value = useContext(CombinationsContext);
  if (!value) {
    throw new Error('useCombinations doit être utilisé dans un <CombinationsProvider>.');
  }
  return value;
}
