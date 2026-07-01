import {
  type AccèsInvitéAccepterDto,
  accèsInvitéAccepterSchema,
  type ChevalPartagé,
  type FeedQuery,
  type Fil,
  feedQuerySchema,
  type HeatmapDto,
  type HistoriqueQuery,
  historiqueQuerySchema,
  type Métriques,
  type PageHistorique,
} from '@hpt/shared';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { type AuthenticatedUser, CurrentUser } from '../auth-account/current-user.decorator';
import { JwtAccessGuard } from '../auth-account/jwt-access.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { GuestAccessService } from './guest-access.service';

/**
 * Frontière HTTP de **consultation** invité (lot 4.6, Spec §9.5, UI/UX §6.7) — le
 * **client** accepte son invitation puis **consulte** le cheval partagé en
 * **lecture seule**. Routes sous `/guest-access`, **authentifiées**
 * (`JwtAccessGuard`, 1.1) — l'invité est un **compte régulier**. **Aucune garde
 * d'entitlement** ici : la portée de l'invité vient de l'**octroi** (pas de son
 * tier) ; le service **vérifie la portée cheval** à chaque lecture
 * (`AccèsInvitéNotFoundError` → 404 si pas d'accès actif, ou **autre** cheval).
 *
 * **Lecture seule stricte** : ce contrôleur n'expose **aucune** écriture. Les
 * lectures **réutilisent** feed (3.1) / héros (3.2) / historique (3.4) /
 * analytique (5.1) scopés au **propriétaire** — jamais reconstruites. Le `:id`
 * malformé est rejeté en **400** ; les queries validées par Zod (`shared`).
 */
@Controller('guest-access')
@UseGuards(JwtAccessGuard)
export class GuestConsultationController {
  constructor(private readonly guestAccess: GuestAccessService) {}

  /**
   * **Accepte** une invitation (jeton reçu par e-mail) : relie le compte de
   * l'appelant à l'octroi et le passe `actif`. Renvoie **le cheval partagé** (où
   * atterrir — onboarding invité, saute la création de cheval). 400 si le jeton
   * est invalide/expiré/déjà utilisé.
   */
  @Post('accept')
  @HttpCode(200)
  accept(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(accèsInvitéAccepterSchema)) dto: AccèsInvitéAccepterDto,
  ): Promise<ChevalPartagé> {
    return this.guestAccess.accept(user.id, dto.token);
  }

  /** Les **chevaux partagés** que l'invité peut consulter (accès actifs, dédupliqués). */
  @Get('me')
  mine(@CurrentUser() user: AuthenticatedUser): Promise<ChevalPartagé[]> {
    return this.guestAccess.listForGuest(user.id);
  }

  /** **Fil (3.1)** du cheval partagé — lecture seule scopée. 404 si pas d'accès actif. */
  @Get('horses/:id/feed')
  feed(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) chevalId: string,
    @Query(new ZodValidationPipe(feedQuerySchema)) query: FeedQuery,
  ): Promise<Fil> {
    return this.guestAccess.feedForGuest(user.id, chevalId, query);
  }

  /** **Héros/métriques (3.2)** du cheval partagé — lecture seule scopée. */
  @Get('horses/:id/metrics')
  metrics(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) chevalId: string,
  ): Promise<Métriques> {
    return this.guestAccess.metricsForGuest(user.id, chevalId);
  }

  /**
   * **Historique (3.4)** paginé du cheval partagé — lecture seule scopée. Même
   * suffixe de route que le propriétaire (`…/sessions/history`) → l'app ne fait
   * que **préfixer** `/guest-access`.
   */
  @Get('horses/:id/sessions/history')
  history(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) chevalId: string,
    @Query(new ZodValidationPipe(historiqueQuerySchema)) query: HistoriqueQuery,
  ): Promise<PageHistorique> {
    return this.guestAccess.historyForGuest(user.id, chevalId, query);
  }

  /** **Analytique (5.1)** du cheval partagé — lecture seule scopée (portée = octroi). */
  @Get('horses/:id/heatmap')
  heatmap(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) chevalId: string,
  ): Promise<HeatmapDto> {
    return this.guestAccess.heatmapForGuest(user.id, chevalId);
  }
}
