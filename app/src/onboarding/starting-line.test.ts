import {
  détecteJalons,
  hauteurMaîtrisée,
  type ObstacleFranchissement,
  recordAbsolu,
  type SéanceCréerDto,
  type SéanceJalonInput,
  séanceCréerSchema,
} from '@hpt/shared';
import { describe, expect, it } from 'vitest';
import { buildStartingLineDto, startingLineDraft } from './starting-line';

/** Projette un DTO de séance vers l'entrée des dérivés (miroir feed/metrics). */
function asJalonInput(dto: SéanceCréerDto, id: string, date: Date): SéanceJalonInput {
  const obstacles: ObstacleFranchissement[] = (dto.obstacles ?? []).map((o) => ({
    type: o.type,
    hauteur: o.hauteur,
    répétitions: o.répétitions,
    barres: o.barres,
    refus: o.refus,
  }));
  return { id, date, provenance: dto.provenance, obstacles, tours: [] };
}

describe('startingLineDraft', () => {
  it('est un franchissement propre unique à la hauteur demandée', () => {
    const draft = startingLineDraft(115);
    expect(draft.obstacles).toHaveLength(1);
    expect(draft.tours).toHaveLength(0);
    const [o] = draft.obstacles;
    expect(o.hauteur).toBe(115);
    expect(o.répétitions).toBe(1);
    // « Franchit proprement » : aucune faute (taux 100 %), donc un vrai repère.
    expect(o.barres).toBe(0);
    expect(o.refus).toBe(0);
  });

  it('borne la hauteur au référentiel §0 (pas de 5)', () => {
    // 112 n'est pas un cran : ramené au plus proche (110).
    expect(startingLineDraft(112).obstacles[0].hauteur).toBe(110);
    // Au-delà du max : borné à 160.
    expect(startingLineDraft(999).obstacles[0].hauteur).toBe(160);
  });
});

describe('buildStartingLineDto', () => {
  it('pose la provenance « déclaratif » (exclue des agrégats, Modèle §2)', () => {
    const dto = buildStartingLineDto(120);
    expect(dto.provenance).toBe('déclaratif');
  });

  it('produit un DTO accepté par le schéma serveur de création (2.2)', () => {
    const dto = buildStartingLineDto(120);
    // Aucun contrat dupliqué : on revalide avec le schéma de `@hpt/shared`.
    expect(() => séanceCréerSchema.parse(dto)).not.toThrow();
  });

  it('porte une clé d’idempotence (réessai sans doublon, 2.2/2.3)', () => {
    const dto = buildStartingLineDto(120);
    expect(typeof dto.idempotency_key).toBe('string');
    expect(dto.idempotency_key.length).toBeGreaterThan(0);
  });
});

describe('ligne de départ exclue des agrégats (DoD : ni record ni maîtrisée)', () => {
  // Une vraie séance live (record à 110) + la ligne de départ déclarative, **plus
  // haute** (130). Le déclaratif ne doit jamais l'emporter sur le live.
  const liveDto = séanceCréerSchema.parse({
    type: 'Parcours',
    idempotency_key: '11111111-1111-4111-8111-111111111111',
    provenance: 'live',
    obstacles: [{ type: 'Vertical', hauteur: 110, répétitions: 1, barres: 0, refus: 0 }],
  });
  const live = asJalonInput(liveDto, 'live-1', new Date('2026-03-01T10:00:00Z'));
  const ligne = asJalonInput(
    buildStartingLineDto(130),
    'ligne-1',
    new Date('2026-03-02T10:00:00Z'),
  );

  it('ne devient pas le record absolu, même plus haute que le live', () => {
    expect(recordAbsolu([live, ligne])?.hauteur).toBe(110);
  });

  it('ne génère aucun jalon (les jalons restent attachés aux séances live)', () => {
    const jalons = détecteJalons([live, ligne]);
    expect(jalons.some((j) => j.seance_id === 'ligne-1')).toBe(false);
    expect(jalons.some((j) => j.type === 'record' && j.hauteur === 110)).toBe(true);
  });

  it('n’alimente pas la hauteur maîtrisée (déclaratif filtré)', () => {
    // Seule, la ligne de départ ne produit aucun point de maîtrise (filtre live).
    expect(hauteurMaîtrisée([ligne]).courante).toBeNull();
  });
});
