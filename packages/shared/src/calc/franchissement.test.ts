import { describe, expect, it } from 'vitest';
import {
  franchissementsObstacle,
  franchissementsTour,
  type ObstacleFranchissement,
} from './franchissement';

const obstacle = (o: Partial<ObstacleFranchissement> = {}): ObstacleFranchissement => ({
  type: 'Oxer',
  hauteur: 110,
  répétitions: 1,
  barres: 0,
  refus: 0,
  ...o,
});

describe('franchissementsObstacle (obstacle simple, §10)', () => {
  it('compte répétitions − barres − refus efforts propres', () => {
    expect(franchissementsObstacle(obstacle({ répétitions: 4, barres: 1, refus: 0 }))).toBe(3);
    expect(franchissementsObstacle(obstacle({ répétitions: 5, barres: 2, refus: 1 }))).toBe(2);
    expect(franchissementsObstacle(obstacle({ répétitions: 1, barres: 0, refus: 0 }))).toBe(1);
  });

  it('borne à 0 (jamais négatif) quand les fautes dépassent les répétitions', () => {
    expect(franchissementsObstacle(obstacle({ répétitions: 2, barres: 5, refus: 0 }))).toBe(0);
  });

  it('compte 0 sur une entrée invalide (négatif, non entier, NaN) — rien célébré à tort', () => {
    expect(franchissementsObstacle(obstacle({ répétitions: -1 }))).toBe(0);
    expect(franchissementsObstacle(obstacle({ répétitions: 2.5 }))).toBe(0);
    expect(franchissementsObstacle(obstacle({ barres: Number.NaN }))).toBe(0);
  });
});

describe('franchissementsObstacle (combinaison, §10 — conservateur)', () => {
  it('compte répétitions franchissements si la ligne entière est sans faute', () => {
    expect(
      franchissementsObstacle(
        obstacle({ type: 'Combinaison', répétitions: 2, barres: 0, refus: 0 }),
      ),
    ).toBe(2);
  });

  it('compte 0 dès la moindre faute (on n’attribue pas la faute par élément)', () => {
    expect(
      franchissementsObstacle(
        obstacle({ type: 'Combinaison', répétitions: 3, barres: 1, refus: 0 }),
      ),
    ).toBe(0);
    expect(
      franchissementsObstacle(
        obstacle({ type: 'Combinaison', répétitions: 3, barres: 0, refus: 1 }),
      ),
    ).toBe(0);
  });
});

describe('franchissementsTour (concours, §10)', () => {
  it('vaut 1 si sans-faute, 0 sinon', () => {
    expect(franchissementsTour({ hauteur: 120, barres: 0, refus: 0 })).toBe(1);
    expect(franchissementsTour({ hauteur: 120, barres: 1, refus: 0 })).toBe(0);
    expect(franchissementsTour({ hauteur: 120, barres: 0, refus: 2 })).toBe(0);
  });

  it('compte 0 sur une entrée invalide', () => {
    expect(franchissementsTour({ hauteur: 120, barres: -1, refus: 0 })).toBe(0);
  });
});
