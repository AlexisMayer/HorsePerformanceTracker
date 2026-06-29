import type { CarteBilan } from '@hpt/shared';
import { useQuery } from '@tanstack/react-query';
import { type RefObject, useCallback, useMemo, useRef, useState } from 'react';
import type { View } from 'react-native';
import { useAuth } from '../auth';
import type { CartePartagePort, PartageRésultat } from './card-share-port';
import { createNativeCartePartagePort } from './native-card-share-port';
import { partagerCarte } from './share-card';
import { createSharingApi } from './sharing-api';

export interface ShareCard {
  /** Données de la carte (récap + record éventuel), ou `null` tant que non chargées. */
  carte: CarteBilan | null;
  loading: boolean;
  error: Error | null;
  /** Ref de la vue de la carte à capturer (branchée sur `BilanCard`). */
  cardRef: RefObject<View | null>;
  /** Déclenche capture + feuille de partage native (jamais imposé : sur action). */
  partager: () => Promise<PartageRésultat | null>;
  sharing: boolean;
}

/**
 * État de la **carte partageable** d'une séance (lot 3.3) — TanStack Query, scopé
 * à la séance, activé seulement avec une session **et** une séance. Surface de
 * **lecture** (le serveur compose le récap + le record depuis l'historique
 * courant) ; le partage est une **action** locale (capture via la ref + feuille de
 * partage native), déléguée à un **port injectable** (testable, cf. `share-card`).
 * Le port natif par défaut peut être surchargé (tests/instrumentation).
 */
export function useShareCard(
  seanceId: string | null,
  nomCheval: string,
  port?: CartePartagePort,
): ShareCard {
  const { client, status } = useAuth();
  const api = useMemo(() => createSharingApi(client), [client]);
  const sharePort = useMemo(() => port ?? createNativeCartePartagePort(), [port]);
  const cardRef = useRef<View | null>(null);
  const [sharing, setSharing] = useState(false);

  const query = useQuery({
    queryKey: ['carte', seanceId],
    queryFn: () => api.getCard(seanceId as string),
    enabled: status === 'authenticated' && seanceId != null,
    staleTime: 60_000,
  });

  const partager = useCallback(async (): Promise<PartageRésultat | null> => {
    const carte = query.data;
    if (!carte) return null;
    setSharing(true);
    try {
      // La ref (et non `.current`) : `react-native-view-shot` lit la vue à la capture.
      return await partagerCarte(sharePort, cardRef, carte, nomCheval);
    } finally {
      setSharing(false);
    }
  }, [query.data, sharePort, nomCheval]);

  return {
    carte: query.data ?? null,
    loading: query.isLoading,
    error: query.error,
    cardRef,
    partager,
    sharing,
  };
}
