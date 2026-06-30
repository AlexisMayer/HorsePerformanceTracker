import {
  type HistoriqueQuery,
  historiqueQuerySchema,
  type PageHistorique,
  type SéanceCréerDto,
  type SéanceModifierDto,
  type SéanceSortie,
  séanceCréerSchema,
  séanceModifierSchema,
} from '@hpt/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { type AuthenticatedUser, CurrentUser } from '../auth-account/current-user.decorator';
import { JwtAccessGuard } from '../auth-account/jwt-access.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SessionsService } from './sessions.service';

/**
 * Frontière HTTP du module `sessions` (lot 2.2, Architecture §5). Routes
 * orientées ressource, **toutes authentifiées** (`JwtAccessGuard` de 1.1) et
 * **scopées au compte courant** : l'`id` du propriétaire vient du jeton
 * (`@CurrentUser`), le cheval ciblé de l'URL — jamais du corps. Validation Zod à
 * l'entrée (DTO de `@hpt/shared`), règles métier dans le service, projections
 * sans clé inattendue.
 *
 * Création + lecture brute (lot 2.2) ; **édition** (`PATCH /sessions/:id`) et
 * **suppression** (`DELETE /sessions/:id`) du **lot 2.4** (Spec §3.7). Le feed
 * riche reste le **3.1**, l'historique complet le **3.4**.
 *
 * Les `:id` malformés sont rejetés en **400** par `ParseUUIDPipe` (avant la
 * base) ; un `:id` valide mais étranger au compte renvoie **404** (service).
 */
@Controller()
@UseGuards(JwtAccessGuard)
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  /**
   * Crée une séance pour un cheval du compte courant (201). Écriture
   * transactionnelle, horodatée, provenance posée. Un réessai avec la même
   * `idempotency_key` renvoie la séance déjà créée (pas de doublon) — même 201,
   * sans cas particulier de statut (le corps prouve l'absence de doublon).
   */
  @Post('horses/:id/sessions')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) chevalId: string,
    @Body(new ZodValidationPipe(séanceCréerSchema)) dto: SéanceCréerDto,
  ): Promise<SéanceSortie> {
    return this.sessions.create(user.id, chevalId, dto);
  }

  /** Liste les séances d'un cheval du compte courant (404 si cheval étranger). */
  @Get('horses/:id/sessions')
  listForHorse(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) chevalId: string,
  ): Promise<SéanceSortie[]> {
    return this.sessions.listForHorse(user.id, chevalId);
  }

  /**
   * **Historique paginé** des séances passées d'un cheval du compte courant
   * (lot 3.4, UI/UX §6.4) — récent → ancien, curseur `before` + `limit`. Sert
   * l'**onglet Historique** (surface app sans module dédié : la composition est
   * côté app). Distinct de `GET …/sessions` (liste brute non paginée de 2.2,
   * inchangée). Query validée par `historiqueQuerySchema` ; 404 si cheval étranger.
   */
  @Get('horses/:id/sessions/history')
  listHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) chevalId: string,
    @Query(new ZodValidationPipe(historiqueQuerySchema)) query: HistoriqueQuery,
  ): Promise<PageHistorique> {
    return this.sessions.listHistory(user.id, chevalId, query);
  }

  /** Détail d'une séance du compte courant (404 sinon, sans fuite d'existence). */
  @Get('sessions/:id')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) seanceId: string,
  ): Promise<SéanceSortie> {
    return this.sessions.findOne(user.id, seanceId);
  }

  /**
   * Édite une séance du compte courant (lot 2.4, Spec §3.7) : remplace son contenu
   * mutable (type, collection, contexte), **pose `date_modification`** et garde
   * `date`/`provenance` immuables. 404 si la séance est étrangère au compte.
   */
  @Patch('sessions/:id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) seanceId: string,
    @Body(new ZodValidationPipe(séanceModifierSchema)) dto: SéanceModifierDto,
  ): Promise<SéanceSortie> {
    return this.sessions.update(user.id, seanceId, dto);
  }

  /**
   * Supprime une séance du compte courant (lot 2.4, Spec §3.7) — purge cascade de
   * ses unités atomiques (0.3). 204 au succès, 404 si étrangère au compte.
   */
  @Delete('sessions/:id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) seanceId: string,
  ): Promise<void> {
    return this.sessions.remove(user.id, seanceId);
  }
}
