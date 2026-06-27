import type { Tier, TypeCompte } from '@hpt/shared';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { loadAuthSecrets } from './auth.config';
import type { AuthenticatedUser } from './current-user.decorator';

interface AccessJwtPayload {
  sub: string;
  email: string;
  type: TypeCompte;
  tier: Tier;
  typ?: string;
}

/**
 * Stratégie Passport JWT pour l'**access token** (Stack §3.4). Extrait le
 * `Bearer` de l'en-tête `Authorization`, vérifie signature + expiration, et
 * n'accepte que les jetons de type `access` (les refresh sont signés avec un
 * autre secret et un autre `typ`).
 */
@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt-access') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: loadAuthSecrets().accessSecret,
    });
  }

  validate(payload: AccessJwtPayload): AuthenticatedUser {
    if (payload.typ !== 'access') {
      throw new UnauthorizedException();
    }
    return { id: payload.sub, email: payload.email, type: payload.type, tier: payload.tier };
  }
}
