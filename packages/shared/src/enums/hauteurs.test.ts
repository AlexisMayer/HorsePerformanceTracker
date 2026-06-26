import { describe, expect, it } from 'vitest';
import {
  estHauteurValide,
  HAUTEUR_MAX_CM,
  HAUTEUR_MIN_CM,
  HAUTEUR_PAS_CM,
  HAUTEURS_CM,
} from './hauteurs';

describe('référentiel hauteurs', () => {
  it('couvre 60→160 cm par pas de 5 (21 crans)', () => {
    expect(HAUTEURS_CM).toHaveLength(21);
    expect(HAUTEURS_CM[0]).toBe(HAUTEUR_MIN_CM);
    expect(HAUTEURS_CM.at(-1)).toBe(HAUTEUR_MAX_CM);
    for (const h of HAUTEURS_CM) {
      expect((h - HAUTEUR_MIN_CM) % HAUTEUR_PAS_CM).toBe(0);
    }
  });

  it('accepte les hauteurs sur un cran', () => {
    expect(estHauteurValide(60)).toBe(true);
    expect(estHauteurValide(95)).toBe(true);
    expect(estHauteurValide(160)).toBe(true);
  });

  it('rejette hors borne, hors pas, ou non entières', () => {
    expect(estHauteurValide(59)).toBe(false);
    expect(estHauteurValide(161)).toBe(false);
    expect(estHauteurValide(62)).toBe(false);
    expect(estHauteurValide(95.5)).toBe(false);
  });
});
