import type { CompteSortie, LoginDto, RegisterDto } from '@hpt/shared';
import {
  type UseMutationResult,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';
import { API_BASE_URL } from '../config';
import { type ApiClient, createApiClient } from './api-client';
import { type AuthApi, createAuthApi } from './auth-api';
import { createTokenStore, type TokenStore } from './token-store';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

const ME_QUERY_KEY = ['auth', 'me'] as const;

export interface AuthContextValue {
  /** `loading` au démarrage tant que la session n'est pas résolue. */
  status: AuthStatus;
  /** Compte courant (e-mail, `tier`, `type`…), ou `null` si déconnecté. */
  account: CompteSortie | null;
  /**
   * Client HTTP authentifié (access token + interceptor 401 de 1.4). Exposé pour
   * que les modules de domaine (ex. `horses`, lot 2.1) réutilisent **le même**
   * client — donc le même access en mémoire et le même rafraîchissement.
   */
  client: ApiClient;
  signIn: UseMutationResult<void, Error, LoginDto>;
  signUp: UseMutationResult<void, Error, RegisterDto>;
  signOut: UseMutationResult<void, Error, void>;
  /** Lot 1.2 — demande un lien de réinitialisation de mot de passe. */
  requestPasswordReset: (email: string) => Promise<void>;
  /** Lot 1.2 — (re)demande le lien de vérification d'e-mail. */
  resendEmailVerification: (email: string) => Promise<void>;
  /**
   * Lot 4.2 — **force une rotation du jeton** puis recharge le compte (`me`).
   * Appelé après un upgrade (contrat 4.1) pour que le claim `tier` rejoigne
   * l'entitlement déverrouillé côté serveur. Renvoie `false` sans session.
   */
  refreshSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface Services {
  tokenStore: TokenStore;
  client: ApiClient;
  authApi: AuthApi;
}

/**
 * Fournit l'état d'auth à l'app, câblé sur l'API de 1.1. État serveur (compte +
 * mutations) via **TanStack Query** (Stack §3.1) ; jetons via `tokenStore`
 * (refresh en secure storage, access en mémoire — Stack §3.4).
 *
 * Au démarrage : si un refresh existe en secure storage, on déclenche `GET
 * /auth/me`. L'access étant vide à froid, ce premier appel reçoit un 401 que
 * l'**interceptor** rafraîchit automatiquement avant de rejouer — la session
 * survit donc au redémarrage sans code spécial.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  // Callback d'expiration appelé depuis l'interceptor (référence stable).
  const onSessionExpiredRef = useRef<() => void>(() => {});

  // Services créés une seule fois (le store garde l'access en mémoire).
  const servicesRef = useRef<Services | null>(null);
  if (servicesRef.current === null) {
    // Sur web, SecureStore n'est pas disponible → fallback mémoire (undefined).
    const backend = Platform.OS === 'web' ? undefined : SecureStore;
    const tokenStore = createTokenStore(backend);
    const client = createApiClient({
      baseUrl: API_BASE_URL,
      tokens: tokenStore,
      onSessionExpired: () => onSessionExpiredRef.current(),
    });
    servicesRef.current = { tokenStore, client, authApi: createAuthApi(client) };
  }
  const { tokenStore, authApi, client } = servicesRef.current;

  // `sessionEnabled` : on a (ou on vient d'obtenir) un refresh → tenter `me`.
  // `bootResolved` : la résolution initiale de session est terminée.
  const [sessionEnabled, setSessionEnabled] = useState(false);
  const [bootResolved, setBootResolved] = useState(false);

  const handleSessionExpired = useCallback(() => {
    setSessionEnabled(false);
    setBootResolved(true);
    queryClient.removeQueries({ queryKey: ME_QUERY_KEY });
  }, [queryClient]);

  useEffect(() => {
    onSessionExpiredRef.current = handleSessionExpired;
  }, [handleSessionExpired]);

  const meQuery = useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: () => authApi.me(),
    enabled: sessionEnabled,
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });

  // Amorçage : lire le refresh persistant et, s'il existe, activer `me`.
  useEffect(() => {
    let cancelled = false;
    tokenStore
      .getRefreshToken()
      .then((refreshToken) => {
        if (cancelled) return;
        if (refreshToken) setSessionEnabled(true);
        else setBootResolved(true);
      })
      .catch(() => {
        if (cancelled) return;
        setBootResolved(true);
      });
    return () => {
      cancelled = true;
    };
  }, [tokenStore]);

  // Quand `me` a tranché (succès ou échec), l'amorçage est résolu.
  useEffect(() => {
    if (sessionEnabled && !meQuery.isPending) setBootResolved(true);
  }, [sessionEnabled, meQuery.isPending]);

  const enableSession = useCallback(async () => {
    setSessionEnabled(true);
    await queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
  }, [queryClient]);

  // Lot 4.2 — rotation forcée du jeton (nouveau claim `tier`) + rechargement du
  // compte. Le déverrouillage réel reste l'autorité serveur (webhook + claim).
  const refreshSession = useCallback(async () => {
    const ok = await client.refreshSession();
    if (ok) await queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
    return ok;
  }, [client, queryClient]);

  const signIn = useMutation<void, Error, LoginDto>({
    mutationFn: async (dto) => {
      const tokens = await authApi.login(dto);
      tokenStore.setAccessToken(tokens.access_token);
      await tokenStore.setRefreshToken(tokens.refresh_token);
    },
    onSuccess: enableSession,
  });

  const signUp = useMutation<void, Error, RegisterDto>({
    mutationFn: async (input) => {
      await authApi.register(input);
      const tokens = await authApi.login({ email: input.email, password: input.password });
      tokenStore.setAccessToken(tokens.access_token);
      await tokenStore.setRefreshToken(tokens.refresh_token);
    },
    onSuccess: enableSession,
  });

  const signOut = useMutation<void, Error, void>({
    mutationFn: async () => {
      const refreshToken = await tokenStore.getRefreshToken();
      if (refreshToken) {
        try {
          await authApi.logout(refreshToken);
        } catch {
          // Effacement local quoi qu'il arrive : la session tombe côté appareil.
        }
      }
      await tokenStore.clear();
    },
    onSuccess: () => {
      setSessionEnabled(false);
      setBootResolved(true);
      queryClient.removeQueries({ queryKey: ME_QUERY_KEY });
    },
  });

  const status: AuthStatus = !bootResolved
    ? 'loading'
    : meQuery.data
      ? 'authenticated'
      : 'unauthenticated';

  const value: AuthContextValue = {
    status,
    account: meQuery.data ?? null,
    client,
    signIn,
    signUp,
    signOut,
    requestPasswordReset: (email) => authApi.requestPasswordReset(email),
    resendEmailVerification: (email) => authApi.requestEmailVerification(email),
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth doit être utilisé dans un <AuthProvider>.');
  return value;
}
