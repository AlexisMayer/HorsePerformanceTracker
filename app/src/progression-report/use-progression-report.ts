import type { BilanProgression, BilanProgressionParams } from '@hpt/shared';
import { useMutation } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuth } from '../auth';
import { createProgressionReportApi } from './progression-report-api';

/**
 * **Génération de bilan à la demande** (lot 4.4) — une **mutation** TanStack (pas
 * une query passive) : le coach déclenche explicitement la génération avec sa
 * curation (période + indicateurs + format). Sur le client **authentifié**
 * (`auth-context`). Aucune écriture métier côté serveur (composition/rendu) : on
 * ne modifie donc **aucun** cache de lecture — c'est un livrable ponctuel.
 *
 * Les refus serveur remontent en `error` : **403** au gratuit (mais l'UI grise
 * déjà via `LockedFeature`, donc ce chemin ne s'atteint pas normalement), **404**
 * si le cheval est étranger.
 */
export function useGénérerBilan(chevalId: string | null) {
  const { client } = useAuth();
  const api = useMemo(() => createProgressionReportApi(client), [client]);

  return useMutation<BilanProgression, Error, BilanProgressionParams>({
    mutationFn: (params) => api.generate(chevalId as string, params),
  });
}
