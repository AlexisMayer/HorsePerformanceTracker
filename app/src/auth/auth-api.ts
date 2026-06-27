import {
  type AuthTokens,
  authTokensSchema,
  type CompteSortie,
  type LoginDto,
  type RegisterDto,
} from '@hpt/shared';
import type { ApiClient } from './api-client';

/**
 * Surface d'auth câblée sur l'API du lot 1.1 (`auth.controller.ts`). Tous les
 * DTO viennent de `@hpt/shared` — aucun type dupliqué (Architecture §1/§2).
 *
 * Note sur les dates : `CompteSortie` type ses `created_at`/`updated_at` en
 * `Date`, mais le transport JSON les rend en chaînes ISO. Les écrans de ce lot
 * n'affichent que des champs scalaires (e-mail, `tier`, `type`,
 * `email_verified`) ; on ne re-valide donc pas le compte par Zod (qui attend des
 * `Date`). Le **couple de jetons**, lui, est entièrement JSON-safe et **est**
 * validé par `authTokensSchema` — c'est la donnée sensible (le refresh).
 */
export interface AuthApi {
  register(dto: RegisterDto): Promise<CompteSortie>;
  login(dto: LoginDto): Promise<AuthTokens>;
  logout(refreshToken: string): Promise<void>;
  me(): Promise<CompteSortie>;
  /** Lot 1.2 — demande un lien de reset (anti-énumération : 200 quoi qu'il arrive). */
  requestPasswordReset(email: string): Promise<void>;
  /** Lot 1.2 — (re)demande le lien de vérification d'e-mail. */
  requestEmailVerification(email: string): Promise<void>;
}

export function createAuthApi(client: ApiClient): AuthApi {
  return {
    register: (dto) =>
      client.request<CompteSortie>('/auth/register', { method: 'POST', body: dto, auth: false }),
    login: async (dto) => {
      const tokens = await client.request<unknown>('/auth/login', {
        method: 'POST',
        body: dto,
        auth: false,
      });
      return authTokensSchema.parse(tokens);
    },
    logout: (refreshToken) =>
      client.request<void>('/auth/logout', {
        method: 'POST',
        body: { refresh_token: refreshToken },
        auth: false,
      }),
    me: () => client.request<CompteSortie>('/auth/me', { method: 'GET' }),
    requestPasswordReset: (email) =>
      client.request<void>('/auth/password-reset/request', {
        method: 'POST',
        body: { email },
        auth: false,
      }),
    requestEmailVerification: (email) =>
      client.request<void>('/auth/verify-email/request', {
        method: 'POST',
        body: { email },
        auth: false,
      }),
  };
}
