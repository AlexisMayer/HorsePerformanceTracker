import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuth } from '../auth';
import { createHeatmapApi } from './heatmap-api';

/**
 * État de la **heatmap type × hauteur** d'un cheval (lot 5.1) — TanStack Query,
 * **scopé au cheval courant** (en-tête, 1.4) et au compte (la clé porte les deux :
 * un changement de session/cheval repart d'une heatmap vierge). N'est activé
 * qu'avec une session **et** un cheval.
 *
 * Surface de **lecture** : aucune mutation. Elle se rafraîchit à l'ouverture (le
 * serveur recompose la heatmap depuis l'historique `live` courant — une
 * suppression/édition de séance, 2.4, est donc reflétée par construction, comme le
 * feed 3.1 / les métriques 3.2). Le hook n'est monté que **derrière le verrou**
 * (dans le contenu débloqué du `LockedFeature`) : un compte gratuit ne déclenche
 * jamais la requête (et le serveur la refuserait de toute façon — 403).
 */
export function useHeatmap(chevalId: string | null) {
  const { client, status, account } = useAuth();
  const api = useMemo(() => createHeatmapApi(client), [client]);

  return useQuery({
    queryKey: ['heatmap', account?.id ?? null, chevalId],
    queryFn: () => api.getHeatmap(chevalId as string),
    enabled: status === 'authenticated' && chevalId != null,
    staleTime: 15_000,
  });
}
