import type { CarteBilan } from '@hpt/shared';
import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { type AuthenticatedUser, CurrentUser } from '../auth-account/current-user.decorator';
import { JwtAccessGuard } from '../auth-account/jwt-access.guard';
import { SharingService } from './sharing.service';

/**
 * Frontière HTTP du module `sharing` (lot 3.3, Architecture §5). Route orientée
 * ressource (la carte **d'une** séance), **authentifiée** (`JwtAccessGuard` de
 * 1.1) et **scopée au compte courant** : la séance vient de l'URL ; la propriété
 * est vérifiée par `sessions`/`horses` (404 sans fuite si étrangère). Surface de
 * **lecture seule** : `sharing` ne compose que des dérivés (rien n'est écrit).
 *
 * La **carte de bilan de séance simple est gratuite**, **jamais verrouillée** : le
 * gating (4.1) ne la touche pas (§8). Le `:id` malformé est rejeté en **400** par
 * `ParseUUIDPipe`.
 */
@Controller()
@UseGuards(JwtAccessGuard)
export class SharingController {
  constructor(private readonly sharing: SharingService) {}

  /**
   * Carte de bilan d'une séance du compte courant : le **récap** (types travaillés,
   * hauteurs, taux) et le **record** mis en avant s'il y en a un. 404 si la séance
   * est étrangère au compte.
   */
  @Get('sessions/:id/card')
  composeCarte(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) seanceId: string,
  ): Promise<CarteBilan> {
    return this.sharing.composeCarte(user.id, seanceId);
  }
}
