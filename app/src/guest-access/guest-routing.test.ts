import { describe, expect, it } from 'vitest';
import { guestStateUnresolved, shouldEnterGuestShell } from './guest-routing';

/** État de base : authentifié, listes résolues, pas encore dans la coquille invité. */
const base = {
  authenticated: true,
  horsesLoading: false,
  horsesCount: 0,
  guestLoading: false,
  sharedHorsesCount: 1,
  inGuest: false,
};

describe('shouldEnterGuestShell — invité pur (lot 4.6)', () => {
  it('entre dans la coquille invité : authentifié, 0 cheval possédé, ≥1 accès partagé', () => {
    expect(shouldEnterGuestShell(base)).toBe(true);
  });

  it('n’entre pas si non authentifié', () => {
    expect(shouldEnterGuestShell({ ...base, authenticated: false })).toBe(false);
  });

  it('n’entre pas s’il possède déjà un cheval (utilisateur régulier)', () => {
    expect(shouldEnterGuestShell({ ...base, horsesCount: 1 })).toBe(false);
  });

  it('n’entre pas sans aucun accès partagé (nouvel arrivant → onboarding)', () => {
    expect(shouldEnterGuestShell({ ...base, sharedHorsesCount: 0 })).toBe(false);
  });

  it('n’entre pas tant que les listes chargent (pas de clignotement)', () => {
    expect(shouldEnterGuestShell({ ...base, horsesLoading: true })).toBe(false);
    expect(shouldEnterGuestShell({ ...base, guestLoading: true })).toBe(false);
  });

  it('n’entre pas s’il y est déjà (pas de redirection en boucle)', () => {
    expect(shouldEnterGuestShell({ ...base, inGuest: true })).toBe(false);
  });
});

describe('guestStateUnresolved — différer l’onboarding le temps de résoudre l’état invité', () => {
  it('vrai : compte sans cheval dont les accès partagés chargent encore', () => {
    expect(guestStateUnresolved({ authenticated: true, horsesCount: 0, guestLoading: true })).toBe(
      true,
    );
  });

  it('faux une fois les accès résolus', () => {
    expect(guestStateUnresolved({ authenticated: true, horsesCount: 0, guestLoading: false })).toBe(
      false,
    );
  });

  it('faux si le compte possède un cheval (déjà son onglet régulier)', () => {
    expect(guestStateUnresolved({ authenticated: true, horsesCount: 2, guestLoading: true })).toBe(
      false,
    );
  });
});
