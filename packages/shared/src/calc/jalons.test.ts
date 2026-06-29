import { describe, expect, it } from 'vitest';
import { détecteJalons, type Jalon, type SéanceJalonInput } from './jalons';

/** Construit une séance live d'entraînement (obstacles) datée. */
function séance(
  id: string,
  date: string,
  obstacles: SéanceJalonInput['obstacles'],
  provenance: SéanceJalonInput['provenance'] = 'live',
): SéanceJalonInput {
  return { id, date: new Date(date), provenance, obstacles, tours: [] };
}

const propre = (hauteur: number) =>
  ({ type: 'Oxer', hauteur, répétitions: 1, barres: 0, refus: 0 }) as const;
const fauté = (hauteur: number) =>
  ({ type: 'Oxer', hauteur, répétitions: 1, barres: 1, refus: 0 }) as const;

/** Résumé compact d'un jalon pour des assertions lisibles. */
const résumé = (j: Jalon) => `${j.type}@${j.hauteur}#${j.seance_id}`;

describe('détecteJalons — records (plus haut franchissement propre, §10)', () => {
  it('génère un record dès la séance n°1 (fonctionne dès le départ)', () => {
    const jalons = détecteJalons([séance('s1', '2026-01-01', [propre(110)])]);
    expect(jalons.map(résumé)).toEqual(['record@110#s1']);
  });

  it('un nouveau plus haut franchissement propre génère un nouveau record', () => {
    const jalons = détecteJalons([
      séance('s1', '2026-01-01', [propre(110)]),
      séance('s2', '2026-01-08', [propre(120)]),
    ]);
    expect(jalons.map(résumé)).toEqual(['record@110#s1', 'record@120#s2']);
  });

  it('ne re-célèbre pas un record déjà atteint (≤ historique) ', () => {
    const jalons = détecteJalons([
      séance('s1', '2026-01-01', [propre(120)]),
      séance('s2', '2026-01-08', [propre(110)]), // plus bas → pas un record
    ]);
    expect(jalons.map(résumé)).toEqual(['record@120#s1', 'première_fois@110#s2']);
  });

  it('un franchissement fauté ne compte pas (record uniquement sur le propre)', () => {
    const jalons = détecteJalons([séance('s1', '2026-01-01', [fauté(130), propre(110)])]);
    expect(jalons.map(résumé)).toEqual(['record@110#s1']);
  });
});

describe('détecteJalons — premières fois (1re hauteur franchie proprement)', () => {
  it('le sommet d’une séance est un record, les autres hauteurs neuves des premières fois', () => {
    const jalons = détecteJalons([
      séance('s1', '2026-01-01', [propre(100), propre(105), propre(110)]),
    ]);
    expect(jalons.map(résumé)).toEqual([
      'record@110#s1',
      'première_fois@100#s1',
      'première_fois@105#s1',
    ]);
  });

  it('une hauteur déjà franchie proprement ne redéclenche pas de première fois', () => {
    const jalons = détecteJalons([
      séance('s1', '2026-01-01', [propre(110)]),
      séance('s2', '2026-01-08', [propre(110)]), // déjà franchie
    ]);
    expect(jalons.map(résumé)).toEqual(['record@110#s1']);
  });

  it('première fois à une hauteur sous le record courant (régression assumée, §5.5)', () => {
    const jalons = détecteJalons([
      séance('s1', '2026-01-01', [propre(120)]),
      séance('s2', '2026-01-08', [propre(115)]), // jamais franchie, mais < record
    ]);
    expect(jalons.map(résumé)).toEqual(['record@120#s1', 'première_fois@115#s2']);
  });
});

describe('détecteJalons — provenance (le déclaratif ne génère aucun dérivé, §2)', () => {
  it('exclut les séances déclaratives de la détection', () => {
    const jalons = détecteJalons([
      séance('s1', '2026-01-01', [propre(140)], 'déclaratif'), // antérieure à l'app
      séance('s2', '2026-01-08', [propre(110)], 'live'),
    ]);
    // Le 140 déclaratif est ignoré : le 110 live est le premier record.
    expect(jalons.map(résumé)).toEqual(['record@110#s2']);
  });
});

describe('détecteJalons — concours & robustesse', () => {
  it('un tour de concours sans-faute compte comme franchissement propre', () => {
    const jalons = détecteJalons([
      {
        id: 's1',
        date: new Date('2026-01-01'),
        provenance: 'live',
        obstacles: [],
        tours: [{ hauteur: 125, barres: 0, refus: 0 }],
      },
    ]);
    expect(jalons.map(résumé)).toEqual(['record@125#s1']);
  });

  it('réordonne par date (entrée non triée) avant de dériver', () => {
    const jalons = détecteJalons([
      séance('s2', '2026-01-08', [propre(120)]),
      séance('s1', '2026-01-01', [propre(110)]),
    ]);
    expect(jalons.map(résumé)).toEqual(['record@110#s1', 'record@120#s2']);
  });

  it('recompose sur l’historique courant : retirer la séance du record le redérive (2.4)', () => {
    const historique = [
      séance('s1', '2026-01-01', [propre(110)]),
      séance('s2', '2026-01-08', [propre(120)]),
    ];
    expect(détecteJalons(historique).map(résumé)).toEqual(['record@110#s1', 'record@120#s2']);
    // Suppression de s2 (record 120) ⇒ le fil recomposé ne garde que s1.
    const aprèsSuppression = historique.filter((s) => s.id !== 's2');
    expect(détecteJalons(aprèsSuppression).map(résumé)).toEqual(['record@110#s1']);
  });
});
