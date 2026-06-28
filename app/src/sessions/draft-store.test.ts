import { describe, expect, it } from 'vitest';
import type { SecureStorageBackend } from '../auth/token-store';
import { emptyDraft, newObstacle } from './draft';
import { createDraftStore, DRAFT_KEY_PREFIX } from './draft-store';

/** Faux backend en mémoire (même interface que `expo-secure-store`). */
function memoryBackend(): SecureStorageBackend & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    getItemAsync: async (k) => store.get(k) ?? null,
    setItemAsync: async (k, v) => {
      store.set(k, v);
    },
    deleteItemAsync: async (k) => {
      store.delete(k);
    },
  };
}

describe('createDraftStore', () => {
  it('save → load restitue le brouillon (survit à un redémarrage)', async () => {
    const backend = memoryBackend();
    const store = createDraftStore(backend);
    const draft = { ...emptyDraft('Parcours'), obstacles: [newObstacle({ hauteur: 115 })] };

    await store.save('h1', draft);
    // Nouvelle instance de store : simule un redémarrage de l'app.
    const reloaded = await createDraftStore(backend).load('h1');
    expect(reloaded?.obstacles[0].hauteur).toBe(115);
    expect(reloaded?.idempotency_key).toBe(draft.idempotency_key);
  });

  it('namespace la clé par cheval', async () => {
    const backend = memoryBackend();
    await createDraftStore(backend).save('h7', emptyDraft('Plat'));
    expect([...backend.store.keys()]).toContain(`${DRAFT_KEY_PREFIX}h7`);
  });

  it('clear efface le brouillon', async () => {
    const backend = memoryBackend();
    const store = createDraftStore(backend);
    await store.save('h1', emptyDraft());
    await store.clear('h1');
    expect(await store.load('h1')).toBeNull();
  });

  it('absent → null', async () => {
    expect(await createDraftStore(memoryBackend()).load('inconnu')).toBeNull();
  });

  it('JSON corrompu ou forme inattendue → null (jamais de plantage)', async () => {
    const backend = memoryBackend();
    backend.store.set(`${DRAFT_KEY_PREFIX}h1`, '{ pas du json');
    backend.store.set(`${DRAFT_KEY_PREFIX}h2`, JSON.stringify({ nope: true }));
    const store = createDraftStore(backend);
    expect(await store.load('h1')).toBeNull();
    expect(await store.load('h2')).toBeNull();
  });
});
