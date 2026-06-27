import { type SéanceCréerDto, type SéanceSortie, séanceCréerSchema } from '@hpt/shared';
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
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
 * **Chemin minimal** volontaire (DoD 2.2) : création + lecture brute suffisantes
 * pour prouver la persistance. L'UX de saisie rapide (presets, sliders, compteurs
 * « tap », duplication, aperçu des taux) est le **lot 2.3** ; le feed riche le
 * **3.1** ; l'édition/suppression le **2.4**.
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

  /** Détail d'une séance du compte courant (404 sinon, sans fuite d'existence). */
  @Get('sessions/:id')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) seanceId: string,
  ): Promise<SéanceSortie> {
    return this.sessions.findOne(user.id, seanceId);
  }
}
