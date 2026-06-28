import type { SéanceSortie } from '@hpt/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type Dispatch, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useAuth } from '../auth';
import {
  type DraftAction,
  draftFromSession,
  draftReducer,
  draftToModifierDto,
  emptyDraft,
  type SessionDraft,
} from './draft';
import { createSessionsApi } from './sessions-api';

export interface SessionEdit {
  /** Séance chargée — **source de `date_modification`** ; `null` tant qu'absente. */
  session: SéanceSortie | null;
  loading: boolean;
  /** Vrai si la séance est introuvable (404) ou étrangère au compte. */
  notFound: boolean;
  draft: SessionDraft;
  dispatch: Dispatch<DraftAction>;
  /** Enregistre les modifications (PATCH ; le serveur pose `date_modification`). */
  save: () => void;
  saving: boolean;
  /** Vrai une fois l'édition enregistrée (confirmation « Modifié »). */
  saved: boolean;
  /** La séance telle que renvoyée après édition (porte la `date_modification`). */
  result: SéanceSortie | null;
  /** Supprime la séance (DELETE ; purge cascade — Spec §3.7). */
  remove: () => void;
  removing: boolean;
  /** Vrai une fois la séance supprimée (l'écran peut revenir en arrière). */
  removed: boolean;
  error: Error | null;
}

/** Mêmes clés que `useSessionCapture` pour que les invalidations se recoupent. */
const sessionDetailKey = (seanceId: string) => ['session', seanceId] as const;
const sessionsListKey = (chevalId: string) => ['sessions', chevalId] as const;

/**
 * Orchestration de l'**écran d'édition d'une séance** (lot 2.4, Spec §3.7) —
 * réutilise les briques pures de la saisie (2.3) : on charge la séance
 * (`GET /sessions/:id`), on **pré-remplit le brouillon** à l'identique
 * (`draftFromSession` — fautes/difficulté/contexte conservés), l'utilisateur
 * corrige via le **même réducteur** (`draftReducer`) et les **mêmes composants**
 * (éditeurs d'obstacle/tour, slider, compteurs), puis :
 *
 *  - **`save`** envoie un `PATCH` (projection `draftToModifierDto`) ; le **service
 *    `sessions` pose `date_modification`** et garde `date`/`provenance` immuables
 *    (l'édition n'est jamais silencieuse, Modèle §2) ;
 *  - **`remove`** envoie un `DELETE` (purge cascade ; aucun agrégat à corriger —
 *    Modèle §9/§10).
 *
 * Le client HTTP **authentifié** est celui d'`auth-context` (réutilisé) ; l'état
 * serveur passe par **TanStack Query**. Pas de brouillon persistant ici : une
 * édition repart toujours de la séance en base (≠ saisie neuve de 2.3).
 */
export function useSessionEdit(seanceId: string): SessionEdit {
  const { client } = useAuth();
  const queryClient = useQueryClient();
  const api = useMemo(() => createSessionsApi(client), [client]);

  const detailQuery = useQuery({
    queryKey: sessionDetailKey(seanceId),
    queryFn: () => api.get(seanceId),
    enabled: Boolean(seanceId),
    retry: false,
  });
  const session = detailQuery.data ?? null;

  const [draft, dispatch] = useReducer(draftReducer, undefined, () => emptyDraft());
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const hydratedRef = useRef(false);
  const [saved, setSaved] = useState(false);

  // Pré-remplit le brouillon dès que la séance est chargée — une seule fois, pour
  // ne pas écraser les corrections en cours si la requête se rafraîchit.
  useEffect(() => {
    if (!hydratedRef.current && session) {
      dispatch({ kind: 'replace', draft: draftFromSession(session) });
      hydratedRef.current = true;
    }
  }, [session]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: sessionDetailKey(seanceId) });
    if (session) {
      queryClient.invalidateQueries({ queryKey: sessionsListKey(session.cheval_id) });
    }
  };

  const saveMutation = useMutation<SéanceSortie, Error, void>({
    mutationFn: () => api.update(seanceId, draftToModifierDto(draftRef.current)),
    onSuccess: () => {
      invalidate();
      setSaved(true);
    },
  });

  const removeMutation = useMutation<void, Error, void>({
    mutationFn: () => api.remove(seanceId),
    onSuccess: invalidate,
  });

  return {
    session,
    loading: detailQuery.isLoading,
    notFound: detailQuery.isError,
    draft,
    dispatch,
    save: () => saveMutation.mutate(),
    saving: saveMutation.isPending,
    saved,
    result: saveMutation.data ?? null,
    remove: () => removeMutation.mutate(),
    removing: removeMutation.isPending,
    removed: removeMutation.isSuccess,
    error: saveMutation.error ?? removeMutation.error,
  };
}
