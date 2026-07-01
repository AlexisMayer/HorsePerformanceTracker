import { describe, expect, it } from 'vitest';
import {
  type BilanAugmentéSortie,
  bilanAugmentéSortieSchema,
  bilansAugmentésDisponiblesSchema,
  DISCLAIMER_IA,
} from './ai-bilan';

/**
 * Contrats `shared` du **bilan augmenté** (lot 4.5, Spec §7). On prouve la forme
 * de sortie (projection + disclaimer + modèle/version épinglés), la constante de
 * disclaimer, et la forme de disponibilité (slot ✦ de l'Historique).
 */
describe('bilanAugmentéSortieSchema', () => {
  const valide: BilanAugmentéSortie = {
    id: 'b1',
    seance_id: 's1',
    date_génération: new Date('2026-07-01T10:00:00.000Z'),
    modèle: 'mistral-small',
    version: 'mistral-small-2409',
    contenu: {
      analyse: 'Belle séance à 110 cm, 4/5 propres.',
      recommandations: 'La prochaine fois, vise 115 cm sur 2 tentatives.',
    },
    disclaimer: DISCLAIMER_IA,
  };

  it('accepte une sortie complète (contenu regroupé + modèle/version + disclaimer)', () => {
    const parsed = bilanAugmentéSortieSchema.parse(valide);
    expect(parsed.contenu.analyse).toContain('110 cm');
    expect(parsed.contenu.recommandations).toContain('115 cm');
    // Modèle + version épinglés (jamais `-latest`, Stack §3.6) présents en sortie.
    expect(parsed.modèle).toBe('mistral-small');
    expect(parsed.version).toBe('mistral-small-2409');
    expect(parsed.version).not.toContain('latest');
  });

  it('exige le disclaimer et le contenu (texte consultatif, Spec §7.2)', () => {
    expect(() => bilanAugmentéSortieSchema.parse({ ...valide, disclaimer: undefined })).toThrow();
    expect(() =>
      bilanAugmentéSortieSchema.parse({ ...valide, contenu: { analyse: 'x' } }),
    ).toThrow();
  });

  it('le disclaimer mentionne l’IA, le véto et le coach (assister sans remplacer)', () => {
    expect(DISCLAIMER_IA).toMatch(/IA/);
    expect(DISCLAIMER_IA).toMatch(/vétérinaire/);
    expect(DISCLAIMER_IA).toMatch(/coach/);
  });
});

describe('bilansAugmentésDisponiblesSchema (slot ✦ de l’Historique)', () => {
  it('liste les séances possédant un bilan augmenté', () => {
    const parsed = bilansAugmentésDisponiblesSchema.parse({
      cheval_id: 'c1',
      seance_ids: ['s1', 's2'],
    });
    expect(parsed.seance_ids).toEqual(['s1', 's2']);
  });

  it('accepte une liste vide (aucun bilan ⇒ aucun ✦)', () => {
    const parsed = bilansAugmentésDisponiblesSchema.parse({ cheval_id: 'c1', seance_ids: [] });
    expect(parsed.seance_ids).toHaveLength(0);
  });
});
