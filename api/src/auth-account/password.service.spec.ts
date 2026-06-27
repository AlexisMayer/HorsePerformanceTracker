import { describe, expect, it } from 'vitest';
import { PasswordService } from './password.service';

/**
 * Tests **sans base** (suite `pnpm test`) du hachage argon2. Le flux complet
 * (inscription/login/rotation) est prouvé de bout en bout par la suite e2e
 * adossée à Postgres (`pnpm db:verify`).
 */
describe('PasswordService (argon2)', () => {
  const passwords = new PasswordService();

  it('hache en argon2id et ne stocke jamais le clair', async () => {
    const hash = await passwords.hash('mon-mot-de-passe');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).not.toContain('mon-mot-de-passe');
  });

  it('vérifie un mot de passe correct et rejette un mauvais', async () => {
    const hash = await passwords.hash('mon-mot-de-passe');
    expect(await passwords.verify(hash, 'mon-mot-de-passe')).toBe(true);
    expect(await passwords.verify(hash, 'mauvais')).toBe(false);
  });

  it('produit un hash distinct à chaque appel (sel aléatoire)', async () => {
    const a = await passwords.hash('identique');
    const b = await passwords.hash('identique');
    expect(a).not.toBe(b);
  });

  it('renvoie false (sans planter) quand le hash est absent ou malformé', async () => {
    expect(await passwords.verify(undefined, 'x')).toBe(false);
    expect(await passwords.verify('pas-un-hash', 'x')).toBe(false);
  });
});
