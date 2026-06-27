import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Garde d'accès des routes protégées : exige un access token valide (stratégie
 * `jwt-access`). À réutiliser par les modules de domaine des lots suivants.
 */
@Injectable()
export class JwtAccessGuard extends AuthGuard('jwt-access') {}
