import { describe, expect, it } from 'vitest';
import {
  effortsBasis,
  formatFeedDate,
  jalonTitre,
  provenanceMarqueur,
  ressentiEmoji,
} from './labels';

describe('ressentiEmoji', () => {
  it('mappe l’échelle 1-5 vers un visage', () => {
    expect(ressentiEmoji(1)).toBe('😞');
    expect(ressentiEmoji(3)).toBe('😐');
    expect(ressentiEmoji(5)).toBe('😄');
  });

  it('renvoie null sans ressenti ou hors échelle (rien à afficher)', () => {
    expect(ressentiEmoji(null)).toBeNull();
    expect(ressentiEmoji(undefined)).toBeNull();
    expect(ressentiEmoji(0)).toBeNull();
    expect(ressentiEmoji(6)).toBeNull();
  });
});

describe('effortsBasis', () => {
  it('parle de « sans-faute » pour un concours, de « propre » sinon', () => {
    expect(effortsBasis('Concours')).toBe('sans-faute');
    expect(effortsBasis('Parcours')).toBe('propre');
    expect(effortsBasis('Plat')).toBe('propre');
    expect(effortsBasis('Gymnastique')).toBe('propre');
  });
});

describe('jalonTitre', () => {
  it('titre une célébration selon le type de jalon', () => {
    expect(jalonTitre('record')).toBe('Nouveau record');
    expect(jalonTitre('première_fois')).toBe('Première fois');
  });
});

describe('provenanceMarqueur', () => {
  it('marque le déclaratif « Antérieure à l’app », rien pour le live (§2)', () => {
    expect(provenanceMarqueur('déclaratif')).toBe('Antérieure à l’app');
    expect(provenanceMarqueur('live')).toBeNull();
  });
});

describe('formatFeedDate', () => {
  it('rend une date courte lisible (tolérante au transport JSON ISO)', () => {
    const fromDate = formatFeedDate(new Date('2026-03-12T10:00:00Z'));
    const fromIso = formatFeedDate('2026-03-12T10:00:00Z');
    expect(fromDate).toContain('12');
    expect(fromDate.length).toBeGreaterThan(0);
    // Même rendu que l'on parte d'un Date ou de sa chaîne ISO.
    expect(fromIso).toBe(fromDate);
  });

  it('renvoie une chaîne vide pour une date illisible (jamais « Invalid Date »)', () => {
    expect(formatFeedDate('pas-une-date')).toBe('');
  });
});
