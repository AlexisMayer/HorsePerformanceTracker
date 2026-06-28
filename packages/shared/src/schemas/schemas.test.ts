import { describe, expect, expectTypeOf, it } from 'vitest';
import type { Compte } from '../types/compte';
import {
  type ChevalSortie,
  chevalCréerSchema,
  chevalModifierSchema,
  chevalSortieSchema,
} from './cheval';
import { type CompteSortie, compteCréerSchema, compteSortieSchema } from './compte';
import { obstacleCréerSchema } from './obstacle';
import { hauteurSchema } from './referentiel';
import {
  type SéanceSortie,
  séanceCréerSchema,
  séanceModifierSchema,
  séanceSortieSchema,
} from './seance';

describe('compteCréerSchema (DTO d’entrée)', () => {
  it('valide une entrée correcte et applique le tier par défaut', () => {
    const parsed = compteCréerSchema.parse({
      email: 'cavalier@example.com',
      nom: 'Alex',
      password: 'motdepasse',
      type: 'amateur',
    });
    expect(parsed.tier).toBe('gratuit');
  });

  it('rejette un e-mail invalide et un mot de passe trop court', () => {
    expect(
      compteCréerSchema.safeParse({ email: 'pasunmail', nom: 'A', password: 'x', type: 'amateur' })
        .success,
    ).toBe(false);
  });
});

describe('compteSortieSchema (DTO de sortie)', () => {
  it('ne laisse jamais fuir le secret : password_hash est retiré', () => {
    const entité: Compte = {
      id: '11111111-1111-1111-1111-111111111111',
      created_at: new Date(),
      updated_at: new Date(),
      email: 'cavalier@example.com',
      nom: 'Alex',
      password_hash: 'argon2$secret',
      email_verified: true,
      type: 'amateur',
      tier: 'premium',
    };

    const sortie = compteSortieSchema.parse(entité);
    expect(sortie).not.toHaveProperty('password_hash');
    expect(sortie).not.toHaveProperty('password');
    expect(sortie.email).toBe('cavalier@example.com');
  });

  it('garantit au niveau du type que la sortie ne porte aucun secret', () => {
    // Échoue à la compilation si `password_hash` réapparaissait dans la sortie.
    expectTypeOf<CompteSortie>().not.toHaveProperty('password_hash');
    expectTypeOf<CompteSortie>().not.toHaveProperty('password');
  });
});

describe('hauteurSchema', () => {
  it('accepte un cran et rejette une valeur hors pas', () => {
    expect(hauteurSchema.safeParse(120).success).toBe(true);
    expect(hauteurSchema.safeParse(122).success).toBe(false);
  });
});

describe('chevalCréerSchema', () => {
  it('valide un cheval et rejette une hauteur de référence invalide', () => {
    expect(
      chevalCréerSchema.safeParse({ nom: 'Pampa', niveau: 'amateur', hauteur_de_référence: 110 })
        .success,
    ).toBe(true);
    expect(
      chevalCréerSchema.safeParse({ nom: 'Pampa', niveau: 'amateur', hauteur_de_référence: 111 })
        .success,
    ).toBe(false);
  });
});

describe('chevalModifierSchema (DTO d’édition, PATCH partiel)', () => {
  it('accepte une mise à jour partielle (un seul champ)', () => {
    expect(chevalModifierSchema.safeParse({ niveau: 'pro' }).success).toBe(true);
  });

  it('n’accepte que amateur | pro pour le niveau', () => {
    expect(chevalModifierSchema.safeParse({ niveau: 'expert' }).success).toBe(false);
  });

  it('autorise null pour effacer un champ facultatif (âge / race)', () => {
    const parsed = chevalModifierSchema.parse({ âge: null, race: null });
    expect(parsed).toEqual({ âge: null, race: null });
  });

  it('rejette un corps vide (rien à éditer)', () => {
    expect(chevalModifierSchema.safeParse({}).success).toBe(false);
  });

  it('valide encore la hauteur sur un cran du référentiel', () => {
    expect(chevalModifierSchema.safeParse({ hauteur_de_référence: 115 }).success).toBe(true);
    expect(chevalModifierSchema.safeParse({ hauteur_de_référence: 113 }).success).toBe(false);
  });
});

describe('chevalSortieSchema (DTO de sortie)', () => {
  it('projette une ligne brute et retire toute clé inattendue (jamais de fuite)', () => {
    const sortie = chevalSortieSchema.parse({
      id: '33333333-3333-3333-3333-333333333333',
      created_at: new Date(),
      updated_at: new Date(),
      compte_id: '44444444-4444-4444-4444-444444444444',
      nom: 'Pampa',
      niveau: 'amateur',
      hauteur_de_référence: 110,
      âge: null,
      race: null,
      // Clé parasite : doit disparaître à la projection.
      secret_interne: 'ne-doit-pas-fuiter',
    });
    expect(sortie).not.toHaveProperty('secret_interne');
    expect(sortie.nom).toBe('Pampa');
    expectTypeOf<ChevalSortie>().not.toHaveProperty('secret_interne');
  });
});

describe('obstacleCréerSchema (champs combinaison conditionnels)', () => {
  it('valide un obstacle simple', () => {
    const parsed = obstacleCréerSchema.parse({ type: 'Oxer', hauteur: 110 });
    expect(parsed.répétitions).toBe(1);
    expect(parsed.barres).toBe(0);
  });

  it('exige nombre_d_éléments pour une combinaison', () => {
    expect(obstacleCréerSchema.safeParse({ type: 'Combinaison', hauteur: 100 }).success).toBe(
      false,
    );
    expect(
      obstacleCréerSchema.safeParse({ type: 'Combinaison', hauteur: 100, nombre_d_éléments: 2 })
        .success,
    ).toBe(true);
  });

  it('refuse nombre_d_éléments sur un obstacle simple', () => {
    expect(
      obstacleCréerSchema.safeParse({ type: 'Vertical', hauteur: 100, nombre_d_éléments: 2 })
        .success,
    ).toBe(false);
  });

  it('refuse un détail d’éléments incohérent avec nombre_d_éléments', () => {
    expect(
      obstacleCréerSchema.safeParse({
        type: 'Combinaison',
        hauteur: 100,
        nombre_d_éléments: 2,
        éléments: ['Vertical', 'Oxer', 'Mur'],
      }).success,
    ).toBe(false);
  });
});

describe('séanceCréerSchema (structure pilotée par le type)', () => {
  const idempotency_key = '22222222-2222-2222-2222-222222222222';

  it('accepte un concours avec des tours et la provenance par défaut', () => {
    const parsed = séanceCréerSchema.parse({
      idempotency_key,
      type: 'Concours',
      tours: [{ hauteur: 130, barres: 0, refus: 0 }],
    });
    expect(parsed.provenance).toBe('live');
  });

  it('accepte une provenance déclaratif explicite (amorçage)', () => {
    const parsed = séanceCréerSchema.parse({
      idempotency_key,
      type: 'Plat',
      provenance: 'déclaratif',
    });
    expect(parsed.provenance).toBe('déclaratif');
  });

  it('refuse un concours qui porterait des obstacles', () => {
    expect(
      séanceCréerSchema.safeParse({
        idempotency_key,
        type: 'Concours',
        obstacles: [{ type: 'Oxer', hauteur: 110 }],
      }).success,
    ).toBe(false);
  });

  it('accepte un Plat sans obstacle (fréquence/régularité)', () => {
    expect(séanceCréerSchema.safeParse({ idempotency_key, type: 'Plat' }).success).toBe(true);
  });

  it('exige une clé d’idempotence (UUID) — réessai sans doublon', () => {
    expect(séanceCréerSchema.safeParse({ type: 'Plat' }).success).toBe(false);
    expect(
      séanceCréerSchema.safeParse({ idempotency_key: 'pas-un-uuid', type: 'Plat' }).success,
    ).toBe(false);
  });

  it('ne porte aucune cible (`cheval_id`) dans le corps — elle vient de l’URL', () => {
    const parsed = séanceCréerSchema.parse({ idempotency_key, type: 'Plat' });
    expect(parsed).not.toHaveProperty('cheval_id');
  });
});

describe('séanceModifierSchema (DTO d’édition, lot 2.4)', () => {
  it('accepte une édition d’entraînement (collection d’obstacles)', () => {
    const parsed = séanceModifierSchema.parse({
      type: 'Parcours',
      obstacles: [{ type: 'Oxer', hauteur: 110, répétitions: 4, barres: 1, refus: 0 }],
    });
    expect(parsed.obstacles).toHaveLength(1);
  });

  it('accepte une édition de concours (collection de tours)', () => {
    expect(
      séanceModifierSchema.safeParse({
        type: 'Concours',
        tours: [{ hauteur: 120, barres: 0, refus: 0 }],
      }).success,
    ).toBe(true);
  });

  it('garde l’invariant type↔structure (un entraînement ne porte pas de tours)', () => {
    expect(
      séanceModifierSchema.safeParse({
        type: 'Parcours',
        tours: [{ hauteur: 120, barres: 0, refus: 0 }],
      }).success,
    ).toBe(false);
  });

  it('n’expose aucun champ immuable : ni `date`, ni `provenance`, ni `idempotency_key`', () => {
    // Sémantique de remplacement : les clés immuables sont retirées (strip),
    // jamais une voie détournée pour réécrire `date`/`provenance`.
    const parsed = séanceModifierSchema.parse({
      type: 'Plat',
      date: '2020-01-01',
      provenance: 'déclaratif',
      idempotency_key: '22222222-2222-2222-2222-222222222222',
    } as Record<string, unknown>);
    expect(parsed).not.toHaveProperty('date');
    expect(parsed).not.toHaveProperty('provenance');
    expect(parsed).not.toHaveProperty('idempotency_key');
    expect(parsed.type).toBe('Plat');
  });
});

describe('séanceSortieSchema (projection de lecture)', () => {
  it('n’expose jamais la clé d’idempotence (donnée technique)', () => {
    expectTypeOf<SéanceSortie>().not.toHaveProperty('idempotency_key');
    const sortie = séanceSortieSchema.parse({
      id: 'a',
      created_at: new Date(),
      updated_at: new Date(),
      cheval_id: 'c',
      type: 'Parcours',
      date: new Date(),
      date_modification: null,
      provenance: 'live',
      obstacles: [],
      tours: [],
      contexte: null,
      // Clé technique présente dans la ligne brute : doit être retirée (strip).
      idempotency_key: '22222222-2222-2222-2222-222222222222',
    } as Record<string, unknown>);
    expect(sortie).not.toHaveProperty('idempotency_key');
  });
});
