import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  type AuthTokens,
  authTokensSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
} from './auth';

describe('registerSchema (DTO d’entrée)', () => {
  it('valide une inscription correcte (amateur | coach)', () => {
    expect(
      registerSchema.safeParse({
        email: 'cavalier@example.com',
        nom: 'Alex',
        password: 'motdepasse',
        type: 'coach',
      }).success,
    ).toBe(true);
  });

  it('n’expose pas `tier` : une valeur fournie par le client est ignorée', () => {
    const parsed = registerSchema.parse({
      email: 'cavalier@example.com',
      nom: 'Alex',
      password: 'motdepasse',
      type: 'amateur',
      tier: 'pro',
    } as Record<string, unknown>);
    expect(parsed).not.toHaveProperty('tier');
  });

  it('rejette un e-mail invalide, un mot de passe trop court, un type inconnu', () => {
    expect(
      registerSchema.safeParse({ email: 'x', nom: 'A', password: 'court', type: 'amateur' })
        .success,
    ).toBe(false);
    expect(
      registerSchema.safeParse({
        email: 'a@b.co',
        nom: 'A',
        password: 'x',
        type: 'amateur',
      }).success,
    ).toBe(false);
    expect(
      registerSchema.safeParse({
        email: 'a@b.co',
        nom: 'A',
        password: 'motdepasse',
        type: 'galactique',
      }).success,
    ).toBe(false);
  });
});

describe('loginSchema / refreshSchema', () => {
  it('exige e-mail + mot de passe pour login', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true);
    expect(loginSchema.safeParse({ email: 'a@b.co' }).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'pasunmail', password: 'x' }).success).toBe(false);
  });

  it('exige un refresh_token non vide', () => {
    expect(refreshSchema.safeParse({ refresh_token: 'abc' }).success).toBe(true);
    expect(refreshSchema.safeParse({ refresh_token: '' }).success).toBe(false);
  });
});

describe('authTokensSchema (DTO de sortie)', () => {
  it('valide un couple de jetons et retire toute clé inconnue', () => {
    const parsed = authTokensSchema.parse({
      access_token: 'a.b.c',
      refresh_token: 'd.e.f',
      token_type: 'Bearer',
      expires_in: 900,
      password_hash: 'argon2$secret',
    } as Record<string, unknown>);
    expect(parsed).not.toHaveProperty('password_hash');
    expect(parsed.token_type).toBe('Bearer');
  });

  it('garantit au niveau du type qu’aucun secret serveur ne fuit', () => {
    expectTypeOf<AuthTokens>().not.toHaveProperty('password_hash');
    expectTypeOf<AuthTokens>().not.toHaveProperty('password');
  });
});
