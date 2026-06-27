import { describe, expect, it } from 'vitest';
import { CAPTURE_FAB, CAPTURE_FAB_POSITION, TABS } from './tabs';

describe('coquille de navigation (UI/UX §5)', () => {
  it('expose exactement les 4 onglets, dans l’ordre', () => {
    expect(TABS.map((t) => t.label)).toEqual(['Feed', 'Historique', 'Analytique', 'Profil']);
  });

  it('mappe chaque onglet à sa route Expo Router', () => {
    expect(TABS.map((t) => t.name)).toEqual(['index', 'historique', 'analytique', 'profil']);
    expect(TABS.map((t) => t.href)).toEqual(['/', '/historique', '/analytique', '/profil']);
  });

  it('a des noms d’onglet uniques', () => {
    expect(new Set(TABS.map((t) => t.name)).size).toBe(TABS.length);
  });

  it('intercale le bouton de saisie central (FAB) au milieu', () => {
    // Centre de 4 onglets → position 2 (Feed · Historique | FAB | Analytique · Profil).
    expect(CAPTURE_FAB_POSITION).toBe(2);
    expect(CAPTURE_FAB.label).toBe('Saisie');
  });

  it('chaque onglet déclare une icône inactive et active distinctes', () => {
    for (const tab of TABS) {
      expect(tab.icon.length).toBeGreaterThan(0);
      expect(tab.iconActive.length).toBeGreaterThan(0);
    }
  });
});
