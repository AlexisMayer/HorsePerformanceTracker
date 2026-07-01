import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuth } from '../auth';
import { createMetricsApi } from './metrics-api';

/**
 * État des **métriques héros** d'un cheval (lot 3.2) — TanStack Query, **scopé au
 * cheval courant** (en-tête, 1.4) et au compte (la clé porte les deux : un
 * changement de session/cheval repart de métriques vierges). N'est activé qu'avec
 * une session **et** un cheval.
 *
 * Surface de **lecture** : aucune mutation. Elle se rafraîchit à l'ouverture (le
 * serveur recompose maîtrisée + records depuis l'historique `live` courant — une
 * suppression/édition de séance, 2.4, est donc reflétée par construction, comme le
 * fil 3.1). Même `staleTime` que le fil pour rester cohérent à l'écran.
 */
export function useMetrics(chevalId: string | null, basePath = '/horses') {
  const { client, status, account } = useAuth();
  const api = useMemo(() => createMetricsApi(client, basePath), [client, basePath]);

  return useQuery({
    queryKey: ['metrics', basePath, account?.id ?? null, chevalId],
    queryFn: () => api.getMetrics(chevalId as string),
    enabled: status === 'authenticated' && chevalId != null,
    staleTime: 15_000,
  });
}
