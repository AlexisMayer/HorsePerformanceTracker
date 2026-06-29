/**
 * Stockage des jetons (Stack §3.4, décision figée du lot 1.4) :
 *
 *  - **refresh token** → secure storage de l'appareil (`expo-secure-store`,
 *    chiffré/keychain). Il **survit au redémarrage** : c'est la persistance de
 *    session.
 *  - **access token** → **en mémoire uniquement**. Court (15 min), reposé à
 *    chaque démarrage par le rafraîchissement automatique (interceptor 401).
 *    Jamais écrit sur disque.
 *
 * Le backend de stockage est **injecté** (interface étroite) : la prod passe le
 * module `expo-secure-store` ; les tests passent un faux en mémoire. La logique
 * reste donc testable sans dépendance native.
 *
 * Sur le web, `expo-secure-store` n'existe pas → fallback en mémoire.
 */

/** Sous-ensemble de `expo-secure-store` dont dépend le store (injectable). */
export interface SecureStorageBackend {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

export interface TokenStore {
  /** Access token courant (mémoire), ou `null` s'il n'a pas encore été obtenu. */
  getAccessToken(): string | null;
  setAccessToken(token: string | null): void;
  /** Refresh token persistant (secure storage). */
  getRefreshToken(): Promise<string | null>;
  setRefreshToken(token: string | null): Promise<void>;
  /** Efface la session : access (mémoire) + refresh (secure storage). */
  clear(): Promise<void>;
}

/** Clé de stockage du refresh (préfixe applicatif pour éviter les collisions). */
export const REFRESH_TOKEN_KEY = 'hpt.refresh_token';

/**
 * Fallback en mémoire pour les environnements où secure storage n'existe pas (web).
 */
function createMemoryBackend(): SecureStorageBackend {
  const store = new Map<string, string>();
  return {
    getItemAsync: async (key) => store.get(key) ?? null,
    setItemAsync: async (key, value) => {
      store.set(key, value);
    },
    deleteItemAsync: async (key) => {
      store.delete(key);
    },
  };
}

export function createTokenStore(
  backend?: SecureStorageBackend,
  key: string = REFRESH_TOKEN_KEY,
): TokenStore {
  // Si pas de backend fourni, utiliser le fallback mémoire
  const finalBackend = backend ?? createMemoryBackend();

  // Access token en mémoire — jamais persisté.
  let accessToken: string | null = null;

  return {
    getAccessToken: () => accessToken,
    setAccessToken: (token) => {
      accessToken = token;
    },
    getRefreshToken: () => finalBackend.getItemAsync(key),
    setRefreshToken: async (token) => {
      if (token === null) {
        await finalBackend.deleteItemAsync(key);
      } else {
        await finalBackend.setItemAsync(key, token);
      }
    },
    clear: async () => {
      accessToken = null;
      await finalBackend.deleteItemAsync(key);
    },
  };
}
