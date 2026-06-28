import { describe, expect, it, vi } from 'vitest';
import { newIdempotencyKey } from './idempotency';

/**
 * La clé d'idempotence doit être un UUID valide (le serveur 2.2 la valide par
 * `z.string().uuid()`) et unique à chaque appel. On vérifie aussi le **repli**
 * RFC 4122 v4 quand `crypto.randomUUID` est indisponible (Hermes ancien).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('newIdempotencyKey', () => {
  it('produit un UUID valide', () => {
    expect(newIdempotencyKey()).toMatch(UUID_RE);
  });

  it('produit une clé différente à chaque appel', () => {
    const keys = new Set(Array.from({ length: 100 }, () => newIdempotencyKey()));
    expect(keys.size).toBe(100);
  });

  it('replie sur un UUID v4 RFC 4122 quand randomUUID est absent', () => {
    const original = globalThis.crypto;
    // Expose getRandomValues mais pas randomUUID → force le chemin de repli.
    vi.stubGlobal('crypto', { getRandomValues: original.getRandomValues.bind(original) });
    try {
      const key = newIdempotencyKey();
      expect(key).toMatch(UUID_V4_RE);
    } finally {
      vi.stubGlobal('crypto', original);
    }
  });

  it('reste valide même sans crypto du tout (repli Math.random)', () => {
    const original = globalThis.crypto;
    vi.stubGlobal('crypto', undefined);
    try {
      expect(newIdempotencyKey()).toMatch(UUID_V4_RE);
    } finally {
      vi.stubGlobal('crypto', original);
    }
  });
});
