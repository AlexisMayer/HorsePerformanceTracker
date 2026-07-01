import type { BilanAugmentéSortie } from '@hpt/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuth } from '../auth';
import { ApiError } from '../auth/api-client';
import { createAiBilanApi } from './ai-bilan-api';

/** Clés de cache TanStack, portées par le compte pour éviter les fuites de session. */
const cléDispo = (compteId: string | null, chevalId: string | null) =>
  ['ai-bilan-dispo', compteId ?? null, chevalId] as const;
const cléBilan = (compteId: string | null, seanceId: string | null) =>
  ['ai-bilan', compteId ?? null, seanceId] as const;

/**
 * **Génération à la demande** (lot 4.5, Spec §7.1) — une **mutation** TanStack
 * (jamais automatique) : l'utilisateur premium/pro déclenche explicitement la
 * génération. Le serveur fait un *get-or-create* (relit sans régénérer). Au
 * succès, on **amorce** le cache de relecture et on **invalide** la disponibilité
 * (le slot ✦ de l'Historique) — sans nouvel appel IA.
 *
 * Les refus serveur remontent en `error` : **403** au gratuit (l'UI grise déjà
 * via `LockedFeature`), **429** si le rate limit est atteint, **404** si étranger.
 */
export function useGénérerBilanAugmenté(seanceId: string | null, chevalId: string | null) {
  const { client, account } = useAuth();
  const api = useMemo(() => createAiBilanApi(client), [client]);
  const queryClient = useQueryClient();

  return useMutation<BilanAugmentéSortie, Error>({
    mutationFn: () => api.générer(seanceId as string),
    onSuccess: (bilan) => {
      queryClient.setQueryData(cléBilan(account?.id ?? null, seanceId), bilan);
      queryClient.invalidateQueries({ queryKey: cléDispo(account?.id ?? null, chevalId) });
    },
  });
}

/**
 * **Relecture** d'un bilan augmenté persisté (Spec §7.3) — « recommandations de
 * la dernière fois », **sans nouvel appel IA**. `enabled` est piloté par la
 * capacité (le gratuit ne lit pas). Un **404** (aucun bilan) est traité comme
 * `null` (pas une erreur) : l'écran propose alors de le générer.
 */
export function useBilanAugmenté(seanceId: string | null, enabled: boolean) {
  const { client, status, account } = useAuth();
  const api = useMemo(() => createAiBilanApi(client), [client]);

  return useQuery<BilanAugmentéSortie | null>({
    queryKey: cléBilan(account?.id ?? null, seanceId),
    queryFn: async () => {
      try {
        return await api.relire(seanceId as string);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
    enabled: status === 'authenticated' && enabled && seanceId != null,
    staleTime: 60_000,
  });
}

/**
 * **Disponibilité** des bilans augmentés d'un cheval (lot 4.5) — la liste des
 * `seance_ids` qui possèdent un bilan, pour remplir le **slot ✦** de l'Historique
 * (3.4) **uniquement** là où un bilan existe. `enabled` est piloté par la
 * **capacité** (`bilan_augmenté`) : un compte gratuit **ne fait aucun appel** et
 * n'affiche donc jamais de ✦ (cohérent « refusé au gratuit »).
 */
export function useBilansAugmentésDisponibles(chevalId: string | null, enabled: boolean) {
  const { client, status, account } = useAuth();
  const api = useMemo(() => createAiBilanApi(client), [client]);

  return useQuery({
    queryKey: cléDispo(account?.id ?? null, chevalId),
    queryFn: () => api.disponibles(chevalId as string),
    enabled: status === 'authenticated' && enabled && chevalId != null,
    staleTime: 30_000,
  });
}
