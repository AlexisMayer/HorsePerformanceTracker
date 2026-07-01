import { describe, expect, it } from 'vitest';
import { basePathForScope, GUEST_READ_BASE, OWNER_READ_BASE } from './read-scope';

describe('basePathForScope — portée de lecture (lot 4.6)', () => {
  it('owner → routes propriétaire (/horses)', () => {
    expect(basePathForScope('owner')).toBe('/horses');
    expect(basePathForScope('owner')).toBe(OWNER_READ_BASE);
  });

  it('guest → routes invité scopées par l’octroi (/guest-access/horses)', () => {
    expect(basePathForScope('guest')).toBe('/guest-access/horses');
    expect(basePathForScope('guest')).toBe(GUEST_READ_BASE);
  });

  it('les deux préfixes partagent le même suffixe de route (réutilisation directe)', () => {
    const chevalId = 'h1';
    expect(`${OWNER_READ_BASE}/${chevalId}/feed`).toBe('/horses/h1/feed');
    expect(`${GUEST_READ_BASE}/${chevalId}/feed`).toBe('/guest-access/horses/h1/feed');
  });
});
