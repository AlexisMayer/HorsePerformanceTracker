import type { EntitlementSortie } from '@hpt/shared';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { type AuthenticatedUser, CurrentUser } from '../auth-account/current-user.decorator';
import { JwtAccessGuard } from '../auth-account/jwt-access.guard';
import { EntitlementsService } from './entitlements.service';

/**
 * Frontière HTTP du module `entitlements` (lot 4.1). **Lecture de l'entitlement
 * du compte courant** (Spec §9.3) : tier + capacités + quotas, projetés depuis
 * la politique `@hpt/shared`. L'app le lit au login pour afficher le tier
 * (Profil, UI/UX §5) et préparer le grisage (4.2).
 *
 * Authentifiée (`JwtAccessGuard` de 1.1) ; le `tier` vient du **principal**
 * (claim JWT issu de `Compte.tier` au login) — jamais d'un id de l'URL. C'est la
 * **même source** que la garde d'entitlement, donc l'app ne peut pas dégriser
 * une fonction que le serveur refuserait ensuite.
 */
@Controller('me')
@UseGuards(JwtAccessGuard)
export class EntitlementsController {
  constructor(private readonly entitlements: EntitlementsService) {}

  /** Entitlement du compte courant (tier, capacités, quotas). */
  @Get('entitlement')
  entitlement(@CurrentUser() user: AuthenticatedUser): EntitlementSortie {
    return this.entitlements.entitlement(user.tier);
  }
}
