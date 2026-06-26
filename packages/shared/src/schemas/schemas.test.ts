import { describe, expect, expectTypeOf, it } from 'vitest';
import type { Compte } from '../types/compte';
import { chevalCréerSchema } from './cheval';
import { type CompteSortie, compteCréerSchema, compteSortieSchema } from './compte';
import { obstacleCréerSchema } from './obstacle';
import { hauteurSchema } from './referentiel';
import { séanceCréerSchema } from './seance';

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
  const cheval_id = '22222222-2222-2222-2222-222222222222';

  it('accepte un concours avec des tours et la provenance par défaut', () => {
    const parsed = séanceCréerSchema.parse({
      cheval_id,
      type: 'Concours',
      tours: [{ hauteur: 130, barres: 0, refus: 0 }],
    });
    expect(parsed.provenance).toBe('live');
  });

  it('refuse un concours qui porterait des obstacles', () => {
    expect(
      séanceCréerSchema.safeParse({
        cheval_id,
        type: 'Concours',
        obstacles: [{ type: 'Oxer', hauteur: 110 }],
      }).success,
    ).toBe(false);
  });

  it('accepte un Plat sans obstacle (fréquence/régularité)', () => {
    expect(séanceCréerSchema.safeParse({ cheval_id, type: 'Plat' }).success).toBe(true);
  });
});
