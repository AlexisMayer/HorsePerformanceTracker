import { describe, expect, it } from 'vitest';
import { tauxCombinaison, tauxObstacleSimple } from './taux-reussite';

describe('tauxObstacleSimple', () => {
  it('calcule le taux sur des exemples connus', () => {
    // (4 − 1 − 0) / 4 = 0.75
    expect(tauxObstacleSimple({ répétitions: 4, barres: 1, refus: 0 })).toBe(0.75);
    // (5 − 2 − 1) / 5 = 0.4
    expect(tauxObstacleSimple({ répétitions: 5, barres: 2, refus: 1 })).toBe(0.4);
    // Franchissement parfait
    expect(tauxObstacleSimple({ répétitions: 1, barres: 0, refus: 0 })).toBe(1);
    // Échec total
    expect(tauxObstacleSimple({ répétitions: 3, barres: 3, refus: 0 })).toBe(0);
  });

  it('renvoie null quand le dénominateur est nul (0 répétition)', () => {
    expect(tauxObstacleSimple({ répétitions: 0, barres: 0, refus: 0 })).toBeNull();
  });

  it('borne une entrée incohérente à 0 plutôt que de renvoyer un négatif', () => {
    expect(tauxObstacleSimple({ répétitions: 2, barres: 5, refus: 0 })).toBe(0);
  });

  it('renvoie null pour des entrées invalides (négatif, non entier, NaN)', () => {
    expect(tauxObstacleSimple({ répétitions: -2, barres: 0, refus: 0 })).toBeNull();
    expect(tauxObstacleSimple({ répétitions: 2.5, barres: 0, refus: 0 })).toBeNull();
    expect(tauxObstacleSimple({ répétitions: 4, barres: -1, refus: 0 })).toBeNull();
    expect(tauxObstacleSimple({ répétitions: Number.NaN, barres: 0, refus: 0 })).toBeNull();
  });
});

describe('tauxCombinaison', () => {
  it('multiplie le dénominateur par le nombre d’éléments (évite le négatif, §7)', () => {
    // 3 éléments, 6 barres, 2 répétitions → (2×3 − 6) / 6 = 0
    expect(tauxCombinaison({ répétitions: 2, nombre_d_éléments: 3, barres: 6, refus: 0 })).toBe(0);
    // (3×2 − 1 − 1) / (3×2) = 4/6
    expect(
      tauxCombinaison({ répétitions: 3, nombre_d_éléments: 2, barres: 1, refus: 1 }),
    ).toBeCloseTo(4 / 6, 10);
    // Combinaison parfaite
    expect(tauxCombinaison({ répétitions: 2, nombre_d_éléments: 2, barres: 0, refus: 0 })).toBe(1);
  });

  it('renvoie null si le dénominateur est nul (0 élément ou 0 répétition)', () => {
    expect(
      tauxCombinaison({ répétitions: 2, nombre_d_éléments: 0, barres: 0, refus: 0 }),
    ).toBeNull();
    expect(
      tauxCombinaison({ répétitions: 0, nombre_d_éléments: 3, barres: 0, refus: 0 }),
    ).toBeNull();
  });

  it('renvoie null pour des entrées invalides', () => {
    expect(
      tauxCombinaison({ répétitions: 2, nombre_d_éléments: -3, barres: 0, refus: 0 }),
    ).toBeNull();
  });
});
