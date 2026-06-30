import type { Capacité } from '@hpt/shared';
import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedUser } from '../auth-account/current-user.decorator';
import { EntitlementsService } from './entitlements.service';
import { CAPACITÉ_REQUISE } from './require-capacite.decorator';

/**
 * **Garde d'entitlement réutilisable** (lot 4.1, Architecture §3/§5 — gating =
 * autorité serveur). Protège les endpoints **premium/pro** : si le handler (ou
 * son contrôleur) porte `@RequireCapacité(...)`, la garde lit le `tier` du
 * **principal** (claim JWT posé par `JwtAccessGuard`) et **tranche** via la
 * politique `@hpt/shared`. Un sous-tier est refusé en **403**
 * (`CapacitéRequiseError`) ; l'UI ne fait que griser (4.2).
 *
 * À utiliser **après** `JwtAccessGuard` (qui pose `request.user`) :
 * `@UseGuards(JwtAccessGuard, EntitlementGuard)`. Un handler **sans**
 * `@RequireCapacité` passe librement (la garde ne gate que ce qui est annoté) —
 * on peut donc l'appliquer largement sans bloquer les routes non payantes.
 *
 * `EntitlementGuard` est **fourni et prouvé** ici (test unitaire) ; les modules
 * 4.4/4.5/4.6/5.1 l'attacheront sur leurs fonctions payantes.
 */
@Injectable()
export class EntitlementGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly entitlements: EntitlementsService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const capacité = this.reflector.getAllAndOverride<Capacité | undefined>(CAPACITÉ_REQUISE, [
      context.getHandler(),
      context.getClass(),
    ]);
    // Handler non annoté → hors gating : laisser passer (saisie, boucle gratuite…).
    if (!capacité) return true;

    const user = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>().user;
    // Doit suivre `JwtAccessGuard` ; sans principal, on ne peut pas trancher.
    if (!user) throw new UnauthorizedException();

    // Lève `CapacitéRequiseError` (403) si le tier n'ouvre pas la capacité.
    this.entitlements.assertCapacité(user.tier, capacité);
    return true;
  }
}
