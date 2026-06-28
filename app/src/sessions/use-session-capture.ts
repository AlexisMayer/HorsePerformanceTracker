import type { SéanceSortie } from '@hpt/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import {
  type Dispatch,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { useAuth } from '../auth';
import {
  type DraftAction,
  draftFromPreviousSession,
  draftReducer,
  draftToCreateDto,
  emptyDraft,
  type SessionDraft,
} from './draft';
import { createDraftStore } from './draft-store';
import { createSessionsApi } from './sessions-api';
import { submitSession } from './submit';

export interface SessionCapture {
  draft: SessionDraft;
  dispatch: Dispatch<DraftAction>;
  /** Dernière séance du cheval (pour la duplication), ou `null`. */
  previous: SéanceSortie | null;
  hasPrevious: boolean;
  /** Pré-remplit le brouillon par duplication de la séance précédente (§3.4). */
  prefillFromPrevious: () => void;
  loadingPrevious: boolean;
  /** Lance l'enregistrement résilient (idempotence + réessai). */
  save: () => void;
  saving: boolean;
  /** Vrai pendant un réessai automatique après coupure passagère. */
  retrying: boolean;
  /** Vrai une fois la séance enregistrée (confirmation « Enregistré »). */
  saved: boolean;
  /** La séance créée (point d'entrée vers son édition/suppression — lot 2.4). */
  savedSession: SéanceSortie | null;
  error: Error | null;
}

const sessionsQueryKey = (chevalId: string) => ['sessions', chevalId] as const;

/**
 * Orchestration de l'**écran de saisie** (lot 2.3) — assemble les briques pures :
 *
 *  - **brouillon** édité par deltas (`draftReducer`), mirroir sur un **store
 *    local** (`draftStore`, secure storage) pour ne **jamais perdre une saisie**,
 *    réhydraté à l'ouverture et effacé à l'enregistrement réussi ;
 *  - **duplication de la séance précédente** lue via l'API 2.2 (`listForHorse`,
 *    dernière séance) — aucune route serveur nouvelle ;
 *  - **enregistrement résilient** : `submitSession` rejoue la **même clé
 *    d'idempotence** sur coupure passagère (pas de doublon, 2.2) ; l'état serveur
 *    passe par **TanStack Query** (Stack §3.1).
 *
 * Le client HTTP **authentifié** est celui d'`auth-context` (access + interceptor
 * 401 de 1.4) — réutilisé, jamais recréé.
 */
export function useSessionCapture(chevalId: string): SessionCapture {
  const { client } = useAuth();
  const queryClient = useQueryClient();
  const services = useMemo(
    () => ({ api: createSessionsApi(client), draftStore: createDraftStore(SecureStore) }),
    [client],
  );

  const [draft, dispatch] = useReducer(draftReducer, undefined, () => emptyDraft());
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const hydratedRef = useRef(false);
  const [retrying, setRetrying] = useState(false);
  const [saved, setSaved] = useState(false);

  // Dernière séance du cheval → base de la duplication (boucle nominale §3.4).
  const sessionsQuery = useQuery({
    queryKey: sessionsQueryKey(chevalId),
    queryFn: () => services.api.listForHorse(chevalId),
    enabled: Boolean(chevalId),
    staleTime: 30_000,
  });
  const list = sessionsQuery.data;
  const previous = list && list.length > 0 ? list[list.length - 1] : null;

  // Réhydrate un brouillon persistant (survit à une fermeture de l'app).
  useEffect(() => {
    let cancelled = false;
    hydratedRef.current = false;
    services.draftStore.load(chevalId).then((persisted) => {
      if (cancelled) return;
      if (persisted) dispatch({ kind: 'replace', draft: persisted });
      hydratedRef.current = true;
    });
    return () => {
      cancelled = true;
    };
  }, [chevalId, services]);

  // Autosauvegarde du brouillon à chaque édition (après réhydratation).
  useEffect(() => {
    if (!hydratedRef.current) return;
    services.draftStore.save(chevalId, draft).catch(() => {});
  }, [draft, chevalId, services]);

  const mutation = useMutation<SéanceSortie, Error, void>({
    mutationFn: async () => {
      setRetrying(false);
      // DTO bâti à l'instant de l'envoi (clé d'idempotence stable du brouillon).
      const dto = draftToCreateDto(draftRef.current);
      return submitSession(services.api, chevalId, dto, { onRetry: () => setRetrying(true) });
    },
    onSuccess: async () => {
      setRetrying(false);
      await services.draftStore.clear(chevalId);
      queryClient.invalidateQueries({ queryKey: sessionsQueryKey(chevalId) });
      setSaved(true);
    },
    onError: () => setRetrying(false),
  });

  const prefillFromPrevious = useCallback(() => {
    if (previous) dispatch({ kind: 'replace', draft: draftFromPreviousSession(previous) });
  }, [previous]);

  return {
    draft,
    dispatch,
    previous,
    hasPrevious: Boolean(previous),
    prefillFromPrevious,
    loadingPrevious: sessionsQuery.isLoading,
    save: () => mutation.mutate(),
    saving: mutation.isPending,
    retrying,
    saved,
    savedSession: mutation.data ?? null,
    error: mutation.error,
  };
}
