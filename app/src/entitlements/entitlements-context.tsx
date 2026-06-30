import type { EntitlementSortie } from '@hpt/shared';
import { useQuery } from '@tanstack/react-query';
import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { useAuth } from '../auth';
import { createEntitlementsApi } from './entitlements-api';

/**
 * État `entitlements` de l'app (lot 4.1). **Lit l'entitlement au login**
 * (Spec §9.3) via `GET /me/entitlement` et le **stocke dans l'état app**
 * (TanStack Query, Stack §3.1), sur le client **authentifié** d'`auth-context`.
 * La requête n'est activée qu'une fois la session établie ; sa clé est portée
 * par le compte → une nouvelle session repart d'un entitlement vierge.
 *
 * Le tier/les capacités exposés ici sont **indicatifs** : le **gating reste
 * l'autorité serveur** (Architecture §3/§5). Ce lot ne fait que **lire et
 * afficher** le tier (Profil) ; le **grisage** des fonctions et le **paywall**
 * (4.2) consommeront `capacités`/`quotas` plus tard — pas ici.
 */
export interface EntitlementsContextValue {
  /** Entitlement du compte (tier + capacités + quotas), ou `null` tant qu'il charge. */
  entitlement: EntitlementSortie | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

const EntitlementsContext = createContext<EntitlementsContextValue | null>(null);

const ENTITLEMENT_QUERY_KEY = ['entitlement'] as const;

export function EntitlementsProvider({ children }: { children: ReactNode }) {
  const { client, status, account } = useAuth();
  const entitlementsApi = useMemo(() => createEntitlementsApi(client), [client]);

  const queryKey = [...ENTITLEMENT_QUERY_KEY, account?.id ?? null];

  const query = useQuery({
    queryKey,
    queryFn: () => entitlementsApi.get(),
    enabled: status === 'authenticated',
    staleTime: 60_000,
  });

  const value: EntitlementsContextValue = {
    entitlement: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: () => query.refetch(),
  };

  return <EntitlementsContext.Provider value={value}>{children}</EntitlementsContext.Provider>;
}

export function useEntitlement(): EntitlementsContextValue {
  const value = useContext(EntitlementsContext);
  if (!value) throw new Error('useEntitlement doit être utilisé dans un <EntitlementsProvider>.');
  return value;
}
