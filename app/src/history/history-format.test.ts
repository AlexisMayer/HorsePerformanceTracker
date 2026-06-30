import type { ObstacleSortie, SéanceSortie, TourSortie } from '@hpt/shared';
import { describe, expect, it } from 'vitest';
import {
  badgesBilan,
  faitsDeSéance,
  formatHistoryDate,
  formatMonthLabel,
  groupByMonth,
} from './history-format';

/**
 * Tests **purs** de la composition de l'historique (lot 3.4) — faits objectifs
 * (réutilisés de `shared`), **groupement par mois**, format de date/mois, et le
 * **câblage conditionnel** du badge `✦`. Aucun rendu RN : on n'asserte que la
 * logique de présentation.
 */

function obstacle(o: Partial<ObstacleSortie> & Pick<ObstacleSortie, 'hauteur'>): ObstacleSortie {
  return {
    id: 'o',
    created_at: new Date(),
    updated_at: new Date(),
    seance_id: 's',
    type: 'Oxer',
    répétitions: 1,
    barres: 0,
    refus: 0,
    difficulté: null,
    nombre_d_éléments: null,
    éléments: null,
    combinaison_ref: null,
    ...o,
  };
}

function tour(t: Partial<TourSortie> & Pick<TourSortie, 'hauteur'>): TourSortie {
  return {
    id: 't',
    created_at: new Date(),
    updated_at: new Date(),
    seance_id: 's',
    barres: 0,
    refus: 0,
    ...t,
  };
}

function séance(p: Partial<SéanceSortie> & Pick<SéanceSortie, 'id' | 'date'>): SéanceSortie {
  return {
    created_at: new Date(),
    updated_at: new Date(),
    cheval_id: 'cheval-1',
    type: 'Plat',
    date_modification: null,
    provenance: 'live',
    obstacles: [],
    tours: [],
    contexte: null,
    ...p,
  };
}

describe('faitsDeSéance — faits objectifs réutilisés de shared (§1/§7/§9)', () => {
  it('dérive hauteur, efforts et taux d’un entraînement (obstacles)', () => {
    const f = faitsDeSéance(
      séance({
        id: 's1',
        date: new Date('2026-03-12T12:00:00.000Z'),
        type: 'Parcours',
        obstacles: [obstacle({ type: 'Oxer', hauteur: 110, répétitions: 4, barres: 1 })],
      }),
    );
    expect(f).not.toBeNull();
    expect(f?.hauteur_max).toBe(110);
    expect(f?.efforts_totaux).toBe(4);
    expect(f?.efforts_propres).toBe(3);
    expect(f?.taux_réussite).toBeCloseTo(0.75, 10);
    expect(f?.sans_faute).toBe(false);
  });

  it('dérive un concours sans-faute (tours)', () => {
    const f = faitsDeSéance(
      séance({
        id: 's2',
        date: new Date('2026-03-08T12:00:00.000Z'),
        type: 'Concours',
        tours: [tour({ hauteur: 115 })],
      }),
    );
    expect(f?.hauteur_max).toBe(115);
    expect(f?.sans_faute).toBe(true);
    expect(f?.taux_réussite).toBe(1);
  });

  it('renvoie null pour un Plat (0 franchissement → régularité, §3)', () => {
    expect(
      faitsDeSéance(séance({ id: 's3', date: new Date('2026-03-03T12:00:00.000Z') })),
    ).toBeNull();
  });
});

describe('formatHistoryDate / formatMonthLabel — présentation (UI/UX §6.4)', () => {
  it('formate une date courte « jj/MM » (tolérant chaîne ISO)', () => {
    expect(formatHistoryDate(new Date('2026-03-12T12:00:00.000Z'))).toBe('12/03');
    expect(formatHistoryDate('2026-03-08T12:00:00.000Z')).toBe('08/03');
  });

  it('formate le libellé de mois « MOIS AAAA »', () => {
    expect(formatMonthLabel(new Date('2026-03-12T12:00:00.000Z'))).toBe('MARS 2026');
    expect(formatMonthLabel('2026-01-02T12:00:00.000Z')).toBe('JANVIER 2026');
  });

  it('reste muet (chaîne vide) sur une date illisible', () => {
    expect(formatHistoryDate('pas-une-date')).toBe('');
    expect(formatMonthLabel('pas-une-date')).toBe('');
  });
});

describe('groupByMonth — groupement par mois en préservant l’ordre (UI/UX §6.4)', () => {
  it('regroupe les séances consécutives par mois (récent → ancien)', () => {
    const sections = groupByMonth([
      séance({ id: 'a', date: new Date('2026-03-12T12:00:00.000Z') }),
      séance({ id: 'b', date: new Date('2026-03-03T12:00:00.000Z') }),
      séance({ id: 'c', date: new Date('2026-02-20T12:00:00.000Z') }),
    ]);
    expect(sections.map((s) => s.title)).toEqual(['MARS 2026', 'FÉVRIER 2026']);
    expect(sections.map((s) => s.key)).toEqual(['2026-03', '2026-02']);
    expect(sections[0].data.map((s) => s.id)).toEqual(['a', 'b']);
    expect(sections[1].data.map((s) => s.id)).toEqual(['c']);
  });

  it('garde un mois en une seule section même à cheval sur deux pages', () => {
    // Liste aplatie de deux « pages » : mars (p1) puis mars + février (p2).
    const sections = groupByMonth([
      séance({ id: 'a', date: new Date('2026-03-12T12:00:00.000Z') }),
      séance({ id: 'b', date: new Date('2026-03-02T12:00:00.000Z') }),
      séance({ id: 'c', date: new Date('2026-02-28T12:00:00.000Z') }),
    ]);
    expect(sections).toHaveLength(2);
    expect(sections[0].data.map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('ignore une séance à la date illisible plutôt que la mal classer', () => {
    const sections = groupByMonth([
      séance({ id: 'a', date: new Date('2026-03-12T12:00:00.000Z') }),
      // biome-ignore lint/suspicious/noExplicitAny: date volontairement illisible.
      séance({ id: 'bad', date: 'pas-une-date' as any }),
    ]);
    expect(sections).toHaveLength(1);
    expect(sections[0].data.map((s) => s.id)).toEqual(['a']);
  });
});

describe('badgesBilan — câblage conditionnel du slot ✦ (lot 3.4, prêt pour 4.5)', () => {
  it('affiche toujours le bilan simple (✓), ré-ouvrable via 3.3', () => {
    expect(badgesBilan()).toEqual(['simple']);
    expect(badgesBilan(false)).toEqual(['simple']);
  });

  it('n’ajoute le ✦ augmenté QUE si un bilan augmenté existe (jamais en dur)', () => {
    // 3.4 : aucune source ⇒ l'écran ne passe rien ⇒ pas de ✦. La présence reste
    // pilotée par le paramètre (4.5 le passera `true` en lisant `ai-bilan`).
    expect(badgesBilan(true)).toEqual(['simple', 'augmenté']);
  });
});
