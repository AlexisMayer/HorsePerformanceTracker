import {
  type SéanceSortie,
  séanceCréerSchema,
  séanceModifierSchema,
  tauxCombinaison,
  tauxObstacleSimple,
} from '@hpt/shared';
import { describe, expect, it } from 'vitest';
import {
  canSave,
  clampCounter,
  clampHauteur,
  draftFromPreviousSession,
  draftFromSession,
  draftReducer,
  draftToCreateDto,
  draftToModifierDto,
  duplicateObstaclePlus5,
  emptyDraft,
  formatDateModification,
  formatRate,
  newObstacle,
  newTour,
  obstaclePreviewRate,
  resizeÉléments,
  type SessionDraft,
  stepHauteur,
} from './draft';

describe('hauteur & compteurs (helpers purs)', () => {
  it('clampHauteur ramène sur le cran de 5 le plus proche, borné [60,160]', () => {
    expect(clampHauteur(113)).toBe(115);
    expect(clampHauteur(112)).toBe(110);
    expect(clampHauteur(40)).toBe(60);
    expect(clampHauteur(999)).toBe(160);
  });

  it('stepHauteur monte/descend de 5 cm sans sortir du référentiel', () => {
    expect(stepHauteur(110, 1)).toBe(115);
    expect(stepHauteur(160, 1)).toBe(160); // plafonné
    expect(stepHauteur(60, -1)).toBe(60); // planché
  });

  it('clampCounter borne à un entier ≥ min', () => {
    expect(clampCounter(3.6, 0)).toBe(4);
    expect(clampCounter(-2, 0)).toBe(0);
    expect(clampCounter(1, 2)).toBe(2);
    expect(clampCounter(Number.NaN, 1)).toBe(1);
  });

  it('resizeÉléments tronque/complète la liste détaillée', () => {
    expect(resizeÉléments(['Oxer', 'Mur', 'Croix'], 2)).toEqual(['Oxer', 'Mur']);
    expect(resizeÉléments(['Oxer'], 3)).toEqual(['Oxer', 'Vertical', 'Vertical']);
    expect(resizeÉléments([], 2)).toEqual(['Vertical', 'Vertical']);
  });
});

describe('aperçu des taux (via shared, §7)', () => {
  it('obstacle simple : (rép − barres − refus)/rép, identique à shared', () => {
    const o = newObstacle({ type: 'Oxer', répétitions: 5, barres: 1, refus: 0 });
    expect(obstaclePreviewRate(o)).toBe(0.8);
    expect(obstaclePreviewRate(o)).toBe(
      tauxObstacleSimple({ répétitions: 5, barres: 1, refus: 0 }),
    );
  });

  it('combinaison : dénominateur = rép × éléments, identique à shared', () => {
    const o = newObstacle({ type: 'Combinaison', répétitions: 2, nombre_d_éléments: 3, barres: 2 });
    // (2*3 - 2 - 0) / (2*3) = 4/6
    expect(obstaclePreviewRate(o)).toBeCloseTo(4 / 6);
    expect(obstaclePreviewRate(o)).toBe(
      tauxCombinaison({ répétitions: 2, nombre_d_éléments: 3, barres: 2, refus: 0 }),
    );
  });

  it('formatRate : pourcentage entier ou tiret', () => {
    expect(formatRate(0.8)).toBe('80 %');
    expect(formatRate(1)).toBe('100 %');
    expect(formatRate(null)).toBe('—');
  });
});

describe('duplication', () => {
  it('« même obstacle, +5 cm » garde type/répétitions/structure, monte de 5, repart à 0 faute', () => {
    const src = newObstacle({
      type: 'Combinaison',
      hauteur: 115,
      répétitions: 3,
      barres: 2,
      refus: 1,
      difficulté: 4,
      nombre_d_éléments: 3,
      éléments: ['Vertical', 'Oxer', 'Vertical'],
    });
    const dup = duplicateObstaclePlus5(src);
    expect(dup.type).toBe('Combinaison');
    expect(dup.hauteur).toBe(120);
    expect(dup.répétitions).toBe(3);
    expect(dup.nombre_d_éléments).toBe(3);
    expect(dup.éléments).toEqual(['Vertical', 'Oxer', 'Vertical']);
    expect(dup.barres).toBe(0);
    expect(dup.refus).toBe(0);
    expect(dup.difficulté).toBeNull();
    expect(dup.localId).not.toBe(src.localId);
  });

  it('« +5 cm » est plafonné à 160', () => {
    expect(duplicateObstaclePlus5(newObstacle({ hauteur: 160 })).hauteur).toBe(160);
  });
});

const PREV_TRAINING: SéanceSortie = {
  id: 's1',
  created_at: new Date(),
  updated_at: new Date(),
  cheval_id: 'h1',
  type: 'Parcours',
  date: new Date(),
  date_modification: null,
  provenance: 'live',
  obstacles: [
    {
      id: 'o1',
      created_at: new Date(),
      updated_at: new Date(),
      seance_id: 's1',
      type: 'Oxer',
      hauteur: 110,
      répétitions: 4,
      barres: 1,
      refus: 0,
      difficulté: 3,
      nombre_d_éléments: null,
      éléments: null,
    },
  ],
  tours: [],
  contexte: null,
};

const PREV_CONCOURS: SéanceSortie = {
  ...PREV_TRAINING,
  id: 's2',
  type: 'Concours',
  obstacles: [],
  tours: [
    {
      id: 't1',
      created_at: new Date(),
      updated_at: new Date(),
      seance_id: 's2',
      hauteur: 120,
      barres: 0,
      refus: 0,
    },
  ],
};

describe('duplication de la séance précédente (boucle nominale §3.4)', () => {
  it('reprend type + structure des obstacles, remet les fautes à 0, clé neuve', () => {
    const draft = draftFromPreviousSession(PREV_TRAINING);
    expect(draft.type).toBe('Parcours');
    expect(draft.obstacles).toHaveLength(1);
    expect(draft.obstacles[0]).toMatchObject({
      type: 'Oxer',
      hauteur: 110,
      répétitions: 4,
      barres: 0,
      refus: 0,
      difficulté: null,
    });
    expect(draft.idempotency_key).not.toBe(PREV_TRAINING.id);
    expect(draft.contexte.note).toBe('');
  });

  it('reprend les tours d’un concours (hauteurs), fautes à 0', () => {
    const draft = draftFromPreviousSession(PREV_CONCOURS);
    expect(draft.type).toBe('Concours');
    expect(draft.tours).toEqual([expect.objectContaining({ hauteur: 120, barres: 0, refus: 0 })]);
    expect(draft.obstacles).toHaveLength(0);
  });
});

describe('canSave', () => {
  it('Plat enregistrable même à 0 obstacle (régularité)', () => {
    expect(canSave(emptyDraft('Plat'))).toBe(true);
  });
  it('Parcours exige ≥ 1 obstacle', () => {
    const empty = emptyDraft('Parcours');
    expect(canSave(empty)).toBe(false);
    expect(canSave({ ...empty, obstacles: [newObstacle()] })).toBe(true);
  });
  it('Concours exige ≥ 1 tour', () => {
    const empty = emptyDraft('Concours');
    expect(canSave(empty)).toBe(false);
    expect(canSave({ ...empty, tours: [newTour()] })).toBe(true);
  });
});

describe('draftToCreateDto → DTO accepté par séanceCréerSchema', () => {
  it('entraînement : obstacles projetés, le DTO passe la validation serveur', () => {
    const draft: SessionDraft = {
      ...emptyDraft('Parcours'),
      obstacles: [
        newObstacle({ type: 'Oxer', hauteur: 110, répétitions: 5, barres: 1, difficulté: 2 }),
      ],
    };
    const dto = draftToCreateDto(draft);
    expect(dto.type).toBe('Parcours');
    expect(dto.provenance).toBe('live');
    expect(dto.obstacles).toHaveLength(1);
    expect(dto.tours).toBeUndefined();
    expect(dto.obstacles?.[0]).toMatchObject({ type: 'Oxer', difficulté: 2 });
    // Un obstacle simple ne doit PAS porter de champs de combinaison.
    expect(dto.obstacles?.[0]).not.toHaveProperty('nombre_d_éléments');
    expect(() => séanceCréerSchema.parse(dto)).not.toThrow();
  });

  it('combinaison : nombre_d_éléments émis ; éléments omis si incomplets', () => {
    const incomplet = draftToCreateDto({
      ...emptyDraft('Gymnastique'),
      obstacles: [
        newObstacle({ type: 'Combinaison', nombre_d_éléments: 3, éléments: ['Vertical'] }),
      ],
    });
    expect(incomplet.obstacles?.[0]).toMatchObject({ nombre_d_éléments: 3 });
    expect(incomplet.obstacles?.[0]).not.toHaveProperty('éléments');
    expect(() => séanceCréerSchema.parse(incomplet)).not.toThrow();

    const complet = draftToCreateDto({
      ...emptyDraft('Gymnastique'),
      obstacles: [
        newObstacle({
          type: 'Combinaison',
          nombre_d_éléments: 2,
          éléments: ['Vertical', 'Oxer'],
        }),
      ],
    });
    expect(complet.obstacles?.[0]).toMatchObject({
      nombre_d_éléments: 2,
      éléments: ['Vertical', 'Oxer'],
    });
    expect(() => séanceCréerSchema.parse(complet)).not.toThrow();
  });

  it('concours : tours projetés, pas d’obstacles', () => {
    const dto = draftToCreateDto({
      ...emptyDraft('Concours'),
      tours: [newTour({ hauteur: 120, barres: 0, refus: 0 })],
    });
    expect(dto.tours).toHaveLength(1);
    expect(dto.obstacles).toBeUndefined();
    expect(() => séanceCréerSchema.parse(dto)).not.toThrow();
  });

  it('contexte : omis si vide, inclus si renseigné', () => {
    const sans = draftToCreateDto({ ...emptyDraft('Plat') });
    expect(sans.contexte).toBeUndefined();

    const avec = draftToCreateDto({
      ...emptyDraft('Plat'),
      contexte: { ressenti_global: 4, énergie: null, note: '  en forme  ' },
    });
    expect(avec.contexte).toEqual({ ressenti_global: 4, note: 'en forme' });
    expect(() => séanceCréerSchema.parse(avec)).not.toThrow();
  });

  it('Plat à 0 obstacle reste un DTO valide', () => {
    const dto = draftToCreateDto(emptyDraft('Plat'));
    expect(dto.obstacles).toEqual([]);
    expect(() => séanceCréerSchema.parse(dto)).not.toThrow();
  });
});

describe('draftReducer', () => {
  it('addObstacle / updateObstacle / removeObstacle', () => {
    let d = emptyDraft('Parcours');
    d = draftReducer(d, { kind: 'addObstacle' });
    expect(d.obstacles).toHaveLength(1);
    const id = d.obstacles[0].localId;
    d = draftReducer(d, { kind: 'updateObstacle', localId: id, patch: { hauteur: 130 } });
    expect(d.obstacles[0].hauteur).toBe(130);
    d = draftReducer(d, { kind: 'removeObstacle', localId: id });
    expect(d.obstacles).toHaveLength(0);
  });

  it('duplicateObstacle insère le clone juste après la source', () => {
    let d = emptyDraft('Parcours');
    d = draftReducer(d, { kind: 'addObstacle', obstacle: newObstacle({ hauteur: 110 }) });
    d = draftReducer(d, { kind: 'addObstacle', obstacle: newObstacle({ hauteur: 100 }) });
    const firstId = d.obstacles[0].localId;
    d = draftReducer(d, { kind: 'duplicateObstacle', localId: firstId });
    expect(d.obstacles.map((o) => o.hauteur)).toEqual([110, 115, 100]);
  });

  it('setType préserve les deux collections (retour en arrière non destructif)', () => {
    let d = emptyDraft('Parcours');
    d = draftReducer(d, { kind: 'addObstacle' });
    d = draftReducer(d, { kind: 'setType', type: 'Concours' });
    expect(d.type).toBe('Concours');
    expect(d.obstacles).toHaveLength(1); // conservé
    // Projeté en concours : seuls les tours partent.
    expect(draftToCreateDto(d).obstacles).toBeUndefined();
  });

  it('tours : add / update / remove', () => {
    let d = emptyDraft('Concours');
    d = draftReducer(d, { kind: 'addTour' });
    const id = d.tours[0].localId;
    d = draftReducer(d, { kind: 'updateTour', localId: id, patch: { barres: 2 } });
    expect(d.tours[0].barres).toBe(2);
    d = draftReducer(d, { kind: 'removeTour', localId: id });
    expect(d.tours).toHaveLength(0);
  });

  it('updateContexte fusionne sans toucher le reste du brouillon', () => {
    let d = emptyDraft('Plat');
    d = draftReducer(d, { kind: 'updateContexte', patch: { ressenti_global: 4 } });
    d = draftReducer(d, { kind: 'updateContexte', patch: { note: 'top' } });
    expect(d.contexte).toEqual({ ressenti_global: 4, énergie: null, note: 'top' });
  });
});

/** Construit une `SéanceSortie` de test (champs techniques minimaux). */
function makeSortie(overrides: Partial<SéanceSortie> = {}): SéanceSortie {
  const tech = { id: 'x', created_at: new Date(), updated_at: new Date() };
  return {
    ...tech,
    cheval_id: 'c1',
    type: 'Parcours',
    date: new Date('2026-06-01T10:00:00Z'),
    date_modification: null,
    provenance: 'live',
    obstacles: [],
    tours: [],
    contexte: null,
    ...overrides,
  };
}

describe('draftFromSession (édition, lot 2.4)', () => {
  it('reprend la séance à l’identique : type, fautes, difficulté, contexte', () => {
    const session = makeSortie({
      type: 'Parcours',
      obstacles: [
        {
          ...{ id: 'o1', created_at: new Date(), updated_at: new Date() },
          seance_id: 'x',
          type: 'Oxer',
          hauteur: 110,
          répétitions: 4,
          barres: 2,
          refus: 1,
          difficulté: 3,
          nombre_d_éléments: null,
          éléments: null,
        },
      ],
      contexte: {
        ...{ id: 'ctx', created_at: new Date(), updated_at: new Date() },
        seance_id: 'x',
        ressenti_global: 4,
        énergie: 2,
        note: 'séance dense',
      },
    });

    const draft = draftFromSession(session);
    expect(draft.type).toBe('Parcours');
    // Fautes et difficulté CONSERVÉES (≠ duplication, qui repart à 0).
    expect(draft.obstacles[0]).toMatchObject({
      type: 'Oxer',
      hauteur: 110,
      répétitions: 4,
      barres: 2,
      refus: 1,
      difficulté: 3,
    });
    expect(draft.contexte).toEqual({ ressenti_global: 4, énergie: 2, note: 'séance dense' });
  });

  it('reprend la structure de combinaison inline (nombre + détail)', () => {
    const session = makeSortie({
      type: 'Gymnastique',
      obstacles: [
        {
          ...{ id: 'o1', created_at: new Date(), updated_at: new Date() },
          seance_id: 'x',
          type: 'Combinaison',
          hauteur: 115,
          répétitions: 2,
          barres: 0,
          refus: 0,
          difficulté: null,
          nombre_d_éléments: 2,
          éléments: ['Vertical', 'Oxer'],
        },
      ],
    });
    const draft = draftFromSession(session);
    expect(draft.obstacles[0]).toMatchObject({
      type: 'Combinaison',
      nombre_d_éléments: 2,
      éléments: ['Vertical', 'Oxer'],
    });
    // La projection ré-émet la combinaison complète (détail conservé).
    expect(() => séanceModifierSchema.parse(draftToModifierDto(draft))).not.toThrow();
  });

  it('reprend les tours d’un concours avec leurs fautes', () => {
    const session = makeSortie({
      type: 'Concours',
      tours: [
        {
          ...{ id: 't1', created_at: new Date(), updated_at: new Date() },
          seance_id: 'x',
          hauteur: 125,
          barres: 4,
          refus: 0,
        },
      ],
    });
    const draft = draftFromSession(session);
    expect(draft.tours[0]).toMatchObject({ hauteur: 125, barres: 4, refus: 0 });
    expect(draft.obstacles).toHaveLength(0);
  });
});

describe('draftToModifierDto (projection édition)', () => {
  it('projette type + collection, jamais idempotency_key ni provenance', () => {
    const dto = draftToModifierDto({
      ...emptyDraft('Parcours'),
      obstacles: [newObstacle({ type: 'Oxer', hauteur: 110, barres: 1 })],
    });
    expect(dto.type).toBe('Parcours');
    expect(dto.obstacles).toHaveLength(1);
    expect(dto).not.toHaveProperty('idempotency_key');
    expect(dto).not.toHaveProperty('provenance');
    // Re-validé par le schéma serveur lui-même (aucun type dupliqué).
    expect(() => séanceModifierSchema.parse(dto)).not.toThrow();
  });

  it('concours : tours projetés ; contexte omis si vide', () => {
    const dto = draftToModifierDto({
      ...emptyDraft('Concours'),
      tours: [newTour({ hauteur: 120 })],
    });
    expect(dto.tours).toHaveLength(1);
    expect(dto.obstacles).toBeUndefined();
    expect(dto.contexte).toBeUndefined();
    expect(() => séanceModifierSchema.parse(dto)).not.toThrow();
  });
});

describe('formatDateModification (honnêteté d’interface, §7)', () => {
  it('rend un libellé sobre « Modifié le … » pour une date', () => {
    expect(formatDateModification('2026-06-28T12:00:00Z')).toMatch(/^Modifié le /);
  });

  it('vide quand jamais éditée (null) ou date invalide', () => {
    expect(formatDateModification(null)).toBe('');
    expect(formatDateModification('pas-une-date')).toBe('');
  });
});
