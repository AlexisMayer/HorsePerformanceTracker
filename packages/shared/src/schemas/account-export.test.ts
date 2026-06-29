import { describe, expect, expectTypeOf, it } from 'vitest';
import { type AccountExport, accountDeleteSchema, accountExportSchema } from './account-export';

describe('accountDeleteSchema (confirmation de suppression)', () => {
  it('exige un mot de passe non vide', () => {
    expect(accountDeleteSchema.safeParse({ password: 'motdepasse-solide' }).success).toBe(true);
    expect(accountDeleteSchema.safeParse({ password: '' }).success).toBe(false);
    expect(accountDeleteSchema.safeParse({}).success).toBe(false);
  });
});

describe('accountExportSchema (portabilité)', () => {
  const baseDates = { created_at: new Date(), updated_at: new Date() };

  function validExport(): unknown {
    return {
      exported_at: new Date(),
      compte: {
        id: 'c1',
        ...baseDates,
        email: 'a@b.co',
        nom: 'Alex',
        email_verified: true,
        type: 'amateur',
        tier: 'gratuit',
      },
      chevaux: [
        {
          id: 'h1',
          ...baseDates,
          compte_id: 'c1',
          nom: 'Eclipse',
          niveau: 'amateur',
          hauteur_de_référence: 110,
          âge: null,
          race: null,
          seances: [
            {
              id: 's1',
              ...baseDates,
              cheval_id: 'h1',
              type: 'Parcours',
              date: new Date(),
              date_modification: null,
              provenance: 'live',
              obstacles: [
                {
                  id: 'o1',
                  ...baseDates,
                  seance_id: 's1',
                  type: 'Oxer',
                  hauteur: 110,
                  répétitions: 1,
                  barres: 0,
                  refus: 0,
                  difficulté: null,
                  nombre_d_éléments: null,
                  éléments: null,
                  combinaison_ref: null,
                },
              ],
              tours: [],
              contexte: null,
            },
            {
              id: 's2',
              ...baseDates,
              cheval_id: 'h1',
              type: 'Concours',
              date: new Date(),
              date_modification: null,
              // L'export inclut aussi le déclaratif (données de l'utilisateur).
              provenance: 'déclaratif',
              obstacles: [],
              tours: [
                {
                  id: 't1',
                  ...baseDates,
                  seance_id: 's2',
                  hauteur: 120,
                  barres: 1,
                  refus: 0,
                },
              ],
              contexte: {
                id: 'ctx1',
                ...baseDates,
                seance_id: 's2',
                ressenti_global: 4,
                énergie: null,
                note: 'beau parcours',
              },
            },
          ],
        },
      ],
    };
  }

  it('valide un arbre compte → chevaux → séances → obstacles/tours/contexte', () => {
    expect(accountExportSchema.safeParse(validExport()).success).toBe(true);
  });

  it('inclut live ET déclaratif', () => {
    const parsed = accountExportSchema.parse(validExport());
    const provenances = parsed.chevaux[0].seances.map((s) => s.provenance);
    expect(provenances).toContain('live');
    expect(provenances).toContain('déclaratif');
  });

  it('retire tout secret projeté par mégarde (password_hash sur le compte)', () => {
    const withSecret = validExport() as { compte: Record<string, unknown> };
    withSecret.compte.password_hash = '$argon2id$secret';
    const parsed = accountExportSchema.parse(withSecret);
    expect(parsed.compte).not.toHaveProperty('password_hash');
  });

  it('garantit au niveau du type qu’aucun secret ne fuit dans l’export', () => {
    expectTypeOf<AccountExport['compte']>().not.toHaveProperty('password_hash');
    // L'export ne porte pas de structure de jetons (refresh / vérification).
    expectTypeOf<AccountExport>().not.toHaveProperty('refresh_tokens');
    expectTypeOf<AccountExport>().not.toHaveProperty('verification_tokens');
  });
});
