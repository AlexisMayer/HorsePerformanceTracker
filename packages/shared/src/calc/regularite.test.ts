import { describe, expect, it } from 'vitest';
import { régularité, type SéanceRégularitéInput } from './regularite';

/** Construit une entrée de régularité datée (live par défaut). */
const s = (date: string, provenance: SéanceRégularitéInput['provenance'] = 'live') =>
  ({ date: new Date(date), provenance }) satisfies SéanceRégularitéInput;

describe('régularité — provenance (live only, §2/§6)', () => {
  it('exclut le déclaratif des agrégats (ligne de départ / séances de mémoire)', () => {
    const r = régularité([
      s('2026-01-05', 'live'),
      s('2026-01-12', 'déclaratif'),
      s('2026-01-19', 'live'),
    ]);
    // Seules les 2 séances live comptent ; la déclarative est ignorée.
    expect(r.total_séances).toBe(2);
  });

  it('sans aucune séance live, tout est à zéro (rien à prouver)', () => {
    const r = régularité([s('2026-01-05', 'déclaratif')]);
    expect(r).toEqual({
      total_séances: 0,
      début: null,
      fin: null,
      jours_couverts: 0,
      séances_par_mois: 0,
      semaines_actives: 0,
      plus_longue_série_semaines: 0,
    });
  });
});

describe('régularité — fréquence (séances/mois)', () => {
  it('compte TOUTES les séances live, Plat inclus (assiduité, pas hauteur)', () => {
    // 4 séances sur ~30 jours ⇒ ~4 séances/mois. Le Plat compte comme les autres.
    const r = régularité([s('2026-01-01'), s('2026-01-08'), s('2026-01-15'), s('2026-01-29')]);
    expect(r.total_séances).toBe(4);
    expect(r.début).toEqual(new Date('2026-01-01'));
    expect(r.fin).toEqual(new Date('2026-01-29'));
    // Étendue = 29 jours + 1 = 29 jours inclusifs ; 4 / 29 * 30 ≈ 4,14.
    expect(r.jours_couverts).toBe(29);
    expect(r.séances_par_mois).toBeCloseTo((4 / 29) * 30, 5);
  });
});

describe('régularité — continuité (semaines actives + plus longue série)', () => {
  it('compte les semaines calendaires distinctes et la plus longue suite consécutive', () => {
    // 4 semaines consécutives, puis un trou, puis 2 semaines consécutives.
    const r = régularité([
      s('2026-01-05'), // semaine A
      s('2026-01-12'), // A+1
      s('2026-01-19'), // A+2
      s('2026-01-26'), // A+3
      // trou (pas de séance semaine A+4)
      s('2026-02-09'), // A+5
      s('2026-02-16'), // A+6
    ]);
    expect(r.semaines_actives).toBe(6);
    expect(r.plus_longue_série_semaines).toBe(4);
  });

  it('deux séances la même semaine ne comptent qu’une semaine active', () => {
    const r = régularité([s('2026-03-02'), s('2026-03-04')]);
    expect(r.total_séances).toBe(2);
    expect(r.semaines_actives).toBe(1);
    expect(r.plus_longue_série_semaines).toBe(1);
  });
});

describe('régularité — fenêtre de curation (§6.3, données inviolables)', () => {
  const historique = [
    s('2025-12-20'),
    s('2026-01-10'),
    s('2026-01-24'),
    s('2026-02-14'),
    s('2026-03-30'),
  ];

  it('restreint aux séances de la période (bornes incluses), sans toucher aux autres', () => {
    const r = régularité(historique, {
      from: new Date('2026-01-01'),
      to: new Date('2026-02-28'),
    });
    // 3 séances dans janv.–févr. ; celles de déc. et mars sont hors période.
    expect(r.total_séances).toBe(3);
    expect(r.début).toEqual(new Date('2026-01-10'));
    expect(r.fin).toEqual(new Date('2026-02-14'));
  });

  it('la période documentée prime : une fin de fenêtre creuse abaisse la fréquence', () => {
    // Fenêtre de 60 jours mais 1 seule séance ⇒ fréquence basse (période honnête).
    const r = régularité([s('2026-01-05')], {
      from: new Date('2026-01-01'),
      to: new Date('2026-03-01'),
    });
    expect(r.total_séances).toBe(1);
    // Étendue = fenêtre fournie (60 jours inclusifs), pas « resserrée » à la séance.
    expect(r.jours_couverts).toBe(60);
    expect(r.séances_par_mois).toBeCloseTo((1 / 60) * 30, 5);
  });

  it('changer la période change le résumé — la même donnée sous-jacente est réutilisée', () => {
    const large = régularité(historique);
    const étroit = régularité(historique, {
      from: new Date('2026-01-01'),
      to: new Date('2026-01-31'),
    });
    expect(large.total_séances).toBe(5);
    expect(étroit.total_séances).toBe(2);
    // La donnée d'entrée n'est pas mutée par la curation (inviolabilité §2).
    expect(historique).toHaveLength(5);
  });
});
