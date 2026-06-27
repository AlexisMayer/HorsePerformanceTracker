import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from './api-client';
import { createTokenStore, type SecureStorageBackend } from './token-store';

const BASE = 'https://api.test';

function createFakeBackend(seed: Record<string, string> = {}) {
  const data = new Map<string, string>(Object.entries(seed));
  const backend: SecureStorageBackend = {
    getItemAsync: async (key) => data.get(key) ?? null,
    setItemAsync: async (key, value) => {
      data.set(key, value);
    },
    deleteItemAsync: async (key) => {
      data.delete(key);
    },
  };
  return { backend, data };
}

function json(body: unknown, status: number): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const VALID_TOKENS = {
  access_token: 'access-2',
  refresh_token: 'refresh-2',
  token_type: 'Bearer',
  expires_in: 900,
};

describe('api-client — interceptor 401', () => {
  let store: ReturnType<typeof createTokenStore>;
  let counts: { refresh: number; me: number };

  beforeEach(() => {
    counts = { refresh: 0, me: 0 };
  });

  /** Fetch simulant un access expiré : `access-2` (issu du refresh) seul vaut 200. */
  function happyFetch(): typeof fetch {
    return (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh')) {
        counts.refresh += 1;
        return json(VALID_TOKENS, 200);
      }
      if (url.endsWith('/me')) {
        counts.me += 1;
        const auth = new Headers(init?.headers).get('Authorization');
        return auth === 'Bearer access-2'
          ? json({ id: 'u1', email: 'a@b.fr' }, 200)
          : json({}, 401);
      }
      return json({}, 404);
    }) as typeof fetch;
  }

  it('rafraîchit automatiquement sur 401 puis rejoue la requête', async () => {
    const { backend } = createFakeBackend({ 'hpt.refresh_token': 'refresh-1' });
    store = createTokenStore(backend);
    store.setAccessToken('access-1'); // expiré

    const client = createApiClient({ baseUrl: BASE, tokens: store, fetchFn: happyFetch() });
    const result = await client.request<{ id: string }>('/me');

    expect(result.id).toBe('u1');
    expect(counts.refresh).toBe(1); // un seul refresh
    expect(counts.me).toBe(2); // 401 puis rejouée
    // Nouveau couple persisté (rotation de 1.1).
    expect(store.getAccessToken()).toBe('access-2');
    expect(await store.getRefreshToken()).toBe('refresh-2');
  });

  it('mutualise le refresh entre 401 concurrents (single-flight)', async () => {
    const { backend } = createFakeBackend({ 'hpt.refresh_token': 'refresh-1' });
    store = createTokenStore(backend);
    store.setAccessToken('access-1');

    const client = createApiClient({ baseUrl: BASE, tokens: store, fetchFn: happyFetch() });
    const [a, b] = await Promise.all([
      client.request<{ id: string }>('/me'),
      client.request<{ id: string }>('/me'),
    ]);

    expect(a.id).toBe('u1');
    expect(b.id).toBe('u1');
    // Deux requêtes 401 en parallèle → UNE seule rotation (sinon la famille tomberait).
    expect(counts.refresh).toBe(1);
  });

  it('valide la réponse de /auth/refresh via le schéma partagé', async () => {
    const { backend } = createFakeBackend({ 'hpt.refresh_token': 'refresh-1' });
    store = createTokenStore(backend);
    store.setAccessToken('access-1');

    // Réponse de refresh non conforme (expires_in manquant) → le parse Zod lève.
    const badFetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh'))
        return json({ access_token: 'x', refresh_token: 'y' }, 200);
      return json({}, 401);
    }) as typeof fetch;

    const client = createApiClient({ baseUrl: BASE, tokens: store, fetchFn: badFetch });
    await expect(client.request('/me')).rejects.toThrow();
  });

  it('échec de refresh → session effacée + onSessionExpired', async () => {
    const { backend } = createFakeBackend({ 'hpt.refresh_token': 'refresh-bad' });
    store = createTokenStore(backend);
    store.setAccessToken('access-1');
    const onSessionExpired = vi.fn();

    const failingFetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh')) return json({ message: 'reuse detected' }, 401);
      return json({}, 401);
    }) as typeof fetch;

    const client = createApiClient({
      baseUrl: BASE,
      tokens: store,
      fetchFn: failingFetch,
      onSessionExpired,
    });

    await expect(client.request('/me')).rejects.toMatchObject({ status: 401 });
    expect(onSessionExpired).toHaveBeenCalledOnce();
    // Refresh rejeté → on purge la session locale.
    expect(store.getAccessToken()).toBeNull();
    expect(await store.getRefreshToken()).toBeNull();
  });

  it('sans refresh token, ne tente pas de refresh', async () => {
    const { backend } = createFakeBackend(); // aucun refresh
    store = createTokenStore(backend);
    const onSessionExpired = vi.fn();

    const client = createApiClient({
      baseUrl: BASE,
      tokens: store,
      fetchFn: happyFetch(),
      onSessionExpired,
    });

    await expect(client.request('/me')).rejects.toBeInstanceOf(ApiError);
    expect(counts.refresh).toBe(0);
    expect(onSessionExpired).toHaveBeenCalledOnce();
  });

  it('une requête non authentifiée (auth:false) ne déclenche pas l’interceptor', async () => {
    const { backend } = createFakeBackend({ 'hpt.refresh_token': 'refresh-1' });
    store = createTokenStore(backend);

    const loginFetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/auth/login')) return json({ message: 'bad credentials' }, 401);
      if (url.endsWith('/auth/refresh')) {
        counts.refresh += 1;
        return json(VALID_TOKENS, 200);
      }
      return json({}, 404);
    }) as typeof fetch;

    const client = createApiClient({ baseUrl: BASE, tokens: store, fetchFn: loginFetch });
    await expect(
      client.request('/auth/login', {
        method: 'POST',
        body: { email: 'a', password: 'b' },
        auth: false,
      }),
    ).rejects.toMatchObject({ status: 401 });
    // Un 401 sur un endpoint public ne doit jamais rafraîchir.
    expect(counts.refresh).toBe(0);
  });
});
