import type { Tier, TypeCompte } from '@hpt/shared';
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

/** Identité attachée à la requête par la garde JWT (issue de l'access token). */
export interface AuthenticatedUser {
  id: string;
  email: string;
  type: TypeCompte;
  tier: Tier;
}

/** Injecte l'utilisateur authentifié dans un handler protégé par `JwtAccessGuard`. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    return ctx.switchToHttp().getRequest<{ user: AuthenticatedUser }>().user;
  },
);
