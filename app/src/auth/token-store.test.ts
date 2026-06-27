import { beforeEach, describe, expect, it } from 'vitest';
import { createTokenStore, REFRESH_TOKEN_KEY, type SecureStorageBackend } from './token-store';

/** Faux secure storage en mémoire — tient lieu de keychain/`expo-secure-store`. */
function createFakeBackend() {
  const data = new Map<string, string>();
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

describe('token-store', () => {
  let fake: ReturnType<typeof createFakeBackend>;

  beforeEach(() => {
    fake = createFakeBackend();
  });

  it('persiste le refresh en secure storage et le relit', async () => {
    const store = createTokenStore(fake.backend);
    await store.setRefreshToken('refresh-1');

    expect(await store.getRefreshToken()).toBe('refresh-1');
    // Écrit bien dans le backing sécurisé (et pas ailleurs).
    expect(fake.data.get(REFRESH_TOKEN_KEY)).toBe('refresh-1');
  });

  it('garde l’access token en mémoire uniquement (jamais persisté)', async () => {
    const store = createTokenStore(fake.backend);
    store.setAccessToken('access-1');

    expect(store.getAccessToken()).toBe('access-1');
    // L’access ne touche jamais le secure storage.
    expect([...fake.data.values()]).not.toContain('access-1');
  });

  it('le refresh survit au redémarrage ; l’access (mémoire) est perdu', async () => {
    // Session 1 : on pose les deux jetons.
    const before = createTokenStore(fake.backend);
    before.setAccessToken('access-1');
    await before.setRefreshToken('refresh-1');

    // « Redémarrage » : nouvelle instance de store sur le MÊME backing sécurisé.
    const after = createTokenStore(fake.backend);
    expect(await after.getRefreshToken()).toBe('refresh-1'); // persisté
    expect(after.getAccessToken()).toBeNull(); // mémoire repartie de zéro
  });

  it('clear() efface le refresh persistant et l’access en mémoire', async () => {
    const store = createTokenStore(fake.backend);
    store.setAccessToken('access-1');
    await store.setRefreshToken('refresh-1');

    await store.clear();

    expect(await store.getRefreshToken()).toBeNull();
    expect(store.getAccessToken()).toBeNull();
    expect(fake.data.size).toBe(0);
  });

  it('setRefreshToken(null) supprime l’entrée', async () => {
    const store = createTokenStore(fake.backend);
    await store.setRefreshToken('refresh-1');
    await store.setRefreshToken(null);

    expect(await store.getRefreshToken()).toBeNull();
    expect(fake.data.has(REFRESH_TOKEN_KEY)).toBe(false);
  });
});
