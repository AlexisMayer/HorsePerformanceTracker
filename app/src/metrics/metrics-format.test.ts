import type { JalonDto, PointMaîtriseDto, Vitrine } from '@hpt/shared';
import { describe, expect, it } from 'vitest';
import {
  courbeMaîtrise,
  formatHauteur,
  maîtriseAccessibilityLabel,
  plaquesVitrine,
} from './metrics-format';

const point = (hauteur: number | null): PointMaîtriseDto => ({
  date: new Date('2026-01-01'),
  hauteur,
});

describe('formatHauteur', () => {
  it('rend le chiffre, ou un tiret quand rien n’est maîtrisé', () => {
    expect(formatHauteur(115)).toBe('115');
    expect(formatHauteur(null)).toBe('—');
  });
});

describe('maîtriseAccessibilityLabel (honnêteté §5.5, accessibilité §8)', () => {
  it('nomme la maîtrisée et le record gravé', () => {
    expect(maîtriseAccessibilityLabel(115, 125)).toBe(
      'Hauteur maîtrisée : 115 centimètres. Record gravé : 125 centimètres.',
    );
  });

  it('assume l’absence de maîtrise sans dramatiser, record éventuel conservé', () => {
    expect(maîtriseAccessibilityLabel(null, 110)).toBe(
      'Pas encore de hauteur maîtrisée. Record gravé : 110 centimètres.',
    );
    expect(maîtriseAccessibilityLabel(null, null)).toBe('Pas encore de hauteur maîtrisée.');
  });
});

describe('courbeMaîtrise (signature barre, UI/UX §2)', () => {
  it('met la plus haute hauteur en barre pleine et garde la plus basse visible', () => {
    const barres = courbeMaîtrise([point(115), point(115), point(105)]);
    expect(barres.map((b) => b.hauteur)).toEqual([115, 115, 105]);
    expect(barres[0].relatif).toBeCloseTo(1, 10); // 115 = max → pleine
    expect(barres[2].relatif).toBeCloseTo(0.25, 10); // 105 = min → 25 %
  });

  it('encode un creux honnête (relatif 0) pour un point non maîtrisé', () => {
    const barres = courbeMaîtrise([point(null), point(110), point(110)]);
    expect(barres[0]).toEqual({ hauteur: null, relatif: 0 });
    expect(barres[1].relatif).toBeCloseTo(0.65, 10); // fenêtre plate (110,110) → mi-hauteur
  });

  it('ne garde que les points les plus récents (fenêtre max)', () => {
    const série = Array.from({ length: 30 }, () => point(110));
    expect(courbeMaîtrise(série, { max: 5 })).toHaveLength(5);
  });

  it('série vide ou entièrement creuse ne plante pas', () => {
    expect(courbeMaîtrise([])).toEqual([]);
    expect(courbeMaîtrise([point(null), point(null)])).toEqual([
      { hauteur: null, relatif: 0 },
      { hauteur: null, relatif: 0 },
    ]);
  });
});

const jalon = (type: JalonDto['type'], hauteur: number): JalonDto => ({
  seance_id: `s-${hauteur}`,
  date: new Date('2026-01-01'),
  type,
  hauteur,
});

describe('plaquesVitrine (palmarès laiton, Spec §5.2)', () => {
  it('met le record absolu en tête et liste les autres hauteurs (desc, dédupliquées)', () => {
    const vitrine: Vitrine = {
      record: jalon('record', 125),
      jalons: [
        jalon('record', 115),
        jalon('record', 125),
        jalon('première_fois', 100),
        jalon('première_fois', 105),
      ],
    };
    expect(plaquesVitrine(vitrine)).toEqual({
      record: 125,
      premièresFois: [115, 105, 100],
    });
  });

  it('vitrine vide → aucune plaque', () => {
    expect(plaquesVitrine({ record: null, jalons: [] })).toEqual({
      record: null,
      premièresFois: [],
    });
  });
});
