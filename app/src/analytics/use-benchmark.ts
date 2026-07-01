import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuth } from '../auth';
import { createBenchmarkApi } from './benchmark-api';

/**
 * État de la **liste des combinaisons benchmarkables** d'un cheval (lot 5.2) —
 * TanStack Query, **scopé au cheval courant** (en-tête, 1.4) et au compte (la clé
 * porte les deux). Alimente le **sélecteur** de la section benchmark. N'est activé
 * qu'avec une session **et** un cheval. Monté **derrière le verrou** (contenu
 * débloqué du `LockedFeature`) : un compte gratuit ne déclenche jamais la requête
 * (et le serveur la refuserait — 403).
 */
export function useBenchmarkList(chevalId: string | null, basePath = '/horses') {
  const { client, status, account } = useAuth();
  const api = useMemo(() => createBenchmarkApi(client, basePath), [client, basePath]);

  return useQuery({
    queryKey: ['benchmark-list', basePath, account?.id ?? null, chevalId],
    queryFn: () => api.listBenchmarkables(chevalId as string),
    enabled: status === 'authenticated' && chevalId != null,
    staleTime: 15_000,
  });
}

/**
 * État de la **série benchmark** d'une combinaison identifiée pour un cheval (lot
 * 5.2) — la progression *like-for-like* dans le temps. N'est activé qu'avec une
 * session, un cheval **et** une combinaison sélectionnée (`combinaisonRef`). Le
 * serveur recompose depuis l'historique `live` courant → une séance ajoutée/éditée
 * est reflétée par construction (comme la heatmap 5.1 / les métriques 3.2).
 */
export function useBenchmarkSérie(
  chevalId: string | null,
  combinaisonRef: string | null,
  basePath = '/horses',
) {
  const { client, status, account } = useAuth();
  const api = useMemo(() => createBenchmarkApi(client, basePath), [client, basePath]);

  return useQuery({
    queryKey: ['benchmark-serie', basePath, account?.id ?? null, chevalId, combinaisonRef],
    queryFn: () => api.getSérie(chevalId as string, combinaisonRef as string),
    enabled: status === 'authenticated' && chevalId != null && combinaisonRef != null,
    staleTime: 15_000,
  });
}
