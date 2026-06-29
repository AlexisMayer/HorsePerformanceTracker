import { describe, expect, it } from 'vitest';
import {
  FENÊTRE_MAÎTRISE_JOURS,
  hauteurMaîtrisée,
  hauteurMaîtriséeParmi,
} from './hauteur-maitrisee';
import { recordAbsolu, type SéanceJalonInput } from './jalons';

/** Obstacle propre : `répétitions` franchissements propres à `hauteur`. */
const propres = (hauteur: number, répétitions: number) =>
  ({ type: 'Oxer', hauteur, répétitions, barres: 0, refus: 0 }) as const;

/** Construit une séance live d'entraînement (obstacles) datée. */
function séance(
  id: string,
  date: string,
  obstacles: SéanceJalonInput['obstacles'],
  provenance: SéanceJalonInput['provenance'] = 'live',
): SéanceJalonInput {
  return { id, date: new Date(date), provenance, obstacles, tours: [] };
}

describe('hauteurMaîtriséeParmi — règle §10 (≥ 3 franchissements propres / ≥ 2 séances)', () => {
  it('exige ≥ 2 séances : 3 franchissements propres dans UNE séance ne suffisent pas', () => {
    const s = [séance('s1', '2026-01-01', [propres(110, 3)])];
    expect(hauteurMaîtriséeParmi(s)).toBeNull();
  });

  it('exige ≥ 3 franchissements : 1 par séance sur 2 séances (total 2) ne suffit pas', () => {
    const s = [
      séance('s1', '2026-01-01', [propres(110, 1)]),
      séance('s2', '2026-01-08', [propres(110, 1)]),
    ];
    expect(hauteurMaîtriséeParmi(s)).toBeNull();
  });

  it('maîtrise au seuil exact : 2 + 1 franchissements sur 2 séances (total 3)', () => {
    const s = [
      séance('s1', '2026-01-01', [propres(110, 2)]),
      séance('s2', '2026-01-08', [propres(110, 1)]),
    ];
    expect(hauteurMaîtriséeParmi(s)).toBe(110);
  });

  it('retient la plus HAUTE hauteur maîtrisée (plancher = sommet fiable)', () => {
    const s = [
      séance('s1', '2026-01-01', [propres(110, 2), propres(115, 2)]),
      séance('s2', '2026-01-08', [propres(110, 2), propres(115, 2)]),
    ];
    // 110 et 115 maîtrisées → on retient 115.
    expect(hauteurMaîtriséeParmi(s)).toBe(115);
  });

  it('combinaison : comptée seulement si la ligne entière est sans faute (§10)', () => {
    const combo = (barres: number) =>
      ({ type: 'Combinaison', hauteur: 120, répétitions: 2, barres, refus: 0 }) as const;
    // 2 séances propres × 2 franchissements = 4 ≥ 3 → maîtrisée.
    expect(
      hauteurMaîtriséeParmi([
        séance('s1', '2026-01-01', [combo(0)]),
        séance('s2', '2026-01-08', [combo(0)]),
      ]),
    ).toBe(120);
    // La moindre faute disqualifie toute la ligne → 0 franchissement → non maîtrisée.
    expect(
      hauteurMaîtriséeParmi([
        séance('s1', '2026-01-01', [combo(1)]),
        séance('s2', '2026-01-08', [combo(1)]),
      ]),
    ).toBeNull();
  });

  it('un tour de concours sans-faute compte comme franchissement propre (§10)', () => {
    const tour = (id: string, date: string): SéanceJalonInput => ({
      id,
      date: new Date(date),
      provenance: 'live',
      obstacles: [],
      tours: [{ hauteur: 125, barres: 0, refus: 0 }],
    });
    // 1 franchissement par tour : 3 tours sans-faute sur 3 séances → maîtrisée à 125.
    expect(
      hauteurMaîtriséeParmi([
        tour('s1', '2026-01-01'),
        tour('s2', '2026-01-08'),
        tour('s3', '2026-01-15'),
      ]),
    ).toBe(125);
  });
});

describe('hauteurMaîtrisée — live only, Plat exclu (§2, §10)', () => {
  it('exclut le déclaratif des agrégats (la ligne de départ ne maîtrise pas)', () => {
    const s = [
      // Déclaratif « propre » à 140 sur 2 séances : ignoré (hors agrégats, §2).
      séance('d1', '2026-01-01', [propres(140, 2)], 'déclaratif'),
      séance('d2', '2026-01-08', [propres(140, 2)], 'déclaratif'),
      // Live à 110 maîtrisé.
      séance('s1', '2026-02-01', [propres(110, 2)]),
      séance('s2', '2026-02-08', [propres(110, 1)]),
    ];
    expect(hauteurMaîtrisée(s).courante).toBe(110);
  });

  it('le Plat (0 obstacle) ne porte aucune hauteur → aucune maîtrise', () => {
    const plat = (id: string, date: string): SéanceJalonInput => ({
      id,
      date: new Date(date),
      provenance: 'live',
      obstacles: [],
      tours: [],
    });
    const s = [plat('p1', '2026-01-01'), plat('p2', '2026-01-08'), plat('p3', '2026-01-15')];
    const { courante, série } = hauteurMaîtrisée(s);
    expect(courante).toBeNull();
    // Une série existe (timeline des séances live) mais sans hauteur maîtrisée.
    expect(série.map((p) => p.hauteur)).toEqual([null, null, null]);
  });

  it('le chiffre courant = dernier point de la série (maîtrisée à la dernière séance)', () => {
    const s = [
      séance('s1', '2026-01-01', [propres(110, 2)]),
      séance('s2', '2026-01-08', [propres(110, 1)]),
    ];
    const { courante, série } = hauteurMaîtrisée(s);
    expect(série.map((p) => p.hauteur)).toEqual([null, 110]);
    expect(courante).toBe(série[série.length - 1].hauteur);
  });
});

describe('hauteurMaîtrisée — honnêteté §5.5 : la maîtrisée redescend, le record reste gravé', () => {
  it('une régression baisse la maîtrisée (fenêtre), le record absolu ne s’efface pas', () => {
    const historique = [
      // Maîtrise établie à 115 (4 franchissements / 2 séances).
      séance('s1', '2024-01-01', [propres(115, 2)]),
      séance('s2', '2024-02-01', [propres(115, 2)]),
      // Exploit ponctuel à 125 (un seul franchissement) → record, jamais maîtrisé.
      séance('s3', '2024-03-01', [propres(125, 1)]),
      // Reprise post-blessure > 1 an plus tard, à plus basse hauteur (105).
      séance('s4', '2025-06-01', [propres(105, 2)]),
      séance('s5', '2025-07-01', [propres(105, 2)]),
    ];

    const { courante, série } = hauteurMaîtrisée(historique);

    // La maîtrisée a redescendu : les hauteurs hautes sont sorties de la fenêtre.
    expect(courante).toBe(105);
    // La courbe encode la baisse honnêtement (montée à 115, puis creux, puis 105).
    expect(série.map((p) => p.hauteur)).toEqual([null, 115, 115, null, 105]);

    // Le record absolu reste GRAVÉ à 125 (tout-temps, jamais fenêtré, §5.5).
    const record = recordAbsolu(historique);
    expect(record?.hauteur).toBe(125);
    expect(record?.seance_id).toBe('s3');

    // Preuve directe : la maîtrisée courante est strictement sous le record gravé.
    expect(courante).toBeLessThan(record?.hauteur ?? 0);
  });

  it('la fenêtre par défaut couvre une année sportive (constante tunable)', () => {
    expect(FENÊTRE_MAÎTRISE_JOURS).toBe(365);
  });

  it('le plancher conservateur peut rester sous le record sans le faire bouger', () => {
    // Maîtrisée 110, mais record à 130 (exploit unique) : floor < ceiling.
    const s = [
      séance('s1', '2026-01-01', [propres(110, 2)]),
      séance('s2', '2026-01-08', [propres(110, 1), propres(130, 1)]),
    ];
    expect(hauteurMaîtrisée(s).courante).toBe(110);
    expect(recordAbsolu(s)?.hauteur).toBe(130);
  });
});

describe('recordAbsolu — le record gravé (§5.5, réutilise la détection de 3.1)', () => {
  it('renvoie le plus haut franchissement propre live, null si aucun', () => {
    expect(recordAbsolu([])).toBeNull();
    expect(recordAbsolu([séance('d1', '2026-01-01', [propres(140, 1)], 'déclaratif')])).toBeNull();
    expect(
      recordAbsolu([
        séance('s1', '2026-01-01', [propres(110, 1)]),
        séance('s2', '2026-01-08', [propres(120, 1)]),
      ])?.hauteur,
    ).toBe(120);
  });
});
