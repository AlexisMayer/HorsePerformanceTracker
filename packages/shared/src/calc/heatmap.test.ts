import { describe, expect, it } from 'vitest';
import { agrègeHeatmap, type CelluleHeatmap, type SéanceHeatmapInput } from './heatmap';
import { tauxCombinaison, tauxObstacleSimple } from './taux-reussite';

/** Raccourci : une séance `live` d'obstacles (le cas nominal de la heatmap). */
function live(obstacles: SéanceHeatmapInput['obstacles']): SéanceHeatmapInput {
  return { provenance: 'live', obstacles };
}

/** Retrouve la cellule `(type, hauteur)`, ou `undefined` si pas de donnée. */
function cellule(
  cellules: CelluleHeatmap[],
  type: string,
  hauteur: number,
): CelluleHeatmap | undefined {
  return cellules.find((c) => c.type === type && c.hauteur === hauteur);
}

describe('agrègeHeatmap — taux §7 exact, agrégé par cellule', () => {
  it('agrège plusieurs obstacles d’une même cellule (Σ propres / Σ totaux)', () => {
    const { cellules } = agrègeHeatmap([
      live([
        { type: 'Oxer', hauteur: 100, répétitions: 4, barres: 1, refus: 0 },
        { type: 'Oxer', hauteur: 100, répétitions: 2, barres: 0, refus: 0 },
      ]),
    ]);
    const c = cellule(cellules, 'Oxer', 100);
    // propres = (4−1) + 2 = 5 ; totaux = 4 + 2 = 6 → 5/6.
    expect(c).toMatchObject({ efforts_propres: 5, efforts_totaux: 6, n_obstacles: 2 });
    expect(c?.taux).toBeCloseTo(5 / 6, 10);
  });

  it('une cellule à obstacle unique porte exactement le taux §7 (simple)', () => {
    const { cellules } = agrègeHeatmap([
      live([{ type: 'Vertical', hauteur: 110, répétitions: 5, barres: 2, refus: 1 }]),
    ]);
    expect(cellule(cellules, 'Vertical', 110)?.taux).toBe(
      tauxObstacleSimple({ répétitions: 5, barres: 2, refus: 1 }),
    );
  });

  it('sépare les cellules par type ET par hauteur', () => {
    const { cellules, types, hauteurs } = agrègeHeatmap([
      live([
        { type: 'Oxer', hauteur: 100, répétitions: 2, barres: 0, refus: 0 },
        { type: 'Oxer', hauteur: 110, répétitions: 2, barres: 0, refus: 0 },
        { type: 'Vertical', hauteur: 100, répétitions: 2, barres: 0, refus: 0 },
      ]),
    ]);
    expect(cellules).toHaveLength(3);
    expect(types).toEqual(['Vertical', 'Oxer']); // ordre du référentiel
    expect(hauteurs).toEqual([100, 110]); // croissant
  });
});

describe('agrègeHeatmap — Combinaison = sa propre ligne (Modèle §9, dénominateur × éléments)', () => {
  it('agrège une combinaison à 3 éléments sur sa hauteur, au bon dénominateur', () => {
    const { cellules, types } = agrègeHeatmap([
      live([
        {
          type: 'Combinaison',
          hauteur: 120,
          répétitions: 2,
          barres: 1,
          refus: 0,
          nombre_d_éléments: 3,
        },
      ]),
    ]);
    const c = cellule(cellules, 'Combinaison', 120);
    // totaux = répétitions × éléments = 2 × 3 = 6 ; propres = 6 − 1 = 5 → 5/6.
    expect(c).toMatchObject({ efforts_propres: 5, efforts_totaux: 6, n_obstacles: 1 });
    expect(c?.taux).toBe(
      tauxCombinaison({ répétitions: 2, nombre_d_éléments: 3, barres: 1, refus: 0 }),
    );
    // La Combinaison est une **ligne à part entière**, jamais fondue dans un simple.
    expect(types).toContain('Combinaison');
  });

  it('place la Combinaison en **dernière** ligne (type-conteneur, référentiel)', () => {
    const { types } = agrègeHeatmap([
      live([
        {
          type: 'Combinaison',
          hauteur: 120,
          répétitions: 1,
          barres: 0,
          refus: 0,
          nombre_d_éléments: 2,
        },
        { type: 'Croix', hauteur: 90, répétitions: 1, barres: 0, refus: 0 },
        { type: 'Oxer', hauteur: 100, répétitions: 1, barres: 0, refus: 0 },
      ]),
    ]);
    expect(types).toEqual(['Croix', 'Oxer', 'Combinaison']);
  });

  it('n’applique PAS la règle §10 : une combinaison fautée compte au dénominateur (taux > 0), pas 0', () => {
    // §10 (hauteur maîtrisée) : combinaison comptée seulement si sans faute → ici 0.
    // §7 (heatmap) : (2×3 − 1) / (2×3) = 5/6 — surtout **pas** 0.
    const { cellules } = agrègeHeatmap([
      live([
        {
          type: 'Combinaison',
          hauteur: 120,
          répétitions: 2,
          barres: 1,
          refus: 0,
          nombre_d_éléments: 3,
        },
      ]),
    ]);
    expect(cellule(cellules, 'Combinaison', 120)?.taux).toBeCloseTo(5 / 6, 10);
  });

  it('ignore une combinaison sans nombre_d_éléments (non calculable), sans planter', () => {
    const { cellules } = agrègeHeatmap([
      live([{ type: 'Combinaison', hauteur: 120, répétitions: 2, barres: 0, refus: 0 }]),
    ]);
    expect(cellule(cellules, 'Combinaison', 120)).toBeUndefined();
  });
});

describe('agrègeHeatmap — cellule vide ≠ taux nul (DoD)', () => {
  it('distingue une case sans donnée (absente) d’une case à 0 % (présente)', () => {
    const { cellules } = agrègeHeatmap([
      // Vertical 110 entièrement fauté → présent, taux 0 (rouille/vide, pas « — »).
      live([{ type: 'Vertical', hauteur: 110, répétitions: 3, barres: 3, refus: 0 }]),
    ]);

    const zéro = cellule(cellules, 'Vertical', 110);
    expect(zéro).toBeDefined();
    expect(zéro?.taux).toBe(0);
    expect(zéro?.n_obstacles).toBe(1); // il y a bien de la donnée

    // Une case jamais travaillée n'a **aucune** cellule → « pas de donnée ».
    expect(cellule(cellules, 'Oxer', 150)).toBeUndefined();
  });

  it('borne une combinaison sur-fautée à 0 (jamais négatif), présente comme donnée', () => {
    const { cellules } = agrègeHeatmap([
      live([
        {
          type: 'Combinaison',
          hauteur: 120,
          répétitions: 2,
          barres: 6,
          refus: 0,
          nombre_d_éléments: 3,
        },
      ]),
    ]);
    const c = cellule(cellules, 'Combinaison', 120);
    // (2×3 − 6) / 6 = 0 (borné), cellule présente (donnée), pas « — ».
    expect(c?.taux).toBe(0);
    expect(c?.efforts_propres).toBe(0);
    expect(c?.efforts_totaux).toBe(6);
  });
});

describe('agrègeHeatmap — périmètre : live only, Plat/Concours/contexte exclus', () => {
  it('exclut le `déclaratif` des agrégats (Modèle §2)', () => {
    const { cellules } = agrègeHeatmap([
      live([{ type: 'Oxer', hauteur: 100, répétitions: 2, barres: 0, refus: 0 }]),
      {
        provenance: 'déclaratif',
        obstacles: [{ type: 'Oxer', hauteur: 140, répétitions: 3, barres: 0, refus: 0 }],
      },
    ]);
    // Le live à 100 est là ; le déclaratif à 140 est **exclu** (aucune cellule).
    expect(cellule(cellules, 'Oxer', 100)).toBeDefined();
    expect(cellule(cellules, 'Oxer', 140)).toBeUndefined();
  });

  it('Plat (0 obstacle) et Concours (des tours, aucun obstacle) ne contribuent rien', () => {
    // Une séance sans obstacle (Plat, ou Concours dont les tours ne sont pas
    // projetés ici) n'apporte aucune cellule — exclusion par construction.
    const { cellules, types, hauteurs } = agrègeHeatmap([
      live([]),
      live([{ type: 'Oxer', hauteur: 100, répétitions: 1, barres: 0, refus: 0 }]),
    ]);
    expect(cellules).toHaveLength(1);
    expect(types).toEqual(['Oxer']);
    expect(hauteurs).toEqual([100]);
  });

  it('un jeu sans aucune séance live rend une heatmap vide', () => {
    expect(agrègeHeatmap([])).toEqual({ types: [], hauteurs: [], cellules: [] });
    expect(
      agrègeHeatmap([
        {
          provenance: 'déclaratif',
          obstacles: [{ type: 'Oxer', hauteur: 100, répétitions: 1, barres: 0, refus: 0 }],
        },
      ]),
    ).toEqual({ types: [], hauteurs: [], cellules: [] });
  });
});
