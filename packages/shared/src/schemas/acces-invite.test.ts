import { describe, expect, it } from 'vitest';
import {
  accèsInvitéAccepterSchema,
  accèsInvitéInviterSchema,
  accèsInvitéSortieSchema,
  chevalPartagéSchema,
  statutAccèsInvitéSchema,
} from './acces-invite';

describe('accèsInvitéInviterSchema — entrée (le coach invite)', () => {
  it('accepte un e-mail valide', () => {
    expect(() => accèsInvitéInviterSchema.parse({ email: 'client@hpt.test' })).not.toThrow();
  });

  it('rejette un e-mail invalide (frontière → 400)', () => {
    expect(() => accèsInvitéInviterSchema.parse({ email: 'pas-un-email' })).toThrow();
  });
});

describe('accèsInvitéAccepterSchema — entrée (le client accepte)', () => {
  it('accepte un jeton non vide', () => {
    expect(() => accèsInvitéAccepterSchema.parse({ token: 'abc123' })).not.toThrow();
  });

  it('rejette un jeton vide', () => {
    expect(() => accèsInvitéAccepterSchema.parse({ token: '' })).toThrow();
  });
});

describe('statutAccèsInvitéSchema — cycle de vie', () => {
  it('accepte les trois statuts figés', () => {
    for (const s of ['en_attente', 'actif', 'révoqué']) {
      expect(() => statutAccèsInvitéSchema.parse(s)).not.toThrow();
    }
  });

  it('rejette un statut hors référentiel', () => {
    expect(() => statutAccèsInvitéSchema.parse('supprimé')).toThrow();
  });
});

describe('accèsInvitéSortieSchema — vue coach (aucun secret)', () => {
  const valide = {
    id: 'grant-1',
    cheval_id: 'cheval-1',
    invité_email: 'client@hpt.test',
    invité_relié: false,
    statut: 'en_attente',
    created_at: new Date(),
  };

  it('accepte une projection bien formée', () => {
    expect(() => accèsInvitéSortieSchema.parse(valide)).not.toThrow();
  });

  it('strippe toute clé inconnue (jeton/relations techniques ne sortent jamais)', () => {
    const parsed = accèsInvitéSortieSchema.parse({
      ...valide,
      token_hash: 'ne-doit-pas-sortir',
      compte_pro_id: 'proprio',
      invité_compte_id: 'client-compte',
    });
    expect(parsed).not.toHaveProperty('token_hash');
    expect(parsed).not.toHaveProperty('compte_pro_id');
    expect(parsed).not.toHaveProperty('invité_compte_id');
  });
});

describe('chevalPartagéSchema — atterrissage invité (scope à UN cheval)', () => {
  it('ne porte que cheval_id + cheval_nom (rien de la fiche au-delà du nom)', () => {
    const parsed = chevalPartagéSchema.parse({
      cheval_id: 'cheval-1',
      cheval_nom: 'Quibelle',
      compte_id: 'proprio',
      niveau: 'pro',
    });
    expect(parsed).toEqual({ cheval_id: 'cheval-1', cheval_nom: 'Quibelle' });
  });
});
