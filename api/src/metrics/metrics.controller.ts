import type { Métriques } from '@hpt/shared';
import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { type AuthenticatedUser, CurrentUser } from '../auth-account/current-user.decorator';
import { JwtAccessGuard } from '../auth-account/jwt-access.guard';
import { MetricsService } from './metrics.service';

/**
 * Frontière HTTP du module `metrics` (lot 3.2, Architecture §5). Route orientée
 * ressource, **authentifiée** (`JwtAccessGuard` de 1.1) et **scopée au compte
 * courant** : le cheval ciblé vient de l'URL ; la propriété est vérifiée par
 * `sessions`/`horses` (404 sans fuite si étranger). Surface de **lecture seule** :
 * `metrics` ne compose que des dérivés (rien n'est écrit).
 *
 * Les **graphes héros sont gratuits**, **jamais verrouillés** : le gating (4.1) ne
 * touche ni la courbe de maîtrisée ni la vitrine à records. Le `:id` malformé est
 * rejeté en **400** par `ParseUUIDPipe`.
 */
@Controller()
@UseGuards(JwtAccessGuard)
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  /**
   * Métriques héros d'un cheval du compte courant : la **courbe de hauteur
   * maîtrisée** (+ chiffre courant + record de référence) et la **vitrine à
   * records/jalons**. 404 si le cheval est étranger au compte.
   */
  @Get('horses/:id/metrics')
  compose(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) chevalId: string,
  ): Promise<Métriques> {
    return this.metrics.compose(user.id, chevalId);
  }
}
