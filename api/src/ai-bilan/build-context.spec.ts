import type { SéanceSortie } from '@hpt/shared';
import { describe, expect, it } from 'vitest';
import { construireContexteBilan, MAX_SÉANCES_PRÉCÉDENTES } from './build-context';

/**
 * Construction **pure** du contexte IA (lot 4.5, Spec §7.2). On prouve : la séance
 * cible devient « dernière », les précédentes sont bien **antérieures** et
 * **plafonnées**, les faits objectifs viennent de `shared`, et le **contexte
 * qualitatif** (ressenti/note) est joint comme matière narrative (Modèle §1).
 */

function séance(over: Partial<SéanceSortie> & { id: string; date: Date }): SéanceSortie {
  return {
    cheval_id: 'c1',
    type: 'Gymnastique',
    date_modification: null,
    provenance: 'live',
    created_at: over.date,
    updated_at: over.date,
    obstacles: [],
    tours: [],
    contexte: null,
    ...over,
  } as SéanceSortie;
}

function obstaclePropre(hauteur: number, répétitions: number) {
  return {
    id: 'o',
    seance_id: 's',
    created_at: new Date(),
    updated_at: new Date(),
    type: 'Oxer' as const,
    hauteur,
    répétitions,
    barres: 0,
    refus: 0,
  };
}

describe('construireContexteBilan', () => {
  it('projette la cible en « dernière » avec faits objectifs (via shared)', () => {
    const cible = séance({
      id: 's2',
      date: new Date('2026-06-30T10:00:00Z'),
      // biome-ignore lint/suspicious/noExplicitAny: forme d'obstacle allégée pour le test.
      obstacles: [obstaclePropre(110, 5) as any],
    });
    const contexte = construireContexteBilan([cible], cible);
    expect(contexte.dernière.hauteur_max).toBe(110);
    expect(contexte.dernière.efforts_propres).toBe(5);
    expect(contexte.dernière.efforts_totaux).toBe(5);
    expect(contexte.dernière.taux_réussite).toBe(1);
  });

  it('joint le contexte qualitatif (matière narrative, jamais agrégée)', () => {
    const cible = séance({
      id: 's1',
      date: new Date('2026-06-30T10:00:00Z'),
      contexte: {
        id: 'ctx',
        seance_id: 's1',
        created_at: new Date(),
        updated_at: new Date(),
        ressenti_global: 4,
        énergie: 3,
        note: 'cheval en forme',
        // biome-ignore lint/suspicious/noExplicitAny: forme contexte allégée pour le test.
      } as any,
    });
    const contexte = construireContexteBilan([cible], cible);
    expect(contexte.dernière.ressenti_global).toBe(4);
    expect(contexte.dernière.énergie).toBe(3);
    expect(contexte.dernière.note).toBe('cheval en forme');
  });

  it('ne retient que des séances ANTÉRIEURES comme précédentes, plafonnées', () => {
    const dates = Array.from({ length: MAX_SÉANCES_PRÉCÉDENTES + 3 }, (_, i) => i);
    const historique = dates.map((i) => séance({ id: `p${i}`, date: new Date(2026, 0, i + 1) }));
    const cible = historique[historique.length - 1]; // la plus récente
    const future = séance({ id: 'future', date: new Date(2027, 0, 1) });

    const contexte = construireContexteBilan([...historique, future], cible);
    // Plafonné à MAX ; la future (postérieure) est exclue ; la cible aussi.
    expect(contexte.précédentes).toHaveLength(MAX_SÉANCES_PRÉCÉDENTES);
    expect(contexte.précédentes.map((s) => s.date)).not.toContain(future.date.toISOString());
    // Ordonnées récent → ancien.
    const temps = contexte.précédentes.map((s) => new Date(s.date).getTime());
    expect(temps).toEqual([...temps].sort((a, b) => b - a));
  });

  it('un Plat (0 obstacle) donne des faits nuls (régularité, pas de hauteur)', () => {
    const cible = séance({ id: 's', date: new Date('2026-06-30T10:00:00Z'), type: 'Plat' });
    const contexte = construireContexteBilan([cible], cible);
    expect(contexte.dernière.hauteur_max).toBeNull();
    expect(contexte.dernière.taux_réussite).toBeNull();
  });
});
