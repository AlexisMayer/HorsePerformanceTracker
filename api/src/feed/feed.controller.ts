import { type FeedQuery, type Fil, feedQuerySchema } from '@hpt/shared';
import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { type AuthenticatedUser, CurrentUser } from '../auth-account/current-user.decorator';
import { JwtAccessGuard } from '../auth-account/jwt-access.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { FeedService } from './feed.service';

/**
 * Frontière HTTP du module `feed` (lot 3.1, Architecture §5). Route orientée
 * ressource, **authentifiée** (`JwtAccessGuard` de 1.1) et **scopée au compte
 * courant** : le cheval ciblé vient de l'URL ; la propriété est vérifiée par
 * `sessions`/`horses` (404 sans fuite si étranger). Surface de **lecture seule** :
 * le feed n'écrit rien et n'est **jamais verrouillé** (gratuit — le gating 4.1 ne
 * le touche pas).
 *
 * Le `:id` malformé est rejeté en **400** par `ParseUUIDPipe` ; la **query** de
 * pagination est validée par `feedQuerySchema` de `@hpt/shared` (rien n'entre non
 * validé). Le **héros** (courbe maîtrisée + vitrine records) est le lot **3.2** :
 * il vivra au-dessus de ce même fil, mais n'est pas servi ici.
 */
@Controller()
@UseGuards(JwtAccessGuard)
export class FeedController {
  constructor(private readonly feed: FeedService) {}

  /**
   * Compose le fil d'un cheval du compte courant (récent → ancien), avec faits
   * objectifs, légendes contexte, jalons injectés et entrées de régularité.
   * Pagination simple par curseur (`before` ISO + `limit`). 404 si le cheval est
   * étranger au compte.
   */
  @Get('horses/:id/feed')
  compose(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) chevalId: string,
    @Query(new ZodValidationPipe(feedQuerySchema)) query: FeedQuery,
  ): Promise<Fil> {
    return this.feed.compose(user.id, chevalId, query);
  }
}
