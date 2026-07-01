import {
  type AccèsInvitéInviterDto,
  type AccèsInvitéSortie,
  accèsInvitéInviterSchema,
} from '@hpt/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { type AuthenticatedUser, CurrentUser } from '../auth-account/current-user.decorator';
import { JwtAccessGuard } from '../auth-account/jwt-access.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { EntitlementGuard } from '../entitlements/entitlement.guard';
import { RequireCapacité } from '../entitlements/require-capacite.decorator';
import { GuestAccessService } from './guest-access.service';

/**
 * Frontière HTTP de **gestion** des comptes invité (lot 4.6, Architecture §5) —
 * le **coach** invite/liste/révoque. Routes orientées ressource
 * (`/horses/:id/guest-access`, convention Archi §5), **authentifiées**
 * (`JwtAccessGuard`, 1.1) et **réservées au Pro** :
 * `@RequireCapacité('comptes_invité')` + `EntitlementGuard` (garde 4.1, autorité
 * serveur) **après** `JwtAccessGuard` — un compte gratuit/premium est refusé en
 * **403** (`CapacitéRequiseError`). La propriété du cheval/de l'octroi est
 * vérifiée dans le service (404 sans fuite si étranger). Le `:id` malformé est
 * rejeté en **400** par `ParseUUIDPipe`, le corps validé par Zod (`shared`).
 */
@Controller()
@UseGuards(JwtAccessGuard, EntitlementGuard)
@RequireCapacité('comptes_invité')
export class GuestAccessController {
  constructor(private readonly guestAccess: GuestAccessService) {}

  /**
   * **Invite** un client (par e-mail) sur un cheval du coach. **Plusieurs**
   * invités par cheval sont permis (propriétaire + cavalier…). 403 si le tier
   * n'ouvre pas `comptes_invité` ; 404 si cheval étranger ; 409 si un accès non
   * révoqué existe déjà pour ce couple (cheval, e-mail).
   */
  @Post('horses/:id/guest-access')
  invite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) chevalId: string,
    @Body(new ZodValidationPipe(accèsInvitéInviterSchema)) dto: AccèsInvitéInviterDto,
  ): Promise<AccèsInvitéSortie> {
    return this.guestAccess.invite(user.id, chevalId, dto);
  }

  /** Liste les accès (invités) d'un cheval du coach (récent → ancien). 404 si étranger. */
  @Get('horses/:id/guest-access')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) chevalId: string,
  ): Promise<AccèsInvitéSortie[]> {
    return this.guestAccess.listForHorse(user.id, chevalId);
  }

  /**
   * **Révoque** un accès (par son id). Scopé au coach (404 sans fuite si
   * étranger) ; l'accès **cesse** immédiatement (statut `révoqué`, jeton effacé).
   * `204 No Content` (bascule d'état d'une ressource existante, rien à renvoyer).
   */
  @Delete('guest-access/:accessId')
  @HttpCode(204)
  revoke(
    @CurrentUser() user: AuthenticatedUser,
    @Param('accessId', ParseUUIDPipe) accèsId: string,
  ): Promise<void> {
    return this.guestAccess.revoke(user.id, accèsId);
  }
}
