import { authTokensSchema } from '@hpt/shared';
import type { TokenStore } from './token-store';

/**
 * Client HTTP de l'app avec **rafraîchissement automatique sur 401** (Stack
 * §3.4, décision figée 1.4).
 *
 * Flux de l'interceptor : une requête authentifiée part avec l'access token en
 * mémoire. Si le serveur répond **401** (access expiré/absent), le client tente
 * **un** rafraîchissement via `POST /auth/refresh` (en s'appuyant sur le refresh
 * de 1.1, en secure storage), persiste le nouveau couple, puis **rejoue** la
 * requête d'origine. Le refresh est **single-flight** : plusieurs 401
 * concurrents partagent une seule rotation (la rotation de 1.1 révoque l'ancien
 * refresh — émettre deux rotations en parallèle tuerait la famille).
 *
 * La réponse de `/auth/refresh` est validée par `authTokensSchema` de
 * `@hpt/shared` — aucun type d'API dupliqué (Architecture §1/§2).
 */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiRequestInit extends Omit<RequestInit, 'body'> {
  /** Corps JSON (sérialisé automatiquement). */
  body?: unknown;
  /**
   * Attache l'access token et active l'interceptor 401. Défaut : `true`.
   * Les endpoints publics (`register`, `login`, `refresh`) passent `false`.
   */
  auth?: boolean;
}

export interface ApiClient {
  request<T>(path: string, init?: ApiRequestInit): Promise<T>;
}

export interface CreateApiClientOptions {
  baseUrl: string;
  tokens: TokenStore;
  /** Appelé quand le rafraîchissement échoue → la session est tombée. */
  onSessionExpired?: () => void;
  /** Injectable pour les tests (défaut : `fetch` global). */
  fetchFn?: typeof fetch;
}

export function createApiClient({
  baseUrl,
  tokens,
  onSessionExpired,
  fetchFn = fetch,
}: CreateApiClientOptions): ApiClient {
  // Rotation en cours partagée (single-flight) — null quand aucune n'est active.
  let refreshing: Promise<boolean> | null = null;

  async function performRefresh(): Promise<boolean> {
    const refreshToken = await tokens.getRefreshToken();
    if (!refreshToken) return false;

    let response: Response;
    try {
      response = await fetchFn(`${baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } catch {
      // Coupure réseau : on ne touche pas au refresh (réessayable plus tard).
      return false;
    }

    if (!response.ok) {
      // Refresh rejeté (expiré, révoqué, réutilisation détectée) → session morte.
      await tokens.clear();
      return false;
    }

    const next = authTokensSchema.parse(await response.json());
    tokens.setAccessToken(next.access_token);
    await tokens.setRefreshToken(next.refresh_token);
    return true;
  }

  function refresh(): Promise<boolean> {
    if (!refreshing) {
      refreshing = performRefresh().finally(() => {
        refreshing = null;
      });
    }
    return refreshing;
  }

  async function send(path: string, init: ApiRequestInit): Promise<Response> {
    const headers = new Headers(init.headers);
    const hasBody = init.body !== undefined;
    if (hasBody && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    if (init.auth !== false) {
      const access = tokens.getAccessToken();
      if (access) headers.set('Authorization', `Bearer ${access}`);
    }
    return fetchFn(`${baseUrl}${path}`, {
      ...init,
      headers,
      body: hasBody ? JSON.stringify(init.body) : undefined,
    });
  }

  async function request<T>(path: string, init: ApiRequestInit = {}): Promise<T> {
    const useAuth = init.auth !== false;
    let response = await send(path, init);

    if (response.status === 401 && useAuth) {
      const refreshed = await refresh();
      if (refreshed) {
        response = await send(path, init); // rejoue avec le nouvel access
      } else {
        onSessionExpired?.();
        throw new ApiError(401, 'Session expirée', await readBody(response));
      }
    }

    if (!response.ok) {
      throw new ApiError(response.status, `HTTP ${response.status}`, await readBody(response));
    }
    return parseBody<T>(response);
  }

  return { request };
}

/** Lit le corps en JSON, ou en texte, sans jamais lever (diagnostic d'erreur). */
async function readBody(response: Response): Promise<unknown> {
  try {
    const text = await response.text();
    if (!text) return undefined;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  } catch {
    return undefined;
  }
}

/** Parse une réponse réussie : `204`/corps vide → `undefined`, sinon JSON. */
async function parseBody<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
