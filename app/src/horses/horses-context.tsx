import type { ChevalCréerDto, ChevalModifierDto, ChevalSortie } from '@hpt/shared';
import {
  type UseMutationResult,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { useAuth } from '../auth';
import { createHorsesApi } from './horses-api';

/**
 * État `horses` de l'app (lot 2.1). Liste des chevaux du compte (TanStack Query,
 * Stack §3.1) + mutations CRUD, le tout sur le client **authentifié** exposé par
 * `auth-context`. La liste n'est activée que lorsqu'une session existe.
 *
 * **Cheval courant** : en v1 l'app est **mono-cheval** — `currentHorse` est
 * simplement le premier cheval **actif** du compte, ce qui suffit à la coquille
 * (Feed/Historique/Analytique) pour savoir quoi afficher. Le **sélecteur
 * d'en-tête** est *visuellement prévu* (cf. `HorseSelector`) mais **sans logique
 * de bascule multi-cheval** : celle-ci relève du Pro (lot 4.x).
 *
 * **Archivage (lot 4.3, Spec §9.2)** : `activeHorses` / `archivedHorses`
 * partitionnent la liste sur `archivé`. Le **sélecteur** et `currentHorse`
 * n'utilisent que l'**actif** (un cheval archivé **sort de la liste active**,
 * UI/UX §5) ; la **section « archivés »** (gestion) lit `archivedHorses`, en
 * **lecture seule**. `archive`/`unarchive` sont des mutations dédiées (le
 * désarchivage peut être **refusé côté serveur** si le quota du tier est plein).
 */
export interface HorsesContextValue {
  /** Toutes les fiches du compte (actives **et** archivées), telles que renvoyées. */
  horses: ChevalSortie[];
  /** Chevaux **actifs** (non archivés) — l'ordre de la liste renvoyée. */
  activeHorses: ChevalSortie[];
  /** Chevaux **archivés** (lecture seule) — section distincte de la gestion. */
  archivedHorses: ChevalSortie[];
  /** Cheval affiché par la coquille — premier cheval **actif** du compte, ou `null`. */
  currentHorse: ChevalSortie | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  create: UseMutationResult<ChevalSortie, Error, ChevalCréerDto>;
  update: UseMutationResult<ChevalSortie, Error, { id: string; dto: ChevalModifierDto }>;
  remove: UseMutationResult<void, Error, string>;
  archive: UseMutationResult<ChevalSortie, Error, string>;
  unarchive: UseMutationResult<ChevalSortie, Error, string>;
}

const HorsesContext = createContext<HorsesContextValue | null>(null);

const HORSES_QUERY_KEY = ['horses'] as const;

export function HorsesProvider({ children }: { children: ReactNode }) {
  const { client, status, account } = useAuth();
  const queryClient = useQueryClient();
  const horsesApi = useMemo(() => createHorsesApi(client), [client]);

  // Clé portée par le compte : un changement de session repart d'une liste vierge.
  const queryKey = [...HORSES_QUERY_KEY, account?.id ?? null];

  const query = useQuery({
    queryKey,
    queryFn: () => horsesApi.list(),
    enabled: status === 'authenticated',
    staleTime: 30_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const create = useMutation<ChevalSortie, Error, ChevalCréerDto>({
    mutationFn: (dto) => horsesApi.create(dto),
    onSuccess: invalidate,
  });

  const update = useMutation<ChevalSortie, Error, { id: string; dto: ChevalModifierDto }>({
    mutationFn: ({ id, dto }) => horsesApi.update(id, dto),
    onSuccess: invalidate,
  });

  const remove = useMutation<void, Error, string>({
    mutationFn: (id) => horsesApi.remove(id),
    onSuccess: invalidate,
  });

  const archive = useMutation<ChevalSortie, Error, string>({
    mutationFn: (id) => horsesApi.archive(id),
    onSuccess: invalidate,
  });

  const unarchive = useMutation<ChevalSortie, Error, string>({
    mutationFn: (id) => horsesApi.unarchive(id),
    onSuccess: invalidate,
  });

  const horses = query.data ?? [];
  const activeHorses = horses.filter((h) => !h.archivé);
  const archivedHorses = horses.filter((h) => h.archivé);

  const value: HorsesContextValue = {
    horses,
    activeHorses,
    archivedHorses,
    // Le cheval courant (et donc le sélecteur) ignore les archivés (UI/UX §5).
    currentHorse: activeHorses[0] ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: () => query.refetch(),
    create,
    update,
    remove,
    archive,
    unarchive,
  };

  return <HorsesContext.Provider value={value}>{children}</HorsesContext.Provider>;
}

export function useHorses(): HorsesContextValue {
  const value = useContext(HorsesContext);
  if (!value) throw new Error('useHorses doit être utilisé dans un <HorsesProvider>.');
  return value;
}
